cmake_minimum_required(VERSION 3.22.1)
project(executorch_vision_plugin)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(executorch-vision-plugin SHARED
  YoloFrameProcessor.cpp
  YoloPostprocess.cpp
  JsiResultsHostObject.cpp
)

# ExecuTorch static lib
add_library(executorch STATIC IMPORTED)
set_target_properties(executorch PROPERTIES
  IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/executorch/lib/libexecutorch.a
)

target_include_directories(executorch-vision-plugin PRIVATE
  ${CMAKE_SOURCE_DIR}/executorch/include
  ${CMAKE_CURRENT_SOURCE_DIR}
)

find_library(log-lib log)

target_link_libraries(
  executorch-vision-plugin
  executorch
  ${log-lib}
)
