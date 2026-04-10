export type ModelProviderKind =
  | 'openai_compatible'
  | 'minimax_native'
  | 'gemini_native'
  | 'anthropic_native'
  | 'cloudflare_ai_gateway';

export interface ModelCapabilities {
  jsonMode: boolean;
  toolCalling: boolean;
  reasoning: boolean;
  streaming: boolean;
}

export interface ModelDescriptor {
  providerId: string;
  providerKind: ModelProviderKind;
  modelId: string;
  label: string;
  costTier: 'low' | 'medium' | 'high';
  maxContext?: number;
  capabilities: ModelCapabilities;
}

export interface UsageRecord {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

export interface GenerationRequest {
  system?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: Record<string, string>;
}

export interface GenerationResult {
  text: string;
  usage?: UsageRecord;
  raw?: unknown;
}

export interface StructuredGenerationRequest<TSchema> extends GenerationRequest {
  schemaName: string;
  schema: TSchema;
}

export interface AgentStepRequest extends GenerationRequest {
  taskType:
    | 'topic_brief_generation'
    | 'article_outline_generation'
    | 'article_draft_generation'
    | 'title_meta_excerpt_generation'
    | 'internal_link_suggestions'
    | 'faq_block_generation'
    | 'refresh_existing_article'
    | 'source_summary_generation'
    | 'publish_decision_reasoning'
    | 'binary_eval';
}

export interface ProviderAdapter {
  readonly providerId: string;
  readonly providerKind: ModelProviderKind;

  listModels(): Promise<ModelDescriptor[]>;
  generateText(request: GenerationRequest): Promise<GenerationResult>;
  generateStructured<TSchema>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<GenerationResult>;
  runAgentStep(request: AgentStepRequest): Promise<GenerationResult>;
  estimateCost(request: GenerationRequest): number | undefined;
}

export interface ProviderRegistryEntry {
  descriptor: ModelDescriptor;
  adapter: ProviderAdapter;
}

export class ProviderRegistry {
  private readonly entries = new Map<string, ProviderRegistryEntry>();

  register(entry: ProviderRegistryEntry): void {
    this.entries.set(this.key(entry.descriptor.providerId, entry.descriptor.modelId), entry);
  }

  get(providerId: string, modelId: string): ProviderRegistryEntry | undefined {
    return this.entries.get(this.key(providerId, modelId));
  }

  list(): ProviderRegistryEntry[] {
    return [...this.entries.values()];
  }

  private key(providerId: string, modelId: string): string {
    return `${providerId}::${modelId}`;
  }
}

export interface OpenAICompatibleConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  defaultHeaders?: Record<string, string>;
  defaultTemperature?: number;
  modelCatalog?: Array<{
    modelId: string;
    label?: string;
    costTier?: ModelDescriptor['costTier'];
    capabilities?: Partial<ModelCapabilities>;
  }>;
  extraChatCompletionBody?: Record<string, unknown>;
}

export interface ProviderEnvironment {
  [key: string]: string | undefined;
}

export interface ProviderHealthResult {
  providerId: string;
  modelId: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface OpenAICompatibleResponse {
  id?: string;
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly providerKind: ModelProviderKind = 'openai_compatible';
  private readonly defaultCapabilities: ModelCapabilities = {
    jsonMode: true,
    toolCalling: true,
    reasoning: true,
    streaming: true,
  };

  constructor(
    public readonly providerId: string,
    private readonly config: OpenAICompatibleConfig,
  ) {
    this.config.apiKey = this.config.apiKey.trim();
  }

  async listModels(): Promise<ModelDescriptor[]> {
    const catalog = this.config.modelCatalog;
    if (!catalog?.length) {
      return [this.createModelDescriptor(this.config.defaultModel)];
    }

    return catalog.map((entry) =>
      this.createModelDescriptor(entry.modelId, {
        label: entry.label,
        costTier: entry.costTier,
        capabilities: entry.capabilities,
      }),
    );
  }

  async generateText(request: GenerationRequest): Promise<GenerationResult> {
    return this.requestChatCompletion(request);
  }

  async generateStructured<TSchema>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<GenerationResult> {
    const schemaInstructions = [
      'Return only valid JSON.',
      `Schema name: ${request.schemaName}.`,
      `JSON schema: ${JSON.stringify(request.schema)}.`,
    ].join('\n');

    return this.requestChatCompletion(
      {
        ...request,
        system: [request.system, schemaInstructions].filter(Boolean).join('\n\n'),
      },
      {
        response_format: {
          type: 'json_object',
        },
      },
    );
  }

  async runAgentStep(request: AgentStepRequest): Promise<GenerationResult> {
    const taskInstructions = taskInstructionsByType[request.taskType];
    return this.generateText({
      ...request,
      system: [request.system, taskInstructions].filter(Boolean).join('\n\n'),
    });
  }

  estimateCost(_request: GenerationRequest): number | undefined {
    return undefined;
  }

  private async requestChatCompletion(
    request: GenerationRequest,
    extraBody?: Record<string, unknown>,
  ): Promise<GenerationResult> {
    const reasoningEffort = this.config.reasoningEffort;
    const payload: Record<string, unknown> = {
      model: this.config.defaultModel,
      messages: buildMessages(request),
      stream: false,
      max_tokens: request.maxOutputTokens,
      ...(this.config.extraChatCompletionBody ?? {}),
      ...(extraBody ?? {}),
    };
    if (reasoningEffort) {
      payload.reasoning_effort = reasoningEffort;
    } else {
      payload.temperature = normalizeTemperature(
        request.temperature ?? this.config.defaultTemperature ?? 0.2,
      );
    }

    const response = await fetch(joinUrl(this.config.baseURL, '/chat/completions'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.defaultHeaders ?? {}),
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    const json = parseJsonSafely<OpenAICompatibleResponse>(rawText);

    if (!response.ok) {
      const providerMessage =
        json?.error?.message || truncateText(rawText, 400) || `HTTP ${response.status}`;
      throw new Error(
        `Provider ${this.providerId} failed with ${response.status}: ${providerMessage}`,
      );
    }

    const text = extractCompletionText(json ?? undefined).trim();
    if (!text) {
      throw new Error(`Provider ${this.providerId} returned an empty text completion.`);
    }

    return {
      text,
      usage: normalizeUsage(json?.usage ?? undefined),
      raw: {
        providerId: this.providerId,
        baseURL: this.config.baseURL,
        model: this.config.defaultModel,
        id: json?.id,
      },
    };
  }

  private createModelDescriptor(
    modelId: string,
    overrides: {
      label?: string;
      costTier?: ModelDescriptor['costTier'];
      capabilities?: Partial<ModelCapabilities>;
    } = {},
  ): ModelDescriptor {
    return {
      providerId: this.providerId,
      providerKind: this.providerKind,
      modelId,
      label: overrides.label ?? `${this.providerId} / ${modelId}`,
      costTier: overrides.costTier ?? 'medium',
      capabilities: {
        ...this.defaultCapabilities,
        ...overrides.capabilities,
      },
    };
  }
}

export interface ProviderRoutingRule {
  taskType: AgentStepRequest['taskType'];
  preferredProviderId: string;
  preferredModelId: string;
  fallbackProviderId?: string;
  fallbackModelId?: string;
}

export function selectProvider(
  registry: ProviderRegistry,
  rule: ProviderRoutingRule,
): ProviderRegistryEntry {
  const preferred = registry.get(rule.preferredProviderId, rule.preferredModelId);
  if (preferred) return preferred;

  if (rule.fallbackProviderId && rule.fallbackModelId) {
    const fallback = registry.get(rule.fallbackProviderId, rule.fallbackModelId);
    if (fallback) return fallback;
  }

  throw new Error(
    `No provider available for task ${rule.taskType} using ${rule.preferredProviderId}/${rule.preferredModelId}`,
  );
}

export const defaultProviderRoutingRules: ProviderRoutingRule[] = [
  {
    taskType: 'topic_brief_generation',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'source_summary_generation',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'article_outline_generation',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'article_draft_generation',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'title_meta_excerpt_generation',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'internal_link_suggestions',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'faq_block_generation',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'refresh_existing_article',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'publish_decision_reasoning',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
  {
    taskType: 'binary_eval',
    preferredProviderId: 'minimax',
    preferredModelId: 'MiniMax-M2.7',
    fallbackProviderId: 'theclawbay',
    fallbackModelId: 'gpt-5.4',
  },
];

export function resolveRoutingRule(
  taskType: AgentStepRequest['taskType'],
  rules: ProviderRoutingRule[] = defaultProviderRoutingRules,
): ProviderRoutingRule {
  const rule = rules.find((candidate) => candidate.taskType === taskType);
  if (!rule) {
    throw new Error(`No provider routing rule configured for task type ${taskType}.`);
  }
  return rule;
}

export function resolveRoutingRuleFromEnvironment(
  env: ProviderEnvironment,
  taskType: AgentStepRequest['taskType'],
  rules: ProviderRoutingRule[] = defaultProviderRoutingRules,
): ProviderRoutingRule {
  const base = resolveRoutingRule(taskType, rules);
  return {
    ...base,
    preferredProviderId: env.AUTONOMOUS_PROVIDER_ID ?? base.preferredProviderId,
    preferredModelId: env.AUTONOMOUS_MODEL_ID ?? base.preferredModelId,
    fallbackProviderId: env.AUTONOMOUS_FALLBACK_PROVIDER_ID ?? base.fallbackProviderId,
    fallbackModelId: env.AUTONOMOUS_FALLBACK_MODEL_ID ?? base.fallbackModelId,
  };
}

export async function buildDefaultProviderRegistry(
  env: ProviderEnvironment = getDefaultProviderEnvironment(),
): Promise<ProviderRegistry> {
  const registry = new ProviderRegistry();
  const adapters = [createTheClawBayAdapter(env), createGeminiAdapter(env), createMiniMaxAdapter(env)].filter(
    (adapter): adapter is OpenAICompatibleAdapter => Boolean(adapter),
  );

  for (const adapter of adapters) {
    for (const descriptor of await adapter.listModels()) {
      registry.register({
        descriptor,
        adapter,
      });
    }
  }

  return registry;
}

export async function checkProviderHealth(
  adapter: ProviderAdapter,
  prompt = 'Reply with the single token OK.',
): Promise<ProviderHealthResult> {
  const models = await adapter.listModels();
  const model = models[0];
  const startedAt = Date.now();

  try {
    await adapter.generateText({
      prompt,
      temperature: 0.1,
      maxOutputTokens: 16,
    });

    return {
      providerId: adapter.providerId,
      modelId: model?.modelId ?? 'unknown',
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      providerId: adapter.providerId,
      modelId: model?.modelId ?? 'unknown',
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: normalizeProviderError(error),
    };
  }
}

export function createTheClawBayAdapter(
  env: ProviderEnvironment = getDefaultProviderEnvironment(),
): OpenAICompatibleAdapter | null {
  const apiKey = env.THECLAWBAY_API_KEY;
  if (!apiKey) return null;

  return new OpenAICompatibleAdapter('theclawbay', {
    providerId: 'theclawbay',
    apiKey,
    baseURL: env.THECLAWBAY_BASE_URL ?? 'https://api.theclawbay.com/v1',
    defaultModel: env.THECLAWBAY_MODEL ?? 'gpt-5.4',
    reasoningEffort:
      env.THECLAWBAY_REASONING_EFFORT === 'low' ||
      env.THECLAWBAY_REASONING_EFFORT === 'medium' ||
      env.THECLAWBAY_REASONING_EFFORT === 'high'
        ? env.THECLAWBAY_REASONING_EFFORT
        : 'high',
    defaultTemperature: 0.2,
  });
}

export function createMiniMaxAdapter(
  env: ProviderEnvironment = getDefaultProviderEnvironment(),
): OpenAICompatibleAdapter | null {
  const apiKey = env.MINIMAX_API_KEY;
  if (!apiKey) return null;

  return new OpenAICompatibleAdapter('minimax', {
    providerId: 'minimax',
    apiKey,
    baseURL: env.MINIMAX_BASE_URL ?? 'https://api.minimax.io/v1',
    defaultModel: env.MINIMAX_MODEL ?? 'MiniMax-M2.7',
    defaultTemperature: 0.2,
  });
}

export function createGeminiAdapter(
  env: ProviderEnvironment = getDefaultProviderEnvironment(),
): OpenAICompatibleAdapter | null {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  return new OpenAICompatibleAdapter('gemini', {
    providerId: 'gemini',
    apiKey,
    baseURL: env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    defaultTemperature: 0.2,
  });
}

export function parseJsonResponse<T>(value: string): T {
  const normalized = stripMarkdownCodeFences(value);
  const objectMatch = normalized.match(/\{[\s\S]*\}$/);
  const jsonCandidate = objectMatch ? objectMatch[0] : normalized;
  return JSON.parse(jsonCandidate) as T;
}

function getDefaultProviderEnvironment(): ProviderEnvironment {
  const processEnv = (globalThis as { process?: { env?: ProviderEnvironment } }).process?.env;
  if (processEnv) {
    return processEnv;
  }

  return {};
}

function buildMessages(
  request: GenerationRequest,
): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const messages: Array<{
    role: 'system' | 'user';
    content: string;
  }> = [];

  if (request.system) {
    messages.push({
      role: 'system',
      content: request.system,
    });
  }

  messages.push({
    role: 'user',
    content: request.prompt,
  });

  return messages;
}

function joinUrl(baseURL: string, pathname: string): string {
  return `${baseURL.replace(/\/+$/, '')}${pathname}`;
}

function normalizeTemperature(value: number): number {
  if (Number.isNaN(value)) return 0.2;
  if (value <= 0) return 0.1;
  if (value > 1) return 1;
  return value;
}

function extractCompletionText(payload: OpenAICompatibleResponse | undefined): string {
  if (!payload?.choices?.length) return '';

  return payload.choices
    .map((choice) => {
      const content = choice.message?.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content
          .map((part) => (part.type === 'text' || !part.type ? part.text ?? '' : ''))
          .join('');
      }
      return '';
    })
    .join('\n')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function normalizeUsage(
  usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      }
    | undefined,
): UsageRecord | undefined {
  if (!usage) return undefined;

  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens,
    outputTokens: usage.output_tokens ?? usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function normalizeProviderError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown provider error';
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function stripMarkdownCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

const taskInstructionsByType: Record<AgentStepRequest['taskType'], string> = {
  topic_brief_generation:
    'Generate a concise topic brief for a first-party content system. Focus on user intent, evidentiary stability, and topical fit.',
  article_outline_generation:
    'Produce an article outline that is specific, reader-first, and aligned with a mounted sidecar under a host site.',
  article_draft_generation:
    'Write a clear article draft for end users. Avoid internal SEO or GEO jargon in visible copy.',
  title_meta_excerpt_generation:
    'Generate a page title, meta description, and excerpt that are specific, natural, and reader-first.',
  internal_link_suggestions:
    'Suggest relevant internal links that help readers navigate to adjacent useful pages or commercial next steps.',
  faq_block_generation:
    'Generate concise FAQ entries that answer common user questions clearly and conservatively.',
  refresh_existing_article:
    'Refresh an existing article with better structure, clarity, and evidence while preserving reader trust.',
  source_summary_generation:
    'Summarize source material conservatively. Separate stable facts from inference.',
  publish_decision_reasoning:
    'Explain whether a draft should publish under a conservative first-party quality bar. Prefer not publishing over weak publishing.',
  binary_eval:
    'Judge the candidate against explicit binary criteria and explain any failure in concrete, reader-first terms.',
};

export * from './autonomous-content.js';
