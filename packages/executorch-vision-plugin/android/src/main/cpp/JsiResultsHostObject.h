#pragma once
#include <jsi/jsi.h>
#include <mutex>
#include <vector>

struct Detection {
  float x, y, w, h, score;
  int classId;
};

class JsiResultsHostObject : public facebook::jsi::HostObject {
public:
  static std::shared_ptr<JsiResultsHostObject> instance();

  void setResults(const std::vector<Detection>& results);
  facebook::jsi::Value get(facebook::jsi::Runtime& rt, const facebook::jsi::PropNameID& name) override;

private:
  std::mutex _mutex;
  std::vector<Detection> _results;
};
