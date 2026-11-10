# Changelog

## 1.3.0

The first release published since 1.2.5 (July 2021).
Versions 1.2.6 through 1.2.41 were tagged in git by an automatic dependency-update job, but its publish step never authenticated, so none of them reached npm.

### Fixed

- Build on FreeBSD and the other BSDs: `getgrouplist` needs `unistd.h` there ([#7](https://github.com/cinderblock/node-userid/pull/7), thanks [@guhaoyu2005](https://github.com/guhaoyu2005)).
- `gids()` no longer lists a gid twice. On FreeBSD and macOS, `getgrouplist` always adds the user's primary group and may list it again.

### Changed

- Published from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) through trusted publishing.
- Tested on Linux (x64 and arm64), macOS, and FreeBSD with Node.js 22, 24, and 26, including uids and gids above 2³¹.
