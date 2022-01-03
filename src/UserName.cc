// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#include "lib/BufferSize.hh"
#include "lib/Error.hh"
#include "lib/FunctionArg.hh"
#include "userid.hh"

#if !defined(_WIN32)
#include <pwd.h>
#else
#include "lib/WindowsMocks.hh"
#endif

using Napi::CallbackInfo;
using Napi::Error;
using Napi::String;

auto userid::UserName(const CallbackInfo &info) -> String {
  const auto env = info.Env();
  const auto uid = getArg<int32_t>(info);

  passwd pwd{};
  std::vector<char> buffer(BufferSize::pwd());

  while (true) {
    decltype(pwd) *result = nullptr;

    const auto errCode = getpwuid_r(uid, &pwd, buffer.data(), buffer.size(), &result);

    if (errCode == ERANGE) {
      buffer.reserve(buffer.size() * 2);
      continue;
    }

    checkError(env, result, errCode, "uid not found");

    if (result != &pwd) {
      throw Error::New(env, "getpwuid_r returned unexpected result");
    }

    break;
  }

  return String::New(env, pwd.pw_name);
}
