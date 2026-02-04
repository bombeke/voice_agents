#pragma once
#include <vector>
#include "JsiResultsHostObject.h"

std::vector<Detection> yoloDecodeAndNms(
  const float* output,
  int numDetections,
  int numClasses,
  float confThresh,
  float iouThresh
);
