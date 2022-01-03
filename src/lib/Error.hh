#pragma once

#include <napi.h>

namespace userid {
/**
 * @brief Throw if the result is nullptr or errNum is not 0
 *
 * @param result
 * @param errNum
 * @param nullMessage
 */
auto checkError(Napi::Env env, void const *result, int errNum, const char *nullMessage) -> void;
} // namespace userid
