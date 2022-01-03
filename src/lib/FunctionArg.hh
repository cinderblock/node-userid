#pragma once

#include <napi.h>

namespace userid {
template <typename T> auto getArg(const Napi::CallbackInfo &info, unsigned index = 0) -> T;
} // namespace userid
