// Proves the point of the promise API: a slow lookup blocks the event loop when sync, and doesn't when async.
//
// Needs a slow `getpwnam_r`, interposed with LD_PRELOAD (see test/fixtures/slow-getpwnam.c), so it only runs when
// USERID_SLOW_LOOKUP_MS is set. CI runs it on Linux.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type * as Userid from '../lib/index.mts';

const delay = Number(process.env.USERID_SLOW_LOOKUP_MS ?? 0);
const packageDir = process.env.USERID_PACKAGE_DIR ?? fileURLToPath(new URL('..', import.meta.url));

describe('event loop', { skip: !delay && 'set USERID_SLOW_LOOKUP_MS and LD_PRELOAD the slow getpwnam_r' }, async () => {
  const userid: typeof Userid = await import(pathToFileURL(join(packageDir, 'dist', 'index.mjs')).href);
  const name = execFileSync('id', ['-un'], { encoding: 'utf8', env: { ...process.env, LD_PRELOAD: '' } }).trim();

  // Count how often a 10 ms interval fires while `run` is in progress
  async function ticksDuring(run: () => unknown) {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    const start = performance.now();
    try {
      await run();
    } finally {
      clearInterval(timer);
    }
    return { ticks, elapsed: performance.now() - start };
  }

  it('the slow lookup is in effect (a sync lookup takes the whole delay and blocks the loop)', async () => {
    const { ticks, elapsed } = await ticksDuring(() => userid.ids(name));
    assert.ok(elapsed >= delay * 0.9, `took ${elapsed} ms`);
    assert.equal(ticks, 0);
  });

  it('an async lookup leaves the event loop running', async () => {
    const { ticks, elapsed } = await ticksDuring(() => userid.promises.ids(name));
    assert.ok(elapsed >= delay * 0.9, `took ${elapsed} ms`);
    // A free loop fires about elapsed / 10 times. Allow plenty of slack for a busy CI machine.
    assert.ok(ticks >= elapsed / 10 / 3, `interval fired ${ticks} times in ${elapsed} ms`);
  });

  it('async lookups run in parallel on the thread pool', async () => {
    // libuv's pool has 4 threads by default
    const { elapsed } = await ticksDuring(() =>
      Promise.all(Array.from({ length: 4 }, () => userid.promises.uid(name))),
    );
    assert.ok(elapsed < delay * 2.5, `4 lookups took ${elapsed} ms, ${delay} ms each`);
  });
});
