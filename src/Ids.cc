// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#include "lib/BufferSize.hh"
#include "lib/Error.hh"
#include "lib/FunctionArg.hh"
#include "userid.hh"
#include <algorithm>
#include <cstring>

#if !defined(_WIN32)
#include <pwd.h>
#else
#include "lib/WindowsMocks.hh"
#endif

using Napi::CallbackInfo;
using Napi::Error;
using Napi::Number;
using Napi::Object;

auto userid::Ids(const CallbackInfo &info) -> Object {
  const auto env = info.Env();
  const auto username = getArg<std::string>(info);
  const auto *const name = username.c_str();

  passwd pwd{};
  std::vector<char> buffer(BufferSize::pwd());

  while (true) {
    decltype(pwd) *result = nullptr;

    const auto errCode = getpwnam_r(name, &pwd, buffer.data(), buffer.size(), &result);

    // ERANGE is reported when buffer wasn't big enough
    if (errCode == ERANGE) {
      // Make sure we don't somehow accidentally get stuck at size = 0
      buffer.resize(std::max<unsigned>(buffer.size() * 2, 1));
      continue;
    }

    checkError(env, result, errCode, "username not found");

    if (result != &pwd) {
      throw Error::New(env, "getpwnam_r returned unexpected result");
    }

    auto ret = Object::New(env);

    ret["uid"] = Number::New(env, pwd.pw_uid);
    ret["gid"] = Number::New(env, pwd.pw_gid);

    return ret;
  }
}

// cSpell:ignore NOLINT
