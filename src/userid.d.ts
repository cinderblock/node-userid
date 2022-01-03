// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

/**
 * Get uid and gid for user.
 *
 * @param {String} username username
 *
 * @return {Object} object with uid and gid, e.g. { uid: 1, gid: 2 }
 */
export declare function ids(username: string): { uid: number; gid: number };

/**
 * Get uid for user.
 *
 * @param {String} username username in /etc/passwd
 *
 * @return {Integer} uid
 */
export declare function uid(username: string): number;

/**
 * Get gid for groupName
 *
 * @param {String} groupName name of group in /etc/group
 *
 * @return {Integer} gid
 */
export declare function gid(groupName: string): number;

/**
 * Get group name for gid
 *
 * @param {Integer} gid - group id
 *
 * @return {String} name of group in /etc/group
 */
export declare function groupname(gid: number): string;

/**
 * Get user name for uid
 *
 * @param {Integer} uid user id
 *
 * @return {String} username of user in /etc/passwd
 */
export declare function username(uid: number): string;

/**
 * Get array of gids of user's groups
 *
 * @param {String} username name of user in /etc/passwd
 *
 * @return {Array} gid
 */
export declare function gids(username: string): number[];
