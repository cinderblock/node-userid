// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#pragma once

#include <napi.h>

namespace userid {
using Napi::CallbackInfo;

auto GroupName(const CallbackInfo &info) -> Napi::String;
auto Gids(const CallbackInfo &info) -> Napi::Array;
auto Gid(const CallbackInfo &info) -> Napi::Number;
auto UserName(const CallbackInfo &info) -> Napi::String;
auto Ids(const CallbackInfo &info) -> Napi::Object;
} // namespace userid
