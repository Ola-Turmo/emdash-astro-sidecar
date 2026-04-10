const DEFAULTS = {
  theclawbay: {
    apiKeyEnv: 'THECLAWBAY_API_KEY',
    baseUrlEnv: 'THECLAWBAY_BASE_URL',
    modelEnv: 'THECLAWBAY_MODEL',
    baseUrl: 'https://api.theclawbay.com/v1',
    model: 'gpt-5.4-mini',
  },
  minimax: {
    apiKeyEnv: 'MINIMAX_API_KEY',
    baseUrlEnv: 'MINIMAX_BASE_URL',
    modelEnv: 'MINIMAX_MODEL',
    baseUrl: 'https://api.minimax.io/v1',
    model: 'MiniMax-M1',
  },
};

function parseArgs(argv) {
  const providers = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--provider') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --provider');
      }
      providers.push(value);
      index += 1;
    }
  }

  return {
    providers: providers.length ? providers : Object.keys(DEFAULTS),
  };
}

async function runHealthcheck(providerName) {
  const config = DEFAULTS[providerName];
  if (!config) {
    return {
      provider: providerName,
      ok: false,
      skipped: true,
      error: `Unknown provider "${providerName}"`,
    };
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    return {
      provider: providerName,
      ok: false,
      skipped: true,
      error: `Missing ${config.apiKeyEnv}`,
    };
  }

  const baseUrl = process.env[config.baseUrlEnv] || config.baseUrl;
  const model = process.env[config.modelEnv] || config.model;
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 16,
        messages: [
          {
            role: 'system',
            content: 'Reply with the single token OK.',
          },
          {
            role: 'user',
            content: 'Health check',
          },
        ],
      }),
    });

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        provider: providerName,
        ok: false,
        skipped: false,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        error: data?.error?.message || text || `HTTP ${response.status}`,
      };
    }

    const content = data?.choices?.[0]?.message?.content || '';
    return {
      provider: providerName,
      ok: true,
      skipped: false,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      model,
      content,
    };
  } catch (error) {
    return {
      provider: providerName,
      ok: false,
      skipped: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  const { providers } = parseArgs(process.argv.slice(2));
  const results = [];

  for (const provider of providers) {
    results.push(await runHealthcheck(provider));
  }

  console.log(JSON.stringify({ results }, null, 2));

  if (results.some((result) => result.ok === false && result.skipped === false)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
