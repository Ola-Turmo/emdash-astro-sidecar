import OpenAI from 'openai';

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
  apiKey?: string;
  apiKeyEnvVar?: string;
  defaultModel: string;
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

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly providerKind: ModelProviderKind = 'openai_compatible';
  private readonly client: OpenAI;
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
    const apiKey = this.resolveApiKey(config);
    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    });
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
    const completion = (await this.client.chat.completions.create({
      model: this.config.defaultModel,
      messages: buildMessages(request),
      stream: false,
      temperature: normalizeTemperature(request.temperature ?? this.config.defaultTemperature ?? 0.2),
      max_tokens: request.maxOutputTokens,
      ...(this.config.extraChatCompletionBody ?? {}),
    } as OpenAI.Chat.ChatCompletionCreateParams)) as OpenAI.Chat.ChatCompletion;

    const text = completion.choices
      .map((choice: OpenAI.Chat.Completions.ChatCompletion.Choice) => choice.message?.content ?? '')
      .join('\n')
      .trim();

    if (!text) {
      throw new Error(`Provider ${this.providerId} returned an empty text completion.`);
    }

    return {
      text,
      usage: normalizeUsage(completion.usage),
      raw: {
        providerId: this.providerId,
        baseURL: this.config.baseURL,
        model: this.config.defaultModel,
        id: completion.id,
      },
    };
  }

  async generateStructured<TSchema>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<GenerationResult> {
    const schemaInstructions = [
      'Return only valid JSON.',
      `Schema name: ${request.schemaName}.`,
      `JSON schema: ${JSON.stringify(request.schema)}.`,
    ].join('\n');

    return this.generateText({
      ...request,
      system: [request.system, schemaInstructions].filter(Boolean).join('\n\n'),
    });
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

  private resolveApiKey(config: OpenAICompatibleConfig): string {
    if (config.apiKey) return config.apiKey;
    if (config.apiKeyEnvVar && process.env[config.apiKeyEnvVar]) {
      return process.env[config.apiKeyEnvVar] as string;
    }

    const hint = config.apiKeyEnvVar
      ? `or environment variable ${config.apiKeyEnvVar}`
      : 'or a configured environment variable';
    throw new Error(`Missing API key for provider ${config.providerId}. Provide apiKey ${hint}.`);
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
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'source_summary_generation',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'article_outline_generation',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'article_draft_generation',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'title_meta_excerpt_generation',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'internal_link_suggestions',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'faq_block_generation',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'refresh_existing_article',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'publish_decision_reasoning',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
  },
  {
    taskType: 'binary_eval',
    preferredProviderId: 'theclawbay',
    preferredModelId: 'gpt-5.4-mini',
    fallbackProviderId: 'minimax',
    fallbackModelId: 'MiniMax-M1',
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

export async function buildDefaultProviderRegistry(
  env: ProviderEnvironment = process.env,
): Promise<ProviderRegistry> {
  const registry = new ProviderRegistry();
  const adapters = [
    createTheClawBayAdapter(env),
    createMiniMaxAdapter(env),
  ].filter((adapter): adapter is OpenAICompatibleAdapter => Boolean(adapter));

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
  env: ProviderEnvironment = process.env,
): OpenAICompatibleAdapter | null {
  const apiKey = env.THECLAWBAY_API_KEY;
  if (!apiKey) return null;

  return new OpenAICompatibleAdapter('theclawbay', {
    providerId: 'theclawbay',
    apiKey,
    baseURL: env.THECLAWBAY_BASE_URL ?? 'https://api.theclawbay.com/v1',
    defaultModel: env.THECLAWBAY_MODEL ?? 'gpt-5.4-mini',
    defaultTemperature: 0.2,
  });
}

export function createMiniMaxAdapter(
  env: ProviderEnvironment = process.env,
): OpenAICompatibleAdapter | null {
  const apiKey = env.MINIMAX_API_KEY;
  if (!apiKey) return null;

  return new OpenAICompatibleAdapter('minimax', {
    providerId: 'minimax',
    apiKey,
    baseURL: env.MINIMAX_BASE_URL ?? 'https://api.minimax.io/v1',
    defaultModel: env.MINIMAX_MODEL ?? 'MiniMax-M1',
    defaultTemperature: 0.2,
  });
}

function buildMessages(request: GenerationRequest): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

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

function normalizeTemperature(value: number): number {
  if (Number.isNaN(value)) return 0.2;
  if (value <= 0) return 0.1;
  if (value > 1) return 1;
  return value;
}

function normalizeUsage(
  usage:
    | OpenAI.Completions.CompletionUsage
    | OpenAI.Responses.ResponseUsage
    | undefined,
): UsageRecord | undefined {
  if (!usage) return undefined;

  if ('input_tokens' in usage || 'output_tokens' in usage) {
    const responseUsage = usage as OpenAI.Responses.ResponseUsage;
    return {
      inputTokens: responseUsage.input_tokens,
      outputTokens: responseUsage.output_tokens,
      totalTokens: responseUsage.total_tokens,
    };
  }

  const completionUsage = usage as OpenAI.Completions.CompletionUsage;
  return {
    inputTokens: completionUsage.prompt_tokens,
    outputTokens: completionUsage.completion_tokens,
    totalTokens: completionUsage.total_tokens,
  };
}

function normalizeProviderError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown provider error';
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
    'Generate concise FAQs that reflect real user questions and preserve factual caution.',
  refresh_existing_article:
    'Refresh an existing article while preserving working structure, improving clarity, and avoiding low-value rewrite churn.',
  source_summary_generation:
    'Summarize source material conservatively. Distinguish sourced facts from inferences.',
  publish_decision_reasoning:
    'Explain whether a draft should publish based on policy, evidence, duplication risk, and reader value.',
  binary_eval:
    'Judge the content against binary pass/fail criteria and explain each failure in concrete terms.',
};
