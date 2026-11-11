#!/usr/bin/env bash
# Install a packed tarball into a scratch project the way a user would, then check it works.
#
#   scripts/smoke-test-package.sh <userid-x.y.z.tgz> <npm|pnpm|bun> [--allow-build]
#
# Fails if the package had to be compiled on install, unless --allow-build: platforms with a
# prebuilt binary must never need a compiler. Bun is the strictest case, because it doesn't run
# a dependency's install script at all unless the user trusts it.

set -euo pipefail

tarball="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
pm="$2"
allow_build="${3:-}"
repo="$(cd "$(dirname "$0")/.." && pwd)"

consumer="$(mktemp -d)"
trap 'rm -rf "$consumer"' EXIT
cd "$consumer"
echo '{ "name": "consumer", "private": true }' > package.json

echo "::group::Install with $pm"
case "$pm" in
  npm) npm install --no-audit --no-fund "$tarball" ;;
  pnpm) pnpm add "$tarball" ;;
  bun) bun add "$tarball" ;;
  *) echo "unknown package manager: $pm" >&2; exit 2 ;;
esac
echo "::endgroup::"

pkg="$consumer/node_modules/userid"

if [ -d "$pkg/build" ]; then
  if [ "$allow_build" = "--allow-build" ]; then
    echo "Built from source (allowed on this platform)"
  else
    echo "::error::userid was compiled on install; expected a prebuilt binary for $(node -p 'process.platform + "-" + process.arch')"
    exit 1
  fi
fi

echo "::group::Resolve through the exports map"
node -e "const u = require('userid'); console.log('require:', u.isSupported, typeof u.ids)"
node --input-type=module -e "import { isSupported, ids } from 'userid'; console.log('import:', isSupported, typeof ids)"
if [ "$pm" = bun ]; then
  bun -e "const u = require('userid'); console.log('bun runtime:', u.isSupported, u.isSupported ? u.username(process.getuid()) : '')"
fi
echo "::endgroup::"

echo "::group::Full test suite against the installed package"
cd "$repo"
USERID_PACKAGE_DIR="$pkg" node --test test/*.test.mts
echo "::endgroup::"
