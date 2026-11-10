# node-userid: triage and modernization

## Goal

1. Triage every issue, PR, and stale branch on [cinderblock/node-userid](https://github.com/cinderblock/node-userid), with a recommended action for each.
2. Modernize the package: build, prebuilt binaries, supported Node versions, types, module format, Bun tooling, CI, a release pipeline that actually publishes, and sane Windows behavior.

## Environment / context

- Checkout: `C:\Users\camer\git\Personal Projects\node-userid`, branch `master` tracking `origin/master`.
- Local `master` was fast-forwarded on 2026-11-09 from `6452dfb` (1.2.34) to `e1fa50a` (merge of PR #7). Repo `package.json` says `1.2.41`.
- npm package: [`userid`](https://www.npmjs.com/package/userid). Sole maintainer is `cinderblock`.
- The addon already uses **node-addon-api 4.3** (C++ wrapper over Node-API). It is not nan or raw V8. Loaded with `bindings`.
- CI: `.github/workflows/main.yml` (active), `update.yml` and `versions.yml` (both `disabled_inactivity`). Dependabot alerts are disabled on the repo.

## Findings / gotchas

- **npm has been stuck at 1.2.5 (published 2021-07-14) for 4+ years.** Git has tags up to `v1.2.41`, but versions 1.2.6–1.2.41 were never published. The auto-publish step in `update.yml` sets `NPM_TOKEN` in the environment but never writes an `.npmrc` that uses it, so `npm publish` could not authenticate. As a result, **the BSD fix from PR #7 has never shipped.** (The long-username fix from PR #4, Jan 2021, did ship, in 1.2.0+.)
- **Main CI is red.** The most recent run (2026-11-06, on `nook-2021-wip`) failed with `TS2339: Property 'should' does not exist on type 'number'`. That's ts-node + `should` typings drift, caused by the unpinned `npm install` of the test fixture.
- **`username()` / `groupname()` use `Int32Value()`**, so IDs ≥ 2³¹ break. Example: macOS `nobody` is uid `4294967294` (-2). This needs `Uint32Value()` and range validation.
- **Non-reentrant libc calls** (`getpwnam`, `getgrgid`, …) are unsafe with `worker_threads`. The `thread-safe` branch fixes this with the `_r` variants.
- **Bug in the `thread-safe` / `no-MACOSX_DEPLOYMENT_TARGET` branches:** after `getgrouplist` they do `groups.resize(foundGroups)`. On macOS and the BSDs, `getgrouplist` returns **0** on success, not the count, so `gids()` would return `[]`. Use the `ngroups` out-param instead. Master avoids this by accident, because it loops to `ngroups`.
- `binding.gyp` uses `<!@(ls -1 src/*.cc)` and `<!(echo $GENERATE_COVERAGE)`. Neither works on Windows.
- `os: ["!win32"]` makes `npm install` fail with EBADPLATFORM on Windows. That breaks any cross-platform project that depends on `userid`, even one that never calls it on Windows.
- **Bun as a consumer:** Bun does not run dependency lifecycle scripts unless the package is in `trustedDependencies`. Today `bun add userid` produces no binary. Prebuilds that are loaded at runtime fix this without needing the install script.
- PR #8 renames the package to `@hershbergien/userid`, points `repository`/badges at the fork, and keeps the dead `bindings` dependency. It also uses `macos-13` (Intel runners have since been retired) and the unmaintained `addnab/docker-run-action`. The approach is right, but it can't merge as-is.
- Branch `nook-2021-wip` (a 2021 WIP commit) was pushed to origin on 2026-11-06, probably by another session. Leaving it alone.

## Triage

| # | Kind | State | Recommendation |
| --- | --- | --- | --- |
| [#8](https://github.com/cinderblock/node-userid/pull/8) prebuildify (matthewh) | PR | open | **Revisit → re-implement and close with credit.** Reuse its release matrix in our own branch (Co-authored-by Matthew), then close #8 with a thank-you comment. Don't merge: it renames the package, changes repository URLs, and targets a retired runner. |
| [#7](https://github.com/cinderblock/node-userid/pull/7) BSD `unistd.h` | PR | merged | Done in code, **never published**. Ships with the first CI release. Add a FreeBSD build to CI so it stays fixed. |
| [#6](https://github.com/cinderblock/node-userid/pull/6) | PR | closed (superseded by #7) | Nothing to do. |
| [#4](https://github.com/cinderblock/node-userid/pull/4) 15-char usernames | PR | merged, shipped | Nothing to do. Keep its long-name CI tests. |
| [#5](https://github.com/cinderblock/node-userid/issues/5) allow yarn | issue | closed | Already resolved (the engines block is gone). The underlying request ("installs with any package manager") still matters: prebuilds + Bun/yarn/pnpm install smoke tests cover it. No reopen. |
| [#3](https://github.com/cinderblock/node-userid/issues/3) | issue | closed, fixed by #4 | Nothing to do. |
| [#2](https://github.com/cinderblock/node-userid/issues/2), [#1](https://github.com/cinderblock/node-userid/issues/1) | issue | closed (old nan versions) | Nothing to do. |
| Dependabot PRs | — | none exist | Dependabot isn't configured. Add `dependabot.yml` (see plan). |
| `thread-safe`, `no-MACOSX_DEPLOYMENT_TARGET` | branches | unmerged WIP (2022, master merged in 2025-02) | **Salvage the C++ only:** reentrant `_r` calls, `checkError` with `strerror_r`, the Windows mocks header, `std::vector` buffers. Fix the `getgrouplist` bug above. Drop their tooling churn (eslint 8, cspell 5, mocha), which this plan replaces. Then delete both branches. |
| `test-no-MACOSX_DEPLOYMENT_TARGET` | branch | fully contained in `no-MACOSX_DEPLOYMENT_TARGET` | Delete. |
| `nook-2021-wip` | branch | recently pushed by someone | Leave it. Ask whoever pushed it. |

## Decisions already made (don't re-ask)

- Install and lockfile use **Bun** (`bun.lock`, no `package-lock.json`). The test matrix runs on **Node**. Publishing is `npm publish --provenance` **from CI only**, never from a CLI (per the `publishing` skill).
- Check with the user before merging PRs, closing issues/PRs, or publishing to npm. Pushing to our own branches is fine.

## Proposed modernization (pending user sign-off)

1. **Native layer.** Stay on node-addon-api (bump to 8.x) and pin `NAPI_VERSION=8`. The C++ wrapper is the right tool here, and the raw C API would add boilerplate for no gain. Use node-addon-api's `node_addon_api_except` gyp target. List the sources explicitly. Bring in the `_r` reentrant code from `thread-safe`, fix the `Uint32` and `getgrouplist` bugs, and make error messages consistent with an errno `code`. Keep node-gyp as the build tool for now, since prebuildify drives it. Moving to cmake-js or similar is a later item.
2. **Prebuilt binaries.** Use `prebuildify --napi --strip` (+ `--tag-libc`, `--tag-armv`) and load with `node-gyp-build`, bundled inside the npm tarball. Drop `bindings`. Node-API means one binary per platform works on every Node version. Targets: linux x64/arm64 (glibc + musl), linux armv7 glibc, darwin arm64 + x64 (cross-compiled from the arm64 runner, or on `macos-15-intel`), freebsd x64 (VM action). Builds from source still work as a fallback on anything else.
3. **Node versions.** Set `engines: ">=22.12"` and test on 22 / 24 / 26 on Linux + macOS. Node 20 went EOL on 2026-04-30. The Node-API binary will still *load* on older versions; we just won't claim support. Add a non-blocking Bun-runtime smoke job.
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
- [x] Triage and plan written. **Current step: waiting on user review.**
- [ ] Step 1 native layer
- [ ] Step 2 prebuilds
- [ ] Steps 3–6 package shape + tests
- [ ] Step 7 CI + release workflow
- [ ] User configures npm trusted publishing for `userid` (manual, npmjs.com)
- [ ] Close PR #8 with credit (needs user OK)
- [ ] Delete salvaged branches (needs user OK)
- [ ] Tag v2.0.0 → CI publishes (needs user OK)

## Open questions for the user

1. Node floor: `>=22.12` (my recommendation), or keep claiming `>=20` / older since the binary is version-independent?
2. Windows: install everywhere and throw at call time (recommended), or keep refusing to install?
3. Coverage: drop Coveralls and C++ gcov (recommended: the codebase is tiny, so keep JS-side tests thorough instead), or keep it?
4. Add an async (Promise) API? NSS lookups against LDAP/SSSD can block the event loop. Recommended as a follow-up after 2.0.0, not in it.
5. PR #8: OK to re-implement with Co-authored-by credit and then close it with a thank-you comment?
6. Is a 1.x maintenance release wanted before 2.0.0 (to ship the BSD fix to `^1` users)? Recommendation: no. Go straight to 2.0.0 and `npm deprecate` nothing.

## Things not to do

- Don't `npm publish` from a CLI. Not "just this once", and not to unstick the 1.2.5 situation.
- Don't merge PR #8 as-is (package rename).
- Don't trust `resize(foundGroups)` after `getgrouplist` (macOS/BSD return 0).
- Don't touch `nook-2021-wip`.
