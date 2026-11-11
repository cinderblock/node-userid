# userid

Look up user and group ids and names in Node.js, straight from the system's user database.
Native bindings to the POSIX functions (`getpwnam_r`, `getgrgid_r`, `getgrouplist`, ...), not child processes, so it sees the same users as `id` and `getent`, including NSS sources like LDAP and SSSD.

[![CI](https://github.com/cinderblock/node-userid/actions/workflows/ci.yml/badge.svg)](https://github.com/cinderblock/node-userid/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/userid)](https://www.npmjs.com/package/userid)

## Installation

```bash
npm install userid
# or
bun add userid
pnpm add userid
```

Prebuilt binaries ship inside the package. There is no install script: nothing compiles, and pnpm and Bun need no build approval.

| Platform                                                                   | Architectures                     |
| -------------------------------------------------------------------------- | --------------------------------- |
| Linux (glibc 2.28+, like Node.js 22: RHEL 8, Debian 10, Ubuntu 20.04, ...) | x64, arm64, armv7, ppc64le, s390x |
| Linux (musl: Alpine)                                                       | x64, arm64                        |
| macOS 11+                                                                  | arm64, x64                        |
| FreeBSD                                                                    | x64                               |

On any other platform, importing `userid` throws an error with `code: 'ERR_USERID_NO_PREBUILT_BINARY'`.
[Open an issue](https://github.com/cinderblock/node-userid/issues) to ask for a prebuilt binary, or [build from source](#building-from-source).

Requires Node.js 22.12 or newer. The binary uses [Node-API](https://nodejs.org/api/n-api.html), so it keeps working on new Node.js versions without a rebuild. It also loads in Bun.

### Windows

Windows has no POSIX user database. The package installs anyway (so cross-platform projects can depend on it), `isSupported` is `false`, and every lookup throws an error with `code: 'ERR_USERID_UNSUPPORTED_PLATFORM'`.

## Usage

```js
import { ids, uid, gid, gids, username, groupname, isSupported } from 'userid';
// or: const userid = require('userid');

ids('root'); // { uid: 0, gid: 0 }
uid('root'); // 0
gid('wheel'); // 0 on macOS and BSDs (on most Linux distributions, group 0 is 'root')
gids('root'); // e.g. [0, 1, 2]: every group the user is in, primary group included
username(0); // 'root'
groupname(0); // 'root' on Linux, 'wheel' on macOS and BSDs
```

| Function         | Returns                                   | Not found             |
| ---------------- | ----------------------------------------- | --------------------- |
| `ids(username)`  | `{ uid, gid }` (gid is the primary group) | `username not found`  |
| `uid(username)`  | uid                                       | `username not found`  |
| `gid(groupname)` | gid                                       | `groupname not found` |
| `gids(username)` | array of gids, no duplicates              | `username not found`  |
| `username(uid)`  | user name                                 | `uid not found`       |
| `groupname(gid)` | group name                                | `gid not found`       |
| `isSupported`    | `false` on Windows, else `true`           |                       |

Errors:

- Not found: `Error` with `code: 'ERR_USERID_NOT_FOUND'`.
- Wrong argument type or count: `TypeError`. A name containing a null byte is a `TypeError` too.
- An id that isn't an integer from 0 to 4294967295: `RangeError`.
- The system lookup itself failed (an unreachable LDAP server, say): an `Error` shaped like Node's own, e.g. `code: 'EIO'`, `syscall: 'getpwnam_r'`.

Lookups are synchronous, and safe to call from several [worker threads](https://nodejs.org/api/worker_threads.html) at once.
A lookup against a network directory can block, so keep that in mind on a busy event loop.

## Building from source

Needs a C++17 compiler, `make` and Python (see [node-gyp](https://github.com/nodejs/node-gyp#installation)), plus [Bun](https://bun.sh) or npm.

```bash
git clone https://github.com/cinderblock/node-userid.git
cd node-userid
bun install            # or: npm install
bun run build          # compiles the binary into prebuilds/, and the TypeScript
cd /path/to/your/project
npm install /path/to/node-userid
```

The package then loads that binary like any other prebuilt one.

## Development

```bash
bun install          # installs and compiles the TypeScript
bun run build:native # compiles the native addon from native/ into prebuilds/ (not on Windows)
bun run test         # node:test, against `id`
bun run check        # formatting, spelling, types, clang-tidy
bun run check:package  # publint + are-the-types-wrong
```

Tests run on Node.js directly, which strips the TypeScript types itself.
On Windows, skip `build:native`: the tests check the unsupported-platform behavior there. Use WSL for the rest.

Optional test fixtures, which CI creates on Linux and FreeBSD:

| Variable                                        | Meaning                                                        |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `LONG_USERNAME_TEST`, `LONG_GROUPNAME_TEST`     | names over 15 characters                                       |
| `BIG_ID_USERNAME`, `BIG_ID_GROUPNAME`, `BIG_ID` | a user and group with an id above 2³¹ (default `3000000000`)   |
| `USERID_PACKAGE_DIR`                            | test an installed copy of the package instead of this checkout |

`scripts/smoke-test-package.sh <tarball> <npm|pnpm|bun>` installs a packed tarball into a scratch project and runs the tests against it. Run `bun run build` first.

## History

This package was originally created by [Jen Andre](https://github.com/jandre/node-userid) <jandre@gmail.com>.

In 2019, it was, unfortunately, missing updates that are required to run on the latest versions of Node.js.

Since Jen has not responded to any attempts at contact, I requested that Npm transfer the package so that I might keep it maintained.

Version 1.0.0 switched to N-API, the forward compatible interface that should be, all around, much nicer moving forward.
It also signals the change to using Github Actions to run all our full coverage tests on all supported platforms.

Version 2.0.0 ships prebuilt binaries, TypeScript types, ES module and CommonJS entry points, and installs on Windows. See the [changelog](CHANGELOG.md).
The prebuild matrix started from [@matthewh](https://github.com/matthewh)'s [#8](https://github.com/cinderblock/node-userid/pull/8).

## Releasing

Releases are published by [CI](.github/workflows/release.yml), never from a developer machine.
Bump the version in `package.json`, commit, then push a matching tag (`git tag v1.2.3 && git push origin v1.2.3`).
The workflow runs all of CI, builds the prebuilt binaries, tests the packed tarball, and then publishes that exact tarball with [provenance](https://docs.npmjs.com/generating-provenance-statements) through npm trusted publishing.

## License

The license, when the package was created, had some mix of GPLv3 and Public Domain.

Since the main source code has always been Public Domain, I believe it should stay that way.
I've also explicitly extended it to the rest of the main (published) source code.

Even though Jen's [before last commit](https://github.com/jandre/node-userid/commit/ba665c45d958982ff5aa0d482741a2955a4de8c4) changed the license in one location to MIT,
the tests, build files, and other scripts (especially those by other contributors) were added under the GPLv3.
I'm therefore inclined to think it's better to not hold to that final license change.

Going forward, all published source code (the part that you use as a user of this package) will be all **Public Domain**.
The rest of this package will stay **GPLv3**.

© 2021 Cameron Tacklind <cameron@tacklind.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
