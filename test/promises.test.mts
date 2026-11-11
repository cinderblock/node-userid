// Tests of the promise API (`userid/promises`).
//
// The sync API's own tests (userid.test.mts) check results against the system's `id` command. These check that every
// promise function gives exactly what its sync twin gives, for valid and invalid input alike, and then what only the
// promise API has: never throwing synchronously, concurrency, worker threads, and running on the libuv thread pool.
// Same optional fixtures and USERID_PACKAGE_DIR as userid.test.mts.

import assert from 'node:assert/strict';
import { createHook } from 'node:async_hooks';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspect } from 'node:util';
import { Worker } from 'node:worker_threads';

import type * as Userid from '../lib/index.mts';
import type * as Promises from '../lib/promises.mts';

const packageDir = process.env.USERID_PACKAGE_DIR ?? fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

const sync: typeof Userid = await import(pathToFileURL(join(packageDir, 'dist', 'index.mjs')).href);
const esm: typeof Promises = await import(pathToFileURL(join(packageDir, 'dist', 'promises.mjs')).href);
const cjsPath = join(packageDir, 'dist', 'promises.cjs');
const cjs: typeof Promises = require(cjsPath);

const flavors = [
  ['ES module', esm],
  ['CommonJS', cjs],
] as const;

const names = ['ids', 'uid', 'gid', 'gids', 'username', 'groupname'] as const;

describe('promise entry points', () => {
  it('ES module and CommonJS share one implementation', () => {
    for (const name of names) assert.equal(esm[name], cjs[name]);
    assert.equal(esm.default, cjs as unknown);
  });

  it('are also the main entry point’s `promises`', () => {
    const main: typeof Userid = require(join(packageDir, 'dist', 'index.cjs'));
    assert.equal(main.promises, cjs as unknown);
    assert.equal(sync.promises, cjs as unknown);
    assert.equal(sync.promises.ids, esm.ids);
  });

  it('have the same isSupported', () => {
    assert.equal(esm.isSupported, sync.isSupported);
    assert.equal(cjs.isSupported, sync.isSupported);
  });
});

if (!esm.isSupported) {
  describe('unsupported platform', () => {
    for (const [flavor, userid] of flavors) {
      it(`${flavor}: every lookup rejects with ERR_USERID_UNSUPPORTED_PLATFORM`, async () => {
        const unsupported = { code: 'ERR_USERID_UNSUPPORTED_PLATFORM' };
        await assert.rejects(userid.ids('root'), unsupported);
        await assert.rejects(userid.uid('root'), unsupported);
        await assert.rejects(userid.gid('root'), unsupported);
        await assert.rejects(userid.gids('root'), unsupported);
        await assert.rejects(userid.username(0), unsupported);
        await assert.rejects(userid.groupname(0), unsupported);
      });
    }
  });
} else {
  const id = (...args: string[]) => execFileSync('id', args, { encoding: 'utf8' }).trim();

  const shellUsername = id('-un');
  const shellGroupname = id('-gn');
  const shellUid = Number(id('-u'));
  const shellGid = Number(id('-g'));

  const longUsername = process.env.LONG_USERNAME_TEST || undefined;
  const longGroupname = process.env.LONG_GROUPNAME_TEST || undefined;
  const bigIdUsername = process.env.BIG_ID_USERNAME || undefined;
  const bigIdGroupname = process.env.BIG_ID_GROUPNAME || undefined;
  const bigId = Number(process.env.BIG_ID ?? 3000000000);

  const missingName = 'no-such-user-or-group-userid-test';
  const missingId = 4294967290;

  // Every kind of argument: found, not found, and each way validation fails. `[]` is "no argument".
  const badNames: unknown[][] = [[missingName], [''], ['root\0'], [], [0], [null]];
  const badIds: unknown[][] = [[missingId], [-1], [1.5], [2 ** 32], [NaN], [Infinity], [], ['0'], [0n]];
  const optional = (value: string | number | undefined) => (value === undefined ? [] : [[value]]);

  const cases: Record<(typeof names)[number], unknown[][]> = {
    ids: [[shellUsername], ['root'], ...optional(longUsername), ...optional(bigIdUsername), ...badNames],
    uid: [[shellUsername], ['root'], ...optional(longUsername), ...optional(bigIdUsername), ...badNames],
    gids: [[shellUsername], ['root'], ...optional(longUsername), ...optional(bigIdUsername), ...badNames],
    gid: [[shellGroupname], ...optional(longGroupname), ...optional(bigIdGroupname), ...badNames],
    username: [[shellUid], [0], ...(bigIdUsername ? [[bigId]] : []), ...badIds],
    groupname: [[shellGid], [0], ...(bigIdGroupname ? [[bigId]] : []), ...badIds],
  };

  type Outcome = { value: unknown } | { error: Record<string, unknown> };

  // Everything a caller could check on an error
  const describeError = (error: unknown) => {
    const e = error as NodeJS.ErrnoException;
    return {
      class: e.constructor,
      name: e.name,
      message: e.message,
      code: e.code,
      errno: e.errno,
      syscall: e.syscall,
    };
  };

  const outcome = async (run: () => unknown): Promise<Outcome> => {
    try {
      return { value: await run() };
    } catch (error) {
      return { error: describeError(error) };
    }
  };

  const loose = (fn: unknown) => fn as (...args: unknown[]) => unknown;

  // The error a promise rejects with
  const rejection = (promise: Promise<unknown>) =>
    promise.then(
      value => assert.fail(`resolved to ${inspect(value)}`),
      (error: unknown) => error as Error,
    );

  for (const [flavor, userid] of flavors) {
    describe(`${flavor} promises`, () => {
      for (const name of names) {
        describe(name, () => {
          for (const args of cases[name]) {
            const label = args.length ? args.map(a => inspect(a)).join(', ') : 'no argument';

            it(`(${label}) matches the sync function`, async () => {
              const expected = await outcome(() => loose(sync[name])(...args));
              const promise = loose(userid[name])(...args);
              assert.ok(promise instanceof Promise, 'returns a promise, even when it will reject');
              assert.deepEqual(await outcome(() => promise), expected);
            });
          }
        });
      }

      it('resolves to the values `id` reports', async () => {
        assert.deepEqual(await userid.ids(shellUsername), { uid: shellUid, gid: shellGid });
        assert.equal(await userid.uid(shellUsername), shellUid);
        assert.equal(await userid.gid(shellGroupname), shellGid);
        assert.equal(await userid.username(shellUid), shellUsername);
        assert.equal(await userid.groupname(shellGid), shellGroupname);
        assert.ok((await userid.gids(shellUsername)).includes(shellGid));
      });

      it('rejects with ERR_USERID_NOT_FOUND', async () => {
        await assert.rejects(userid.ids(missingName), { code: 'ERR_USERID_NOT_FOUND', message: 'username not found' });
        await assert.rejects(userid.groupname(missingId), { code: 'ERR_USERID_NOT_FOUND', message: 'gid not found' });
      });

      it('rejects bad arguments instead of throwing', async () => {
        const bad = loose(userid.username)('0');
        assert.ok(bad instanceof Promise);
        await assert.rejects(bad, { name: 'TypeError', message: 'Argument must be a number' });
      });
    });
  }

  describe('errors', () => {
    it('have a stack trace that leads back to the caller', async function callerOfUsername() {
      const error = await rejection(esm.username(missingId));
      assert.match(error.stack ?? '', /callerOfUsername/);
    });

    it('have a stack trace for bad arguments too', async function callerWithBadArgument() {
      const error = await rejection(esm.username(-1));
      assert.match(error.stack ?? '', /callerWithBadArgument/);
    });
  });

  describe('concurrency', () => {
    it('resolves many lookups in flight at once, each to its own result', async () => {
      const lookups = Array.from({ length: 1000 }, (_, i) => {
        switch (i % 6) {
          case 0:
            return [esm.ids(shellUsername), sync.ids(shellUsername)];
          case 1:
            return [esm.gids(shellUsername), sync.gids(shellUsername)];
          case 2:
            return [esm.username(shellUid), sync.username(shellUid)];
          case 3:
            return [esm.groupname(shellGid), sync.groupname(shellGid)];
          case 4:
            return [esm.gid(shellGroupname), sync.gid(shellGroupname)];
          default:
            return [esm.uid(missingName).catch((e: Error) => e.message), 'username not found'];
        }
      });

      const results = await Promise.all(lookups.map(([promise]) => promise));
      results.forEach((result, i) => assert.deepEqual(result, lookups[i]![1]));
    });

    it('runs lookups on the thread pool (async-hooks resource `userid:<name>`)', async () => {
      const types: string[] = [];
      const hook = createHook({
        init(_id, type) {
          if (type.startsWith('userid:')) types.push(type);
        },
      }).enable();

      try {
        await Promise.all([
          esm.ids(shellUsername),
          esm.uid(shellUsername),
          esm.gid(shellGroupname),
          esm.gids(shellUsername),
          esm.username(shellUid),
          esm.groupname(shellGid),
        ]);
      } finally {
        hook.disable();
      }

      assert.deepEqual(types.sort(), [
        'userid:gid',
        'userid:gids',
        'userid:groupname',
        'userid:ids',
        'userid:ids',
        'userid:username',
      ]);
    });

    it('does not queue any work for a bad argument', async () => {
      const types: string[] = [];
      const hook = createHook({
        init(_id, type) {
          if (type.startsWith('userid:')) types.push(type);
        },
      }).enable();

      try {
        await assert.rejects(esm.username(-1), RangeError);
      } finally {
        hook.disable();
      }

      assert.deepEqual(types, []);
    });
  });

  describe('worker threads', () => {
    const workerSource = `
      const { parentPort, workerData } = require('node:worker_threads');
      const userid = require(workerData.cjsPath);
      (async () => {
        let last;
        for (let round = 0; round < 20; round++) {
          last = await Promise.all(
            Array.from({ length: 50 }, () =>
              Promise.all([userid.ids(workerData.name), userid.username(workerData.uid), userid.gids(workerData.name)]),
            ),
          );
        }
        parentPort.postMessage(last[0].map(r => (Array.isArray(r) ? r.sort() : r)));
      })().catch(e => { throw e; });
    `;

    it('look up the same results as the main thread, concurrently', async () => {
      const workerData = { cjsPath, name: shellUsername, uid: shellUid };

      const results = await Promise.all(
        Array.from(
          { length: 4 },
          () =>
            new Promise((resolve, reject) => {
              const worker = new Worker(workerSource, { eval: true, workerData });
              worker.once('message', resolve);
              worker.once('error', reject);
            }),
        ),
      );

      const expected = [sync.ids(shellUsername), sync.username(shellUid), sync.gids(shellUsername).sort()];
      for (const result of results) assert.deepEqual(result, expected);
    });

    it('can be terminated with lookups still in flight', async () => {
      const source = `
        const { parentPort, workerData } = require('node:worker_threads');
        const userid = require(workerData.cjsPath);
        for (let i = 0; i < 200; i++) userid.gids(workerData.name);
        parentPort.postMessage('queued');
      `;

      for (let i = 0; i < 5; i++) {
        const worker = new Worker(source, { eval: true, workerData: { cjsPath, name: shellUsername } });
        await new Promise((resolve, reject) => {
          worker.once('message', resolve);
          worker.once('error', reject);
        });
        assert.equal(await worker.terminate(), 1);
      }

      // The main thread's lookups still work afterwards
      assert.deepEqual(await esm.ids(shellUsername), sync.ids(shellUsername));
    });
  });
}
