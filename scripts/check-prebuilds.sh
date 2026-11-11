#!/usr/bin/env bash
# Check that every glibc Linux prebuild loads wherever Node.js 22 itself runs:
# no glibc or libstdc++ symbol version newer than Node.js 22's own minimums.
#
#   scripts/check-prebuilds.sh [prebuilds-dir]
#
# Uses `readelf`, which reads binaries of any architecture.

set -euo pipefail

dir="${1:-prebuilds}"

# Node.js 22 needs glibc 2.28 (RHEL 8, Debian 10, Ubuntu 20.04) and that era's libstdc++ (gcc 8)
max_glibc=2.28
max_glibcxx=3.4.25

newest() { grep -oE "$1_[0-9.]+" | sed "s/^$1_//" | sort -uV | tail -n 1; }
newer() { [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n 1)" != "$2" ]; }

status=0
found=0

while IFS= read -r -d '' file; do
  found=$((found + 1))
  needs="$(readelf -V --wide "$file")"
  glibc="$(newest GLIBC <<< "$needs")"
  glibcxx="$(newest GLIBCXX <<< "$needs")"

  printf '%-50s GLIBC_%-6s GLIBCXX_%s\n' "$file" "${glibc:-none}" "${glibcxx:-none}"

  if [ -n "$glibc" ] && newer "$glibc" "$max_glibc"; then
    echo "::error file=$file::needs GLIBC_$glibc, newer than $max_glibc"
    status=1
  fi
  if [ -n "$glibcxx" ] && newer "$glibcxx" "$max_glibcxx"; then
    echo "::error file=$file::needs GLIBCXX_$glibcxx, newer than $max_glibcxx"
    status=1
  fi
done < <(find "$dir" -path '*linux-*' -name '*.glibc.node' -print0)

if [ "$found" -eq 0 ]; then
  echo "::error::no glibc Linux prebuilds in $dir"
  exit 1
fi

exit "$status"
