#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJsonPath = new URL('../package.json', import.meta.url);

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
const version = packageJson.version;

const buildEnv = {
  ...process.env,
  APP_VERSION: version,
  VITE_APP_VERSION: version
};

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: buildEnv
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

console.log(`Deploying version ${version}…`);
run('docker', ['compose', 'build']);
run('docker', ['compose', 'up', '-d']);
console.log(`Deployment complete. Active version: ${version}`);
