# userid

Simple Node.js library with native bindings for getting uid and gid information.
Thread safe.

[![](https://github.com/cinderblock/node-userid/workflows/Main/badge.svg)](https://github.com/cinderblock/node-userid/actions)
[![](https://github.com/cinderblock/node-userid/workflows/Test%20All%20Versions/badge.svg)](https://github.com/cinderblock/node-userid/actions)
[![Coverage Status](https://coveralls.io/repos/github/cinderblock/node-userid/badge.svg?branch=master)](https://coveralls.io/github/cinderblock/node-userid?branch=master) _(JavaScript & C++!)_

## Installation

```bash
$ npm install userid
# Or, alternatively, directly from github:
$ npm install cinderblock/node-userid
```

This relies on GNU `getgrname` and `getgrid`.
Works on POSIX systems only.
This package is not useful on Windows.

## Usage

### Example

```js
var userid = require('userid');

// get user id
console.log("root's uid is:", userid.uid('root'));

// get group id
console.log("wheel's gid is:", userid.gid('wheel'));

// get user name
console.log('uid 0 name is:', userid.username(0));

// get group name
console.log('gid 0 name is:', userid.groupname(0));
```

<!-- TODO: Full Docs -->

## Development

This repository is setup for development with Visual Studio Code.
Other environments should be possible, just replicate the important settings in [`.vscode`](.vscode).
To get IntelliSense to work fully, add a line like this to your user `settings.json`:

```json
{
  "local.node-gyp.node-cache": "C:/Users/<username>/AppData/Local/node-gyp/Cache/<version>"
}
```

We use Npm, not Yarn.
Yarn should work, but we want to use Npm's `package-lock.json`.

### Windows

Development on Windows is possible but there are two main hurdles.

#### `package.json#engines`

The initial problem is that we've marked this package as not compatible with Windows.
Simply remove that line from the `package.json` before running `npm install`.
Please do not commit this change.

#### Linking

The other problem is that we cannot actually link the binary on a Windows machine because the bindings to the operating system calls are missing.
However, mock declarations for development on Windows machines are provided and will allow the `.cc` files to compile.

#### WSL to the Rescue

One nice solution is to open the folder in a WSL terminal.
This enables linking and running on Linux.
It also generates coverage information that will show up in code gutters with the correct extension installed.

```bash
GENERATE_COVERAGE="yes" npm run build
npm run coverage
```

Pull requests that would bring Windows into the fold would be welcome.

### Improvements to be made

- Publish pre-built versions of packages
- Don't depend on coveralls for coverage reports (maybe with [Standalone Stats](https://github.com/cinderblock/github-action-standalone-stats))
- Implement any `TODO`s found in the sources or tests
- Automatic testing of latest versions of Node/OSes
- Windows compatibility?
  - WSL
  - Windows equivalent native methods
  - Mock implementation?
  - Optional dependency?

## History

This package was originally created by [Jen Andre](https://github.com/jandre/node-userid) <jandre@gmail.com>.

In 2019, it was, unfortunately, missing updates that are required to run on the latest versions of Node.js.

Since Jen has not responded to any attempts at contact, I requested that Npm transfer the package so that I might keep it maintained.

Version 1.0.0 switched to N-API, the forward compatible interface that should be, all around, much nicer moving forward.
It also signals the change to using Github Actions to run all our full coverage tests on all supported platforms.

## License

The license, when the package was created, had some mix of GLPv3 and Public Domain.

Since the main source code has always been Public Domain, I believe it should stay that way.
I've also explicitly extended it to the rest of the main (published) source code.

Event though Jen's [before last commit](https://github.com/jandre/node-userid/commit/ba665c45d958982ff5aa0d482741a2955a4de8c4) changed the license in one location to MIT,
the tests, build files, and other scripts (especially those by other contributors) were added under the GPLv3.
I'm therefore inclined to think it's better to not hold to that final license change.

Going forward, all published source code (the part that you use as a user of this package) will be all **Public Domain**.
The rest of this package will stay **GPLv3**.

© 2021 Cameron Tacklind <cameron@tacklind.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
