// This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

#include "userid.hh"

#include <algorithm>
#include <cstdint>
#include <vector>

#if !defined(_WIN32)
#include <grp.h>
#include <pwd.h>
#include <unistd.h>

#else
// Mocks for Windows

using uid_t = uint32_t;
using gid_t = uint32_t;
struct passwd {
  char *pw_name;   /* username */
  char *pw_passwd; /* user password */
  uid_t pw_uid;    /* user ID */
  gid_t pw_gid;    /* group ID */
  char *pw_gecos;  /* user information */
  char *pw_dir;    /* home directory */
  char *pw_shell;  /* shell program */
};

/**
 * The getpwnam() function returns a pointer to a structure containing
 * the broken-out fields of the record in the password database (e.g.,
 * the local password file /etc/passwd, NIS, and LDAP) that matches the
 * username name.
 */
auto getpwnam(const char *name) -> struct passwd *;

/**
 * The getgrouplist() function scans the group database (see group(5))
 * to obtain the list of groups that user belongs to.  Up to *ngroups of
 * these groups are returned in the array groups.
 *
 * If it was not among the groups defined for user in the group
 * database, then group is included in the list of groups returned by
 * getgrouplist(); typically this argument is specified as the group ID
 * from the password record for user.
 *
 * The ngroups argument is a value-result argument: on return it always
 * contains the number of groups found for user, including group; this
 * value may be greater than the number of groups stored in groups.
 *
 * @return If the number of groups of which user is a member is less than or
 * equal to *ngroups, then the value *ngroups is returned.
 *
 * If the user is a member of more than *ngroups groups, then
 * getgrouplist() returns -1.  In this case, the value returned in
 * *ngroups can be used to resize the buffer passed to a further call
 * getgrouplist().
 */
auto getgrouplist(const char *user, gid_t group, gid_t *groups, int *ngroups) -> int;
#endif

using Napi::Array;
using Napi::CallbackInfo;
using Napi::Error;
using Napi::Number;
using Napi::TypeError;

auto userid::Gids(const CallbackInfo &info) -> Array {
  const auto env = info.Env();

  if (info.Length() < 1) {
    throw TypeError::New(env, "Wrong number of arguments");
  }

  if (!info[0].IsString()) {
    throw TypeError::New(env, "Argument must be a string");
  }

  const auto username = std::string(info[0].As<String>());

  errno = 0;
  const auto *const pw = getpwnam(username.c_str());

  if (pw == nullptr) {
    // TODO(Cameron): More verbose error message that includes errno
    throw Error::New(env, "getpwnam");
  }

#ifdef __APPLE__
  typedef int gidType;
#else  // ifdef __APPLE__
  using gidType = gid_t;
#endif // ifdef __APPLE__

  gidType *groups = nullptr;

  int foundGroups;
  int ngroups = 4;

  do {
    // It is safe to delete nullptr on first run
    delete[] groups;

    // Make our list of groups bigger by 2x at a time
    ngroups *= 2;

    groups = new gidType[ngroups];

    if (groups == nullptr) {
      throw Error::New(env, "Malloc error generating list of groups");
    }

    foundGroups = getgrouplist(username.c_str(), pw->pw_gid, groups, &ngroups);

    // getgrouplist forces us to guess how many groups the user might be in
    // returns `-1` if we guessed too low
  } while (foundGroups == -1);

  // On success, `ngroups` holds the number of groups stored. (The return value is not a count on every platform.)
  // BSDs (and macOS) always add the base group and may list it again, so drop duplicates like `id -G` does.
  std::vector<gidType> unique;
  unique.reserve(ngroups);

  for (int i = 0; i < ngroups; i++) {
    if (std::find(unique.begin(), unique.end(), groups[i]) == unique.end()) {
      unique.push_back(groups[i]);
    }
  }

  delete[] groups;

  auto ret = Array::New(env, unique.size());

  for (std::size_t i = 0; i < unique.size(); i++) {
    ret[static_cast<uint32_t>(i)] = Number::New(env, unique[i]);
  }

  return ret;
}
