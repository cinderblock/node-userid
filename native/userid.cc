// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

// Native lookups in the POSIX user and group databases.
//
// Every lookup uses the reentrant `*_r` functions, so calls from several worker threads at once are safe.
// Errors are thrown as plain JavaScript errors; `lib/index.cts` adds Node-style `code`s and messages.

#include <napi.h>

#include <grp.h>
#include <pwd.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace {

using Napi::CallbackInfo;

// Used when sysconf() has no suggestion for a lookup buffer
constexpr std::size_t DefaultBufferSize = 1024;
// Stop growing a lookup buffer here (an entry this large is surely a bug somewhere else)
constexpr std::size_t MaxBufferSize = std::size_t{1} << 20U;
// Stop growing the group list here (Linux's NGROUPS_MAX is 65536)
constexpr std::size_t MaxGroups = std::size_t{1} << 17U;

auto notFoundError(Napi::Env env, const char *message) -> Napi::Error {
  auto error = Napi::Error::New(env, message);
  error.Set("code", "ERR_USERID_NOT_FOUND");
  return error;
}

// `lib/index.cts` turns these into Node-style system errors (`code: 'EIO'`, ...)
auto systemError(Napi::Env env, const char *syscall, int errnum) -> Napi::Error {
  auto error = Napi::Error::New(env, std::string(syscall) + " failed");
  error.Set("errno", Napi::Number::New(env, errnum));
  error.Set("syscall", syscall);
  return error;
}

// POSIX lets the `*_r` lookups report "no such entry" as any of these instead of a null result with 0
auto meansNotFound(int err) -> bool {
  return err == 0 || err == ENOENT || err == ESRCH || err == EBADF || err == EPERM;
}

auto stringArg(const CallbackInfo &info) -> std::string {
  const auto env = info.Env();

  if (info.Length() < 1) {
    throw Napi::TypeError::New(env, "Wrong number of arguments");
  }
  if (!info[0].IsString()) {
    throw Napi::TypeError::New(env, "Argument must be a string");
  }

  auto value = info[0].As<Napi::String>().Utf8Value();

  // C strings would silently stop at the first null byte
  if (value.find('\0') != std::string::npos) {
    throw Napi::TypeError::New(env, "Argument must not contain null bytes");
  }

  return value;
}

auto idArg(const CallbackInfo &info) -> std::uint32_t {
  const auto env = info.Env();

  if (info.Length() < 1) {
    throw Napi::TypeError::New(env, "Wrong number of arguments");
  }
  if (!info[0].IsNumber()) {
    throw Napi::TypeError::New(env, "Argument must be a number");
  }

  const double value = info[0].As<Napi::Number>().DoubleValue();

  // NaN fails the last comparison
  if (value < 0 || value > UINT32_MAX || std::trunc(value) != value) {
    throw Napi::RangeError::New(env, "Argument must be an integer from 0 to 4294967295");
  }

  return static_cast<std::uint32_t>(value);
}

// Run one reentrant lookup (`getpwnam_r` and friends), growing the buffer until the entry fits.
// `use` is called with the entry while the buffer its strings point into is still alive.
template <typename Entry, typename Call, typename Use>
auto lookup(Napi::Env env, const char *syscall, int sizeHintName, const char *missing, Call call, Use use) {
  const auto hint = sysconf(sizeHintName);
  std::vector<char> buffer(hint > 0 ? static_cast<std::size_t>(hint) : DefaultBufferSize);

  Entry entry{};
  Entry *result = nullptr;
  int err = 0;

  for (;;) {
    err = call(&entry, buffer.data(), buffer.size(), &result);

    if (err == EINTR) {
      continue;
    }
    if (err == ERANGE && buffer.size() < MaxBufferSize) {
      buffer.resize(buffer.size() * 2);
      continue;
    }
    break;
  }

  if (result == nullptr) {
    if (meansNotFound(err)) {
      throw notFoundError(env, missing);
    }
    throw systemError(env, syscall, err);
  }

  return use(*result);
}

struct UserIds {
  uid_t uid;
  gid_t gid;
};

auto findUser(Napi::Env env, const std::string &name) -> UserIds {
  return lookup<passwd>(
      env, "getpwnam_r", _SC_GETPW_R_SIZE_MAX, "username not found",
      [&](passwd *pwd, char *buf, std::size_t len, passwd **result) {
        return getpwnam_r(name.c_str(), pwd, buf, len, result);
      },
      [](const passwd &pwd) { return UserIds{pwd.pw_uid, pwd.pw_gid}; });
}

auto Ids(const CallbackInfo &info) -> Napi::Value {
  const auto env = info.Env();
  const auto user = findUser(env, stringArg(info));

  auto ret = Napi::Object::New(env);
  ret["uid"] = Napi::Number::New(env, user.uid);
  ret["gid"] = Napi::Number::New(env, user.gid);
  return ret;
}

auto UserName(const CallbackInfo &info) -> Napi::Value {
  const auto env = info.Env();
  const uid_t uid = idArg(info);

  return lookup<passwd>(
      env, "getpwuid_r", _SC_GETPW_R_SIZE_MAX, "uid not found",
      [&](passwd *pwd, char *buf, std::size_t len, passwd **result) { return getpwuid_r(uid, pwd, buf, len, result); },
      [&](const passwd &pwd) { return Napi::String::New(env, pwd.pw_name); });
}

auto Gid(const CallbackInfo &info) -> Napi::Value {
  const auto env = info.Env();
  const auto name = stringArg(info);

  return lookup<group>(
      env, "getgrnam_r", _SC_GETGR_R_SIZE_MAX, "groupname not found",
      [&](group *grp, char *buf, std::size_t len, group **result) {
        return getgrnam_r(name.c_str(), grp, buf, len, result);
      },
      [&](const group &grp) { return Napi::Number::New(env, grp.gr_gid); });
}

auto GroupName(const CallbackInfo &info) -> Napi::Value {
  const auto env = info.Env();
  const gid_t gid = idArg(info);

  return lookup<group>(
      env, "getgrgid_r", _SC_GETGR_R_SIZE_MAX, "gid not found",
      [&](group *grp, char *buf, std::size_t len, group **result) { return getgrgid_r(gid, grp, buf, len, result); },
      [&](const group &grp) { return Napi::String::New(env, grp.gr_name); });
}

auto Gids(const CallbackInfo &info) -> Napi::Value {
  const auto env = info.Env();
  const auto name = stringArg(info);
  const auto user = findUser(env, name);

#ifdef __APPLE__
  // macOS declares the group list as `int`
  using ListId = int;
#else
  using ListId = gid_t;
#endif

  std::vector<ListId> groups(16);

  for (;;) {
    auto count = static_cast<int>(groups.size());

    // On success, `count` is the number of groups stored. The return value is not a count everywhere.
    if (getgrouplist(name.c_str(), static_cast<ListId>(user.gid), groups.data(), &count) != -1) {
      groups.resize(static_cast<std::size_t>(count));
      break;
    }

    if (groups.size() >= MaxGroups) {
      throw systemError(env, "getgrouplist", ERANGE);
    }

    // Linux reports how many are needed; BSDs and macOS don't, so at least double
    groups.resize(std::max(groups.size() * 2, static_cast<std::size_t>(count)));
  }

  // BSDs and macOS always add the primary group and may list it again. Keep the first of each, like `id -G`.
  std::vector<std::uint32_t> unique;
  unique.reserve(groups.size());
  for (const auto id : groups) {
    // Always report gids unsigned, like `ids()` does (macOS would give `nobody` as -2)
    const auto gid = static_cast<std::uint32_t>(static_cast<gid_t>(id));
    if (std::find(unique.begin(), unique.end(), gid) == unique.end()) {
      unique.push_back(gid);
    }
  }

  auto ret = Napi::Array::New(env, unique.size());
  for (std::uint32_t i = 0; i < unique.size(); i++) {
    ret[i] = Napi::Number::New(env, unique[i]);
  }
  return ret;
}

auto Init(Napi::Env env, Napi::Object exports) -> Napi::Object {
  exports["ids"] = Napi::Function::New(env, Ids, "ids");
  exports["gid"] = Napi::Function::New(env, Gid, "gid");
  exports["gids"] = Napi::Function::New(env, Gids, "gids");
  exports["username"] = Napi::Function::New(env, UserName, "username");
  exports["groupname"] = Napi::Function::New(env, GroupName, "groupname");
  return exports;
}

} // namespace

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
