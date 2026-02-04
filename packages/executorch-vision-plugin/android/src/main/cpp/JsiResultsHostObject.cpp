#include "JsiResultsHostObject.h"

using namespace facebook;

static std::shared_ptr<JsiResultsHostObject> g_instance;

std::shared_ptr<JsiResultsHostObject> JsiResultsHostObject::instance() {
  if (!g_instance) g_instance = std::make_shared<JsiResultsHostObject>();
  return g_instance;
}

void JsiResultsHostObject::setResults(const std::vector<Detection>& results) {
  std::lock_guard<std::mutex> lock(_mutex);
  _results = results;
}

jsi::Value JsiResultsHostObject::get(jsi::Runtime& rt, const jsi::PropNameID& name) {
  auto prop = name.utf8(rt);
  if (prop == "getLatest") {
    return jsi::Function::createFromHostFunction(rt, name, 0,
      [this](jsi::Runtime& rt, const jsi::Value&, const jsi::Value*, size_t) {
        std::lock_guard<std::mutex> lock(_mutex);
        auto arr = jsi::Array(rt, _results.size());
        for (size_t i = 0; i < _results.size(); i++) {
          auto obj = jsi::Object(rt);
          obj.setProperty(rt, "x", _results[i].x);
          obj.setProperty(rt, "y", _results[i].y);
          obj.setProperty(rt, "w", _results[i].w);
          obj.setProperty(rt, "h", _results[i].h);
          obj.setProperty(rt, "score", _results[i].score);
          obj.setProperty(rt, "classId", _results[i].classId);
          arr.setValueAtIndex(rt, i, obj);
        }
        return arr;
      });
  }
  return jsi::Value::undefined();
}
