// Tests compare against the system's own `id` command.
//
// Optional fixtures (CI creates them on Linux and FreeBSD):
//   LONG_USERNAME_TEST, LONG_GROUPNAME_TEST  names over 15 characters (https://github.com/cinderblock/node-userid/issues/3)
//   BIG_ID_USERNAME, BIG_ID_GROUPNAME        a user and group whose ids are BIG_ID (default 3000000000), above 2^31
// USERID_PACKAGE_DIR tests an installed copy of the package instead of this checkout.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

import type * as Userid from '../lib/index.mts';

const packageDir = process.env.USERID_PACKAGE_DIR ?? fileURLToPath(new URL('..', import.meta.url));
const esmPath = join(packageDir, 'dist', 'index.mjs');
const cjsPath = join(packageDir, 'dist', 'index.cjs');

const esm: typeof Userid = await import(pathToFileURL(esmPath).href);
const cjs: typeof Userid = createRequire(import.meta.url)(cjsPath);

const flavors = [
  ['ES module', esm],
  ['CommonJS', cjs],
] as const;

const NotFound = { code: 'ERR_USERID_NOT_FOUND' };
const BadRange = { name: 'RangeError', message: 'Argument must be an integer from 0 to 4294967295' };

// An id nobody should have. (4294967295 is `(uid_t)-1`, and macOS's `nobody` is 4294967294.)
const missingId = 4294967290;
const missingName = 'no-such-user-or-group-userid-test';

describe('entry points', () => {
  it('ES module and CommonJS share one implementation', () => {
    assert.equal(esm.ids, cjs.ids);
    assert.equal(esm.default, cjs as unknown);
  });
});

if (!esm.isSupported) {
  describe('unsupported platform', () => {
    for (const [flavor, userid] of flavors) {
      it(`${flavor}: every lookup throws ERR_USERID_UNSUPPORTED_PLATFORM`, () => {
        assert.equal(userid.isSupported, false);

        const unsupported = { code: 'ERR_USERID_UNSUPPORTED_PLATFORM' };
        assert.throws(() => userid.ids('root'), unsupported);
        assert.throws(() => userid.uid('root'), unsupported);
        assert.throws(() => userid.gid('root'), unsupported);
        assert.throws(() => userid.gids('root'), unsupported);
        assert.throws(() => userid.username(0), unsupported);
        assert.throws(() => userid.groupname(0), unsupported);
      });
    }
  });
} else {
  const id = (...args: string[]) => execFileSync('id', args, { encoding: 'utf8' }).trim();

  const shellUsername = id('-un');
  const shellGroupname = id('-gn');
  const shellUid = Number(id('-u'));
  const shellGid = Number(id('-g'));
  // macOS prints large gids as negative numbers; userid always reports them unsigned
  const shellGids = id('-G')
    .split(/\s+/)
    .map(n => Number(n) >>> 0)
    .sort((a, b) => a - b);

  const longUsername = process.env.LONG_USERNAME_TEST || undefined;
  const longGroupname = process.env.LONG_GROUPNAME_TEST || undefined;
  const bigIdUsername = process.env.BIG_ID_USERNAME || undefined;
  const bigIdGroupname = process.env.BIG_ID_GROUPNAME || undefined;
  const bigId = Number(process.env.BIG_ID ?? 3000000000);

  for (const [flavor, userid] of flavors) {
    describe(flavor, () => {
      it('is supported', () => {
        assert.equal(userid.isSupported, true);
      });

      describe('ids', () => {
        it(`gets uid ${shellUid} and gid ${shellGid} of ${shellUsername}`, () => {
          assert.deepEqual(userid.ids(shellUsername), { uid: shellUid, gid: shellGid });
        });

        it('works with a long username', { skip: !longUsername }, () => {
          assert.equal(userid.ids(longUsername!).uid, Number(id('-u', longUsername!)));
        });

        it(`works with ids above 2^31`, { skip: !bigIdUsername }, () => {
          assert.deepEqual(userid.ids(bigIdUsername!), { uid: bigId, gid: bigId });
        });

        itRejectsNames(userid.ids, 'username not found');
      });

      describe('uid', () => {
        it(`gets uid ${shellUid} of ${shellUsername}`, () => {
          assert.equal(userid.uid(shellUsername), shellUid);
        });

        itRejectsNames(userid.uid, 'username not found');
      });

      describe('username', () => {
        it(`gets ${shellUsername} for uid ${shellUid}`, () => {
          assert.equal(userid.username(shellUid), shellUsername);
        });

        it('works with a long username', { skip: !longUsername }, () => {
          assert.equal(userid.username(Number(id('-u', longUsername!))), longUsername);
        });

        it('works with ids above 2^31', { skip: !bigIdUsername }, () => {
          assert.equal(userid.username(bigId), bigIdUsername);
        });

        itRejectsIds(userid.username, 'uid not found');
      });

      describe('gid', () => {
        it(`gets gid ${shellGid} of ${shellGroupname}`, () => {
          assert.equal(userid.gid(shellGroupname), shellGid);
        });

        it('works with a long groupname', { skip: !longGroupname }, () => {
          assert.equal(userid.gid(longGroupname!), Number(id('-g', longGroupname!)));
        });

        it('works with ids above 2^31', { skip: !bigIdGroupname }, () => {
          assert.equal(userid.gid(bigIdGroupname!), bigId);
        });

        itRejectsNames(userid.gid, 'groupname not found');
      });

      describe('groupname', () => {
        it(`gets ${shellGroupname} for gid ${shellGid}`, () => {
          assert.equal(userid.groupname(shellGid), shellGroupname);
        });

        it('works with a long groupname', { skip: !longGroupname }, () => {
          assert.equal(userid.groupname(Number(id('-g', longGroupname!))), longGroupname);
        });

        it('works with ids above 2^31', { skip: !bigIdGroupname }, () => {
          assert.equal(userid.groupname(bigId), bigIdGroupname);
        });

        itRejectsIds(userid.groupname, 'gid not found');
      });

      describe('gids', () => {
        it(`gets the same gids as \`id -G\` for ${shellUsername}`, () => {
          assert.deepEqual(
            userid.gids(shellUsername).sort((a, b) => a - b),
            shellGids,
          );
        });

        it('never lists a gid twice', () => {
          const gids = userid.gids(shellUsername);
          assert.equal(gids.length, new Set(gids).size);
        });

        it('includes the primary group', () => {
          assert.ok(userid.gids(shellUsername).includes(shellGid));
        });

        it('works with ids above 2^31', { skip: !bigIdUsername }, () => {
          assert.ok(userid.gids(bigIdUsername!).includes(bigId));
        });

        itRejectsNames(userid.gids, 'username not found');
      });
    });
  }

  describe('worker threads', () => {
    it('look up the same results as the main thread, concurrently', async () => {
      // Each worker loads the addon and hammers the reentrant lookups at the same time
      const source = `
        const { parentPort, workerData } = require('node:worker_threads');
        const userid = require(workerData.cjsPath);
        let last;
        for (let i = 0; i < 2000; i++) {
          last = [userid.ids(workerData.name), userid.username(workerData.uid), userid.gids(workerData.name).sort()];
        }
        parentPort.postMessage(last);
      `;
      const workerData = { cjsPath, name: shellUsername, uid: shellUid };

      const results = await Promise.all(
        Array.from(
          { length: 4 },
          () =>
            new Promise((resolve, reject) => {
              const worker = new Worker(source, { eval: true, workerData });
              worker.once('message', resolve);
              worker.once('error', reject);
            }),
        ),
      );

      const expected = [esm.ids(shellUsername), esm.username(shellUid), esm.gids(shellUsername).sort()];
      for (const result of results) assert.deepEqual(result, expected);
    });
  });
}

function itRejectsNames(fn: (name: string) => unknown, notFoundMessage: string) {
  const loose = fn as (...args: unknown[]) => unknown;

  it('throws when the name is not found', () => {
    assert.throws(() => fn(missingName), { ...NotFound, message: notFoundMessage });
  });

  it('throws on an empty name', () => {
    assert.throws(() => fn(''), NotFound);
  });

  it('throws on a name with a null byte', () => {
    assert.throws(() => fn('root\0'), { name: 'TypeError', message: 'Argument must not contain null bytes' });
  });

  it('throws without an argument', () => {
    assert.throws(() => loose(), { name: 'TypeError', message: 'Wrong number of arguments' });
  });

  it('throws on a non-string argument', () => {
    assert.throws(() => loose(0), { name: 'TypeError', message: 'Argument must be a string' });
  });
}

function itRejectsIds(fn: (id: number) => unknown, notFoundMessage: string) {
  const loose = fn as (...args: unknown[]) => unknown;

  it('throws when the id is not found', () => {
    assert.throws(() => fn(missingId), { ...NotFound, message: notFoundMessage });
  });

  for (const bad of [-1, 1.5, 2 ** 32, NaN, Infinity]) {
    it(`throws a RangeError on ${bad}`, () => {
      assert.throws(() => fn(bad), BadRange);
    });
  }

  it('throws without an argument', () => {
    assert.throws(() => loose(), { name: 'TypeError', message: 'Wrong number of arguments' });
  });

  it('throws on a non-number argument', () => {
    assert.throws(() => loose('0'), { name: 'TypeError', message: 'Argument must be a number' });
  });
}
