// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#include "userid.hh"
#include "lib/BufferSize.hh"

auto Init(Napi::Env env, Napi::Object exports) -> Napi::Object {
  using Napi::Function;

  exports["ids"] = Function::New(env, &userid::Ids, "Native Ids");
  exports["gid"] = Function::New(env, &userid::Gid, "Native Gid");
  exports["gids"] = Function::New(env, &userid::Gids, "Native Gids");
  exports["username"] = Function::New(env, &userid::UserName, "Native UserName");
  exports["groupname"] = Function::New(env, &userid::GroupName, "Native GroupName");

  // Original native module used the "uid" name but the JavaScript renamed it to "ids"
  // This gets replaced in the JavaScript API by a different function
  exports["uid"] = exports["ids"];

#ifdef DEBUG
  exports["_override_buffer_size"] = Function::New(
      env,
      [](const Napi::CallbackInfo &info) {
        try {
          if (info.Length() == 0U) {
            userid::BufferSize::overrideDisable();
          } else {
            userid::BufferSize::override(info[0].As<Napi::Number>().Int32Value());
          }
        } catch (...) {
          userid::BufferSize::override();
        }
      },
      "Native Debug Override Buffer Size");
#endif

  return exports;
}

// NOLINTNEXTLINE(modernize-use-trailing-return-type,bugprone-easily-swappable-parameters,cppcoreguidelines-avoid-non-const-global-variables)
NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init);

// cSpell:ignore NOLINTNEXTLINE
