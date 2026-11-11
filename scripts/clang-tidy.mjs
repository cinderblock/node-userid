// Run clang-tidy on the native sources with the include paths node-gyp builds with.
// Needs one native build first (`bun run build:native`), which downloads the Node.js headers.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, platform, tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

if (platform() === 'win32') {
  console.log('clang-tidy: skipped on Windows (the sources use POSIX headers)');
  process.exit(0);
}

// The Node.js headers the native build downloaded. prebuildify keeps its own copy, for a Node.js version it picks;
// plain node-gyp uses its cache. Any version will do: only the Node-API headers are used, and those are stable.
const caches = [
  join(tmpdir(), 'prebuildify', 'node'),
  process.env.npm_config_devdir,
  join(homedir(), platform() === 'darwin' ? 'Library/Caches' : '.cache', 'node-gyp'),
].filter(Boolean);

const nodeHeaders = caches
  .flatMap(cache =>
    existsSync(cache) ? readdirSync(cache).map(version => join(cache, version, 'include', 'node')) : [],
  )
  .find(dir => existsSync(join(dir, 'node_api.h')));

if (!nodeHeaders) {
  console.error(`clang-tidy: no Node.js headers found in:\n  ${caches.join('\n  ')}`);
  console.error('Run `bun run build:native` first.');
  process.exit(1);
}

const args = [
  '--quiet',
  'native/userid.cc',
  '--',
  '-std=c++17',
  '-DNAPI_VERSION=8',
  '-DNAPI_CPP_EXCEPTIONS',
  `-isystem${require('node-addon-api').include_dir}`,
  `-isystem${nodeHeaders}`,
];

const result = spawnSync('clang-tidy', args, { stdio: 'inherit' });

if (result.error?.code === 'ENOENT') {
  console.error('clang-tidy: not found on PATH. Install LLVM (apt install clang-tidy, brew install llvm).');
  process.exit(1);
}

process.exit(result.status ?? 1);
