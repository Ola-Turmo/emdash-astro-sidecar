import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();

function formatCommand(args) {
  return ['pnpm', 'exec', 'wrangler', ...args].join(' ');
}

function executeWrangler(args, options = {}) {
  const result = spawnSync(
    process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'pnpm',
    process.platform === 'win32' ? ['/c', 'pnpm', 'exec', 'wrangler', ...args] : ['exec', 'wrangler', ...args],
    {
      cwd: options.cwd || repoRoot,
      env: options.env || process.env,
      input: options.input,
      encoding: options.encoding || 'utf8',
      stdio: options.stdio || 'pipe',
    },
  );

  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout,
    stderr,
    command: formatCommand(args),
  };
}

function stripInvalidTokenEnv(env) {
  if (!env.CLOUDFLARE_API_TOKEN) {
    return env;
  }

  const next = { ...env };
  delete next.CLOUDFLARE_API_TOKEN;
  return next;
}

function looksLikeEnvTokenOverrideFailure(output) {
  const text = `${output.stdout}\n${output.stderr}`.toLowerCase();
  return (
    text.includes('authentication error') ||
    text.includes('invalid api token') ||
    text.includes('failed to fetch auth token') ||
    text.includes('in a non-interactive environment') ||
    text.includes('bad request')
  );
}

export function runWrangler(args, options = {}) {
  const primary = executeWrangler(args, options);
  if (primary.ok) {
    if (options.stdio === 'inherit') {
      return { mode: process.env.CLOUDFLARE_API_TOKEN ? 'env-token-or-oauth' : 'oauth', ...primary };
    }
    return { mode: process.env.CLOUDFLARE_API_TOKEN ? 'env-token-or-oauth' : 'oauth', ...primary };
  }

  if (!process.env.CLOUDFLARE_API_TOKEN) {
    const error = new Error(primary.stderr || primary.stdout || `Wrangler command failed: ${primary.command}`);
    error.result = primary;
    throw error;
  }

  const fallback = executeWrangler(args, {
    ...options,
    env: stripInvalidTokenEnv(options.env || process.env),
  });

  if (fallback.ok) {
    if (options.stdio === 'inherit') {
      console.warn(
        '[cloudflare-auth] Ignored failing CLOUDFLARE_API_TOKEN and used local Wrangler OAuth session instead.',
      );
    }
    return { mode: 'oauth-after-invalid-env-token', ...fallback };
  }

  const chosen = looksLikeEnvTokenOverrideFailure(primary) ? primary : fallback;
  const error = new Error(chosen.stderr || chosen.stdout || `Wrangler command failed: ${chosen.command}`);
  error.primary = primary;
  error.fallback = fallback;
  throw error;
}

export function detectCloudflareAuth(options = {}) {
  const checks = [];
  const whoami = runWrangler(['whoami'], {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  checks.push({
    name: 'whoami',
    ok: true,
    mode: whoami.mode,
  });

  let pages = null;
  if (options.requirePages) {
    pages = runWrangler(['pages', 'project', 'list'], {
      cwd: options.cwd,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    checks.push({
      name: 'pages-project-list',
      ok: true,
      mode: pages.mode,
    });
  }

  return {
    ok: true,
    using: pages?.mode || whoami.mode,
    checks,
    recommendation:
      pages?.mode === 'oauth-after-invalid-env-token' || whoami.mode === 'oauth-after-invalid-env-token'
        ? 'A bad CLOUDFLARE_API_TOKEN is overriding a valid local Wrangler OAuth session. Deploy scripts will ignore that env token automatically.'
        : 'Wrangler auth is healthy for the required command set.',
  };
}
