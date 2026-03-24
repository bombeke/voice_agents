#include "DetectTagsHostObject.h"

using namespace facebook;

jsi::Value DetectTagsHostObject::get(
  jsi::Runtime& rt,
  const jsi::PropNameID& name
) {
  auto prop = name.utf8(rt);

  if (prop == "detectTags") {
    return jsi::Function::createFromHostFunction(
      rt,
      name,
      2,
      [](jsi::Runtime& rt,
         const jsi::Value&,
         const jsi::Value* args,
         size_t count) -> jsi::Value {

        return callKotlinDetectTags(rt, args[0], args[1]);
      }
    );
  }

  return jsi::Value::undefined();
}