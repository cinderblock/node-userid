import 'should';

import execToString from './lib/execToString';
import itShouldHandleErrorsConsistently from './lib/itShouldHandleErrorsConsistently';

import * as types from '../src/userid';

const importPath = process.env.TEST_IMPORT_OVERRIDE || '../src/userid.cjs';

const userid = (import(importPath) as Promise<typeof types>).catch(e => {
  console.error(e);
  throw e;
});

// Simply test against current user's info

const shellUsername = execToString('id -un');
const shellGroupName = execToString('id -gn');

const shellUid = execToString('id -u').then(Number);
const shellGid = execToString('id -g').then(Number);

// Get a nice list
const shellGids = execToString('id -G').then(gids => gids.split(' ').map(Number).sort());

// As per https://github.com/cinderblock/node-userid/issues/3 we need to test long usernames.
// But we don't want to fail if a username is missing.
const longUsername = process.env.TEST_LONG_USERNAME;
const longUsernameUid = longUsername ? execToString(`id -u ${longUsername}`).then(Number) : -1;

// Try long group names too
const longGroupName = process.env.TEST_LONG_GROUPNAME;
const longGroupnameGid = longGroupname ? execToString(`id -g ${longGroupname}`).then(Number) : -1;

async function testIdsMethod() {
  it(`should load a user's uid [${await shellUid}] and gid [${await shellGid}] by username [${await shellUsername}] as an object`, async () => {
    const libIds = (await userid).ids(await shellUsername);

    libIds.uid.should.equal(await shellUid);
    libIds.gid.should.equal(await shellGid);
  });

  if (longUsername) {
    it(`should work with a long username [${longUsername}] that exists`, async () => {
      const libLongIds = (await userid).ids(longUsername);

      libLongIds.uid.should.equal(await longUsernameUid);

      // TODO: Test `libLongIds.gid.should.equal(shellGid)` properly
    });
  }

  itShouldHandleErrorsConsistently((await userid).ids, 'string', 'username', 'username not found');
}

describe('userid', () => {
  describe('method userid.ids', testIdsMethod);

  // If we're using the Node API
  if (process.env.TEST_NODE_API) {
    // this method matches `userid.ids` for historical compatibility
    describe('method userid.uid (should match method `userid.ids`)', testIdsMethod);
  } else {
    // Otherwise it has its own signature
    describe('method userid.uid', async () => {
      it(`should load user's uid [${await shellUid}] by username [${await shellUsername}]`, async () => {
        (await userid).uid(await shellUsername).should.equal(await shellUid);
      });

      if (longUsername) {
        it(`should work with a long username [${longUsername}] that exists`, async () => {
          (await userid).uid(longUsername).should.equal(await longUsernameUid);
        });
      }

      itShouldHandleErrorsConsistently((await userid).uid, 'string', 'username', 'username not found');
    });
  }

  describe('method userid.username', async () => {
    it(`should load a username [${await shellUsername}] by uid [${await shellUid}]`, async () => {
      (await userid).username(await shellUid).should.equal(await shellUsername);
    });

    if (longUsername) {
      it(`should load a long username [${longUsername}] by uid [${await longUsernameUid}]`, async () => {
        (await userid).username(await longUsernameUid).should.equal(longUsername);
      });
    }

    itShouldHandleErrorsConsistently((await userid).username, 'number', 'uid', 'uid not found');
  });

  describe('method userid.gid', async () => {
    it(`should load group's gid [${await shellGid}] by group name [${await shellGroupName}]`, async () => {
      (await userid).gid(await shellGroupName).should.equal(await shellGid);
    });

    if (longGroupname) {
      it(`should work with a long groupname [${longGroupname}] that exists`, async () => {
        (await userid).gid(longGroupname).should.equal(await longGroupnameGid);
      });
    }

    itShouldHandleErrorsConsistently((await userid).gid, 'string', 'groupname', 'groupname not found');
  });

  describe('method userid.groupname', async () => {
    it(`should load a group's name [${await shellGroupName}] by gid [${await shellGid}]`, async () => {
      (await userid).groupname(await shellGid).should.equal(await shellGroupName);
    });

    if (longGroupname) {
      it(`should work with a long groupname [${longGroupname}] that exists`, async () => {
        (await userid).groupname(await longGroupnameGid).should.equal(longGroupname);
      });
    }

    itShouldHandleErrorsConsistently((await userid).groupname, 'number', 'gid', 'gid not found');
  });

  describe('method userid.gids', async () => {
    it(`should load a list of gids [${await shellGids}] by username [${await shellUsername}]`, async () => {
      (await userid)
        .gids(await shellUsername)
        .sort()
        .should.deepEqual(await shellGids);
    });

    // TODO: test for a long username
    // TODO: test for a long groupname in returned list

    itShouldHandleErrorsConsistently((await userid).gids, 'string', 'user', 'getpwnam');
  });
});
