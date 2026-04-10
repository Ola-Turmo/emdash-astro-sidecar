import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const registryPath = resolve(repoRoot, 'docs', 'autonomous-worker-registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

function parseArgs(argv) {
  return {
    kind: argv.find((arg) => arg.startsWith('--kind='))?.replace('--kind=', ''),
  };
}

function run(command, args) {
  console.log(`Running: ${[command, ...args].join(' ')}`);
  if (process.platform === 'win32') {
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/c', command, ...args], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    return;
  }

  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const workers = registry.workers.filter((worker) => !options.kind || worker.kind === options.kind);

  for (const worker of workers) {
    run(process.platform === 'win32' ? 'pnpm' : 'pnpm', [
      'exec',
      'wrangler',
      'deploy',
      '--config',
      worker.wranglerConfig,
    ]);
  }
}

main();
