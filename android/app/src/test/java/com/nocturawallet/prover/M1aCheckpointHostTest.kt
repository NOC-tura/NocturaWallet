package com.nocturawallet.prover

import java.io.File
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

/**
 * The desktop rehearsal of the M1a checkpoint: the SAME sequence the phone runs
 * ([M1aCheckpoint]), over the host build of libnoctura_prover.so (`cargo build --release
 * --features jni-host`) with the pinned key files from NOCTURA_A0_KEYS_DIR. It writes the report
 * to NOCTURA_M1A_REPORT_OUT (default build/m1a-checkpoint/host-report.json) so the desk script can
 * run every one of its checks on a real report before a phone is plugged in:
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs verify --rehearsal <that file>
 *
 * What it cannot show (only the phone can): isSupported() through the React module on ART, the
 * ABI gate on aarch64, the arm64 library loading inside the installed app, the proving thread's
 * stack on Android, the time a prove takes on the phone.
 *
 * Without NOCTURA_A0_HOST_LIB_DIR or NOCTURA_A0_KEYS_DIR it is SKIPPED, loudly
 * (`M1A-HOST-SKIPPED` on stderr); under CI it fails instead.
 */
class M1aCheckpointHostTest {
    private val fixtures = File("../../native/noctura-prover/tests/fixtures")
    private var keysDir: String? = null

    @Before
    fun loadTheHostLibrary() {
        val lib = System.getenv("NOCTURA_A0_HOST_LIB_DIR")
        keysDir = System.getenv("NOCTURA_A0_KEYS_DIR")
        if (lib == null || keysDir == null) {
            check(System.getenv("CI") == null) { "CI must provide NOCTURA_A0_HOST_LIB_DIR and NOCTURA_A0_KEYS_DIR — refusing to skip" }
            System.err.println("M1A-HOST-SKIPPED ${javaClass.simpleName}: NOCTURA_A0_HOST_LIB_DIR / NOCTURA_A0_KEYS_DIR not set — the rehearsal did NOT run")
        }
        assumeTrue(lib != null && keysDir != null)
        NocturaNativeLib.ensureLoaded()
    }

    @Test
    fun theCheckpointSequenceRunsOverTheHostLibraryAndWritesTheReport() {
        val platform = JSONObject()
            .put("where", "host-rehearsal")
            .put("javaVmName", System.getProperty("java.vm.name"))
            .put("osArch", System.getProperty("os.arch"))
        val report = M1aCheckpoint.run(
            File(fixtures, "a0-key-vectors.json").readText(),
            File(fixtures, "a0-prove-vectors.json").readText(),
            { File(keysDir!!, it).path },
            platform,
            null,
        )
        val out = File(System.getenv("NOCTURA_M1A_REPORT_OUT") ?: "build/m1a-checkpoint/host-report.json")
        out.parentFile?.mkdirs()
        out.writeText(report.toString(2) + "\n")
        System.err.println("M1A-HOST-REPORT ${out.absolutePath}")

        assertEquals(emptyList<String>(), M1aCheckpoint.deviceFailures(report, expectSupported = false))
        // The values against the offline fixtures (the desk recomputes them again from the mnemonic).
        val note0 = JSONObject(File(fixtures, "a0-key-vectors.json").readText()).getJSONArray("seeds").getJSONObject(0)
            .getJSONArray("notes").getJSONObject(0)
        assertEquals("0", note0.getString("depositIndex"))
        assertEquals(note0.getString("rho"), report.getJSONObject("depositRho").getString("ok"))
        val c = note0.getJSONArray("commitments").getJSONObject(2)
        assertEquals(M1aCheckpoint.DEPOSIT_AMOUNT, c.getString("amount"))
        assertEquals(c.getString("commitment"), report.getJSONObject("commitment").getString("ok"))
        val scenario0 = JSONObject(File(fixtures, "a0-prove-vectors.json").readText()).getJSONArray("scenarios").getJSONObject(0)
        assertEquals(scenario0.getJSONArray("publicInputs").toString(), report.getJSONObject("depositProof").getJSONArray("publicInputs").toString())
        // The proving thread is the app's, not the test's.
        assertEquals(A0Prover.THREAD_NAME, report.getJSONObject("depositProof").getString("thread"))
        assertTrue(report.getJSONObject("depositProof").getJSONArray("publicInputs").length() == 4)
    }
}

/** The device-side judge itself — pure logic, runs everywhere (no library, no key files). */
class M1aCheckpointDeviceFailuresTest {
    @Test
    fun deviceFailuresSeesEachRefusalThatDidNotHappen() {
        // Negative controls for the device-side judge: a report where each check fails.
        val bad = JSONObject()
            .put("isSupported", false)
            .put("complete", false)
            .put("seedCopyZeroFilled", false)
            .put("withdrawWithoutAuthId", JSONObject().put("ok", true))
            .put("withdrawReusedAuthId", JSONObject().put("error", "E_A0_AUTH_MISMATCH"))
            .put("depositRhoAfterClose", JSONObject().put("ok", "00"))
        val f = M1aCheckpoint.deviceFailures(bad, expectSupported = true)
        assertEquals(f.toString(), 10, f.size)
        assertTrue(M1aCheckpoint.deviceFailures(bad.put("isSupported", JSONObject.NULL), expectSupported = false).none { it.startsWith("isSupported") })
    }
}
