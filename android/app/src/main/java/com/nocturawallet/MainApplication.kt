package com.nocturawallet

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.nocturawallet.screensecurity.NocturaScreenSecurityPackage
import com.nocturawallet.prover.NocturaProverPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Project-local native modules (not auto-linked because they're not
          // distributed as separate npm packages).
          add(NocturaScreenSecurityPackage())
          // Pure-Rust prover and A0 core (libnoctura_prover.so: libc/libm/libdl only,
          // no C++ runtime — native/noctura-prover/check-needed.sh, in CI).
          add(NocturaProverPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
