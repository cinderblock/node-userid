// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#include "lib/BufferSize.hh"
#include "lib/Error.hh"
#include "lib/FunctionArg.hh"
#include "userid.hh"

#if !defined(_WIN32)
#include <grp.h>
#else
#include "lib/WindowsMocks.hh"
#endif

using Napi::CallbackInfo;
using Napi::Error;
using Napi::Number;

auto userid::Gid(const CallbackInfo &info) -> Number {
  const auto env = info.Env();
  const auto username = getArg<std::string>(info);
  const auto *const name = username.c_str();

  group grp{};
  std::vector<char> buffer(BufferSize::grp());

  while (true) {
    decltype(grp) *result = nullptr;

    auto errCode = getgrnam_r(name, &grp, buffer.data(), buffer.size(), &result);

    if (errCode == ERANGE) {
      buffer.reserve(buffer.size() * 2);
      continue;
    }

    checkError(env, result, errCode, "groupname not found");

    if (result != &grp) {
      throw Error::New(env, "getgrnam_r returned unexpected result");
    }

    break;
  }

  return Number::New(env, grp.gr_gid);
}
