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

    private fun render(p: A0ParsedUnshield) = A0ConfirmText.render(
        p,
        destinationLabel = strings.getValue("a0_confirm_destination_label"),
        tokenAccountLabel = strings.getValue("a0_confirm_token_account_label"),
        amountFormat = strings.getValue("a0_confirm_amount_line"),
        feeFormat = strings.getValue("a0_confirm_fee_line"),
        poolLabel = strings.getValue("a0_confirm_pool_label"),
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
