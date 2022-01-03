#include "FunctionArg.hh"

using Napi::CallbackInfo;
using Napi::Number;
using Napi::String;
using Napi::TypeError;

template <> auto userid::getArg(const CallbackInfo &info, unsigned index) -> int32_t {
  if (info.Length() < index + 1) {
    throw TypeError::New(info.Env(), "Wrong number of arguments");
  }

  if (!info[index].IsNumber()) {
    throw TypeError::New(info.Env(), "Argument must be a number");
  }

  return info[index].As<Number>().Int32Value();
}

template <> auto userid::getArg(const CallbackInfo &info, unsigned index) -> std::string {
  if (info.Length() < index + 1) {
    throw TypeError::New(info.Env(), "Wrong number of arguments");
  }

  if (!info[index].IsString()) {
    throw TypeError::New(info.Env(), "Argument must be a string");
  }

  return info[index].As<String>();
}
