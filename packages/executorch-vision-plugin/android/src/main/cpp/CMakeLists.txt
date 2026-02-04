cmake_minimum_required(VERSION 3.10.2)
project(executorch-vision-plugin)

add_library(yolo_plugin SHARED 
  src/main/cpp/YoloFrameProcessor.cpp
  src/main/cpp/YoloPostprocess.cpp
  src/main/cpp/JsiResultsHostObject.cpp
)

# ExecuTorch
add_library(executorch STATIC IMPORTED)
set_target_properties(executorch PROPERTIES
  IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/executorch/lib/libexecutorch.a
)

target_include_directories(yolo_plugin PRIVATE
  ${CMAKE_SOURCE_DIR}/executorch/include
  src/main/cpp
)

target_link_libraries(yolo_plugin executorch log)
