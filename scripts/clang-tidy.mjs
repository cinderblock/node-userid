// Run clang-tidy on the native sources with the include paths node-gyp builds with.
// Needs a configured build (`bun run build:native`) for the Node.js headers.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

if (platform() === 'win32') {
  console.log('clang-tidy: skipped on Windows (the sources use POSIX headers)');
  process.exit(0);
}

// node-gyp keeps the Node.js headers it built against in its cache
const version = process.version.slice(1);
const cache =
  process.env.npm_config_devdir ?? join(homedir(), platform() === 'darwin' ? 'Library/Caches' : '.cache', 'node-gyp');
const nodeHeaders = join(cache, version, 'include', 'node');

if (!existsSync(nodeHeaders)) {
  console.error(`clang-tidy: missing Node.js headers at ${nodeHeaders}. Run \`bun run build:native\` first.`);
  process.exit(1);
}

const args = [
  '--quiet',
  'src/userid.cc',
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
