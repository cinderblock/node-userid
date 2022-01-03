#include "BufferSize.hh"

#if !defined(_WIN32)
// for sysconf()
#include <unistd.h>
#else
#include "WindowsMocks.hh"
#endif

static constexpr auto FallbackGuessSize = 0x4000; // 16KiB

static auto getSize(int name) noexcept -> unsigned {
  auto buffSize = sysconf(name);

  if (buffSize == -1) {
    return FallbackGuessSize;
  }

  return buffSize;
}

auto userid::BufferSize::grp() -> unsigned { return getSize(_SC_GETGR_R_SIZE_MAX); }
auto userid::BufferSize::pwd() -> unsigned { return getSize(_SC_GETPW_R_SIZE_MAX); }
