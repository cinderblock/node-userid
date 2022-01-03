#pragma once

#include <cerrno>
#include <cstddef>
#include <cstdint>

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

struct group {
  /**
   * group name
   **/
  char *gr_name;
  /**
   * group password
   **/
  char *gr_passwd;
  /**
   * group ID
   **/
  gid_t gr_gid;
  /**
   * NULL-terminated array of pointers to names of group members
   **/
  char **gr_mem;
};

/**
 * The getgrnam() function returns a pointer to a structure containing
 * the broken-out fields of the record in the group database (e.g., the
 * local group file /etc/group, NIS, and LDAP) that matches the group
 * name name.
 */
auto getgrnam(const char *name) -> struct group *;

/**
 * The getgrgid() function shall search the group database for an entry with a matching gid.
 */
auto getgrgid(gid_t gid) -> struct group *;

/**
 * @brief Get the grnam r object
 *
 * The getgrnam_r() and getgrgid_r() functions obtain the same information as getgrnam() and getgrgid(), but store the
 * retrieved group structure in the space pointed to by grp. The string fields pointed to by the members of the group
 * structure are stored in the buffer buf of size buflen. A pointer to the result (in case of success) or NULL (in case
 * no entry was found or an error occurred) is stored in *result.
 *
 * The call
 *
 * sysconf(_SC_GETGR_R_SIZE_MAX)
 *
 * returns either -1, without changing errno, or an initial suggested size for buf. (If this size is too small, the call
 * fails with ERANGE, in which case the caller can retry with a larger buffer.)
 *
 * @param name
 * @param grp
 * @param buf
 * @param buflen
 * @param result
 * @return int
 */
auto getgrnam_r(const char *name, struct group *grp, char *buf, std::size_t buflen, struct group **result) -> int;

/**
 * @brief Get the grp object
 *
 * The getgrnam_r() and getgrgid_r() functions obtain the same information as getgrnam() and getgrgid(), but store the
 * retrieved group structure in the space pointed to by grp. The string fields pointed to by the members of the group
 * structure are stored in the buffer buf of size buflen. A pointer to the result (in case of success) or NULL (in case
 * no entry was found or an error occurred) is stored in *result.
 *
 * The call
 *
 * sysconf(_SC_GETGR_R_SIZE_MAX)
 *
 * returns either -1, without changing errno, or an initial suggested size for buf. (If this size is too small, the call
 * fails with ERANGE, in which case the caller can retry with a larger buffer.)
 *
 * @param gid
 * @param grp
 * @param buf
 * @param buflen
 * @param result
 * @return int
 */
auto getgrgid_r(gid_t gid, struct group *grp, char *buf, std::size_t buflen, struct group **result) -> int;

/**
 * The getpwnam() function returns a pointer to a structure containing
 * the broken-out fields of the record in the password database (e.g.,
 * the local password file /etc/passwd, NIS, and LDAP) that matches the
 * username name.
 */
auto getpwnam(const char *name) -> struct passwd *;

/**
 * The getpwuid() function returns a pointer to a structure containing the broken-out fields of the record in the
 * password database that matches the user ID uid.
 */
auto getpwuid(uid_t uid) -> struct passwd *;

/**
 * The getpwnam_r() and getpwuid_r() functions obtain the same information as getpwnam() and getpwuid(), but store the
 * retrieved passwd structure in the space pointed to by pwd. The string fields pointed to by the members of the passwd
 * structure are stored in the buffer buf of size buflen. A pointer to the result (in case of success) or NULL (in case
 * no entry was found or an error occurred) is stored in *result.
 *
 * The call
 *
 *     sysconf(_SC_GETPW_R_SIZE_MAX)
 *
 * returns either `-1`, without changing `errno`, or an initial suggested size for buf.
 * (If this size is too small, the call fails with ERANGE, in which case the caller can retry with a larger buffer.)
 */
auto getpwnam_r(const char *name, struct passwd *pwd, char *buf, std::size_t buflen, struct passwd **result) -> int;

/**
 * The getpwnam_r() and getpwuid_r() functions obtain the same information as getpwnam() and getpwuid(), but store the
 * retrieved passwd structure in the space pointed to by pwd. The string fields pointed to by the members of the passwd
 * structure are stored in the buffer buf of size buflen. A pointer to the result (in case of success) or NULL (in case
 * no entry was found or an error occurred) is stored in *result.
 *
 * The call
 *
 *     sysconf(_SC_GETPW_R_SIZE_MAX)
 *
 * returns either `-1`, without changing `errno`, or an initial suggested size for buf.
 * (If this size is too small, the call fails with ERANGE, in which case the caller can retry with a larger buffer.)
 */
auto getpwuid_r(uid_t uid, struct passwd *pwd, char *buf, std::size_t buflen, struct passwd **result) -> int;

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

/**
 * @brief https://man7.org/linux/man-pages/man3/sysconf.3.html
 *
 * @param name
 * @return long
 */
auto sysconf(int name) -> long; // NOLINT(google-runtime-int)

/**
 * @brief Inquire about the parameter corresponding to _POSIX_GETPW_R_SIZE_MAX.
 */
extern const int _SC_GETPW_R_SIZE_MAX; // NOLINT(bugprone-reserved-identifier,cert-dcl37-c,cert-dcl51-cpp)
/**
 * @brief Inquire about the parameter corresponding to _POSIX_GETGR_R_SIZE_MAX.
 */
extern const int _SC_GETGR_R_SIZE_MAX; // NOLINT(bugprone-reserved-identifier,cert-dcl37-c,cert-dcl51-cpp)

#if (_POSIX_C_SOURCE >= 200112L) && !_GNU_SOURCE
/**
 * @brief
 *
 * XSI-compliant
 *
 * @param errnum
 * @param buf
 * @param buflen
 * @return int 0 on success
 */
auto strerror_r(int errnum, char *buf, std::size_t buflen) -> int;
#else
/**
 * @brief
 *
 * GNU-specific
 *
 * @param errnum
 * @param buf
 * @param buflen
 * @return int 0 on success
 */
auto strerror_r(int errnum, char *buf, std::size_t buflen) -> char *;
#endif

static_assert(false, "Something is wrong. This file should not be being built.");

// cSpell:ignore untruncated NOLINT
