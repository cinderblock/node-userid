#!/bin/sh
# CI helper: install the official Node.js 22 build into a plain Debian or Ubuntu container, as root.
# For architectures with no `node:` Docker image (s390x) or none old enough (ppc64le).

set -eu

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends curl xz-utils ca-certificates "$@" >/dev/null

arch="$(dpkg --print-architecture)"
case "$arch" in
  amd64) arch=x64 ;;
  ppc64el) arch=ppc64le ;;
esac

base=https://nodejs.org/dist/latest-v22.x
file="$(curl -fsSL "$base/SHASUMS256.txt" | grep -o "node-v[0-9.]*-linux-$arch\.tar\.xz" | head -n 1)"
curl -fsSL "$base/$file" | tar -xJ -C /usr/local --strip-components=1

node --version
