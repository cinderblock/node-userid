#!/bin/sh
# CI helper: install the official Node.js 22 build into a plain Debian or Ubuntu container, as root.
# For architectures with no `node:` Docker image (s390x) or none old enough (ppc64le).
# Every download retries: these containers run under QEMU, where a slow transfer is more likely to be cut off.

set -eu

apt_get() {
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=5 "$@"
}

apt_get update -qq
apt_get install -y -qq --no-install-recommends curl xz-utils ca-certificates "$@" >/dev/null

# Ubuntu 20.04's curl (7.68) has no --retry-all-errors, and --retry alone doesn't retry a transfer that was cut off
fetch() {
  attempt=1
  until curl -fsSL --connect-timeout 20 --speed-limit 1024 --speed-time 60 -o "$2" "$1"; do
    if [ "$attempt" -ge 5 ]; then
      echo "Giving up on $1 after $attempt attempts" >&2
      return 1
    fi
    echo "Download of $1 failed (attempt $attempt), retrying" >&2
    attempt=$((attempt + 1))
    sleep 5
  done
}

arch="$(dpkg --print-architecture)"
case "$arch" in
  amd64) arch=x64 ;;
  ppc64el) arch=ppc64le ;;
esac

tmp="$(mktemp -d)"
base=https://nodejs.org/dist/latest-v22.x

fetch "$base/SHASUMS256.txt" "$tmp/SHASUMS256.txt"
file="$(grep -o "node-v[0-9.]*-linux-$arch\.tar\.xz" "$tmp/SHASUMS256.txt" | head -n 1)"
fetch "$base/$file" "$tmp/$file"
(cd "$tmp" && grep "  $file\$" SHASUMS256.txt | sha256sum -c -)

tar -xJf "$tmp/$file" -C /usr/local --strip-components=1
rm -rf "$tmp"

node --version
