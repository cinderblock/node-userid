// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#include "userid.hh"

auto Init(Napi::Env env, Napi::Object exports) -> Napi::Object {
  using Napi::Function;

  exports["ids"] = Function::New(env, &userid::Ids);
  exports["gid"] = Function::New(env, &userid::Gid);
  exports["gids"] = Function::New(env, &userid::Gids);
  exports["username"] = Function::New(env, &userid::UserName);
  exports["groupname"] = Function::New(env, &userid::GroupName);

  // Original native module used the "uid" name but the JavaScript renamed it to "ids"
  // This gets replaced in the JavaScript API by a different function
  exports["uid"] = exports["ids"];

  return exports;
}

// NOLINTNEXTLINE(modernize-use-trailing-return-type,bugprone-easily-swappable-parameters,cppcoreguidelines-avoid-non-const-global-variables)
NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init);

// cSpell:ignore NOLINTNEXTLINE
