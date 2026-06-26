cmake_minimum_required(VERSION 3.18.1)
project(noctura_key)
enable_language(ASM)

# blst build: the amalgamated src/server.c + the per-arch assembly dispatcher
# build/assembly.S (which #includes the right build/elf/*-armv8.S etc. for the
# NDK target). The portable no-asm path only supports 32-bit limbs, so on
# aarch64/x86_64 we MUST use the assembly (no __BLST_NO_ASM__).
add_library(noctura_key SHARED
    noctura_key_jni.cpp
    blst/src/server.c
    blst/build/assembly.S)

target_include_directories(noctura_key PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/blst/bindings)

find_library(log-lib log)
target_link_libraries(noctura_key ${log-lib})
