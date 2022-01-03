// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#include "lib/BufferSize.hh"
#include "lib/Error.hh"
#include "lib/FunctionArg.hh"
#include "userid.hh"

#if !defined(_WIN32)
#include <grp.h>
#include <pwd.h>

// BSD needs unistd.h for getgrouplist function
#if defined(BSD) || defined(__APPLE__)
#include <unistd.h>
#endif

#if defined(__APPLE__)
using gid_t = int;
#endif

#else
#include "lib/WindowsMocks.hh"
#endif

using Napi::Array;
using Napi::CallbackInfo;
using Napi::Error;
using Napi::Number;

auto userid::Gids(const CallbackInfo &info) -> Array {
  const auto env = info.Env();
  const auto username = getArg<std::string>(info);
  const auto *const name = username.c_str();

  passwd pwd{};
  std::vector<char> buffer(BufferSize::pwd());

  while (true) {
    decltype(pwd) *result = nullptr;

    const auto errCode = getpwnam_r(name, &pwd, buffer.data(), buffer.size(), &result);

    if (errCode == ERANGE) {
      buffer.reserve(buffer.size() * 2);
      continue;
    }

    checkError(env, result, errCode, "username not found");

    if (result != &pwd) {
      throw Error::New(env, "getpwnam_r returned unexpected result");
    }

    break;
  }

  const auto defaultGroup = pwd.pw_gid;

  constexpr unsigned FirstGuess = 4;

  int numGroupsGuess = FirstGuess;
  int foundGroups = 0;

  std::vector<gid_t> groups;

  do {
    // Grow the vector to fit our current guess
    groups.reserve(static_cast<unsigned>(numGroupsGuess));

    foundGroups = getgrouplist(name, defaultGroup, groups.data(), &numGroupsGuess);
  } while (foundGroups == -1);

  // So that we can use the vector's size, set it correctly
  groups.resize(static_cast<unsigned>(foundGroups));

  // Someday, node-addon-api may allow us to just do something like this:
  // return Napi::TypedArray::New(env, groups);

  auto ret = Array::New(env, groups.size());
  for (unsigned i = 0; i < groups.size(); i++) {
    ret[i] = Number::New(env, groups[i]);
  }
  return ret;
}
