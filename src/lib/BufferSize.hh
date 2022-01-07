#pragma once

#include <cstddef>

namespace userid::BufferSize {
auto grp() noexcept -> std::size_t;
auto pwd() noexcept -> std::size_t;
#ifdef DEBUG
void overrideDisable() noexcept;
void override(std::size_t = 0) noexcept;
#endif
} // namespace userid::BufferSize
