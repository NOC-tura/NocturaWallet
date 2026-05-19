package com.nocturawallet.screensecurity

import android.app.Activity
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Native Android bridge that toggles the `FLAG_SECURE` window flag on the
 * current activity. While the flag is set the OS blocks screenshots, blocks
 * screen recording, blacks out the screen in the recent-tasks thumbnail, and
 * prevents the surface from being captured by accessibility / cast services.
 *
 * Mounted from JS via `src/modules/screenSecurity/screenSecurityModule.ts`.
 * Used on every secret-bearing screen (seed display, seed confirm, PIN entry,
 * import, unlock, change PIN, backup, ZK proof generation) — the canonical
 * FLAG_SECURE-9 list locked in Phase 3.
 *
 * iOS counterpart is a separate UIApplication.willResignActiveNotification
 * observer that mounts a blur overlay (out of scope for this Android module).
 */
@ReactModule(name = NocturaScreenSecurityModule.NAME)
class NocturaScreenSecurityModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "NocturaScreenSecurity"
    }

    override fun getName() = NAME

    @ReactMethod
    fun enableSecureScreen(promise: Promise) {
        val activity: Activity? = getCurrentActivity()
        if (activity == null) {
            // No current activity (e.g. during app background or early-mount).
            // Resolve silently rather than reject — the next mount cycle will retry.
            promise.resolve(null)
            return
        }
        activity.runOnUiThread {
            activity.getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun disableSecureScreen(promise: Promise) {
        val activity: Activity? = getCurrentActivity()
        if (activity == null) {
            promise.resolve(null)
            return
        }
        activity.runOnUiThread {
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            promise.resolve(null)
        }
    }
}
