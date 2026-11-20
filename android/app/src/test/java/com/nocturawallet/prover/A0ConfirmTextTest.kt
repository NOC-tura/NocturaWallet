package com.nocturawallet.prover

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element

/**
 * What the dialog shows (spec §4 step 3): Rust's `parseUnshield` answer read strictly, rendered
 * with the REAL format strings of `res/values/a0_confirm_strings.xml` — the full owner, the token
 * account labelled as such, "Destination receives exactly …" with the base units, the relayer fee
 * "taken from your shielded balance" (I7), the pool. Addresses and amounts come from the offline
 * ATA vectors (scripts/a0-vectors/gen-ata-vectors.mjs, web3.js) — never from the code under test.
 * The token's symbol (M1c Task 8): Kotlin's own from BuildConfig.A0_NETWORK, TEST on devnet, NOC
 * otherwise — one row per network, and a source row that the controller takes it from nowhere else.
 */
class A0ConfirmTextTest {
    private val strings: Map<String, String> = run {
        val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
            .parse(File("src/main/res/values/a0_confirm_strings.xml"))
        val nodes = doc.getElementsByTagName("string")
        (0 until nodes.length).associate { i ->
            val e = nodes.item(i) as Element
            e.getAttribute("name") to e.textContent
        }
    }
    private val vectors = JSONObject(File("../../native/noctura-prover/tests/fixtures/a0-ata-vectors.json").readText())
    private val owner = vectors.getJSONArray("owners").getJSONObject(1) // GoBAm…, an on-curve owner
    private val pool = vectors.getJSONObject("constants").getString("pool")

    private fun rust(amount: String, humanAmount: String, fee: String, humanFee: String) = JSONObject()
        .put("owner", owner.getString("owner"))
        .put("ata", owner.getString("ata"))
        .put("amount", amount)
        .put("fee", fee)
        .put("humanAmount", humanAmount)
        .put("humanFee", humanFee)
        .put("pool", pool)

    private fun render(p: A0ParsedUnshield, network: String = "mainnet-beta") = A0ConfirmText.render(
        p,
        destinationLabel = strings.getValue("a0_confirm_destination_label"),
        tokenAccountLabel = strings.getValue("a0_confirm_token_account_label"),
        amountFormat = strings.getValue("a0_confirm_amount_line"),
        feeFormat = strings.getValue("a0_confirm_fee_line"),
        poolLabel = strings.getValue("a0_confirm_pool_label"),
        symbol = A0ConfirmText.tokenSymbol(network),
    )

    @Test
    fun theDialogShowsRustsValuesWholeWithTheResourcesWording() {
        val amounts = vectors.getJSONArray("amounts")
        val a = amounts.getJSONObject(amounts.length() - 1)
        val f = amounts.getJSONObject(3) // 10000 → 0.00001, the live quote's minFee
        val p = A0ParsedUnshield.from(rust(a.getString("units"), a.getString("human"), f.getString("units"), f.getString("human")))
        assertNotNull(p)
        val t = render(p!!)
        assertEquals(owner.getString("owner"), t.owner) // whole, 44 characters, never cut
        assertEquals(44, t.owner.length)
        assertEquals(owner.getString("ata"), t.ata)
        assertEquals("Token account", t.tokenAccountLabel)
        assertEquals("Destination (wallet address)", t.destinationLabel)
        assertEquals(
            "Destination receives exactly ${a.getString("human")} NOC (${a.getString("units")} base units)",
            t.amountLine,
        )
        assertEquals("Relayer fee 0.00001 NOC, taken from your shielded balance", t.feeLine)
        assertEquals(pool, t.pool)
        assertEquals("Pool", t.poolLabel)
    }

    @Test
    fun theDevnetBuildNamesTheTokenTestAsTheScreensDo() {
        // M1c Task 8 (controller ruling): the same symbol as #16 / #21 — TEST on the devnet build
        val f = vectors.getJSONArray("amounts").getJSONObject(3) // 10000 → 0.00001
        val p = A0ParsedUnshield.from(rust("1250000000", "1.25", f.getString("units"), f.getString("human")))!!
        val t = render(p, network = "devnet")
        assertEquals("Destination receives exactly 1.25 TEST (1250000000 base units)", t.amountLine)
        assertEquals("Relayer fee 0.00001 TEST, taken from your shielded balance", t.feeLine)
    }

    @Test
    fun theMainnetBuildNamesTheTokenNoc() {
        val f = vectors.getJSONArray("amounts").getJSONObject(3)
        val p = A0ParsedUnshield.from(rust("1250000000", "1.25", f.getString("units"), f.getString("human")))!!
        val t = render(p, network = "mainnet-beta") // .env.production's NETWORK
        assertEquals("Destination receives exactly 1.25 NOC (1250000000 base units)", t.amountLine)
        assertEquals("Relayer fee 0.00001 NOC, taken from your shielded balance", t.feeLine)
    }

    @Test
    fun theSymbolIsTestOnlyForExactlyDevnet() {
        assertEquals("TEST", A0ConfirmText.tokenSymbol("devnet"))
        // controls: every other value — mainnet, none (an env file without NETWORK), a near miss — is NOC
        for (n in listOf("mainnet-beta", "mainnet", "", "Devnet", " devnet", "devnet ", "testnet")) {
            assertEquals("network '$n'", "NOC", A0ConfirmText.tokenSymbol(n))
        }
    }

    @Test
    fun theSymbolComesFromBuildConfigNeverFromJs() {
        // the controller passes Kotlin's own choice from this build's BuildConfig …
        val controller = File("src/main/java/com/nocturawallet/prover/A0ConfirmController.kt").readText()
        assertTrue(controller.contains("symbol = A0ConfirmText.tokenSymbol(BuildConfig.A0_NETWORK)"))
        assertTrue(controller.contains("import com.nocturawallet.BuildConfig"))
        // … and names no symbol itself (a literal there would bypass the network)
        assertTrue(!Regex("\"(NOC|TEST)\"").containsMatchIn(controller))
        // the field is the build's NETWORK, defined in every build (empty when the env has none)
        val gradle = File("build.gradle").readText()
        val field = gradle.lines().map { it.trim() }.single { it.startsWith("buildConfigField \"String\", \"A0_NETWORK\"") }
        assertTrue(field, field.contains("project.env.get(\"NETWORK\") ?: \"\""))
        // the resource carries no symbol of its own: both lines take it as an argument
        assertTrue(strings.getValue("a0_confirm_amount_line").contains("%3\$s"))
        assertTrue(strings.getValue("a0_confirm_fee_line").contains("%2\$s"))
        for (v in strings.values) assertTrue("a literal symbol in '$v'", !Regex("\\b(NOC|TEST)\\b").containsMatchIn(v))
    }

    @Test
    fun theResourceHasEveryStringTheCodeNames() {
        val names = File("src/main/java/com/nocturawallet/prover/A0ConfirmController.kt").readText()
            .let { Regex("""R\.string\.(\w+)""").findAll(it).map { m -> m.groupValues[1] }.toSet() }
        assertTrue(names.size >= 9)
        for (n in names) assertTrue("missing string $n", strings.containsKey(n))
        assertEquals(names, strings.keys) // and nothing unused
    }

    @Test
    fun parseUnshieldsAnswerIsReadStrictly() {
        val good = rust("1", "0.000000001", "0", "0")
        assertNotNull(A0ParsedUnshield.from(good))
        // negative controls: a key more, a key less, a non-string, an empty string, not an object
        assertNull(A0ParsedUnshield.from(JSONObject(good.toString()).put("extra", "x")))
        assertNull(A0ParsedUnshield.from(JSONObject(good.toString()).apply { remove("pool") }))
        assertNull(A0ParsedUnshield.from(JSONObject(good.toString()).put("amount", 1)))
        assertNull(A0ParsedUnshield.from(JSONObject(good.toString()).put("ata", "")))
        assertNull(A0ParsedUnshield.from(good.toString()))
        assertNull(A0ParsedUnshield.from(null))
    }
}
