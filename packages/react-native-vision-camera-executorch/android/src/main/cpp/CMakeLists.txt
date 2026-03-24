cmake_minimum_required(VERSION 3.9.0)

project(visioncameraexecutorch)

add_library(
  visioncameraexecutorch
  SHARED
  DetectTagsHostObject.cpp
  JNIInstaller.cpp
  JSIUtils.cpp
)

find_package(fbjni REQUIRED)

target_link_libraries(
  visioncameraexecutorch
  fbjni::fbjni
)