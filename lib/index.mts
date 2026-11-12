// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

// ES module entry point. The implementation is CommonJS, because native addons are loaded with `require()`.

import userid from './index.cjs';

export type { Ids } from './index.cjs';

export const { isSupported, ids, uid, gid, gids, username, groupname, promises } = userid;

export default userid;
