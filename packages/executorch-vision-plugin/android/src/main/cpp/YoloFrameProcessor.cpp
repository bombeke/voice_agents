#include <visioncamera/FrameProcessorPlugin.h>
#include <executorch/runtime/executor/module.h>
#include <atomic>
#include <thread>
#include "YoloPostprocess.h"
#include "JsiResultsHostObject.h"

using namespace facebook;

static std::unique_ptr<executorch::runtime::Method> g_method;
static std::atomic<bool> g_busy{false};

class YoloFrameProcessorPlugin : public visioncamera::FrameProcessorPlugin {
public:
  YoloFrameProcessorPlugin() {
    if (!g_method) {
      auto module = executorch::runtime::Module("yolov26n.pte");
      // Prefer NNAPI / GPU if available
      module.set_preferred_backend("nnapi");
      g_method = module.load_method("forward");
    }
  }

  jsi::Value callback(jsi::Runtime& rt, visioncamera::Frame* frame, const jsi::Value*, size_t) override {
    if (g_busy.exchange(true)) return jsi::Value::undefined();

    uint8_t* data = frame->getData();
    int w = frame->getWidth();
    int h = frame->getHeight();

    std::thread([data, w, h]() {
      // TODO: preprocess + reuse tensor buffer
      // TODO: method->execute(...)
      // TODO: preprocess into static tensor buffer

      // g_method->execute(inputs);

      // TODO: get output pointer
      const float* output = nullptr;

      auto results = yoloDecodeAndNms(output, 25200, 80, 0.25f, 0.45f);
      JsiResultsHostObject::instance()->setResults(results);

      g_busy.store(false);
    }).detach();

    return jsi::Value::undefined();
  }
};

VISIONCAMERA_EXPORT_FRAME_PROCESSOR(YoloFrameProcessorPlugin)
