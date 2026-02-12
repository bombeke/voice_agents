cmake_minimum_required(VERSION 3.29)
project(VisionCameraExecutorch)

#set(EXECUTORCH_BUILD_PRESET_FILE ${CMAKE_SOURCE_DIR}/executorch/tools/cmake/preset/llm.cmake)
# 1. Define where your prebuilt libraries are located
set(EXECUTORCH_LIB_DIR ${CMAKE_CURRENT_SOURCE_DIR}/lib/${ANDROID_ABI})

# 2. Declare the ExecuTorch prebuilt library
add_library(executorch_lib STATIC IMPORTED) # Use SHARED if it's a .so file
set_target_properties(executorch_lib PROPERTIES 
    IMPORTED_LOCATION ${EXECUTORCH_LIB_DIR}/libexecutorch.a)

# 3. Create your module's shared library
add_library(
    VisionCameraExecutorch 
    SHARED 
    executorch_wrapper.cpp
)

# CMakeLists.txt
#add_subdirectory("executorch")

#target_link_libraries(
#    my_target
#    PRIVATE executorch
#    executorch::backends
#    executorch::extensions
#    executorch::kernels)
# 4. Link everything together
target_link_libraries(VisionCameraExecutorch
    executorch_lib
    log # Android log library
    android
)
