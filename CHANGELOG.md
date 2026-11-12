# Changelog

## 2.1.0

### Added

- **Promise API**: `import { ids } from 'userid/promises'`, or `require('userid').promises` (like `fs/promises` and `fs.promises`). The same six functions, but each lookup runs on the libuv thread pool, so a slow user directory (LDAP, SSSD, NIS) no longer blocks the event loop. Results and errors are the same as the synchronous functions', but every error, including a bad argument or an unsupported platform, is a rejected promise. Lookups can't be cancelled; see the [README](README.md#promises).

## 2.0.0

### Added

- **Prebuilt binaries** inside the package for Linux (x64, arm64, armv7, ppc64le, s390x on glibc 2.28+; x64, arm64 on musl), macOS (arm64, x64), and FreeBSD (x64). The package has no install script, so nothing compiles on install, and pnpm and Bun need no build approval. Thanks to [@matthewh](https://github.com/matthewh), whose [#8](https://github.com/cinderblock/node-userid/pull/8) started the build matrix.
- **ES module entry point** (`import { ids } from 'userid'`) alongside CommonJS, and TypeScript types for both.
- **`isSupported`**: `false` on Windows.
- Errors carry a `code`: `ERR_USERID_NOT_FOUND` when a user or group doesn't exist, and Node-style codes (`EIO`, ...) with `errno` and `syscall` when the system lookup itself fails.
- Lookups are safe from several worker threads at once (reentrant `*_r` functions).

### Changed (breaking)

- **Node.js 22.12 or newer.**
- **No build from source on install.** Platforms without a prebuilt binary get an error with `code: 'ERR_USERID_NO_PREBUILT_BINARY'` on import; [build from source](README.md#building-from-source) from a git checkout instead.
- **Installs on Windows.** It used to refuse (`os: ["!win32"]`). Now every lookup throws an error with `code: 'ERR_USERID_UNSUPPORTED_PLATFORM'` there.
- **Ids are validated:** `username()` and `groupname()` throw a `RangeError` unless given an integer from 0 to 4294967295. Before, `-42` silently wrapped around to 4294967254.
- Names containing a null byte throw a `TypeError` (they used to be cut short at the null).
- `gids()` reports every gid unsigned. On macOS, groups like `nobody` used to come back negative (`-2`).
- `gids()` on an unknown user throws `username not found`, like `ids()` (it used to say `getpwnam`).
- `package.json` has an `exports` map: only `userid` and `userid/package.json` can be imported. Requiring files inside the package, like `userid/build/Release/userid.node`, no longer works. (The package no longer contains that file.)
- The raw native module's extra `uid` export (an alias of `ids`) is gone; the package's `uid()` is unchanged.

### Migrating from 1.x

Most code needs no change. Check for:

- Code that relied on `npm install` failing on Windows to skip `userid`: use `isSupported` instead.
- Installs on a platform that has no prebuilt binary (see the README): build from source, or ask for a prebuild.
- Code that passed negative or fractional ids to `username()`/`groupname()`.
- Code that matched `gids()` errors on the message `getpwnam`: match `code === 'ERR_USERID_NOT_FOUND'`.

## 1.3.0

The first release published since 1.2.5 (July 2021).
Versions 1.2.6 through 1.2.41 were tagged in git by an automatic dependency-update job, but its publish step never authenticated, so none of them reached npm.

### Fixed

- Build on FreeBSD and the other BSDs: `getgrouplist` needs `unistd.h` there ([#7](https://github.com/cinderblock/node-userid/pull/7), thanks [@guhaoyu2005](https://github.com/guhaoyu2005)).
- `gids()` no longer lists a gid twice. On FreeBSD and macOS, `getgrouplist` always adds the user's primary group and may list it again.

### Changed

- Published from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) through trusted publishing.
- Tested on Linux (x64 and arm64), macOS, and FreeBSD with Node.js 22, 24, and 26, including uids and gids above 2³¹.
