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
)

find_library(log-lib log)

target_link_libraries(
  executorch-vision-plugin
  ${log-lib}
)
