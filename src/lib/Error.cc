
#include "Error.hh"
#include <cstring>

using Napi::Error;

#if defined(_WIN32)
#include "WindowsMocks.hh"
#endif

void userid::checkError(Napi::Env const env, void const *const result, int const errCode,
                        const char *const nullMessage) {
  if (result != nullptr) {
    return;
  }

  if (errCode == 0) {
    throw Error::New(env, nullMessage);
  }

  const unsigned size = 80;

  // Make sure it's filled with null terminators.
  std::vector<char> buffer(size, '\0');

#if (_POSIX_C_SOURCE >= 200112L) && !_GNU_SOURCE
  while (true) {

    auto err = strerror_r(errCode, buffer.data(), buffer.size());

    // Behavior changed in glibc 2.13
#if defined(__GLIBC__) && (__GLIBC__ < 2 || (__GLIBC__ == 2 && __GLIBC_MINOR__ < 13))
    if (err == -1) {
      err = errno;
    }
#endif

    if (err == ERANGE) {
      buffer.resize(buffer.size() * 2);
      continue;
    }

    if (err != 0) {
      throw Error::New(env, "strerror_r failed");
    }

    throw Error::New(env, buffer.data());
  }
#else
  auto *const err = strerror_r(errCode, buffer.data(), size);
  throw Error::New(env, err);
#endif
}
