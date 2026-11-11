# CI: make native builds resilient to network blips

## Goal

A single transient network failure must not fail a release. On 2026-11-10, [release run 42939713843](https://github.com/cinderblock/node-userid/actions/runs/42939713843) attempt 1 failed in `Prebuild linux-armv7-glibc`: node-gyp's download of the Node.js 22.12.0 headers from nodejs.org was cut off under QEMU (`gyp ERR! configure error`, `TypeError: terminated` at undici `Fetch.onAborted`). Re-running the failed jobs passed and published.

`release.yml` publishes only if every `ci.yml` job passes, so every job that downloads headers is a release risk, not just the prebuild jobs.

Parent plan: [triage-and-modernize.md](triage-and-modernize.md) (follow-up item "retry the native build in the prebuild jobs").

## Environment / context

- Branch `ci-prebuild-retry` (worktree `C:\Users\camer\.t3\worktrees\node-userid\ci-prebuild-retry`), PR against `master`.
- `build:native` runs `prebuildify --target node@22.12.0 ...`. prebuildify calls `node-gyp rebuild --target=22.12.0 --devdir=$TMPDIR/prebuildify/node`. node-gyp downloads `node-v22.12.0-headers.tar.gz` into that devdir unless it's already installed there.
- node-gyp takes a local headers tarball with its `tarball` option (`lib/install.js`: `if (tarPath) tar.extract({ file: tarPath ... })`), and reads options from `npm_config_<key>` and `npm_package_config_node_gyp_<key>` env vars (`lib/node-gyp.js`). With the tarball it still extracts into the same devdir, so `scripts/clang-tidy.mjs`'s header search is unaffected.

## Decisions

- **Download the headers once per job, on the runner host, with retries; hand the file to node-gyp.** This takes the network out of the build itself, including the slow emulated (QEMU) containers and the FreeBSD VM, which is where the flake hit. `curl --retry` on the host is fast and robust; the file is checked against nodejs.org's `SHASUMS256.txt` (node-gyp doesn't checksum a local tarball).
- **No retry around the build step.** Once the build has no network access, a failing build is a real failure; retrying it would only hide real problems and triple the time of the slow emulated jobs.
- **Pass the tarball as `npm_package_config_node_gyp_tarball`**, not `npm_config_tarball`: npm 11 warns about unknown `npm_config_*` keys, and node-gyp documents the `npm_package_config_node_gyp_` prefix as the preferred form.
- **The target version comes from `package.json`'s `build:native`**, so there's one place to bump it.
- Cover every job that builds: `checks`, `test`, `freebsd`, `prebuild-linux`, `prebuild-macos`, `prebuild-freebsd`.
- `scripts/ci-install-node.sh` (s390x/ppc64le containers) also downloads from nodejs.org under emulation: give its `curl` calls and `apt-get` retries too.

## Steps

- [x] Read plan, `ci.yml`, prebuildify and node-gyp sources
- [x] `scripts/fetch-node-headers.sh` + a "Download the Node.js headers" step in all six building jobs. Docker gets the path remapped to `/repo/...`; the FreeBSD VMs get it through `envs:` (the VM sees the workspace at the same path). `.cache/` is ignored by git, prettier and cspell.
- [x] Retries in `scripts/ci-install-node.sh` (apt `Acquire::Retries=5`, a 5-attempt curl loop, stall detection, plus a SHA-256 check of the Node.js tarball it never had). `apt-get install clang-tidy` in `checks` got `Acquire::Retries=5` too.
- [x] Verified in WSL (separate mirror `~/node-userid-ci-retry`, so the main mirror is untouched), each build with a fresh `TMPDIR`
- [x] Commit `ee28de1`, [PR #10](https://github.com/cinderblock/node-userid/pull/10), CI 42/42 green ([run 42945961856](https://github.com/cinderblock/node-userid/actions/runs/42945961856))
- [x] Update the parent plan's follow-up item
- [ ] Merge: needs the user's explicit OK for `gh pr merge --admin` (code-owner review required). Not tagged or published.

## Findings / gotchas

- **Proof the build makes no network request** (WSL, 2026-11-10): with `npm_package_config_node_gyp_dist_url=http://127.0.0.1:9`, a build _without_ the tarball fails (`gyp ERR! configure error`, `Error: bad port` from undici), and builds _with_ `npm_package_config_node_gyp_tarball` succeed under both `npm run` and `bun run`. node-gyp extracts into `$TMPDIR/prebuildify/node/22.12.0` with `installVersion` 11, `scripts/clang-tidy.mjs` still finds the headers, and the tests pass as before (92 pass, 18 skipped by environment, same as the main mirror).
- CI confirmed it everywhere: every building job logs `node-v22.12.0-headers.tar.gz: OK`, and the builds in Docker (path remapped to `/repo`) and in both FreeBSD VMs (same path via `envs:`) passed. A missing file would have failed the build (node-gyp extracts the given path), so they used it.
- npm 11 printed no warning for the `npm_package_config_node_gyp_*` variables.
- Residual network steps left as they are: `docker pull` and `bun install` retry on their own; `apk add` (Alpine prebuilds) and `pkg install` (FreeBSD VM) don't, but they hit package mirrors with small transfers, not the long emulated download that failed. Revisit if one of them ever flakes.

## Things not to do

- Don't change `build:native`'s arguments (`--cache`, `--devdir`, `--nodedir`): `scripts/clang-tidy.mjs` finds the headers in `$TMPDIR/prebuildify/node/<version>`.
- Don't merge the PR: `master` needs a code-owner review, so it needs an admin merge with the user's explicit OK. Don't tag or publish.
