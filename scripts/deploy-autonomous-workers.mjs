import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectCloudflareAuth, runWrangler } from './cloudflare-auth.mjs';

const repoRoot = process.cwd();
const registryPath = resolve(repoRoot, 'docs', 'autonomous-worker-registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

function parseArgs(argv) {
  return {
    kind: argv.find((arg) => arg.startsWith('--kind='))?.replace('--kind=', ''),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const workers = registry.workers.filter((worker) => !options.kind || worker.kind === options.kind);
  const authState = detectCloudflareAuth({
    requirePages: workers.some((worker) => worker.kind === 'route'),
  });

  console.log(`[cloudflare-auth] ${authState.recommendation}`);

  for (const worker of workers) {
    console.log(`Running: pnpm exec wrangler deploy --config ${worker.wranglerConfig}`);
    runWrangler(['deploy', '--config', worker.wranglerConfig], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  }
}

main();
