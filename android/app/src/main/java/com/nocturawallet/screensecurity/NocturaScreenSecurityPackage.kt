package com.nocturawallet.screensecurity

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage registration for the NocturaScreenSecurity native module.
 * Added manually in MainApplication.kt — auto-linking only covers packages
 * defined by external react-native libraries, not project-local modules.
 */
class NocturaScreenSecurityPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(NocturaScreenSecurityModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
