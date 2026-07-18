# Shielded pool — mainnet readiness program

**Date:** 2026-07-18
**Status:** Program plan (living document)
**Scope:** Everything required to move the Noctura shielded pool from the working devnet POC to **mainnet with real funds**. Cross-repo + operational: this doc lives in the wallet repo but coordinates wallet, coordinator/program (ICO), cryptographic-ceremony, and external-audit workstreams. Supersedes the point-in-time checklist in `project_shielded_mainnet_blockers`.

---

## 1. Executive summary

**Where we are.** The devnet POC is functionally complete and on-chain-confirmed for all three shielded flows, with **on-device native proving** (noteSecret never leaves the phone):
- Shield (deposit) — devnet tx `5grcGn6…SaXeL8w5`.
- Unshield (withdraw_change) — devnet tx `5orjudu…LfN7DvN`.
- Private transfer (relayer-hidden sender) — devnet tx `4gRiKD…QWNzJp` (fee_payer = coordinator; user's transparent key absent; amount hidden).

**What mainnet requires.** Real funds change the risk model from "test tokens on my own coordinator" to "adversaries with financial incentive." The gap is NOT wallet features — it is **cryptographic assurance (ceremony + audit), on-chain governance (immutable VK), infrastructure (dedicated relayer, indexer), platform coverage (iOS), and a guarded rollout.** Nothing here should ship to real funds until the launch gates (§5) are all green.

**Recommended launch model: phased / guarded** (deposit caps + allowlist → gradual limit increases), NOT big-bang. A privacy pool is a single high-value target; a cap bounds the blast radius of any latent bug or key-management error during the early mainnet window.

---

## 2. Readiness matrix

Gate = "blocks real-funds launch?" · Owner = wallet / program (ICO) / ceremony / audit / infra / user.

| # | Item | Owner | Gate | Status |
|---|------|-------|------|--------|
| 1 | On-device native proving (noteSecret local) | wallet | ✅ blocking | **DONE** (mechanism; mainnet needs ceremony zkeys — see #2/#D1) |
| 2 | Multi-party trusted-setup ceremony (prod VKs) | ceremony | ✅ blocking | OPEN |
| 3 | Immutable VK (or multisig+timelock) on-chain | program | ✅ blocking | OPEN (devnet `set_vks` = single-admin, fund-drain vector) |
| 4 | Security audit — circuits + Anchor program | audit | ✅ blocking | OPEN |
| 5 | noteSecret seed-recoverability | wallet + program | ✅ blocking | PARTIAL (memo wallet-side #56; program deploy TBD) |
| 6 | Mainnet pool deployed for real NOC mint `B61Sy…6nhXW` | program + wallet | ✅ blocking | OPEN |
| 7 | Merkle indexer at scale | infra + wallet | ⚠️ non-blocking (perf) | OPEN (RPC log-scan works for now) |
| 8 | iOS native shielded path | wallet | ⚠️ launch-scope decision | OPEN (Android only) |
| 9 | API key rotation (Helius/Alchemy) | user | ✅ blocking (hygiene) | OPEN |
| 10 | Dedicated relayer keypair (not presale coordinator key) + rent economics | infra | ✅ blocking | OPEN |
| 11 | Program upgrade-authority policy (burn / multisig+timelock) | program | ✅ blocking | OPEN |
| 12 | Monitoring, alerting, incident-response + pause switch | infra + program | ✅ blocking | OPEN |
| 13 | Guarded rollout controls (deposit cap / allowlist / limit ramp) | program + wallet | ✅ blocking | OPEN |

---

## 3. Workstreams

### A. Cryptographic assurance (ceremony) — owner: ceremony coordinator

- **A1. Trusted-setup ceremony (#2).** A real multi-party Powers-of-Tau + phase-2 ceremony per circuit (deposit, withdraw, withdraw_change, transfer), with public transcripts and verifiable toxic-waste destruction (≥N independent contributors, at least one honest). Output: the production `.zkey` (proving) + `vk.json` (verifying) per circuit. **This is the root of trust — the whole system's soundness depends on it.**
- **A2. Circuit audit (#4, part 1).** Independent audit of the Circom circuits (constraint completeness, under-constrained signals, the commitment/nullifier/hash-to-field scheme, domain separation). The wallet's witness encoding is already golden-vector-gated against the coordinator, which de-risks encoding drift but NOT circuit soundness.
- **Deliverables to downstream:** the 4 production VKs (→ program, workstream B), and the 4 production zkeys+wasm hosted with SHA-256 pins (→ wallet, workstream D, same delivery contract as devnet `ZKEY_ASSETS`).

### B. On-chain program hardening — owner: ICO / program

- **B1. Immutable VK (#3).** **Recommended: bake the 4 ceremony VKs as immutable program constants** (or a data account made immutable). Removes the single-admin `set_vks` fund-drain vector entirely. If any post-launch VK change is anticipated, gate it behind a multisig + timelock + on-chain announcement — but immutable is the safest default and is recommended.
- **B2. Mainnet pool deployment (#6).** Deploy the pool program for the real NOC mint `B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW` (decimals 9). New mainnet program ID (≠ devnet `NPkc…`). Confirm the deposit/withdraw_change **NoteCiphertext memo** (wallet #56) is in the deployed program (needed for #5 recoverability).
- **B3. Upgrade authority (#11).** Decide + document: burn the upgrade authority (fully immutable program) OR assign to a multisig+timelock. **Recommended: burn after a short bake-in**, or multisig+timelock if staged upgrades are required. A live single-key upgrade authority on a fund-holding program is unacceptable for mainnet.
- **B4. Program audit (#4, part 2).** Independent audit of the Anchor program (account validation, PDA derivation, the alt_bn128 Groth16 verification path, rent/close handling, reentrancy/duplicate-nullifier, arithmetic).
- **B5. Pause switch (part of #12).** A guardian-controlled pause (deposits/withdraws) for incident response, itself under multisig — so a discovered exploit can be halted without draining.

### C. Infrastructure / relayer — owner: ICO / infra

- **C1. Dedicated relayer keypair (#10).** A funded, dedicated mainnet relayer keypair — NOT the presale coordinator key (which signs presale txs). Key management: HSM/KMS, rotation policy, funding + monitoring.
- **C2. Rent-per-transfer economics (#10).** Each transfer costs the relayer base fee + 2× non-refundable nullifier-record rent (~1.9M lamports on devnet). Model mainnet cost, fee policy (who pays, spend caps — the fee-drain guards from noc-presale #18 already exist), and top-up automation.
- **C3. Merkle indexer at scale (#7).** RPC log-scan is fine at low volume; at mainnet scale add a coordinator indexer endpoint for the tree/path + incremental sync. Wallet consumes it with a fail-safe fallback to RPC scan. **Non-blocking for launch; needed as volume grows.**
- **C4. Monitoring/alerting/incident-response (#12).** Pool balance vs commitments invariant checks, nullifier-double-spend alerts, relayer balance/latency, prover error rates, an on-call runbook, and the pause procedure (B5).

### D. Wallet — owner: wallet (this repo)

Each of these becomes its own spec/plan when scheduled.

- **D1. Mainnet config + VK/zkey pinning.** New mainnet build config: `SHIELDED_POOL_PROGRAM_ID` = the mainnet pool program (≠ `NPkc…`); `ZKEY_ASSETS` = the 4 ceremony-produced mainnet zkeys+wasm (url+SHA-256); `ZKEY_PROGRAM_ID` + `ZKEY_CLUSTER` updated (the import-time `ZKEY_PROGRAM_ID === SHIELDED_POOL_PROGRAM_ID` guard must hold); `EXPECTED_NPUBLIC` unchanged if circuits unchanged. The `.env.mainnet` sets `LOCAL_PROVING=true`, `SHIELDED_RELAYER=true`, the mainnet RPC, and the mainnet relayer endpoint. **Depends on A1 (zkeys) + B1/B2 (program+VK).**
- **D2. Seed-recoverability — verify + finalize (#5).** Confirm the deposit/withdraw_change NoteCiphertext memo is deployed on the mainnet program (B2) and that a wipe→restore-from-mnemonic on-device test recovers ALL shielded balances (deposit + change + received) and can spend them. If the memo path is insufficient for any flow, decide whether to also derive `noteSecret` from `sk_spend` in native (keeps the view key non-spend-capable). **This is fund-loss-critical — a mainnet user who reinstalls must not lose shielded funds.**
- **D3. iOS native shielded path (#8).** Port the pure-Rust prover (`noctura-prover`) to iOS: the same Rust core via a Swift bridge (the crate is already `cdylib`/`rlib`; UniFFI or a `#[no_mangle]` C-ABI + Swift). Plus the shielded key/secure-storage path (Secure Enclave envelope). **Launch-scope decision: Android-only launch vs iOS-parity launch** — recommend deciding early; iOS is a significant workstream.
- **D4. Guarded-rollout UX (#13).** Enforce/display deposit caps + limit-ramp state in the wallet (read from the program or config), and clear pending/failed states. Aligns with the program-side caps (§B/§13).
- **D5. Pre-mainnet code review.** A focused security review of the wallet's shielded modules (key derivation, note encryption, witness encoding, the native prover FFI boundary, no-plaintext-secret-egress) as part of the audit window.

### E. Operational / user — owner: user + infra

- **E1. API key rotation (#9).** Rotate the Helius + Alchemy keys exposed in the cross-Claude conversation; update `.env.*` and any coordinator config. **User action.**
- **E2. Legal/compliance review** (geo-gating already exists per `project_geo_gate`; confirm it satisfies mainnet policy for a privacy tool — jurisdictions, OFAC).
- **E3. Play Store / App Store production config** (per `project_play_store_prep`: real release key + Play App Signing, iOS bundle/Team ID/associated domains).

---

## 4. Dependency graph & sequencing

Critical path (must be serial):

```
A1 ceremony ──▶ 4 production VKs ──▶ B1 immutable VK + B2 mainnet program deploy ──┐
        └────▶ 4 production zkeys+wasm ──────────────────────────────▶ D1 wallet pin ──▶ D2 recoverability verify
A2 circuit audit ─┐                                                                        │
B4 program audit ─┴──▶ (audit sign-off gates EVERYTHING) ─────────────────────────────────┤
C1 relayer keypair + C2 economics ───────────────────────────────────────────────────────┤
B3 upgrade-authority + B5 pause + C4 monitoring ──────────────────────────────────────────┤
E1 key rotation ──────────────────────────────────────────────────────────────────────────┘
                                                                                            ▼
                                                                              §5 LAUNCH GATES → guarded mainnet (D4/§13)
```

Parallelizable now (don't wait on the ceremony): B3, B5, C1, C2, C4, D3 (iOS), D5, E1, E2, E3.
Serial on the ceremony: A→VKs→B1/B2→D1→D2, and the audit sign-off before any real funds.

Suggested phase order:
1. **Prep (parallel):** relayer keypair + economics, upgrade-authority + pause + monitoring design, iOS port, key rotation, wallet security review, compliance.
2. **Ceremony + audit:** run the ceremony; audit circuits + program (using the frozen code).
3. **Deploy:** immutable-VK mainnet program for NOC mint; host mainnet zkeys.
4. **Wallet:** pin mainnet program + zkeys; on-device recoverability verification.
5. **Guarded launch:** deposit cap + allowlist → monitor → ramp limits.

---

## 5. Launch gates (go / no-go — ALL must be green before real funds)

- [ ] Ceremony complete, transcript public, toxic waste provably destroyed (A1).
- [ ] Circuit audit + program audit signed off, criticals resolved (A2, B4, D5).
- [ ] Mainnet program deployed with **immutable** VK (or multisig+timelock, documented) for NOC mint `B61Sy…` (B1, B2).
- [ ] Program upgrade authority burned or multisig+timelock (B3).
- [ ] Pause switch + monitoring + on-call runbook live (B5, C4).
- [ ] Dedicated relayer keypair funded + secured; rent economics + spend caps modeled (C1, C2).
- [ ] Wallet pins mainnet program + ceremony zkeys; import-time program-id guard holds; `LOCAL_PROVING`+`SHIELDED_RELAYER` on (D1).
- [ ] On-device wipe→restore recovers + spends ALL shielded balances (D2).
- [ ] Guarded-rollout controls enforced (deposit cap / allowlist / ramp) (D4, §13).
- [ ] API keys rotated (E1); compliance reviewed (E2); store production config (E3).
- [ ] iOS parity **decided** (ship Android-only vs wait for iOS) (D3).

---

## 6. Risks & mitigations

- **Ceremony compromise** → all soundness lost. Mitigate: ≥N independent contributors, public transcripts, verifier reproducibility.
- **VK fund-drain via mutable `set_vks`** → immutable VK (B1) removes it entirely.
- **Recoverability gap** → users lose funds on reinstall. Mitigate: D2 on-device restore test is a hard gate.
- **Relayer key compromise / griefing** → dedicated keypair + HSM + spend caps (C1/C2) + pause (B5).
- **Latent bug at launch** → phased/guarded rollout (§13) caps exposure; pause switch halts.
- **Metadata (timing / small anon-set)** → out of scope for launch-gating but document expected privacy: unlinkability holds; timing + anon-set size are the residual leakage (grows safer with volume).

## 7. Not in this program

- New shielded features beyond deposit/withdraw/transfer. Non-shielded wallet work. The ceremony/audit are coordinated + funded here but executed by specialized parties (this doc defines the interface + gates, not their internal procedure).
