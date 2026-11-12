// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

// The promise API (`userid/promises`, also `require('userid').promises`).
//
// Each lookup runs on the libuv thread pool, so a slow user directory (LDAP, SSSD, NIS) doesn't block the event loop.
// Results and errors are exactly those of the synchronous functions, but every error, including a bad argument or an
// unsupported platform, arrives as a rejected promise.
//
// A lookup can't be cancelled: the C library has no way to interrupt one, and it keeps its thread-pool thread until the
// system answers.

import { decorate, load, type Ids, type Native } from './native.cjs';

export { isSupported } from './native.cjs';
export type { Ids } from './native.cjs';

type Async = 'idsAsync' | 'gidAsync' | 'gidsAsync' | 'usernameAsync' | 'groupnameAsync';

async function call<M extends Async>(method: M, args: IArguments): Promise<Awaited<ReturnType<Native[M]>>> {
  try {
    const fn = load()[method] as (...args: unknown[]) => ReturnType<Native[M]>;
    return await fn(...args);
  } catch (error) {
    decorate(error);
    // A lookup's error is created on a fresh tick with no stack. This points it at the caller instead.
    Error.captureStackTrace?.(error as object, call);
    throw error;
  }
}

/**
 * Get a user's uid and primary gid.
 *
 * @param username Name in the user database (`/etc/passwd`, LDAP, ...)
 * @returns Rejects with `code: 'ERR_USERID_NOT_FOUND'` when there is no such user
 */
export async function ids(username: string): Promise<Ids> {
  return await call('idsAsync', arguments);
}

/**
 * Get a user's uid.
 *
 * @param username Name in the user database
 * @returns Rejects with `code: 'ERR_USERID_NOT_FOUND'` when there is no such user
 */
export async function uid(username: string): Promise<number> {
  return (await call('idsAsync', arguments)).uid;
}

/**
 * Get a group's gid.
 *
 * @param groupname Name in the group database (`/etc/group`, LDAP, ...)
 * @returns Rejects with `code: 'ERR_USERID_NOT_FOUND'` when there is no such group
 */
export async function gid(groupname: string): Promise<number> {
  return await call('gidAsync', arguments);
}

/**
 * Get the gids of every group a user is in, including their primary group. No gid is listed twice.
 *
 * @param username Name in the user database
 * @returns Rejects with `code: 'ERR_USERID_NOT_FOUND'` when there is no such user
 */
export async function gids(username: string): Promise<number[]> {
  return await call('gidsAsync', arguments);
}

/**
 * Get the name of the user with a uid.
 *
 * @param uid Integer from 0 to 4294967295
 * @returns Rejects with a `RangeError` when `uid` is not an integer in that range,
 *   or with `code: 'ERR_USERID_NOT_FOUND'` when there is no such user
 */
export async function username(uid: number): Promise<string> {
  return await call('usernameAsync', arguments);
}

/**
 * Get the name of the group with a gid.
 *
 * @param gid Integer from 0 to 4294967295
 * @returns Rejects with a `RangeError` when `gid` is not an integer in that range,
 *   or with `code: 'ERR_USERID_NOT_FOUND'` when there is no such group
 */
export async function groupname(gid: number): Promise<string> {
  return await call('groupnameAsync', arguments);
}
