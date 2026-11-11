// Test fixture: a `getpwnam_r` that takes USERID_SLOW_LOOKUP_MS milliseconds, like a lookup against a slow LDAP server.
// Load it with LD_PRELOAD (glibc Linux) to run test/event-loop.test.mts:
//
//   cc -shared -fPIC -o slow-getpwnam.so test/fixtures/slow-getpwnam.c -ldl
//   LD_PRELOAD=$PWD/slow-getpwnam.so USERID_SLOW_LOOKUP_MS=300 node --test test/event-loop.test.mts

#define _GNU_SOURCE
#include <dlfcn.h>
#include <pwd.h>
#include <stdlib.h>
#include <time.h>

typedef int (*getpwnam_r_fn)(const char *, struct passwd *, char *, size_t, struct passwd **);

int getpwnam_r(const char *name, struct passwd *pwd, char *buf, size_t len, struct passwd **result) {
  getpwnam_r_fn real = (getpwnam_r_fn)dlsym(RTLD_NEXT, "getpwnam_r");

  const char *ms = getenv("USERID_SLOW_LOOKUP_MS");
  if (ms != NULL) {
    long delay = strtol(ms, NULL, 10);
    struct timespec wait = {delay / 1000, (delay % 1000) * 1000000L};
    while (nanosleep(&wait, &wait) != 0) {
    }
  }

  return real(name, pwd, buf, len, result);
}
