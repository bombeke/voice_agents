#pragma once
#include <jsi/jsi.h>

class DetectTagsHostObject : public facebook::jsi::HostObject {
public:
  facebook::jsi::Value get(
    facebook::jsi::Runtime& rt,
    const facebook::jsi::PropNameID& name
  ) override;
};