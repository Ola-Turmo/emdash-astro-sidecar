import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function parseArgs(argv) {
  const args = {
    limit: 3,
    apply: false,
    verify: false,
    audit: false,
    deploy: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--limit') {
      args.limit = Number(argv[index + 1] || '3');
      index += 1;
      continue;
    }
    if (token === '--apply') {
      args.apply = true;
      continue;
    }
    if (token === '--verify') {
      args.verify = true;
      continue;
    }
    if (token === '--audit') {
      args.audit = true;
      continue;
    }
    if (token.startsWith('--deploy=')) {
      args.deploy = token.replace('--deploy=', '');
      continue;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiUrl = process.env.CONTENT_API_URL;

  if (!apiUrl) {
    throw new Error('CONTENT_API_URL is required to materialize publication artifacts.');
  }

  const baseApiUrl = apiUrl.replace(/\/$/, '');
  const authHeaders = buildAuthHeaders();

  const response = await fetch(`${baseApiUrl}/publication-artifacts?limit=${args.limit}`, {
    headers: authHeaders,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch publication artifacts: ${response.status}`);
  }

  const payload = await response.json();
  const artifacts = payload.artifacts || [];

  if (!artifacts.length) {
    console.log('No pending publication artifacts.');
    return;
  }

  const manifestEntries = [];

  for (const artifact of artifacts) {
    const absolutePath = resolve(process.cwd(), artifact.suggestedPath);
    console.log(`${args.apply ? 'Materializing' : 'Would materialize'} ${artifact.slug} -> ${absolutePath}`);

    if (args.apply) {
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, artifact.mdx, 'utf8');

      const markResponse = await fetch(`${baseApiUrl}/publication-artifacts/materialized`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeadersObject(),
        },
        body: JSON.stringify({
          materializationId: artifact.materializationId,
          materializedPath: artifact.suggestedPath,
        }),
      });

      if (!markResponse.ok) {
        throw new Error(`Failed to mark artifact ${artifact.materializationId} as materialized.`);
      }
    }

    manifestEntries.push({
      materializationId: artifact.materializationId,
      artifactId: artifact.artifactId,
      slug: artifact.slug,
      suggestedPath: artifact.suggestedPath,
      url: artifact.url,
    });
  }

  const manifestPath = writeManifest({
    generatedAt: new Date().toISOString(),
    apply: args.apply,
    verify: args.verify,
    audit: args.audit,
    deploy: args.deploy,
    artifacts: manifestEntries,
  });

  console.log(`Wrote publication manifest to ${manifestPath}`);

  if (!args.apply) {
    return;
  }

  if (args.verify) {
    runNodeCommand(['pnpm', 'verify']);
  }

  if (args.deploy === 'preview') {
    runNodeCommand(['node', 'apps/blog/deploy.ts', '--preview', '--skip-emdash']);
  } else if (args.deploy === 'production') {
    runNodeCommand(['node', 'apps/blog/deploy.ts', '--prod', '--skip-emdash']);
  }

  if (args.audit && manifestEntries.length > 0) {
    const auditArgs = ['node', 'scripts/audit-deployed-urls.mjs'];
    for (const entry of manifestEntries) {
      if (entry.url) {
        auditArgs.push('--url', entry.url);
      }
    }
    runNodeCommand(auditArgs);
  }

  if (args.deploy) {
    for (const entry of manifestEntries) {
      const deployedResponse = await fetch(`${baseApiUrl}/publication-artifacts/deployed`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeadersObject(),
        },
        body: JSON.stringify({
          materializationId: entry.materializationId,
        }),
      });

      if (!deployedResponse.ok) {
        throw new Error(`Failed to mark artifact ${entry.materializationId} as deployed.`);
      }
    }
  }
}

function writeManifest(manifest) {
  const outputDir = resolve(process.cwd(), '.autonomous');
  mkdirSync(outputDir, { recursive: true });
  const filePath = resolve(outputDir, 'publication-manifest.json');
  writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
  return filePath;
}

function runNodeCommand(command) {
  const [tool, ...args] = command;
  const executable =
    process.platform === 'win32' && tool === 'pnpm'
      ? 'pnpm.cmd'
      : process.platform === 'win32' && tool === 'node'
        ? process.execPath
        : tool;
  const finalArgs =
    process.platform === 'win32' && tool === 'node'
      ? args
      : args;

  console.log(`Running: ${[tool, ...args].join(' ')}`);
  execFileSync(executable, finalArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
}

function buildAuthHeaders() {
  const headers = new Headers();
  if (process.env.CONTENT_API_TOKEN) {
    headers.set('authorization', `Bearer ${process.env.CONTENT_API_TOKEN}`);
  }
  return headers;
}

function authHeadersObject() {
  return process.env.CONTENT_API_TOKEN
    ? { authorization: `Bearer ${process.env.CONTENT_API_TOKEN}` }
    : {};
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
