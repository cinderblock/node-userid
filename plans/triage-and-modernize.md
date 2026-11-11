# node-userid: triage and modernization

## Goal

1. Triage every issue, PR, and stale branch on [cinderblock/node-userid](https://github.com/cinderblock/node-userid), with a recommended action for each.
2. Modernize the package: build, prebuilt binaries, supported Node versions, types, module format, Bun tooling, CI, a release pipeline that actually publishes, and sane Windows behavior.

## Environment / context

- Checkout: `C:\Users\camer\git\Personal Projects\node-userid`, branch `master` tracking `origin/master`.
- Local `master` was fast-forwarded on 2026-11-09 from `6452dfb` (1.2.34) to `e1fa50a` (merge of PR #7). Repo `package.json` says `1.2.41`.
- npm package: [`userid`](https://www.npmjs.com/package/userid). Sole maintainer is `cinderblock`.
- The addon already uses **node-addon-api 4.3** (C++ wrapper over Node-API). It is not nan or raw V8. Loaded with `bindings`.
- Local tooling: Windows has Node 26.12.1, Bun 1.4.2, npm 11.20.0. POSIX builds and tests run in **WSL Ubuntu 24.04** (g++ 13.3, Python 3.12). Node and Bun are installed user-locally there. Tests run in a WSL-native mirror at `~/node-userid`, synced from the Windows checkout, so Linux `node_modules`/`build/` never land in the Windows tree.
- CI: `.github/workflows/main.yml` (active), `update.yml` and `versions.yml` (both `disabled_inactivity`). Dependabot alerts are disabled on the repo.

## Findings / gotchas

- **npm has been stuck at 1.2.5 (published 2021-07-14) for 4+ years.** Git has tags up to `v1.2.41`, but versions 1.2.6–1.2.41 were never published. The auto-publish step in `update.yml` sets `NPM_TOKEN` in the environment but never writes an `.npmrc` that uses it, so `npm publish` could not authenticate. As a result, **the BSD fix from PR #7 has never shipped.** (The long-username fix from PR #4, Jan 2021, did ship, in 1.2.0+.)
- **Main CI was red.** The most recent run (2026-11-06, on `nook-2021-wip`) failed with `TS2339: Property 'should' does not exist on type 'number'`. That's specific to that old branch's test setup; the real `master` breakages are listed below.
- ~~`username()` / `groupname()` use `Int32Value()`, so IDs ≥ 2³¹ break.~~ **Wrong, verified 2026-11-10:** `napi_get_value_int32` applies ECMAScript `ToInt32` (modular), so 3000000000 → -1294967296 → `uid_t` 3000000000 again. In WSL, a user/group created with id 3000000000 resolves correctly through every function. No code fix is needed; it gets a regression test instead. (2.0 still adds input validation: reject non-integers and values outside `[0, 2³²)`.)
- WSL has a test user `biguidusername` (uid 3000000000) in group `biggroupname` (gid 3000000000). `make` and `clang-tidy` 18 were installed through apt (`wsl -u root` works without a password; plain `sudo` asks for one).
- On macOS, `gids()` returns gids as signed `int` (e.g. `nobody` → `-2`). macOS's own `id -G` also prints `-2`, so that matches the platform. Leave it.
- `master` builds and passes all 24 tests on Linux with Node 24.22 when installed from the lockfile (`npm ci`).
- **Non-reentrant libc calls** (`getpwnam`, `getgrgid`, …) are unsafe with `worker_threads`. The `thread-safe` branch fixes this with the `_r` variants.
- **Bug in the `thread-safe` / `no-MACOSX_DEPLOYMENT_TARGET` branches:** after `getgrouplist` they do `groups.resize(foundGroups)`. On macOS and the BSDs, `getgrouplist` returns **0** on success, not the count, so `gids()` would return `[]`. Use the `ngroups` out-param instead. Master avoids this by accident, because it loops to `ngroups`.
- `binding.gyp` uses `<!@(ls -1 src/*.cc)` and `<!(echo $GENERATE_COVERAGE)`. Neither works on Windows.
- `os: ["!win32"]` makes `npm install` fail with EBADPLATFORM on Windows. That breaks any cross-platform project that depends on `userid`, even one that never calls it on Windows.
- **Bun as a consumer:** Bun does not run dependency lifecycle scripts unless the package is in `trustedDependencies`. Today `bun add userid` produces no binary. Prebuilds that are loaded at runtime fix this without needing the install script.
- PR #8 renames the package to `@hershbergien/userid`, points `repository`/badges at the fork, and keeps the dead `bindings` dependency. It also uses `macos-13` (Intel runners have since been retired) and the unmaintained `addnab/docker-run-action`. The approach is right, but it can't merge as-is.
- Branch `nook-2021-wip` (a 2021 WIP commit) was pushed to origin on 2026-11-06, probably by another session. Leaving it alone.
- **CI breakages found while fixing `v1` (2026-11-10):**
  - node-gyp 9 imports Python `distutils`, which Python 3.12 removed. That broke the macOS and FreeBSD runners (`ModuleNotFoundError: No module named 'distutils'`). Linux survived only because the runner's Python ships setuptools. Fixed with node-gyp 13. Consumers were never affected: npm uses its own bundled node-gyp, and the packed-tarball job passed on macOS throughout.
  - On Node 26, mocha 9 fails with `ReferenceError: require is not defined in ES module scope` from `node_modules/yargs/yargs`. Node 26 detects mocha 9's extensionless, old `yargs` file as ESM. It is **not** Node's TypeScript stripping: `--no-experimental-strip-types` doesn't help. Fixed with mocha 11.
  - The runner's clang-tidy errors inside node-addon-api 4.3's `napi.h` (`in-class initializer for static data member is not a constant expression`). Local clang-tidy 18 only warns. `.clang-tidy`'s `WarningsAsErrors: true` is not a glob, so it never failed on warnings anyway. A full run takes about 36 s per file because `src/.clang-tidy` enables `*`. clang-tidy was dropped from `v1` CI; 2.0 brings it back with a curated check list.
  - **Real bug, found by the new FreeBSD job:** `gids('root')` returned `[0, 0, 5]`. BSD `getgrouplist` always inserts the base gid and lists it again when the user is a member of it. Fixed on `v1` by deduping in order (`1f862ef`).

## Triage

| #                                                                                                                    | Kind     | State                                            | Recommendation                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#8](https://github.com/cinderblock/node-userid/pull/8) prebuildify (matthewh)                                       | PR       | open                                             | **Revisit → re-implement and close with credit.** Reuse its release matrix in our own branch (Co-authored-by Matthew), then close #8 with a thank-you comment. Don't merge: it renames the package, changes repository URLs, and targets a retired runner.                    |
| [#7](https://github.com/cinderblock/node-userid/pull/7) BSD `unistd.h`                                               | PR       | merged                                           | Done in code, **never published**. Ships with the first CI release. Add a FreeBSD build to CI so it stays fixed.                                                                                                                                                              |
| [#6](https://github.com/cinderblock/node-userid/pull/6)                                                              | PR       | closed (superseded by #7)                        | Nothing to do.                                                                                                                                                                                                                                                                |
| [#4](https://github.com/cinderblock/node-userid/pull/4) 15-char usernames                                            | PR       | merged, shipped                                  | Nothing to do. Keep its long-name CI tests.                                                                                                                                                                                                                                   |
| [#5](https://github.com/cinderblock/node-userid/issues/5) allow yarn                                                 | issue    | closed                                           | Already resolved (the engines block is gone). The underlying request ("installs with any package manager") still matters: prebuilds + Bun/yarn/pnpm install smoke tests cover it. No reopen.                                                                                  |
| [#3](https://github.com/cinderblock/node-userid/issues/3)                                                            | issue    | closed, fixed by #4                              | Nothing to do.                                                                                                                                                                                                                                                                |
| [#2](https://github.com/cinderblock/node-userid/issues/2), [#1](https://github.com/cinderblock/node-userid/issues/1) | issue    | closed (old nan versions)                        | Nothing to do.                                                                                                                                                                                                                                                                |
| Dependabot PRs                                                                                                       | —        | none exist                                       | Dependabot isn't configured. Add `dependabot.yml` (see plan).                                                                                                                                                                                                                 |
| `thread-safe`, `no-MACOSX_DEPLOYMENT_TARGET`                                                                         | branches | unmerged WIP (2022, master merged in 2025-02)    | **Salvage the C++ only:** reentrant `_r` calls, `checkError` with `strerror_r`, the Windows mocks header, `std::vector` buffers. Fix the `getgrouplist` bug above. Drop their tooling churn (eslint 8, cspell 5, mocha), which this plan replaces. Then delete both branches. |
| `test-no-MACOSX_DEPLOYMENT_TARGET`                                                                                   | branch   | fully contained in `no-MACOSX_DEPLOYMENT_TARGET` | Delete.                                                                                                                                                                                                                                                                       |
| `nook-2021-wip`                                                                                                      | branch   | recently pushed by someone                       | Leave it. Ask whoever pushed it.                                                                                                                                                                                                                                              |

## Decisions already made (don't re-ask)

- Install and lockfile use **Bun** (`bun.lock`, no `package-lock.json`). The test matrix runs on **Node**. Publishing is `npm publish --provenance` **from CI only**, never from a CLI (per the `publishing` skill).
- Check with the user before merging PRs, closing issues/PRs, or publishing to npm. Pushing to our own branches is fine.
- User sign-off received 2026-11-09 on the whole plan below. Answers to the open questions:
  1. Node floor `>=22.12`: yes.
  2. Windows: install everywhere, throw on call: yes.
  3. Coverage: "whatever". Decision: drop Coveralls and C++ gcov.
  4. Async (Promise) API: yes, as a follow-up after 2.0.0.
  5. Re-implement PR #8 with Co-authored-by credit, then close it with a thank-you: yes (still confirm the exact comment text before posting).
  6. Ship a **1.x maintenance release first** so `^1` users get the BSD fix: yes. Plan: `v1` branch off `master`, minimal fixes, version `1.3.0`, published by the new CI release workflow.
- Binary hosting: prebuildify bundles binaries **inside the npm tarball**, so there is no third-party host and nothing goes on GitHub Release assets. The user's condition ("unless they have their own binary hosts") is satisfied.

## Proposed modernization (pending user sign-off)

1. **Native layer.** Stay on node-addon-api (bump to 8.x) and pin `NAPI_VERSION=8`. The C++ wrapper is the right tool here, and the raw C API would add boilerplate for no gain. Use node-addon-api's `node_addon_api_except` gyp target. List the sources explicitly. Bring in the `_r` reentrant code from `thread-safe`, fix that branch's `getgrouplist` bug, validate id arguments (integer in `[0, 2³²)`), and make error messages consistent with an errno `code`. Keep node-gyp as the build tool for now, since prebuildify drives it. Moving to cmake-js or similar is a later item.
2. **Prebuilt binaries.** Use `prebuildify --napi --strip` (+ `--tag-libc`, `--tag-armv`) and load with `node-gyp-build`, bundled inside the npm tarball. Drop `bindings`. Node-API means one binary per platform works on every Node version. Targets: linux x64/arm64 (glibc + musl), linux armv7 glibc, darwin arm64 + x64 (cross-compiled from the arm64 runner, or on `macos-15-intel`), freebsd x64 (VM action). Builds from source still work as a fallback on anything else.
3. **Node versions.** Set `engines: ">=22.12"` and test on 22 / 24 / 26 on Linux + macOS. Node 20 went EOL on 2026-04-30. The Node-API binary will still _load_ on older versions; we just won't claim support. Add a non-blocking Bun-runtime smoke job.
4. **Module format and types.** Keep a CJS core (native addons load through `require` anyway), plus a thin ESM wrapper with named exports. Add an `exports` map with `types`/`import`/`require` conditions. Write the wrapper in TypeScript and emit `.d.ts`. Verify with `@arethetypeswrong/cli` and `publint` in CI. The API stays the same: `ids`, `uid`, `gid`, `gids`, `username`, `groupname`.
5. **Windows.** Remove `os: ["!win32"]` so the package installs everywhere. On win32 the module loads without a binary, exports `isSupported: false`, and every function throws an `Error` with `code: 'ERR_USERID_UNSUPPORTED_PLATFORM'`. The install script becomes a small `scripts/install.cjs` that does nothing on win32 and otherwise runs `node-gyp-build`. CI runs on `windows-latest` to prove install + import + throw. Every platform also gets `isSupported`.
6. **Tests.** Replace mocha + ts-node + should + nyc with `node:test` + `node:assert`, using TypeScript tests run through Node's built-in type stripping. Keep the long-username/groupname tests on Linux and the "native API stability" test. Add tests for large uids, an unknown user, and calls from a `worker_threads` worker. C++ coverage via gcov/lcov becomes optional (see question 3).
7. **CI (GitHub Actions).** All actions at current majors, pinned by SHA, with `permissions: contents: read`.
   - `ci.yml` (push/PR): lint (prettier, cspell, clang-tidy), typecheck, attw/publint, the test matrix (Node 22/24/26 × ubuntu/macos), a Windows install job, a FreeBSD job, a Bun-runtime job, and pnpm/yarn/bun consumer install from `npm pack`.
   - `release.yml` (on a `v*` tag): build the prebuilds matrix, assemble, `npm pack`, smoke-test the tarball on each OS, then `npm publish --provenance` using **npm trusted publishing (OIDC)**, so there's no `NPM_TOKEN` secret. The publish job runs on Node 24 for npm ≥ 11.5.
   - Add a `prepublishOnly` guard that fails outside CI (allowing only `0.0.0`).
   - Replace `update.yml` (weekly auto-bump + auto-publish) with `dependabot.yml`: the `bun` and `github-actions` ecosystems, grouped, weekly. Delete `versions.yml` (now folded into `ci.yml`).
8. **Release.** Version **2.0.0**: install on Windows, raised engines, and `exports` map are all breaking changes. Add a CHANGELOG entry that explains the 1.2.5 → 2.0.0 gap.
9. **README.** New install notes (prebuilds, Bun, Windows behavior), the supported platforms table, the dev workflow with Bun, and fixed badges (drop Coveralls if question 3 goes that way).

## Progress log

- [x] Fetch; fast-forward local master to `e1fa50a`
- [x] Read all issues, PRs, branches, CI state, npm state
- [x] Triage and plan written; user signed off 2026-11-09
- [x] **Phase A: 1.3.0 on branch `v1`**, pushed, all 13 CI jobs green ([run 42901682602](https://github.com/cinderblock/node-userid/actions/runs/42901682602)). Commits `42b2eff`..`96cba6e`:
  - big-id tests
  - `ci.yml`, which replaces `main.yml`/`update.yml`/`versions.yml`
  - `release.yml`: on a `v*` tag, runs CI, then `npm publish --provenance` via trusted publishing (environment `npm`). It picks the dist-tag automatically: `latest`, `next` for prereleases, or `v<major>-latest` for an older major.
  - the `scripts/guard-publish.cjs` prepublishOnly guard
  - node-gyp 13 + mocha 11
  - the `gids()` dedupe fix
  - CHANGELOG, and the version bump to 1.3.0
  - `package-lock.json` stays on `v1`; Bun lands in 2.0.
- [x] `v1` merged into `modernize` (`9701c60`), so 2.0 builds on 1.3.0.
- [x] **Published 1.3.0** (2026-11-10). The user configured trusted publishing (`cinderblock`/`node-userid`/`release.yml`/env `npm`, Allow npm publish checked, Allow npm dist-tag unchecked) and OK'd the tag. [Release run 42926720280](https://github.com/cinderblock/node-userid/actions/runs/42926720280). npm shows `latest: 1.3.0` with SLSA provenance. The registry took about 7½ minutes to show it after `+ userid@1.3.0` ("Your package is being processed").
- [x] `master` fast-forwarded to `v1` (`96cba6e`), with the user's OK.
- [ ] **Phase B: 2.0 on `modernize`** (current)
  - [x] Native rewrite, TypeScript wrapper, ESM + CJS, Windows behavior, node:test suite, Bun tooling: `26feba8`
  - [x] CI with prebuilds, a pack job, consumer installs, and a release that publishes the tested tarball: `39c7cfa`
  - [x] README + CHANGELOG for 2.0
  - [x] **pnpm: prebuilt only** (user chose it on 2026-11-10). No install script; `binding.gyp` + sources moved to `native/` and not shipped; `ERR_USERID_NO_PREBUILT_BINARY` on platforms without a prebuild; ppc64le + s390x prebuilds added.
  - [ ] armv7 consumer test on the Node 22 image (fix pushed; confirm on CI)
  - [ ] Version bump to 2.0.0, then the user OKs the `v2.0.0` tag
- [ ] Close PR #8 with credit (show the comment text first)
- [ ] Delete salvaged branches `thread-safe`, `no-MACOSX_DEPLOYMENT_TARGET`, `test-no-MACOSX_DEPLOYMENT_TARGET` (needs user OK)
- [ ] After 2.0: offer to lock down npm "Publishing access" (require 2FA, disallow tokens)
- [ ] After 2.0: async (Promise) API (user said yes, as a follow-up)

## Open questions for the user

None right now.

Answered (kept for the record): 2026-11-10, pnpm: prebuilt only, no install script. 2026-11-09: Node `>=22.12`; install on Windows and throw; drop Coveralls/gcov; async API after 2.0; re-implement #8 with credit; ship 1.3.0 first.

## Things not to do

- Don't `npm publish` from a CLI. Not "just this once", and not to unstick the 1.2.5 situation.
- Don't merge PR #8 as-is (package rename).
- Don't "fix" `Int32Value` → `Uint32Value` as a bug fix. It already works (see Findings).
- Don't trust `resize(foundGroups)` after `getgrouplist` (macOS/BSD return 0).
- Don't touch `nook-2021-wip`.
- Don't put `binding.gyp` back in the repo root. Bun builds any root project with a `binding.gyp` and no install script (ignoring `gypfile: false`), which breaks `bun install` on Windows (`grp.h: No such file or directory`). npm and pnpm treat a shipped `binding.gyp` as "needs a build" too.
- Don't add an `install`/`postinstall` script: pnpm 11+ fails `pnpm add` with `ERR_PNPM_IGNORED_BUILDS` for any dependency that has one.
- Don't use Node 24+ Docker images for armv7: Node 24 dropped official 32-bit ARM builds (`no matching manifest for linux/arm/v7`).
