#!/usr/bin/env node

import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const separatorIndex = args.indexOf('--');

if (separatorIndex === -1) {
  throw new Error('Usage: node scripts/run-concept-command.mjs --site <site> --concept <concept> -- <command...>');
}

const optionArgs = args.slice(0, separatorIndex);
const commandArgs = args.slice(separatorIndex + 1);

if (!commandArgs.length) {
  throw new Error('Missing command to execute after --');
}

const options = parseOptions(optionArgs);
if (!options.site || !options.concept) {
  throw new Error('Both --site and --concept are required');
}

const [command, ...commandRest] = commandArgs;
const env = {
  ...process.env,
  EMDASH_SITE_KEY: options.site,
  EMDASH_CONCEPT_KEY: options.concept,
};
const child = spawnCommand(command, commandRest, env);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

function spawnCommand(command, args, env) {
  if (process.platform !== 'win32') {
    return spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
      env,
    });
  }

  const commandLine = [command, ...args].map(quoteForCmd).join(' ');
  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env,
  });
}

function quoteForCmd(value) {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function parseOptions(optionArgs) {
  const result = {
    site: '',
    concept: '',
  };

  for (let index = 0; index < optionArgs.length; index += 1) {
    const arg = optionArgs[index];
    if (arg === '--site' && optionArgs[index + 1]) {
      result.site = optionArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--site=')) {
      result.site = arg.slice('--site='.length);
      continue;
    }
    if (arg === '--concept' && optionArgs[index + 1]) {
      result.concept = optionArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--concept=')) {
      result.concept = arg.slice('--concept='.length);
    }
  }

  return result;
}
