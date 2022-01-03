import 'should';

import execToString from './lib/execToString';
import itShouldHandleErrorsConsistently from './lib/itShouldHandleErrorsConsistently';

import * as types from '../src/userid';

const importPath = process.env.TEST_IMPORT_OVERRIDE || '../src/userid.cjs';

const userid = (
  await import(importPath).catch(e => {
    console.error(e);
    throw e;
  })
).default as typeof types;

// Simply test against current user's info

const shellUsername = await execToString('id -un');
const shellGroupName = await execToString('id -gn');

const shellUid = await execToString('id -u').then(Number);
const shellGid = await execToString('id -g').then(Number);

// Get a nice list
const shellGids = await execToString('id -G').then(gids => gids.split(' ').map(Number));

// As per https://github.com/cinderblock/node-userid/issues/3 we need to test long usernames.
// But we don't want to fail if a username is missing.
const longUsername = process.env.TEST_LONG_USERNAME;
const longUsernameUid = longUsername ? await execToString(`id -u ${longUsername}`).then(Number) : -1;

// Try long group names too
const longGroupName = process.env.TEST_LONG_GROUPNAME;
const longGroupNameGid = longGroupName ? await execToString(`id -g ${longGroupName}`).then(Number) : -1;

function testIdsMethod() {
  it(`should load a user's uid [${shellUid}] and gid [${shellGid}] by username [${shellUsername}] as an object`, () => {
    const libIds = userid.ids(shellUsername);

    libIds.uid.should.equal(shellUid);
    libIds.gid.should.equal(shellGid);
  });

  if (longUsername) {
    it(`should work with a long username [${longUsername}] that exists`, () => {
      const libLongIds = userid.ids(longUsername);

      libLongIds.uid.should.equal(longUsernameUid);

      // TODO: Test `libLongIds.gid.should.equal(shellGid)` properly
    });
  }

  itShouldHandleErrorsConsistently(userid.ids, 'string', 'username', 'username not found');
}

describe('userid', () => {
  describe('method userid.ids', testIdsMethod);

  // If we're using the Node API
  if (process.env.TEST_NODE_API) {
    // this method matches `userid.ids` for historical compatibility
    describe('method userid.uid (should match method `userid.ids`)', testIdsMethod);
  } else {
    // Otherwise it has its own signature
    describe('method userid.uid', () => {
      it(`should load user's uid [${shellUid}] by username [${shellUsername}]`, () => {
        userid.uid(shellUsername).should.equal(shellUid);
      });

      if (longUsername) {
        it(`should work with a long username [${longUsername}] that exists`, () => {
          userid.uid(longUsername).should.equal(longUsernameUid);
        });
      }

      itShouldHandleErrorsConsistently(userid.uid, 'string', 'username', 'username not found');
    });
  }

  describe('method userid.username', () => {
    it(`should load a username [${shellUsername}] by uid [${shellUid}]`, () => {
      userid.username(shellUid).should.equal(shellUsername);
    });

    if (longUsername) {
      it(`should load a long username [${longUsername}] by uid [${longUsernameUid}]`, () => {
        userid.username(longUsernameUid).should.equal(longUsername);
      });
    }

    itShouldHandleErrorsConsistently(userid.username, 'number', 'uid', 'uid not found');
  });

  describe('method userid.gid', () => {
    it(`should load group's gid [${shellGid}] by group name [${shellGroupName}]`, () => {
      userid.gid(shellGroupName).should.equal(shellGid);
    });

    if (longGroupName) {
      it(`should work with a long groupname [${longGroupName}] that exists`, () => {
        userid.gid(longGroupName).should.equal(longGroupNameGid);
      });
    }

    itShouldHandleErrorsConsistently(userid.gid, 'string', 'groupname', 'groupname not found');
  });

  describe('method userid.groupname', () => {
    it(`should load a group's name [${shellGroupName}] by gid [${shellGid}]`, () => {
      userid.groupname(shellGid).should.equal(shellGroupName);
    });

    if (longGroupName) {
      it(`should work with a long groupname [${longGroupName}] that exists`, () => {
        userid.groupname(longGroupNameGid).should.equal(longGroupName);
      });
    }

    itShouldHandleErrorsConsistently(userid.groupname, 'number', 'gid', 'gid not found');
  });

  describe('method userid.gids', () => {
    const sort = (a: number, b: number) => a - b;
    const shellGidsSorted = shellGids.sort(sort);
    it(`should load a list of gids [${shellGidsSorted}] by username [${shellUsername}]`, () => {
      userid.gids(shellUsername).sort(sort).should.deepEqual(shellGidsSorted);
    });

    // TODO: test for a long username
    // TODO: test for a long groupname in returned list

    itShouldHandleErrorsConsistently(userid.gids, 'string', 'user', 'username not found');
  });
});
