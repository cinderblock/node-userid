// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

// The synchronous API. The same lookups returning promises are in `./promises.cts` (`userid/promises`).

import { decorate, load, type Ids, type Native } from './native.cjs';

export { isSupported } from './native.cjs';
export type { Ids } from './native.cjs';

/**
 * The same lookups, returning promises, like `fs.promises`. Also available as `userid/promises`.
 */
export * as promises from './promises.cjs';

type Sync = 'ids' | 'gid' | 'gids' | 'username' | 'groupname';

function call<M extends Sync>(method: M, args: IArguments): ReturnType<Native[M]> {
  const fn = load()[method] as (...args: unknown[]) => ReturnType<Native[M]>;

  try {
    return fn(...args);
  } catch (error) {
    decorate(error);
    Error.captureStackTrace?.(error as object, call);
    throw error;
  }
}

/**
 * Get a user's uid and primary gid.
 *
 * @param username Name in the user database (`/etc/passwd`, LDAP, ...)
 * @throws {Error} `code: 'ERR_USERID_NOT_FOUND'` when there is no such user
 */
export function ids(username: string): Ids {
  return call('ids', arguments);
}

/**
 * Get a user's uid.
 *
 * @param username Name in the user database
 * @throws {Error} `code: 'ERR_USERID_NOT_FOUND'` when there is no such user
 */
export function uid(username: string): number {
  return call('ids', arguments).uid;
}

/**
 * Get a group's gid.
 *
 * @param groupname Name in the group database (`/etc/group`, LDAP, ...)
 * @throws {Error} `code: 'ERR_USERID_NOT_FOUND'` when there is no such group
 */
export function gid(groupname: string): number {
  return call('gid', arguments);
}

/**
 * Get the gids of every group a user is in, including their primary group. No gid is listed twice.
 *
 * @param username Name in the user database
 * @throws {Error} `code: 'ERR_USERID_NOT_FOUND'` when there is no such user
 */
export function gids(username: string): number[] {
  return call('gids', arguments);
}

/**
 * Get the name of the user with a uid.
 *
 * @param uid Integer from 0 to 4294967295
 * @throws {RangeError} When `uid` is not an integer in that range
 * @throws {Error} `code: 'ERR_USERID_NOT_FOUND'` when there is no such user
 */
export function username(uid: number): string {
  return call('username', arguments);
}

/**
 * Get the name of the group with a gid.
 *
 * @param gid Integer from 0 to 4294967295
 * @throws {RangeError} When `gid` is not an integer in that range
 * @throws {Error} `code: 'ERR_USERID_NOT_FOUND'` when there is no such group
 */
export function groupname(gid: number): string {
  return call('groupname', arguments);
}
