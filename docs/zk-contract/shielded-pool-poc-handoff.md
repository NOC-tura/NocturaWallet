# Noctura Shielded Pool — devnet POC handoff (for the ICO/program Claude)

**Goal:** Build, on **devnet only**, a minimal Zcash-Sapling-style shielded pool that the existing Noctura wallet can drive: **deposit** (transparent → shielded note) + **withdraw** (shielded note → transparent), proving the circuit + on-chain verifier + merkle + nullifier work end-to-end. Transfer (shielded→shielded), multi-input, and consolidation are **out of POC scope** (add after deposit+withdraw is proven).

> ⛔ **MAINNET / FUNDS WARNING.** A shielded pool holds real funds and hides real transfers. An under-constrained circuit = **funds drainable**; a wrong nullifier binding = **double-spend or privacy break**. This POC is **devnet, test funds only**. Before ANY mainnet deployment with real value: a **dedicated ZK circuit audit** + a proper **trusted-setup ceremony** (Powers of Tau + circuit-specific phase 2) + a security review by a ZK engineer are MANDATORY. Do not skip.

## 0. What is ALREADY fixed (the wallet is canonical — DO NOT redesign)

The crypto encoding is wallet-canonical and golden-vectored. Conform exactly:
- **Spec:** `docs/zk-contract/zk-witness-encoding-contract.md` (in the wallet repo). **Golden vectors:** `docs/zk-contract/golden-vectors.json` — binding; your circuit/program must reproduce them.
- Field **BN254**; Poseidon `poseidon-lite ^0.3.0` (circomlib-compatible, x^5).
- byte→field **big-endian**, range-checked `< F` (except `mintHash`, which reduces).
- Domain tags (first Poseidon input): `0x01` commitment · `0x02` nullifier · `0x05` pk_recipient · Merkle nodes **untagged** `poseidon2(left,right)`.
- `pkRecipientHash = poseidon3(0x05, be(pk[0:24]), be(pk[24:48]))` (48-byte BLS12-381 G1 compressed, 24/24).
- `mintHash = be(mint[0:32]) mod F`.
- `noteCommitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)` (amount = lamports/base units).
- `nullifier = poseidon3(0x02, noteSecret, leafIndex)`.
- Merkle: `poseidon2`, **depth 20**, `ZERO_LEAF = 0`.

## 1. Circuit (B) — Groth16 / BN254 (Circom recommended)

Two circuits (or one parametrized). Each MUST use the exact Poseidon/encoding above (verify against golden vectors with a round-trip test).

### 1a. `deposit` circuit
Proves a new note commitment is well-formed (no spend, no merkle membership).
- **Private:** `pkRecipientHash, amount, mintHash, noteSecret`.
- **Public:** `commitment`, `amount`, `mintHash` (the program checks the deposited lamports/tokens == `amount` and the asset == `mint`).
- **Constraints:** `commitment === poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)`. (pkRecipientHash may be passed as a hashed private input or recomputed from pk — keep it consistent with the wallet's witness, which sends `pkRecipientHash`.)

### 1b. `withdraw` circuit
Proves the spender owns a note in the tree, reveals its nullifier, and binds the public withdraw.
- **Private:** `noteSecret, pkRecipientHash, amount, mintHash, leafIndex, merklePath[20], merklePathIndices[20]`.
- **Public:** `merkleRoot, nullifier, withdrawAmount, recipientHash` (recipient of the transparent withdraw; bind it so a relayer can't redirect funds), `mintHash`.
- **Constraints:**
  1. `commitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)`.
  2. Merkle membership: folding `commitment` up `merklePath` with `merklePathIndices` (poseidon2, depth 20) === `merkleRoot`.
  3. `nullifier === poseidon3(0x02, noteSecret, leafIndex)`.
  4. Value: `withdrawAmount === amount` (POC: full-note withdraw, no change note — simplest; change comes with transfer).
  5. **Bind `recipientHash` and `mintHash`** as public so the proof is non-malleable (a relayer/observer can't change the recipient or asset). Add a dummy constraint referencing `recipientHash` so the compiler keeps it (e.g. `recipientHash * 1 === recipientHash`), or include it in a hash.
- **Critical anti-footgun:** every public signal must be *constrained* (a public input that doesn't enter a constraint is forgeable). Range-check `amount`/`withdrawAmount` to 64 bits. The nullifier MUST depend on `leafIndex` (it does) so the same note at different positions can't be re-spent.

### Trusted setup
Powers of Tau (reuse a public PoT for BN254) + per-circuit phase-2. For the POC a single-contributor setup is acceptable on **devnet**; mainnet needs a multi-party ceremony.

## 2. On-chain program (A) — Anchor

Accounts:
- **`pool`** (config): authority, `mint` (the asset; POC: one mint, e.g. wrapped SOL or a devnet test SPL — confirm with wallet side), the **Groth16 verifying keys** (deposit + withdraw), the pool token vault.
- **`merkle_tree`**: an append-only Poseidon merkle tree, depth 20, with a small **root history** ring buffer (e.g. last 64 roots) so a proof against a recently-valid root still verifies after concurrent inserts. `next_leaf_index`.
- **`nullifier`** records: a PDA per spent nullifier (`["nullifier", nullifier_bytes]`) — existence = spent. Reject re-use.

Instructions:
- **`deposit(amount, commitment, proof, public_inputs)`**: verify the deposit proof (commitment matches amount+mint); transfer `amount` of the asset from the user into the pool vault; insert `commitment` as the next leaf; push the new root to history; emit an event with `(commitment, leafIndex)` so the wallet can track its note position.
- **`withdraw(proof, public_inputs)`**: check `merkleRoot ∈ root history`; check the `nullifier` PDA does NOT exist → create it (mark spent); verify the withdraw proof against the **withdraw VK** with public inputs `(merkleRoot, nullifier, withdrawAmount, recipientHash, mintHash)`; transfer `withdrawAmount` from the pool vault to the recipient. The recipient must equal `recipientHash`'s preimage (the wallet passes the real recipient; the program hashes it and checks, OR the recipient pubkey is a direct public input — simpler: make the recipient pubkey a *public input* and bind it in-circuit).
- **On-chain Groth16 verify:** use Solana's `alt_bn128` syscalls (`sol_alt_bn128_group_op` pairing/G1/G2) — there are existing Anchor Groth16 verifier crates (e.g. `groth16-solana` / `light-protocol`'s verifier) you can reuse for the pairing check. Reuse an audited verifier; do NOT hand-roll pairing.

Events: emit `Deposit{commitment, leafIndex}` and `Withdraw{nullifier}` so the wallet's note store + merkle sync can follow.

## 3. Prover backend (already contracted) — `POST /api/v1/zk/prove`

Per `zk-witness-encoding-contract.md` §"API contract": `{proofType, params}` (params = witness with `noteSecret` present client→prover, but NEVER logged/stored) → `{success, proofData(base64), publicInputs, error}`. Also `GET /api/v1/config/circuit` → `{maxInputs, maxOutputs, treeDepth:20}`. (POC: a simple snarkjs-based prover service is fine; it loads the proving key + computes the Groth16 proof from the witness.) The wallet calls these via the SSL-pinned client; keep them on `api.noc-tura.io`.

## 4. What the WALLET side does (me, in parallel — not your scope)
- Native BLST signing (Android Kotlin/JNI) + wire the `WitnessProvider` (`setWitnessProvider`) so `sk_spend` (BLS12-381) never enters JS and the witness (noteSecret, merklePath) is built natively.
- Merkle sync (follow `Deposit`/`Withdraw` events → local tree → witness paths).
- Flip `FEATURES.shielded` for a devnet build; wire the existing #16/#17/#18 screens to the deposit/withdraw flow.

## 5. POC acceptance (devnet)
1. Wallet deposits a test note → `deposit` lands → event `(commitment, leafIndex)` → note in the wallet store.
2. Wallet withdraws that note → `/zk/prove` returns a proof → `withdraw` lands → funds at the recipient; the `nullifier` PDA now exists.
3. **Double-spend rejected:** a second withdraw of the same note fails (nullifier exists).
4. **Golden-vector round-trip:** your circuit's commitment/nullifier for a golden input == `golden-vectors.json`.

Report back: program ID, account layouts (merkle + nullifier + pool), the deposit/withdraw instruction discriminators + account orders, the verifying keys, and the `/zk/prove` request/response shape you implemented — the wallet side wires to those. Ping when deposit+withdraw work on devnet.
