#include "YoloPostprocess.h"
#include <algorithm>
#include <cmath>

static float iou(const Detection& a, const Detection& b) {
  float x1 = std::max(a.x, b.x);
  float y1 = std::max(a.y, b.y);
  float x2 = std::min(a.x + a.w, b.x + b.w);
  float y2 = std::min(a.y + a.h, b.y + b.h);
  float inter = std::max(0.f, x2 - x1) * std::max(0.f, y2 - y1);
  float unionA = a.w * a.h + b.w * b.h - inter;
  return inter / unionA;
}

std::vector<Detection> yoloDecodeAndNms(
  const float* output,
  int numDetections,
  int numClasses,
  float confThresh,
  float iouThresh
) {
  std::vector<Detection> dets;

  for (int i = 0; i < numDetections; i++) {
    const float* row = output + i * (5 + numClasses);
    float score = row[4];
    if (score < confThresh) continue;

    int cls = 0;
    float best = 0.f;
    for (int c = 0; c < numClasses; c++) {
      if (row[5 + c] > best) {
        best = row[5 + c];
        cls = c;
      }
    }

    Detection d;
    d.x = row[0];
    d.y = row[1];
    d.w = row[2];
    d.h = row[3];
    d.score = score * best;
    d.classId = cls;
    dets.push_back(d);
  }

  std::sort(dets.begin(), dets.end(), [](auto& a, auto& b) {
    return a.score > b.score;
  });

  std::vector<Detection> result;
  for (auto& d : dets) {
    bool keep = true;
    for (auto& r : result) {
      if (iou(d, r) > iouThresh) {
        keep = false;
        break;
      }
    }
    if (keep) result.push_back(d);
  }
  return result;
}
