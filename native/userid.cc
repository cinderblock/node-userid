// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

// Native lookups in the POSIX user and group databases.
//
// Every lookup uses the reentrant `*_r` functions, so calls from several threads at once are safe: from worker
// threads, and from the libuv thread pool that runs the asynchronous versions.
//
// The lookups themselves (`find*`) are plain C++ that never touch JavaScript, so they can run on any thread. Each
// returns a `Result`: the value, or a `Failure`. Two thin bindings expose each lookup:
//   - sync (`ids`):       validate the argument, run the lookup now, return the value or throw.
//   - async (`idsAsync`): validate the argument now, run the lookup on the libuv thread pool, return a promise.
// Both turn a `Failure` into an error with the same function, so the two APIs fail identically.
// `lib/native.cts` then adds Node-style `code`s and messages to system errors.

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
#include <type_traits>
#include <utility>
#include <variant>
#include <vector>

namespace {

using Napi::CallbackInfo;

// Used when sysconf() has no suggestion for a lookup buffer
constexpr std::size_t DefaultBufferSize = 1024;
// Stop growing a lookup buffer here (an entry this large is surely a bug somewhere else)
constexpr std::size_t MaxBufferSize = std::size_t{1} << 20U;
// Stop growing the group list here (Linux's NGROUPS_MAX is 65536)
constexpr std::size_t MaxGroups = std::size_t{1} << 17U;

// ---------------------------------------------------------------------------------------------------------------------
// Results

// Why a lookup failed. Plain data, so it can travel from a thread-pool thread back to JavaScript.
struct Failure {
  // "username not found" and the like, or nullptr for a system error
  const char *notFound;
  // The function that failed, for a system error
  const char *syscall;
  int errnum;
};

auto notFound(const char *message) -> Failure { return {message, nullptr, 0}; }
auto systemFailure(const char *syscall, int errnum) -> Failure { return {nullptr, syscall, errnum}; }

template <typename T> using Result = std::variant<T, Failure>;

struct UserIds {
  std::uint32_t uid;
  std::uint32_t gid;
};

struct GroupId {
  std::uint32_t gid;
};

using GroupIds = std::vector<std::uint32_t>;

// ---------------------------------------------------------------------------------------------------------------------
// Lookups. These run on any thread and must not touch JavaScript.

// POSIX lets the `*_r` lookups report "no such entry" as any of these instead of a null result with 0
auto meansNotFound(int err) -> bool {
  return err == 0 || err == ENOENT || err == ESRCH || err == EBADF || err == EPERM;
}

// Run one reentrant lookup (`getpwnam_r` and friends), growing the buffer until the entry fits.
// `use` is called with the entry while the buffer its strings point into is still alive.
template <typename Entry, typename Call, typename Use>
auto lookup(const char *syscall, int sizeHintName, const char *missing, Call call, Use use)
    -> Result<std::invoke_result_t<Use, const Entry &>> {
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
      return notFound(missing);
    }
    return systemFailure(syscall, err);
  }

  return use(*result);
}

auto findUser(const std::string &name) -> Result<UserIds> {
  return lookup<passwd>(
      "getpwnam_r", _SC_GETPW_R_SIZE_MAX, "username not found",
      [&](passwd *pwd, char *buf, std::size_t len, passwd **result) {
        return getpwnam_r(name.c_str(), pwd, buf, len, result);
      },
      [](const passwd &pwd) { return UserIds{pwd.pw_uid, pwd.pw_gid}; });
}

auto findUserName(const std::uint32_t &uid) -> Result<std::string> {
  return lookup<passwd>(
      "getpwuid_r", _SC_GETPW_R_SIZE_MAX, "uid not found",
      [&](passwd *pwd, char *buf, std::size_t len, passwd **result) {
        return getpwuid_r(static_cast<uid_t>(uid), pwd, buf, len, result);
      },
      [](const passwd &pwd) { return std::string(pwd.pw_name); });
}

auto findGroupId(const std::string &name) -> Result<GroupId> {
  return lookup<group>(
      "getgrnam_r", _SC_GETGR_R_SIZE_MAX, "groupname not found",
      [&](group *grp, char *buf, std::size_t len, group **result) {
        return getgrnam_r(name.c_str(), grp, buf, len, result);
      },
      [](const group &grp) { return GroupId{grp.gr_gid}; });
}

auto findGroupName(const std::uint32_t &gid) -> Result<std::string> {
  return lookup<group>(
      "getgrgid_r", _SC_GETGR_R_SIZE_MAX, "gid not found",
      [&](group *grp, char *buf, std::size_t len, group **result) {
        return getgrgid_r(static_cast<gid_t>(gid), grp, buf, len, result);
      },
      [](const group &grp) { return std::string(grp.gr_name); });
}

auto findGroups(const std::string &name) -> Result<GroupIds> {
  const auto user = findUser(name);
  if (const auto *failure = std::get_if<Failure>(&user)) {
    return *failure;
  }
  const auto primary = std::get<UserIds>(user).gid;

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
    if (getgrouplist(name.c_str(), static_cast<ListId>(primary), groups.data(), &count) != -1) {
      groups.resize(static_cast<std::size_t>(count));
      break;
    }

    if (groups.size() >= MaxGroups) {
      return systemFailure("getgrouplist", ERANGE);
    }

    // Linux reports how many are needed; BSDs and macOS don't, so at least double
    groups.resize(std::max(groups.size() * 2, static_cast<std::size_t>(count)));
  }

  // BSDs and macOS always add the primary group and may list it again. Keep the first of each, like `id -G`.
  GroupIds unique;
  unique.reserve(groups.size());
  for (const auto id : groups) {
    // Always report gids unsigned, like `ids()` does (macOS would give `nobody` as -2)
    const auto gid = static_cast<std::uint32_t>(static_cast<gid_t>(id));
    if (std::find(unique.begin(), unique.end(), gid) == unique.end()) {
      unique.push_back(gid);
    }
  }
  return unique;
}

// ---------------------------------------------------------------------------------------------------------------------
// Conversion to JavaScript. Main (JavaScript) thread only.

auto toError(Napi::Env env, const Failure &failure) -> Napi::Error {
  if (failure.notFound != nullptr) {
    auto error = Napi::Error::New(env, failure.notFound);
    error.Set("code", "ERR_USERID_NOT_FOUND");
    return error;
  }

  // `lib/native.cts` turns these into Node-style system errors (`code: 'EIO'`, ...)
  auto error = Napi::Error::New(env, std::string(failure.syscall) + " failed");
  error.Set("errno", Napi::Number::New(env, failure.errnum));
  error.Set("syscall", failure.syscall);
  return error;
}

auto toValue(Napi::Env env, const UserIds &ids) -> Napi::Value {
  auto ret = Napi::Object::New(env);
  ret["uid"] = Napi::Number::New(env, ids.uid);
  ret["gid"] = Napi::Number::New(env, ids.gid);
  return ret;
}

auto toValue(Napi::Env env, const GroupId &group) -> Napi::Value { return Napi::Number::New(env, group.gid); }

auto toValue(Napi::Env env, const std::string &name) -> Napi::Value { return Napi::String::New(env, name); }

auto toValue(Napi::Env env, const GroupIds &gids) -> Napi::Value {
  auto ret = Napi::Array::New(env, gids.size());
  for (std::uint32_t i = 0; i < gids.size(); i++) {
    ret[i] = Napi::Number::New(env, gids[i]);
  }
  return ret;
}

// ---------------------------------------------------------------------------------------------------------------------
// Argument validation. Runs on the main thread, before any lookup, for both APIs.

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

// ---------------------------------------------------------------------------------------------------------------------
// Bindings

// Splits a lookup's type `Result<Value> (*)(const Input &)`
template <typename Fn> struct Signature;
template <typename T, typename Input> struct Signature<Result<T> (*)(const Input &)> {
  using Value = T;
  using Argument = Input;
};

// Synchronous: look up now, on the calling thread
template <auto Lookup, auto Arg> auto Sync(const CallbackInfo &info) -> Napi::Value {
  const auto env = info.Env();
  const auto result = Lookup(Arg(info));

  if (const auto *failure = std::get_if<Failure>(&result)) {
    throw toError(env, *failure);
  }
  return toValue(env, std::get<0>(result));
}

// Runs one lookup on the libuv thread pool, then settles a promise with its result on the main thread.
// AsyncWorker deletes itself once it has called `OnOK` or `OnError`.
template <auto Lookup> class LookupWorker final : public Napi::AsyncWorker {
  using Types = Signature<decltype(Lookup)>;

public:
  LookupWorker(Napi::Env env, const char *resourceName, typename Types::Argument argument)
      : Napi::AsyncWorker(env, resourceName), deferred(Napi::Promise::Deferred::New(env)),
        argument(std::move(argument)), result(Failure{}) {}

  [[nodiscard]] auto Promise() const -> Napi::Promise { return deferred.Promise(); }

protected:
  // Thread pool. A `std::exception` thrown here (`bad_alloc`, say) leads to `OnError` instead of `OnOK`.
  void Execute() override { result = Lookup(argument); }

  // Main thread
  void OnOK() override {
    const auto env = Env();
    if (const auto *failure = std::get_if<Failure>(&result)) {
      deferred.Reject(toError(env, *failure).Value());
    } else {
      deferred.Resolve(toValue(env, std::get<0>(result)));
    }
  }

  // Main thread, when `Execute` threw
  void OnError(const Napi::Error &error) override { deferred.Reject(error.Value()); }

private:
  Napi::Promise::Deferred deferred;
  typename Types::Argument argument;
  Result<typename Types::Value> result;
};

// The async-hooks resource name of each async function, e.g. `userid:ids`. Passed as the function's `data`.
struct AsyncName {
  std::string resource;
};

// Asynchronous: validate now (a bad argument throws, exactly like the sync version), look up on the thread pool
template <auto Lookup, auto Arg> auto Async(const CallbackInfo &info) -> Napi::Value {
  const auto &name = *static_cast<const AsyncName *>(info.Data());

  auto *worker = new LookupWorker<Lookup>(info.Env(), name.resource.c_str(), Arg(info));
  auto promise = worker->Promise();
  worker->Queue();
  return promise;
}

// Export `name` (sync) and `nameAsync` (returns a promise)
template <auto Lookup, auto Arg> void Export(Napi::Env env, Napi::Object exports, const std::string &name) {
  exports[name] = Napi::Function::New(env, Sync<Lookup, Arg>, name);

  // Lives as long as the function that uses it
  auto *data = new AsyncName{"userid:" + name};
  auto async = Napi::Function::New(env, Async<Lookup, Arg>, name + "Async", data);
  async.AddFinalizer([](Napi::Env /*env*/, AsyncName *finalized) { delete finalized; }, data);
  exports[name + "Async"] = async;
}

auto Init(Napi::Env env, Napi::Object exports) -> Napi::Object {
  Export<findUser, stringArg>(env, exports, "ids");
  Export<findGroupId, stringArg>(env, exports, "gid");
  Export<findGroups, stringArg>(env, exports, "gids");
  Export<findUserName, idArg>(env, exports, "username");
  Export<findGroupName, idArg>(env, exports, "groupname");
  return exports;
}

} // namespace

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
