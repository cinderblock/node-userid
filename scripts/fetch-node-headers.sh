#!/bin/sh
# CI helper: download the Node.js headers that `build:native` builds against, with retries, and point node-gyp at them.
#
# Left alone, node-gyp downloads the headers in the middle of the build, once, with no retry. That's slow and fragile in
# the emulated (QEMU) containers and the FreeBSD VM: a cut-off download there failed a release. Run this on the runner
# itself instead. node-gyp then extracts the local file into its usual cache and makes no network request.
#
# Prints the tarball's absolute path. On GitHub Actions it also sets npm_package_config_node_gyp_tarball for later
# steps, which node-gyp reads as its `tarball` option.

set -eu

cd "$(dirname "$0")/.."

# The version `build:native` targets, so it's only written down in package.json
version="$(sed -n 's/.*"build:native": *".*--target node@\([0-9][0-9.]*\).*/\1/p' package.json)"
if [ -z "$version" ]; then
  echo "fetch-node-headers: no --target node@<version> in package.json's build:native script" >&2
  exit 1
fi

base="https://nodejs.org/download/release/v$version"
file="node-v$version-headers.tar.gz"
dir=.cache/node-headers
mkdir -p "$dir"

fetch() {
  curl -fsSL --retry 5 --retry-all-errors --retry-delay 5 --connect-timeout 20 --speed-limit 1024 --speed-time 60 -o "$2" "$1"
}

fetch "$base/SHASUMS256.txt" "$dir/SHASUMS256.txt"
fetch "$base/$file" "$dir/$file"

# node-gyp checks the checksum of what it downloads, but not of a local tarball
grep "  $file\$" "$dir/SHASUMS256.txt" > "$dir/$file.sha256"
if command -v sha256sum >/dev/null; then
  (cd "$dir" && sha256sum -c "$file.sha256" >&2)
else
  (cd "$dir" && shasum -a 256 -c "$file.sha256" >&2)
fi

tarball="$PWD/$dir/$file"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "npm_package_config_node_gyp_tarball=$tarball" >> "$GITHUB_ENV"
fi

echo "$tarball"
