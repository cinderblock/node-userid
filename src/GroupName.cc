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
using Napi::String;

auto userid::GroupName(const CallbackInfo &info) -> String {
  const auto env = info.Env();
  const int gid = getArg<int32_t>(info);

  group grp{};
  std::vector<char> buffer(BufferSize::grp());

  while (true) {
    decltype(grp) *result = nullptr;

    const auto errCode = getgrgid_r(gid, &grp, buffer.data(), buffer.size(), &result);

    if (errCode == ERANGE) {
      buffer.resize(buffer.size() * 2);
      continue;
    }

    checkError(env, result, errCode, "gid not found");

    if (result != &grp) {
      throw Error::New(env, "getgrgid_r returned unexpected result");
    }

    return String::New(env, grp.gr_name);
  }
}
