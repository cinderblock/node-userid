#pragma once

#include <napi.h>

namespace userid {
template <typename T> auto getArg(const Napi::CallbackInfo &info, unsigned index = 0) -> T;
template <> auto getArg(const Napi::CallbackInfo &info, unsigned index) -> int32_t;
template <> auto getArg(const Napi::CallbackInfo &info, unsigned index) -> std::string;
} // namespace userid
