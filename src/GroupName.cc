// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#include "lib/BufferSize.hh"
#include "lib/Error.hh"
#include "lib/FunctionArg.hh"
#include "userid.hh"
#include <algorithm>

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

    // ERANGE is reported when buffer wasn't big enough
    if (errCode == ERANGE) {
      // Make sure we don't somehow accidentally get stuck at size = 0
      buffer.resize(std::max<unsigned>(buffer.size() * 2, 1));
      continue;
    }

    checkError(env, result, errCode, "gid not found");

    if (result != &grp) {
      throw Error::New(env, "getgrgid_r returned unexpected result");
    }

    return String::New(env, grp.gr_name);
  }
}
