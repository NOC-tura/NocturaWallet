package com.nocturawallet.prover

import com.facebook.react.bridge.JavaOnlyArray
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

/**
 * The real JNI: Kotlin's NocturaA0Native over the host build of libnoctura_prover.so
 * (`cargo build --release --features jni-host` — the same #[no_mangle] functions the arm64
 * library exports). NOCTURA_A0_HOST_LIB_DIR names the directory holding it; without it these
 * tests are SKIPPED, loudly (`A0-JNI-SKIPPED` on stderr), and under CI they fail instead.
 *
 * Expected values: the offline fixtures under native/noctura-prover/tests/fixtures (written by
 * scripts/a0-vectors/, never by the code under test).
 */
class A0JniTest {
    private val fixtures = File("../../native/noctura-prover/tests/fixtures")
    private val keys = JSONObject(File(fixtures, "a0-key-vectors.json").readText())
    private val proves = JSONObject(File(fixtures, "a0-prove-vectors.json").readText())
    private val seed = keys.getJSONArray("seeds").getJSONObject(0)
    private val notes = seed.getJSONArray("notes")
    private val noFile = "/nonexistent/never-read"

    @Before
    fun loadTheHostLibrary() {
        val dir = System.getenv("NOCTURA_A0_HOST_LIB_DIR")
        if (dir == null) {
            check(System.getenv("CI") == null) { "CI must provide NOCTURA_A0_HOST_LIB_DIR — refusing to skip" }
            System.err.println("A0-JNI-SKIPPED ${javaClass.simpleName}: NOCTURA_A0_HOST_LIB_DIR is not set — the JNI tests did NOT run")
        }
        assumeTrue(dir != null)
        NocturaNativeLib.ensureLoaded()
    }

    private fun ok(json: String?): Any? {
        val r = A0Result.parse(json)
        check(r is A0Result.Ok) { "expected ok, got $json" }
        return r.value
    }
    private fun code(json: String?): String {
        val r = A0Result.parse(json)
        check(r is A0Result.Err) { "expected an error, got $json" }
        return r.code
    }
    private fun seedArray(): JavaOnlyArray {
        val hex = seed.getString("seed")
        return JavaOnlyArray.from((0 until hex.length / 2).map { hex.substring(2 * it, 2 * it + 2).toInt(16) })
    }
    private fun open(): String {
        var copy: ByteArray? = null
        val out = A0Seed.use(seedArray()) { b ->
            copy = b
            NocturaA0Native.keysOpen(b)
        }
        assertTrue("Kotlin's seed copy was not zero-filled", copy!!.all { it == 0.toByte() })
        return ok(out) as String
    }
    private fun withdraw() = proves.getJSONArray("scenarios").getJSONObject(1)
    private fun authorize(h: String): String {
        val a = withdraw().getJSONObject("authorization")
        return ok(NocturaA0Native.authorizeUnshield(h, a.getString("owner"), a.getString("amount"), a.getString("fee"))) as String
    }
    private fun prove(h: String, authId: String?): String? =
        NocturaA0Native.prove(h, "withdraw_change", withdraw().getJSONObject("witness").toString(), authId, noFile, noFile)

    @Test
    fun theBoundCallsReturnTheFixturesPublicValuesThroughTheJni() {
        val h = open()
        assertTrue(h.matches(Regex("[1-9][0-9]*")))
        val n0 = notes.getJSONObject(0)
        val n1 = notes.getJSONObject(1)
        assertEquals(n0.getString("rho"), ok(NocturaA0Native.depositRho(h, "0")))
        val c = n0.getJSONArray("commitments").getJSONObject(2)
        assertEquals(c.getString("commitment"), ok(NocturaA0Native.commitment(h, c.getString("amount"), n0.getString("rho"))))
        val spent = ok(NocturaA0Native.matchSpent(h, arrayOf(n1.getString("nullifier")), arrayOf(n0.getString("rho"), n1.getString("rho")))) as JSONArray
        assertEquals("[1]", spent.toString())
        assertEquals("E_A0_ARG", code(NocturaA0Native.depositRho("01", "0")))
        assertEquals(JSONObject.NULL, ok(NocturaA0Native.keysClose(h)))
        assertEquals("E_A0_UNKNOWN_HANDLE", code(NocturaA0Native.depositRho(h, "0")))
        val bad = A0Seed.use(JavaOnlyArray.of(1, 2, 3)) { NocturaA0Native.keysOpen(it) }
        assertEquals("E_A0_SEED_LENGTH", code(bad))
    }

    @Test
    fun invAuthAWithdrawChangeProveThroughTheJniNeedsTheApproval() {
        val h = open()
        assertEquals("E_A0_AUTH_ABSENT", code(prove(h, null)))
        authorize(h)
        assertEquals("E_A0_AUTH_MISMATCH", code(prove(h, "00".repeat(16))))
        authorize(h)
        assertEquals("E_A0_ARG", code(prove(h, "not-an-auth-id")))
        val id = authorize(h)
        assertEquals("E_A0_AUTH_ABSENT", code(prove(h, null)))
        assertEquals("E_A0_AUTH_ABSENT", code(prove(h, id)))
        // positive control: an approval gets through, to the (absent) key file — once
        val id2 = authorize(h)
        assertEquals("E_A0_KEY_FILE_READ", code(prove(h, id2)))
        assertEquals("E_A0_AUTH_ABSENT", code(prove(h, id2)))
        NocturaA0Native.keysClose(h)
    }

    /**
     * Review I1 (Task 4, fix round 1): 5,000 + 5,000 values through the real JNI in one call — the
     * values come through (the own notes' indices, none of the fillers). The local-reference
     * books are kept by the Rust test `tests_android_refs` over a fake JNIEnv: HotSpot has no
     * local-reference limit, and JDK 17's `-Xcheck:jni` printed no warning for the unfixed
     * library at this size (measured), so a JVM run cannot read the leak that overflows ART N's
     * 512-entry table.
     */
    @Test
    fun largeArraysCrossTheRealJniInOneCall() {
        val h = open()
        val extra = 5000
        val chain = (0 until notes.length()).map { notes.getJSONObject(it).getString("nullifier") } +
            (0 until extra).map { "%064x".format(it + 1) }
        val own = (0 until notes.length()).map { notes.getJSONObject(it).getString("rho") } +
            (0 until extra).map { "%064x".format(it + 1_000_000) }
        val spent = ok(NocturaA0Native.matchSpent(h, chain.toTypedArray(), own.toTypedArray())) as JSONArray
        assertEquals((0 until notes.length()).toList().toString().replace(" ", ""), spent.toString())
        NocturaA0Native.keysClose(h)
    }

    @Test
    fun invNkAndInvNullNoJniOutputCarriesASecretOrAnOwnNullifier() {
        val forbidden = mutableListOf<String>()
        for (k in listOf("seed", "sk", "viewKey", "nk", "ivk", "dSelf", "addrSelf")) forbidden += seed.getString(k)
        val rhos = mutableListOf<String>()
        val nfs = mutableListOf<String>()
        for (i in 0 until notes.length()) {
            rhos += notes.getJSONObject(i).getString("rho")
            nfs += notes.getJSONObject(i).getString("nullifier")
            forbidden += notes.getJSONObject(i).getString("nullifier")
            forbidden += notes.getJSONObject(i).getString("rhoChange")
        }
        val h = open()
        val a = withdraw().getJSONObject("authorization")
        val outputs = mutableListOf<String?>()
        for (i in 0 until notes.length()) outputs += NocturaA0Native.depositRho(h, notes.getJSONObject(i).getString("depositIndex"))
        outputs += NocturaA0Native.commitment(h, "1000000000", rhos[1])
        outputs += NocturaA0Native.matchSpent(h, nfs.toTypedArray(), rhos.toTypedArray())
        outputs += NocturaA0Native.matchSpent(h, rhos.toTypedArray(), rhos.toTypedArray())
        outputs += NocturaA0Native.parseUnshield(a.getString("owner"), a.getString("amount"), a.getString("fee"))
        val id = authorize(h)
        outputs += id
        outputs += prove(h, id)
        outputs += prove(h, null)
        outputs += NocturaA0Native.prove(h, "deposit", proves.getJSONArray("scenarios").getJSONObject(0).getJSONObject("witness").toString(), null, noFile, noFile)
        outputs += NocturaA0Native.keysClose(h)
        assertTrue(outputs.size > 12)
        for (out in outputs) {
            for (f in forbidden) {
                assertTrue("$out carries a secret or an own nullifier", !out!!.lowercase().contains(f))
            }
        }
        // positive control: matchSpent did see the nullifiers (it returned every index)
        assertEquals((0 until notes.length()).toList().toString().replace(" ", ""), (ok(NocturaA0Native.run {
            val h2 = open()
            matchSpent(h2, nfs.toTypedArray(), rhos.toTypedArray())
        }) as JSONArray).toString())
    }
}
