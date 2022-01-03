
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

  const auto size = strerrorlen_s(errCode);

  // strerrorlen_s returns one less than needed size. Make sure it's filled with null terminators.
  std::vector<char> buffer(size + 1, '\0');

  const auto err = strerror_s(buffer.data(), size, errCode);

  if (err != 0) {
    throw Error::New(env, "strerror_s failed");
  }

  throw Error::New(env, buffer.data());
}
