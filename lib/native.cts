// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

// Internal: loads the native addon, and gives its errors Node's shape. Shared by the sync and promise APIs.
// Not part of the public API (the `exports` map doesn't expose it).

import { join } from 'node:path';
import { getSystemErrorMessage, getSystemErrorName } from 'node:util';

/** A user's numeric ids, from the user database. */
export interface Ids {
  /** User id */
  uid: number;
  /** Primary group id */
  gid: number;
}

/** The functions the native addon exports. Each `*Async` runs its lookup on the libuv thread pool. */
export interface Native {
  ids(username: string): Ids;
  gid(groupname: string): number;
  gids(username: string): number[];
  username(uid: number): string;
  groupname(gid: number): string;
  idsAsync(username: string): Promise<Ids>;
  gidAsync(groupname: string): Promise<number>;
  gidsAsync(username: string): Promise<number[]>;
  usernameAsync(uid: number): Promise<string>;
  groupnameAsync(gid: number): Promise<string>;
}

/**
 * Whether this platform has a POSIX user and group database to read.
 * `false` on Windows, where every lookup fails with code `ERR_USERID_UNSUPPORTED_PLATFORM`.
 */
export const isSupported: boolean = process.platform !== 'win32';

let native: Native | undefined;

/** The native addon. Throws on Windows, or when this platform has no binary. */
export function load(): Native {
  if (!isSupported) {
    const error: NodeJS.ErrnoException = new Error(
      `userid is not supported on ${process.platform}: it has no POSIX user and group database`,
    );
    error.code = 'ERR_USERID_UNSUPPORTED_PLATFORM';
    throw error;
  }

  if (!native) {
    try {
      // Finds the prebuilt binary for this platform in `prebuilds/`, or one built from source in `build/`
      native = require('node-gyp-build')(join(__dirname, '..')) as Native;
    } catch (cause) {
      if (!(cause instanceof Error) || !cause.message.startsWith('No native build was found')) throw cause;

      const error: NodeJS.ErrnoException = new Error(
        `userid has no prebuilt binary for ${process.platform}-${process.arch}. ` +
          'Build it from source (https://github.com/cinderblock/node-userid#building-from-source), ' +
          'or ask for this platform at https://github.com/cinderblock/node-userid/issues',
        { cause },
      );
      error.code = 'ERR_USERID_NO_PREBUILT_BINARY';
      throw error;
    }
  }

  return native;
}

// Load eagerly where supported, so a broken install fails on import instead of on first use
if (isSupported) load();

/**
 * Give a system error from the native code the same shape as Node's own: `code` (`'EIO'`, ...) and a readable message.
 * Other errors pass through unchanged.
 */
export function decorate(error: unknown): unknown {
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
  return error;
}
