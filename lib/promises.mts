// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

// ES module entry point of the promise API, `userid/promises`. The implementation is CommonJS (see `./index.mts`).

import promises from './promises.cjs';

export type { Ids } from './promises.cjs';

export const { isSupported, ids, uid, gid, gids, username, groupname } = promises;

export default promises;
