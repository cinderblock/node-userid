// npm `install` script: make sure a native binary is available.
//
// Usually there's nothing to do: a prebuilt binary for this platform ships in `prebuilds/`.
// Otherwise `node-gyp-build` compiles one from source with node-gyp.
// Windows has no POSIX user database, so there is nothing to build there; the package still installs.

const { spawnSync } = require('node:child_process');

if (process.platform === 'win32') process.exit(0);

const result = spawnSync(process.execPath, [require.resolve('node-gyp-build/bin.js')], { stdio: 'inherit' });

process.exit(result.status ?? 1);
