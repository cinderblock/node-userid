# node-userid: async (Promise) API for 2.1

## Goal

Add a Promise-based API to `userid` and ship it as the minor release **2.1.0**. Every lookup today is synchronous (`getpwnam_r` and friends). Against a network directory (LDAP, SSSD, NIS) a lookup can block the event loop for seconds; the async API runs it on the libuv thread pool instead.

Parent plan: `plans/triage-and-modernize.md` (newest copy on the `modernize` branch). Its decisions, findings and "things not to do" still apply.

## Environment / context

- Worktree: `C:\Users\camer\.t3\worktrees\node-userid\async-api`, branch `async-api` off `master` (`1dc988f`, the 2.0.0 merge).
- POSIX builds and tests run in WSL Ubuntu 24.04, in a **separate** mirror `~/node-userid-async` (the main plan's `~/node-userid` mirror belongs to the master checkout and other threads). Synced from the worktree with `rsync`, excluding `node_modules/`, `dist/`, `prebuilds/`, `native/build/`, `.git/`.
- WSL test fixtures: user `biguidusername` / group `biggroupname`, id 3000000000.
- Another thread owns branch `ci-prebuild-retry` (retrying the native build in prebuild jobs). Expect a `ci.yml` merge conflict if both land; don't take that work here.

## Design (for the user's review)

### API shape: `userid/promises` subpath, plus `promises` on the main export

Mirrors Node's own modules (`fs/promises` + `fs.promises`, `dns/promises` + `dns.promises`):

```js
import { ids, gids, username } from 'userid/promises';
const { promises } = require('userid'); // same functions
await ids('root'); // { uid: 0, gid: 0 }
```

Same names and arguments as the sync functions: `ids`, `uid`, `gid`, `gids`, `username`, `groupname`, and `isSupported`.

No `*Async` functions: Node core never adopted that naming, and two spellings of the same thing would only grow the API.

### Native: `Napi::AsyncWorker`, one lookup core shared with the sync path

- The lookups (`findUser`, `findUserName`, `findGroupId`, `findGroupName`, `findGroups`) become plain C++ that never touches JavaScript. They return `Result<T>` (`std::variant<T, Failure>`), where `Failure` is "not found" (message) or a system error (syscall + errno).
- The sync binding runs the lookup and throws on `Failure`. The async binding validates the argument on the main thread, then queues an `AsyncWorker` that runs the same lookup on the libuv pool and settles a `Napi::Promise::Deferred` in `OnOK`. Errors are built by one function for both paths, so `code`, `errno`, `syscall` and messages are identical.
- Why `AsyncWorker` over a hand-rolled `napi_create_async_work`: it is node-addon-api's own wrapper for exactly this, handles the async-hooks resource (`userid:ids`, ...), and self-deletes. A `std::exception` (e.g. `bad_alloc`) inside `Execute` becomes a rejection, not a crash.

### Errors and validation

- Identical to the sync functions. Validation (`TypeError`/`RangeError`) happens synchronously, but the JS wrapper is `async`, so it surfaces as a **rejected promise**, never a synchronous throw.
- On Windows: `isSupported` is `false` and every function rejects with `ERR_USERID_UNSUPPORTED_PLATFORM`.
- The rejection's stack trace is re-captured in the wrapper after `await`, so it points at the caller (`at async ids` → the user's code) instead of being empty.

### Cancellation: not offered

The libc lookups (`getpwnam_r`, `getgrouplist`, ...) have no cancellation hook: once a thread-pool thread is inside NSS it stays there until NSS returns. An `AbortSignal` option could only abandon the promise while the thread stays busy, which hides the real cost (a pinned pool thread). Callers who want a deadline can `Promise.race` with a timer and see the same behavior explicitly. Documented in the README.

### Thread pool caveat

Each pending lookup occupies one libuv pool thread (4 by default, shared with `fs`, `dns.lookup`, `crypto`, `zlib`). A hung directory can therefore stall those too, exactly as `dns.lookup` does with a hung resolver. README points at `UV_THREADPOOL_SIZE`.

### Files

- `lib/native.cts` (new, internal): `isSupported`, binary loading, Node-style error decoration. Shared by both APIs.
- `lib/index.cts`: sync API, plus `export * as promises`.
- `lib/promises.cts` + `lib/promises.mts` (new): the async API, CJS and ESM.
- `package.json` `exports`: add `./promises` with `import`/`require` × `types`/`default`.

## Plan / steps

1. [x] Plan doc (this file).
2. [x] Native refactor: pure lookup core, sync + async bindings.
3. [x] JS wrappers, types, exports map.
4. [x] Tests: async parity with sync (every case), concurrency, worker threads (incl. terminating a worker mid-lookup), async-hooks resource type, Windows rejections. Plus an event-loop test that interposes a slow `getpwnam_r` with `LD_PRELOAD` (Linux CI) to prove the loop keeps running.
5. [x] Build + test in WSL; typecheck, lint, format, spelling, publint/attw. Windows tests. Tarball smoke test with npm, pnpm, Bun (and the Bun runtime).
6. [ ] **Present the design to the user** (before README/CHANGELOG polish). ← current step. Draft PR open so CI runs meanwhile.
7. [ ] README, CHANGELOG `2.1.0`, version bump.
8. [ ] PR against `master`, CI fully green. **No merge, tag or publish** without the user's explicit OK.

## Decisions already made (don't re-ask)

- Async API approved by the user as a follow-up to 2.0 (2026-11-09).
- Release: minor, `2.1.0`. Merge needs an admin merge and the user's OK; release needs a `v2.1.0` tag and the user's OK.

## Findings / gotchas

- **Terminating a worker thread with async lookups in flight aborted the whole process** (`terminate called after throwing an instance of 'Napi::Error'`). The worker's environment is shutting down, so settling the promise fails, and node-addon-api's rethrow (`ThrowAsJavaScriptException` → `napi_throw` fails) escapes as a C++ exception. Fixed with node-addon-api's opt-in `NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS` define in `native/binding.gyp`, which treats "can't throw because the environment is terminating" as a no-op. Covered by the test "can be terminated with lookups still in flight"; passed 15/15 repeated runs.
- The `LD_PRELOAD` slow-lookup test works: with a 300 ms `getpwnam_r`, the sync lookup lets a 10 ms interval fire 0 times; the async lookup lets it fire normally; 4 parallel async lookups finish in about 300 ms total (pool of 4).
- The promise API works unchanged in the Bun runtime (Bun 1.4.2), including 200 concurrent lookups.
- A rejection's stack is empty when the error is made in `OnOK` (no JS frames). Re-capturing it in the wrapper after `await` gives `at async username (...)` → caller's frames, as long as the caller `await`s (V8 async stack traces).
- attw prints `node10: (ignored) 💀 Resolution failed` for `userid/promises`. Expected: node10 resolution has no `exports` support, and the package's profile is `node16` (engines `>=22.12`).

## Progress log

- [x] Implementation, tests, CI step, smoke test (2026-11-10).
- [ ] User review of the design.
- [ ] README, CHANGELOG 2.1.0, version bump.
- [x] CI green on [PR #11](https://github.com/cinderblock/node-userid/pull/11): all 42 checks on `1764c49` (2026-11-10). Re-run after the docs commit.

## Open questions for the user

1. API shape: `userid/promises` + `promises` property (recommended), vs `*Async` functions, vs both.

## Things not to do

- Don't merge, tag or publish.
- Don't add an `AbortSignal` option that only pretends to cancel (see Cancellation).
- Everything in the parent plan's list (no install script, no root `binding.gyp`, no CLI publish, ...).
