// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

import { join } from 'node:path';
import { getSystemErrorMessage, getSystemErrorName } from 'node:util';

/** A user's numeric ids, from the user database. */
export interface Ids {
  /** User id */
  uid: number;
  /** Primary group id */
  gid: number;
}

interface Native {
  ids(username: string): Ids;
  gid(groupname: string): number;
  gids(username: string): number[];
  username(uid: number): string;
  groupname(gid: number): string;
}

/**
 * Whether this platform has a POSIX user and group database to read.
 * `false` on Windows, where every lookup throws an error with code `ERR_USERID_UNSUPPORTED_PLATFORM`.
 */
export const isSupported: boolean = process.platform !== 'win32';

let native: Native | undefined;

function load(): Native {
  if (!isSupported) {
    const error: NodeJS.ErrnoException = new Error(
      `userid is not supported on ${process.platform}: it has no POSIX user and group database`,
    );
    error.code = 'ERR_USERID_UNSUPPORTED_PLATFORM';
    throw error;
  }

  // Finds a prebuilt binary in `prebuilds/`, or one built from source in `build/`
  native ??= require('node-gyp-build')(join(__dirname, '..')) as Native;
  return native;
}

// Load eagerly where supported, so a broken install fails on import instead of on first use
if (isSupported) load();

/**
 * Give system errors from the native code the same shape as Node's own: `code` (`'EIO'`, ...) and a readable message.
 */
function call<T>(method: keyof Native, args: IArguments): T {
  const fn = load()[method] as (...args: unknown[]) => T;

  try {
    return fn(...args);
  } catch (error) {
    if (error instanceof Error && typeof (error as NodeJS.ErrnoException).errno === 'number') {
      const e = error as NodeJS.ErrnoException;
      // libuv (and so Node) numbers errors as negative errno values
      const uv = -(e.errno as number);
      try {
        e.code = getSystemErrorName(uv);
        e.message = `${e.syscall}: ${getSystemErrorMessage(uv)}`;
      } catch {
        // An errno libuv doesn't know: keep the plain message
      }
    }
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
  return call<Ids>('ids', arguments).uid;
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
