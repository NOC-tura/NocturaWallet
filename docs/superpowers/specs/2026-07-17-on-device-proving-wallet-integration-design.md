# On-device proving — wallet integration of live circuit artifacts

**Date:** 2026-07-17
**Status:** Design approved, spec under review
**Unblocks:** mainnet blocker #1 (local proving), asset-delivery side. Coordinator delivered LIVE artifacts (noc-presale PR #20, `https://api.noc-tura.io/api/v1/zk-assets/v1/`).

## Context

ICO delivered the four devnet circuit artifacts (`{deposit, withdraw, withdraw_change, transfer}`), each a snarkjs groth16 `.zkey` + a circom2 `.wasm` witness generator, hosted with immutable cache + ETag + range-requests, plus a machine-readable `zkey-manifest.json` and a pasteable `ZKEY_ASSETS` TS literal (real SHA-256 digests). This spec wires the wallet to consume them.

The wallet already has the fail-closed download→verify→cache primitive (`ensureZkey`) and a mocked native prover bridge. Today both handle the **zkey only**, and `ZKEY_ASSETS` is empty. This change makes the wallet download+verify **both** zkey and wasm, extends the native contract to receive both paths, and adds the ICO-specified trust assertions.

**This does NOT flip the `localProving` gate ON.** The native `NocturaProver` (mopro) module still does not exist (bridge is mocked), and the on-chain proofBytes parity gate (ICO §6) is deferred. This task readies the JS/asset layer so that when the native module lands, everything downstream is wired and verified.

## The frozen ICO contract (what the wallet must do)

1. `ensureZkey`-style fail-closed flow for **both** artifacts: download → SHA-256 → compare to the pinned value → cache → use. Download+verify both zkey and wasm; **do not** bundle the wasm in the app binary (download-both enables rotation without an app-store release).
2. `nativeProve(circuitId, witnessJson, zkeyPath, wasmPath)` — runtime-load variant (zkey/wasm paths at prove-time), NOT the mopro compile-time-embed template.
3. Before trusting artifacts: assert `programId == NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES` and `cluster == devnet` (guarantees the zkey matches the on-chain VK).
4. After a proof: assert `publicInputs.length == nPublic` per circuit.

Format (mopro-confirmed): groth16 / bn128 (BN254); circom 2.x + snarkjs ^0.7.4. `nPublic`: deposit=3, withdraw=5, withdraw_change=6, transfer=6.

## Decision (approved): client-pinned, no runtime manifest fetch

ICO §3 says "verify from the manifest," but the artifact bytes are already SHA-256-pinned in `ZKEY_ASSETS` (in code), while the manifest itself is not hash-pinned — trusting a fetched manifest for a security assertion is strictly weaker (a MITM could serve a tampered manifest). Since the **client is the spec**, we hardcode the expected values as client constants and assert against them, with no runtime manifest fetch:

- `ZKEY_PROGRAM_ID = 'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES'`, `ZKEY_CLUSTER = 'devnet'`, `EXPECTED_NPUBLIC = {deposit:3, withdraw:5, withdraw_change:6, transfer:6}`.
- Assert `ZKEY_PROGRAM_ID === SHIELDED_POOL_PROGRAM_ID` (both already `NPkc…HfES` today — a fail-closed guard that the pinned zkeys target the program we transact with).
- Assert `publicInputs.length === EXPECTED_NPUBLIC[id]` after each proof.

A runtime manifest fetch buys nothing the pinned literal doesn't already encode: rotation (devnet-1 → devnet-2) requires new SHA-256 pins in code = an app release, not OTA. During **implementation only** (not runtime), we fetch the manifest once to cross-check that the pasted literal's SHA-256 values match the hosted manifest (catches a copy-paste error); this is a dev-time check, not a shipped dependency.

## Components & interfaces

| Unit | Change |
|---|---|
| `src/constants/provingAssets.ts` | Restructure `ZKEY_ASSETS` to `Record<CircuitId, CircuitAssets>` where `CircuitAssets = {zkey: PinnedAsset; wasm: PinnedAsset}`, `PinnedAsset = {url: string; sha256: string}`. Paste ICO's literal (real values, Appendix A). Add `ZKEY_PROGRAM_ID`, `ZKEY_CLUSTER`, `EXPECTED_NPUBLIC: Record<CircuitId, number>`. Replace `zkeyAsset(id)` with `circuitAssets(id): CircuitAssets` (throws if either url/sha256 empty — fail-closed). |
| `src/modules/zkProver/provingAssets.ts` | `AssetIO.cachePath(id: string, kind: 'zkey' \| 'wasm'): string`. New `ensureCircuitAssets(id: CircuitId, io: AssetIO): Promise<{zkeyPath: string; wasmPath: string}>` — downloads+SHA-256-verifies BOTH (each: download-if-missing → hash → compare to pinned → delete+throw on mismatch → return path). Keep the per-asset verify logic in a private `ensureOne(url, sha256, path, io)` helper (DRY across zkey/wasm). |
| `src/modules/zkProver/rnfsAssetIO.ts` | `cachePath(id, kind)` → `${CachesDirectoryPath}/noctura-${id}.${kind}` (distinct files: `noctura-transfer.zkey`, `noctura-transfer.wasm`). `download`/`sha256`/`remove` unchanged (path-based, kind-agnostic). Generalize the download error message from "zkey download failed" to "asset download failed". |
| `src/modules/zkProver/nativeProverBridge.ts` | `NocturaProverNative.prove` and `nativeProve` gain `wasmPath: string`. Update the doc comment: native no longer owns a bundled wasm — JS supplies both SHA-256-verified paths. |
| `src/modules/zkProver/localProver.ts` | `prove`: `const {zkeyPath, wasmPath} = await ensureCircuitAssets(proofType, io)` → `const res = await nativeProve(proofType, JSON.stringify(params), zkeyPath, wasmPath)`; then `if (res.publicInputs.length !== EXPECTED_NPUBLIC[proofType]) throw` (fail-closed) before returning. |
| programId guard | A module-load assertion in `constants/provingAssets.ts` (or `localProver`): `if (ZKEY_PROGRAM_ID !== SHIELDED_POOL_PROGRAM_ID) throw` — the pinned zkeys must target the program the wallet transacts with. Placed so it fails loudly at import, not silently at prove-time. |

### `ensureCircuitAssets` (pure logic, injected IO — unit-testable)

```
ensureCircuitAssets(id, io):
  { zkey, wasm } = circuitAssets(id)                 // pinned url+sha256, throws if empty
  zkeyPath = await ensureOne(zkey.url, zkey.sha256, io.cachePath(id, 'zkey'), io)
  wasmPath = await ensureOne(wasm.url, wasm.sha256, io.cachePath(id, 'wasm'), io)
  return { zkeyPath, wasmPath }

ensureOne(url, sha256, path, io):
  if !(await io.exists(path)) await io.download(url, path)
  actual = await io.sha256(path)
  if actual !== sha256: await io.remove(path); throw `SHA-256 mismatch — rejected`
  return path
```

`ensureZkey` is replaced by `ensureCircuitAssets`; grep for callers (only `localProver`).

## Error handling (all fail-closed)

- zkey OR wasm SHA-256 mismatch → delete the bad file + throw; no proof.
- Download non-200 → throw (existing rnfsAssetIO behavior).
- `circuitAssets(id)` with an empty url/sha256 → throw (asset not delivered).
- `publicInputs.length !== EXPECTED_NPUBLIC[id]` → throw (wrong circuit/artifacts).
- `ZKEY_PROGRAM_ID !== SHIELDED_POOL_PROGRAM_ID` → throw at import (config drift).

## Scope / non-goals

- **Gate stays OFF.** `localProving` flag unchanged; native module still mocked. This wires the asset+contract layer only.
- **On-chain proofBytes parity gate (ICO §6) deferred** — verified when the native module lands (native mopro/rapidsnark serialization must byte-match hosted `/zk/prove`; snarkjs round-trip proves valid provers, not native serialization).
- **No runtime manifest fetch** (decision above). The one-time literal-vs-manifest SHA-256 cross-check is a dev-time implementation step, not shipped code.
- **Mainnet items deferred** (ICO §6): ceremony, immutable/multisig VK, dedicated relayer keypair, rent economics, audit. `/v1/` + `circuitSetVersion` reserve the rotation path.
- **CORS** irrelevant (native RN client sends no Origin → always allowed).

## Testing (TDD, native mocked)

1. `constants/provingAssets.ts`: `circuitAssets(id)` returns both pinned assets; throws on empty; `EXPECTED_NPUBLIC` values = 3/5/6/6; module-load programId guard holds (passes today, would throw if `ZKEY_PROGRAM_ID` diverged).
2. `ensureCircuitAssets`: with a mock `AssetIO`, downloads+verifies both; a zkey mismatch throws + removes; a wasm mismatch throws + removes; cache hit skips download; returns `{zkeyPath, wasmPath}` from `cachePath(id,'zkey'|'wasm')`.
3. `rnfsAssetIO.cachePath('transfer','wasm')` → `/caches/noctura-transfer.wasm` (and `.zkey`).
4. `nativeProverBridge.nativeProve` forwards `wasmPath` to `native.prove`.
5. `localProver.prove`: calls `ensureCircuitAssets`, passes both paths to `nativeProve`, returns the proof; asserts `publicInputs.length === EXPECTED_NPUBLIC[id]` (a wrong-length proof throws).
6. Full suite + `npm run verify` (lint + tsc + jest) green.

## Appendix A — `ZKEY_ASSETS` literal (verbatim from ICO hand-off, 2026-07-17)

circuitSetVersion=devnet-1, cluster=devnet, programId=NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES

| circuit | zkey sha256 | wasm sha256 |
|---|---|---|
| deposit | f11fec5007f7039ce6897689e4d6061b7276f82014c04600a006bfb9e7ffa821 | b05ef3f39b7a839f7d063e3c3db8ca355053733b2817eaa5773a562f3b572984 |
| withdraw | abc7ef8345eaa247f83d5fb148a3670b9a201d4a5e2d068b9459db1acc319557 | 1af3b9f8abb9ebd5007bcdc71817bce52192d23f53adbcc7d7cd7bedaf9a111c |
| withdraw_change | e67f948a5b2e5d812dc8966a0ed0255689a8a0cebf41768cacc2dda5f19ca7e3 | 36fd887f047b5d2a0a647780ed46e97138fdf57969c0892e3f91d6a8d939b15a |
| transfer | 858429d01b51fc801fe2e814fd292ea0901f84b19c349656ee5f3243f30d77ce | 2a7213170759b01d265f7df01ad76fc87a3de8ef28e34a9596ba6094b6a9f118 |

URLs: `https://api.noc-tura.io/api/v1/zk-assets/v1/<circuit>_final.zkey` and `.../<circuit>.wasm` (transfer/withdraw_change use `<circuit>_final.zkey` / `<circuit>.wasm`; deposit/withdraw likewise). Exact URLs pasted into `provingAssets.ts` from the hand-off.
