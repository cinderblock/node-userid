#include "FunctionArg.hh"

using Napi::CallbackInfo;
using Napi::Number;
using Napi::String;
using Napi::TypeError;

template <> auto userid::getArg(const CallbackInfo &info, unsigned index) -> int32_t {
  // CallbackInfo::operator[] doesn't throw when out of bounds
  if (info.Length() <= index) {
    throw TypeError::New(info.Env(), "Wrong number of arguments");
  }

  // Improve error message
  if (!info[index].IsNumber()) {
    throw TypeError::New(info.Env(), "Argument must be a number");
  }

  return info[index].As<Number>().Int32Value();
}

template <> auto userid::getArg(const CallbackInfo &info, unsigned index) -> std::string {
  // CallbackInfo::operator[] doesn't throw when out of bounds
  if (info.Length() <= index) {
    throw TypeError::New(info.Env(), "Wrong number of arguments");
  }

  // Improve error message
  if (!info[index].IsString()) {
    throw TypeError::New(info.Env(), "Argument must be a string");
  }

  return info[index].As<String>();
}
