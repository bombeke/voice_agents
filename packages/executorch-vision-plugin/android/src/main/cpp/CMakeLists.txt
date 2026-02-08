cmake_minimum_required(VERSION 3.22.1)
project(executorch_vision_plugin)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(executorch-vision-plugin SHARED
  YoloFrameProcessor.cpp
  YoloPostprocess.cpp
  JsiResultsHostObject.cpp
)

target_include_directories(executorch-vision-plugin PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${REACT_ANDROID_DIR}/src/main/java/com/facebook/react/turbomodule/core/jni
  ${REACT_ANDROID_DIR}/src/main/jni/react/jni
  ${REACT_ANDROID_DIR}/src/main/jni/first-party/fbjni
  ${REACT_ANDROID_DIR}/src/main/jni/first-party/yogajni/include
  ${REACT_ANDROID_DIR}/src/main/jni/first-party/folly
  ${REACT_ANDROID_DIR}/src/main/jni/third-party/boost
  ${REACT_ANDROID_DIR}/src/main/jni/third-party/glog
  ${REACT_ANDROID_DIR}/src/main/jni/third-party/double-conversion
  ${REACT_ANDROID_DIR}/src/main/jni/third-party/folly/include
  ${REACT_COMMON_DIR}
)

find_library(log-lib log)
find_package(ReactAndroid REQUIRED CONFIG)
find_package(visioncamera REQUIRED CONFIG)

target_link_libraries(
  executorch-vision-plugin
  ${log-lib}
  ReactAndroid::jsi
  ReactAndroid::reactnativejni
  visioncamera::visioncamera
)
