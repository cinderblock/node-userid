#ifdef DEBUG
// NOLINTNEXTLINE(bugprone-reserved-identifier,cert-dcl37-c,cert-dcl51-cpp,cppcoreguidelines-macro-usage)
#define __STDC_WANT_LIB_EXT1__ 1
#endif

#ifdef _WIN32
// NOLINTNEXTLINE(bugprone-reserved-identifier,cert-dcl37-c,cert-dcl51-cpp,cppcoreguidelines-macro-usage)
#define _CRT_SECURE_NO_WARNINGS
#endif

#include "BufferSize.hh"
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <optional>
#include <vector>

#if !defined(_WIN32)
// for sysconf()
#include <unistd.h>
#else
#include "WindowsMocks.hh"
#endif

static constexpr auto FallbackGuessSize = 0x4000; // 16KiB

#ifdef DEBUG
// NOLINTNEXTLINE(cppcoreguidelines-avoid-non-const-global-variables)
static std::optional<std::size_t> bufferSizeOverride;

void userid::BufferSize::overrideDisable() noexcept { bufferSizeOverride.reset(); }
void userid::BufferSize::override(const std::size_t size) noexcept { bufferSizeOverride = size; }
#endif

static auto getSize(int name) noexcept -> std::size_t {
#ifdef DEBUG
  if (bufferSizeOverride.has_value()) {
    try {
      return bufferSizeOverride.value();
    } catch (...) {
      return 0;
    }
  }
#endif

  const auto buffSize = sysconf(name);

  if (buffSize == -1) {
    return FallbackGuessSize;
  }

  return buffSize;
}

auto userid::BufferSize::grp() noexcept -> std::size_t { return getSize(_SC_GETGR_R_SIZE_MAX); }
auto userid::BufferSize::pwd() noexcept -> std::size_t { return getSize(_SC_GETPW_R_SIZE_MAX); }
