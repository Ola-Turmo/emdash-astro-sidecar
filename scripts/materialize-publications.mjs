import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function parseArgs(argv) {
  const args = {
    limit: 3,
    apply: false,
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

  const headers = new Headers();
  if (process.env.CONTENT_API_TOKEN) {
    headers.set('authorization', `Bearer ${process.env.CONTENT_API_TOKEN}`);
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/publication-artifacts?limit=${args.limit}`, {
    headers,
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

  for (const artifact of artifacts) {
    const absolutePath = resolve(process.cwd(), artifact.suggestedPath);
    console.log(`${args.apply ? 'Materializing' : 'Would materialize'} ${artifact.slug} -> ${absolutePath}`);

    if (!args.apply) continue;

    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, artifact.mdx, 'utf8');

    const markResponse = await fetch(`${apiUrl.replace(/\/$/, '')}/publication-artifacts/materialized`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.CONTENT_API_TOKEN
          ? { authorization: `Bearer ${process.env.CONTENT_API_TOKEN}` }
          : {}),
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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
