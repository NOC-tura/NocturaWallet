package com.nocturawallet

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.nocturawallet.screensecurity.NocturaScreenSecurityPackage
import com.nocturawallet.prover.NocturaProverPackage
// NocturaKeyPackage (native blst, C1) is DISABLED: libnoctura_key.so bundles its
// own NDK libc++_shared.so which conflicts with React Native's at startup and
// crashes every release build on launch. C2 shielded uses the JS view-key model
// and never calls native, so disabling it is safe. RE-ENABLE only with the libc++
// conflict fixed (build libnoctura with ANDROID_STL=c++_static) + on-device
// verification, when native shielded ops are needed (Project 2 / withdraw
// recoverability). See project_native_libcpp_crash memory.
// import com.nocturawallet.shieldedkey.NocturaKeyPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Project-local native modules (not auto-linked because they're not
          // distributed as separate npm packages).
          add(NocturaScreenSecurityPackage())
          // add(NocturaKeyPackage()) // disabled — libc++ startup-crash (see import note)
          // Pure-Rust prover (libnoctura_prover.so: libc/libm/libdl only, NO
          // libc++_shared — readelf-verified) → safe to enable, unlike blst above.
          add(NocturaProverPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
