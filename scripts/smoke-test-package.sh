#!/usr/bin/env bash
# Install a packed tarball into a scratch project the way a user would, then check it works.
#
#   scripts/smoke-test-package.sh <userid-x.y.z.tgz> <npm|pnpm|bun>
#
# The package has no install scripts: it must work from its prebuilt binaries alone, with no
# compiler and no build approval (pnpm 11+ fails an install that has unapproved build scripts).

set -euo pipefail

tarball="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
pm="$2"
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
  echo "::error::userid was compiled on install; it should only use its prebuilt binaries"
  exit 1
fi

echo "::group::Resolve through the exports map"
node -e "const u = require('userid'); console.log('require:', u.isSupported, typeof u.ids)"
node --input-type=module -e "import { isSupported, ids } from 'userid'; console.log('import:', isSupported, typeof ids)"
node -e "const p = require('userid/promises'); if (p !== require('userid').promises) throw new Error('two copies'); console.log('require promises:', typeof p.ids)"
node --input-type=module -e "import { ids } from 'userid/promises'; console.log('import promises:', typeof ids)"
if [ "$pm" = bun ]; then
  bun -e "const u = require('userid'); console.log('bun runtime:', u.isSupported, u.isSupported ? u.username(process.getuid()) : '')"
  bun -e "const p = require('userid/promises'); console.log('bun runtime promises:', p.isSupported, p.isSupported ? await p.username(process.getuid()) : await p.ids('root').catch(e => e.code))"
fi
echo "::endgroup::"

echo "::group::Full test suite against the installed package"
cd "$repo"
USERID_PACKAGE_DIR="$pkg" node --test test/*.test.mts
echo "::endgroup::"

echo "::group::Without a prebuilt binary, loading fails with a clear error"
# Pass paths as arguments, so Git Bash on Windows translates them for Node.js
if [ "$(node -p 'require(process.argv[1]).isSupported' "$pkg")" = true ]; then
  mv "$pkg/prebuilds" "$pkg/prebuilds.hidden"
  # shellcheck disable=SC2016
  code="$(node -e 'try { require(process.argv[1]); console.log("loaded") } catch (e) { console.log(e.code) }' "$pkg")"
  mv "$pkg/prebuilds.hidden" "$pkg/prebuilds"
  if [ "$code" != ERR_USERID_NO_PREBUILT_BINARY ]; then
    echo "::error::expected ERR_USERID_NO_PREBUILT_BINARY, got $code"
    exit 1
  fi
  echo "ok: $code"
else
  echo "skipped: unsupported platform"
fi
echo "::endgroup::"
