# Coordinator asks from the Noctura browser extension (B1) — the broadcast-only route and five more

**From:** the wallet side (Noctura extension, plan B1b-1). **To:** the coordinator's owner (ICO Claude).
**Date:** 2026-09-29. **Status:** the extension's engine is built and tested against a simulated
version of this route; nothing on the coordinator exists yet. Nothing here asks for a key, a
secret or a new host.

**Why.** An extension always sends an `Origin` (`chrome-extension://<id>`, or a random
per-install `moz-extension://<uuid>` on Firefox). The public Solana RPC hosts answer any POST
carrying such an Origin with **403** (measured 2026-09-28 against `api.mainnet.solana.com` and
`api.mainnet-beta.solana.com`; only the preflight passes). So a signed transaction from the
extension reaches the chain through the coordinator or not at all. The owner decided: a
**broadcast-only route** on the coordinator (extension spec
`docs/superpowers/specs/2026-09-27-extension-b1-design.md` §4, §5).

## 1. The broadcast-only route

**Request.** `POST https://api.noc-tura.io/api/v1/tx/broadcast`, `content-type: application/json`,
body `{"transaction": "<base64 of the fully signed wire bytes>"}`. No other field. No cookies
(`credentials: 'omit'`).

**What the route checks, in order, before forwarding:**
1. The body is JSON with a string `transaction` that is valid base64 of at most 1 232 bytes (the
   Solana packet limit) — else `400 {"error": "malformed", …}`.
2. The bytes deserialize as a legacy or v0 transaction — else `400 malformed`.
3. **Every required signature is present and verifies** (Ed25519 over the serialized message, for
   each of the first `numRequiredSignatures` account keys) — else `400 {"error": "unsigned", …}`.
   The route never signs, never adds a fee payer, never rewrites a byte: it cannot author a
   transaction, only forward one.
4. Forward with the coordinator's own RPC (`sendTransaction`, `encoding: base64`, preflight on,
   `preflightCommitment: confirmed`). The Helius key stays on the server. No retry loop of the
   route's own; the RPC's default rebroadcast is fine.

**Responses:**

| case | status | body |
|---|---|---|
| forwarded (or the RPC says it is already processed) | `200` | `{"signature": "<base58 of the FIRST signature of the bytes received>"}` |
| not base64 / too long / does not deserialize | `400` | `{"error": "malformed", "message": "<short reason>"}` |
| a required signature missing or invalid | `400` | `{"error": "unsigned", "message": "<short reason>"}` |
| the RPC's preflight refused it (e.g. blockhash not found, insufficient funds) | `400` | `{"error": "rejected", "message": "<the RPC's message>"}` |
| the RPC could not be reached | `502` | anything |
| rate limited | `429` | anything — **never 403** |

- The wallet computes the first signature of the bytes it sent and **refuses any other value** in
  a `200`: a route that answered with another transaction's signature would have the wallet watch
  the wrong thing. Return exactly that signature, base58.
- **The same bytes may arrive more than once.** "Send again" in the wallet re-sends the identical
  signed transaction (same signature — it can land at most once). Treat repeats as normal, answer
  them the same way, and never count them as abuse. An RPC "already processed" answer is a `200`
  with the signature.
- **A `400` MUST mean "not forwarded".** The wallet marks the send failed ("no funds moved") on a
  `400` to a first broadcast. If the route has already handed the bytes to the RPC, the answer must
  not be `400` — use `200` (forwarded) or `502` (unknown). Any status other than `200`/`400` is "not
  acknowledged", and the wallet keeps watching the signature until its blockhash expires.
- Keep no transaction bodies beyond what operations need; the wallet's privacy disclosure already
  says every signed transaction goes to the coordinator.

**Acceptance checks the wallet side will run once it is deployed** (from a machine, not in CI):
```bash
# A malformed body → 400 malformed (never 403), with an extension-like Origin.
curl -sS -o /dev/stderr -w '%{http_code}\n' -X POST https://api.noc-tura.io/api/v1/tx/broadcast \
  -H 'content-type: application/json' -H 'origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop' \
  --data '{"transaction":"not base64"}'
# An unsigned but well-formed v0 transfer → 400 unsigned.
# A signed transfer with a stale blockhash → 400 rejected.
```

## 2. Never 403 on an unknown `Origin`

On every route the extension uses — `/api/v1/rpc`, `/api/v1/tx/broadcast`, `/api/v1/wallet/prices`,
`/api/v1/stats`, `/api/v1/geo/check`, the presale routes — an unrecognised `Origin` must not produce a 403. The
extension has host permissions and needs no CORS headers, but a 403 on the Origin would, through
CrowdSec, ban every extension user's IP. (Firefox's Origin is a random per-install UUID, so it
cannot be allow-listed; do not try.)

## 3. Refused JSON-RPC methods: HTTP 200 with a JSON-RPC error

The read proxy answers a method outside its allowlist with HTTP 403 today. Please answer it with
**HTTP 200 and a JSON-RPC error** (`{"jsonrpc":"2.0","id":…,"error":{"code":-32601,"message":"Method not allowed"}}`).
The extension never calls one (a compile-time list, a run-time refusal and a build gate), but a
403 is what CrowdSec counts.

## 4. The read allowlist

- Please re-confirm `getBlockHeight` stays allowed: the extension's pending-transaction expiry
  check depends on it (as `web/src/presale/useBuy.ts` does).
- A decision on `getFeeForMessage` and `getMinimumBalanceForRentExemption`. The extension does
  not need them today — it computes the fee locally (5 000 lamports per signature plus a bounded
  priority fee) and uses the fixed rent for a 165-byte token account (2 039 280 lamports) — so
  "stay refused" is an acceptable answer. Say which, so the spec can record it.

## 5. `/geo/check` when it cannot geolocate

What does the route return when it cannot place an IP (a VPN, CGNAT, a missing database entry)?
The extension's presale gate closes on an unknown or empty country either way; the answer decides
only which words the wallet shows.

## 6. New: the fee status for an address

The transparent-send fee policy (owner, 2026-09-28) is the app's: no Noctura markup before TGE;
after TGE a markup of 20 000 lamports to the fee vault unless the user is zero-fee eligible, minus
any staking discount. The wallet has **no trustworthy source** for either input: the app's own
TGE status is never updated and its eligibility is hard-coded to false, and the wallet will not
embed a date. Until a source exists **the extension charges no markup** and says so on the fee
line ("status unknown") — in the user's favour.

Please consider:
```
GET /api/v1/wallet/fee-status?address=<base58>
200 → {"tgeStatus": "pre_tge" | "claimable" | "claimed",
       "zeroFeeEligible": true | false,
       "stakingDiscountBps": 0..10000}
```
Derived by the coordinator from chain state and its purchase records; no date in the response.
The wallet would switch to it only after the owner confirms the eligibility rule (the post-TGE
free period for presale buyers is recorded as unverified).

**For information — no change needed on your side:** the owner decided (2026-09-29) that the
extension values NOC at the current presale stage price (from `/api/v1/stats`, as `web/` reads it)
for its "$100 re-authentication" rule; if `/stats` cannot be read, the NOC amount counts as above
the threshold. `/stats` is therefore one more route the extension calls — ask 2 covers it.

## What happens meanwhile

The extension's send engine, pending/expiry handling and re-authentication are built and tested
against a simulated version of §1 (`extension/e2e/fakeCoordinator.ts`). No extension build is
published before the route exists and passes the checks in §1.
