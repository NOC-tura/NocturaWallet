# Shielded seed-recovery note memo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make deposit and withdraw-change notes seed-recoverable by emitting an on-chain `NoteCiphertext` memo `(amount, noteSecret)` encrypted to the wallet's own view key, exactly as transfer already does.

**Architecture:** Two ix builders (`buildDepositIx`, `buildWithdrawWithChangeIx`) gain a trailing `u32le(len)+ciphertext(128)` field (mirroring `buildTransferIx`). The two flows (`depositShield`, `unshieldWithChange`) build that ciphertext with `encryptNote(getViewPublicKey(seed), amount, noteSecret)` and pass it in. Recovery is unchanged — the existing origin-agnostic `scanIncomingNotes` already recovers any such memo (proven by `noteScan.test.ts`). The on-chain program change (accept the arg + emit the event) is an ICO deliverable specified here.

**Tech Stack:** TypeScript (strict), Jest, `@solana/web3.js` (mocked in tests), `@noble/*` BLS12-381 / XChaCha20-Poly1305 (real in tests).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- No placeholders — every function fully implemented.
- Ciphertext is exactly **128 bytes** (`R48 + nonce24 + sealed56`); payload = `amount(8 LE) + noteSecret(32 BE)`.
- Money as `bigint` (lamports/smallest unit); u64 LE on the wire.
- Prettier: single quotes, trailing commas, no parens on single arrow params.
- Ciphertext is **required** (fail-closed) — no optional field.
- Run a single test file with `npx jest --testPathPattern=<name>`; typecheck with `npx tsc --noEmit`.

**Design spec:** `docs/superpowers/specs/2026-07-13-shielded-seed-recovery-memo-design.md`

---

### Task 1: `buildDepositIx` — append the ciphertext memo

**Files:**
- Modify: `src/modules/shielded/poolInstructions.ts` (`DepositIxParams`, `buildDepositIx`, doc comment)
- Test: `src/modules/shielded/__tests__/poolInstructions.test.ts`

**Interfaces:**
- Consumes: existing `u32le`, `depositDiscriminator`, `u64le`.
- Produces: `buildDepositIx(p: DepositIxParams)` where `DepositIxParams` now has `ciphertext: Uint8Array // 128 bytes`. Data layout becomes `disc(8)+amount(8)+commitment(32)+u32le(256)+proof(256)+u32le(128)+ciphertext(128)` (total 440 B).

- [ ] **Step 1: Write the failing test**

Add inside `describe('buildDepositIx', …)` in `poolInstructions.test.ts`:

```ts
  it('appends the ciphertext memo: total = …+u32le(128)+ct(128), len prefix at 308', () => {
    const ciphertext = new Uint8Array(128).fill(0xcd);
    const ix = buildDepositIx({
      amount: 1n, commitment: new Uint8Array(32).fill(9),
      proofBytes: new Uint8Array(256).fill(0xab), ciphertext,
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    });
    expect(ix.data.length).toBe(8 + 8 + 32 + 4 + 256 + 4 + 128); // 440
    expect(ix.data.readUInt32LE(308)).toBe(128);                 // memo len prefix
    expect(Buffer.from(ix.data.subarray(312))).toEqual(Buffer.from(ciphertext));
  });

  it('rejects a ciphertext that is not 128 bytes', () => {
    expect(() => buildDepositIx({
      amount: 1n, commitment: new Uint8Array(32), proofBytes: new Uint8Array(256),
      ciphertext: new Uint8Array(64),
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    })).toThrow(/ciphertext must be 128 bytes/);
  });
```

Also update the existing `data = …` test (the one asserting `ix.data.length` === `8 + 8 + 32 + 4 + 256`) to add a 128-byte `ciphertext` to its params and change its length assertion to `8 + 8 + 32 + 4 + 256 + 4 + 128`. Add `ciphertext: new Uint8Array(128)` to the `account metas` test's params too (params are now required).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=poolInstructions`
Expected: FAIL — `buildDepositIx` doesn't accept `ciphertext`; length is 308 not 440.

- [ ] **Step 3: Implement**

In `poolInstructions.ts`, add to `DepositIxParams` (after `proofBytes`):

```ts
  ciphertext: Uint8Array;   // 128 bytes — NoteCiphertext memo (amount+noteSecret to own view key)
```

Update the doc comment line to:

```ts
 * Data = disc(8) + amount(u64 LE) + commitment(32) + len(u32 LE) + proof_bytes
 *      + len(u32 LE) + ciphertext(128).  The memo lets a restored wallet recover
 *      this deposit note by scanning (see seed-recovery design spec).
```

In `buildDepositIx`, add the guard and the two trailing `Buffer.from` lines:

```ts
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');
  if (p.ciphertext.length !== 128) throw new Error('ciphertext must be 128 bytes');

  const data = Buffer.concat([
    Buffer.from(depositDiscriminator()),
    Buffer.from(u64le(p.amount)),
    Buffer.from(p.commitment),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
    Buffer.from(u32le(p.ciphertext.length)),
    Buffer.from(p.ciphertext),
  ]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=poolInstructions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/poolInstructions.ts src/modules/shielded/__tests__/poolInstructions.test.ts
git commit -m "feat(shielded): buildDepositIx emits NoteCiphertext memo (seed-recovery)"
```

---

### Task 2: `buildWithdrawWithChangeIx` — append the ciphertext memo

**Files:**
- Modify: `src/modules/shielded/poolInstructions.ts` (`WithdrawWithChangeIxParams`, `buildWithdrawWithChangeIx`, doc)
- Test: `src/modules/shielded/__tests__/withdrawChangeIx.test.ts`

**Interfaces:**
- Consumes: existing `u32le`, `withdrawChangeDiscriminator`, `u64le`.
- Produces: `buildWithdrawWithChangeIx(p)` where `WithdrawWithChangeIxParams` now has `ciphertext: Uint8Array // 128`. Data becomes `disc(8)+merkle_root(32)+nullifier(32)+amount(8)+change_commitment(32)+u32le(256)+proof(256)+u32le(128)+ciphertext(128)` (total 504 B).

- [ ] **Step 1: Write the failing test**

Add to `withdrawChangeIx.test.ts` (mirror its existing param shape; it constructs a full param object — add `ciphertext` there and a new assertion):

```ts
  it('appends the ciphertext memo: total 504 B, len prefix 128 at offset 372', () => {
    const ciphertext = new Uint8Array(128).fill(0xee);
    const ix = buildWithdrawWithChangeIx({
      merkleRoot: new Uint8Array(32).fill(1), nullifier: new Uint8Array(32).fill(2),
      amount: 200n, changeCommitment: new Uint8Array(32).fill(9),
      proofBytes: new Uint8Array(256).fill(0xab), ciphertext,
      pool: A(1), merkleTree: A(2), vault: A(3), destinationTokenAccount: A(4),
      nullifierRecord: A(5), feePayer: A(6), wchangeVk: A(7),
    });
    expect(ix.data.length).toBe(8 + 32 + 32 + 8 + 32 + 4 + 256 + 4 + 128); // 504
    expect(ix.data.readUInt32LE(372)).toBe(128);
    expect(Buffer.from(ix.data.subarray(376))).toEqual(Buffer.from(ciphertext));
  });

  it('rejects a ciphertext that is not 128 bytes', () => {
    expect(() => buildWithdrawWithChangeIx({
      merkleRoot: new Uint8Array(32), nullifier: new Uint8Array(32), amount: 1n,
      changeCommitment: new Uint8Array(32), proofBytes: new Uint8Array(256),
      ciphertext: new Uint8Array(1),
      pool: A(1), merkleTree: A(2), vault: A(3), destinationTokenAccount: A(4),
      nullifierRecord: A(5), feePayer: A(6), wchangeVk: A(7),
    })).toThrow(/ciphertext must be 128 bytes/);
  });
```

If `withdrawChangeIx.test.ts` already builds the ix in a shared setup/`beforeEach`, add `ciphertext: new Uint8Array(128)` to that shared params object and adjust any existing `data.length` assertion to `…+ 4 + 128`. Confirm the file imports `buildWithdrawWithChangeIx` and has an `A` pubkey helper (mirror `poolInstructions.test.ts` if not: `const A = (s: number) => new PublicKey(new Uint8Array(32).fill(s));`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=withdrawChangeIx`
Expected: FAIL — no `ciphertext` param; length is 372.

- [ ] **Step 3: Implement**

In `poolInstructions.ts`, add to `WithdrawWithChangeIxParams` (after `proofBytes`):

```ts
  ciphertext: Uint8Array;              // 128 — NoteCiphertext memo for the change note
```

Update the doc comment `Data = …` line to append `+ len(u32 LE) + ciphertext(128)`. Then in `buildWithdrawWithChangeIx` add the guard and the two trailing lines:

```ts
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');
  if (p.ciphertext.length !== 128) throw new Error('ciphertext must be 128 bytes');

  const data = Buffer.concat([
    Buffer.from(withdrawChangeDiscriminator()),
    Buffer.from(p.merkleRoot),
    Buffer.from(p.nullifier),
    Buffer.from(u64le(p.amount)),
    Buffer.from(p.changeCommitment),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
    Buffer.from(u32le(p.ciphertext.length)),
    Buffer.from(p.ciphertext),
  ]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=withdrawChangeIx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/poolInstructions.ts src/modules/shielded/__tests__/withdrawChangeIx.test.ts
git commit -m "feat(shielded): buildWithdrawWithChangeIx emits NoteCiphertext memo (seed-recovery)"
```

---

### Task 3: `depositShield` — emit the memo encrypted to own view key

**Files:**
- Modify: `src/modules/shielded/depositFlow.ts`
- Test: `src/modules/shielded/__tests__/depositMemo.test.ts` (new — the existing `depositFlow.test.ts` only covers the `parseDepositLeafIndex` helper; keep it untouched)

**Interfaces:**
- Consumes: `buildDepositNote` (returns `{params, note}` with `note.noteSecret: string`, `note.commitment: string`), `buildDepositIx` (now requires `ciphertext`, Task 1), `encryptNote(viewKeyG1, amount, noteSecret) → Uint8Array(128)`, `getViewPublicKey(seed) → Uint8Array`.
- Produces: `depositShield` passes `ciphertext = encryptNote(getViewPublicKey(seed), amount, BigInt(note.noteSecret))` to `buildDepositIx`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/shielded/__tests__/depositMemo.test.ts`. It mocks the heavy deps, lets `buildDepositNote` + crypto run real, and mocks `buildDepositIx` to capture the ciphertext, then decrypts it with the seed's view key:

```ts
import {Keypair, PublicKey} from '@solana/web3.js';

const captured: {ciphertext?: Uint8Array} = {};
jest.mock('../poolInstructions', () => ({
  buildDepositIx: jest.fn((p: {ciphertext: Uint8Array}) => {
    captured.ciphertext = p.ciphertext;
    return {}; // opaque ix; submitPoolTx is mocked
  }),
}));
jest.mock('../../zkProver/zkProverModule', () => ({
  proveShielded: jest.fn(async () => ({proofBytes: '00'.repeat(256), publicInputs: [], proofData: ''})),
}));
jest.mock('../poolTx', () => ({submitPoolTx: jest.fn(async () => 'SIG')}));
jest.mock('../leafResolver', () => ({resolveLeafIndex: jest.fn(async () => 3)}));
jest.mock('../noteStore', () => ({addNote: jest.fn()}));
jest.mock('../../solana/transactionBuilder', () => ({
  resolveSourceTokenAccount: jest.fn(async () => new PublicKey(new Uint8Array(32).fill(5))),
}));
jest.mock('../../solana/connection', () => ({getConnection: () => ({})}));
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({}), initSecureMmkv: jest.fn(),
}));

import {depositShield} from '../depositFlow';
import {addNote} from '../noteStore';
import {tryDecryptNote} from '../noteEncryption';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';

const MINT = 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe';
const seed = new Uint8Array(64).fill(7);
const feePayer = Keypair.generate();

it('emits a 128-byte memo that decrypts to the stored note amount + noteSecret', async () => {
  await depositShield(seed, feePayer, MINT, 1_000n);
  expect(captured.ciphertext).toHaveLength(128);
  const dec = tryDecryptNote(deriveShieldedViewKey(seed), captured.ciphertext!);
  expect(dec).not.toBeNull();
  expect(dec!.amount).toBe(1_000n);
  // the memo carries the SAME noteSecret that was persisted for the note
  const stored = (addNote as jest.Mock).mock.calls[0][0];
  expect(dec!.noteSecret.toString()).toBe(stored.noteSecret);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=depositMemo`
Expected: FAIL — `buildDepositIx` is called without `ciphertext`, so `captured.ciphertext` is `undefined`.

- [ ] **Step 3: Implement**

In `depositFlow.ts`, add imports:

```ts
import {encryptNote} from './noteEncryption';
import {getViewPublicKey} from './shieldedIdentity';
```

In `depositShield`, build the memo right after the note is built and pass it to `buildDepositIx`:

```ts
  const {params, note} = buildDepositNote(seed, amount, mint);
  // Recovery memo: encrypt (amount, noteSecret) to our OWN view key so a wallet
  // restored from the mnemonic recovers this deposit by scanning (noteScan.ts).
  const ciphertext = encryptNote(getViewPublicKey(seed), amount, BigInt(note.noteSecret));
```

and in the `buildDepositIx({ … })` call add `ciphertext,` (e.g. after `proofBytes,`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=depositMemo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/depositFlow.ts src/modules/shielded/__tests__/depositMemo.test.ts
git commit -m "feat(shielded): depositShield emits recovery memo to own view key"
```

---

### Task 4: `unshieldWithChange` — emit the change-note memo

**Files:**
- Modify: `src/modules/shielded/withdrawFlow.ts` (`unshieldWithChange`)
- Test: `src/modules/shielded/__tests__/withdrawChangeFlow.test.ts` (extend the existing harness)

**Interfaces:**
- Consumes: `buildWithdrawChangeWitness` result `w` with `w.changeAmount: bigint`; the local `changeNoteSecret: bigint`; `buildWithdrawWithChangeIx` (now requires `ciphertext`, Task 2); `encryptNote`, `getViewPublicKey`.
- Produces: `unshieldWithChange` passes `ciphertext = encryptNote(getViewPublicKey(seed), w.changeAmount, changeNoteSecret)` to `buildWithdrawWithChangeIx`.

- [ ] **Step 1: Write the failing test**

The existing `withdrawChangeFlow.test.ts` lets `buildWithdrawWithChangeIx` run real (its returned ix goes to the mocked `submitPoolTxMany`). Add a `poolInstructions` mock at the top of the file to capture the ciphertext, and a new test. Add near the other `jest.mock` calls:

```ts
const capturedW: {ciphertext?: Uint8Array} = {};
jest.mock('../poolInstructions', () => ({
  buildWithdrawWithChangeIx: jest.fn((p: {ciphertext: Uint8Array}) => {
    capturedW.ciphertext = p.ciphertext;
    return {};
  }),
  buildCreateAtaIdempotentInstruction: jest.fn(() => ({})),
}));
```

> Note: `withdrawFlow.ts` also imports `buildCreateAtaIdempotentInstruction` — check its real import path. If it comes from a different module (e.g. `../../solana/*`) rather than `poolInstructions`, mock it there instead and only mock `buildWithdrawWithChangeIx` from `poolInstructions`. Grep first: `grep -n "buildCreateAtaIdempotentInstruction\|buildWithdrawWithChangeIx" src/modules/shielded/withdrawFlow.ts`.

Add imports at the top of the test:

```ts
import {tryDecryptNote} from '../noteEncryption';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';
```

Add the test inside `describe('unshieldWithChange', …)`:

```ts
  it('emits a change-note memo that decrypts to the change amount + change secret', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: [rootHex]});
    await unshieldWithChange(seed, feePayer, MINT, note, 200n);
    expect(capturedW.ciphertext).toHaveLength(128);
    const dec = tryDecryptNote(deriveShieldedViewKey(seed), capturedW.ciphertext!);
    expect(dec).not.toBeNull();
    expect(dec!.amount).toBe(300n); // changeAmount from the mocked witness
    const stored = (addNote as jest.Mock).mock.calls[0][0];
    expect(dec!.noteSecret.toString()).toBe(stored.noteSecret);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=withdrawChangeFlow`
Expected: FAIL — `capturedW.ciphertext` is `undefined` (memo not built yet). (Pre-existing tests may also shift because `buildWithdrawWithChangeIx` is now mocked; they should still pass since they don't assert on the ix — if any asserted on real ix data, move that assertion to Task 2's ix test.)

- [ ] **Step 3: Implement**

In `withdrawFlow.ts`, add imports (if not already present):

```ts
import {encryptNote} from './noteEncryption';
import {getViewPublicKey} from './shieldedIdentity';
```

In `unshieldWithChange`, after the witness `w` is built and before `buildWithdrawWithChangeIx`, add:

```ts
  // Recovery memo for the same-owner change note: encrypt (changeAmount,
  // changeNoteSecret) to our own view key so a restored wallet recovers it.
  const ciphertext = encryptNote(getViewPublicKey(seed), w.changeAmount, changeNoteSecret);
```

and add `ciphertext,` to the `buildWithdrawWithChangeIx({ … })` params.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=withdrawChangeFlow`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/withdrawFlow.ts src/modules/shielded/__tests__/withdrawChangeFlow.test.ts
git commit -m "feat(shielded): unshieldWithChange emits change-note recovery memo"
```

---

### Task 5: ICO contract spec + golden vector + full-suite verification

**Files:**
- Create: `docs/superpowers/specs/2026-07-13-ico-deposit-withdrawchange-memo-contract.md`
- Create: `/home/user/Downloads/deposit-withdrawchange-memo-golden.json` (handoff artifact, outside the repo like the transfer golden vector)

**Interfaces:**
- Consumes: the finalized `buildDepositIx` / `buildWithdrawWithChangeIx` (Tasks 1–2) to produce byte-exact golden data.

- [ ] **Step 1: Generate the golden vectors**

Write a throwaway node script (run with `npx tsx` or a temporary jest test that logs) that calls both builders with fixed params and prints `ix.data.toString('hex')`. Use deterministic inputs: `amount`/`commitment`/`proofBytes` fixed, and a fixed 128-byte `ciphertext` (e.g. `new Uint8Array(128).fill(0xcd)`) — the memo bytes are opaque to the program, so a fixed filler is fine for byte-parity. Capture both `expectedIxDataHex` strings.

- [ ] **Step 2: Write the golden JSON**

Write `/home/user/Downloads/deposit-withdrawchange-memo-golden.json`:

```json
{
  "deposit": { "params": { "amount": "1000000000", "commitmentHex": "…", "proofBytesHex": "…", "ciphertextHex": "cdcd… (128B)" }, "expectedIxDataHex": "…", "accountMetas": ["pool(ro)","merkle_tree(mut)","vault(mut)","depositor(signer)","depositor_token_account(mut)","token_program(ro)"] },
  "withdraw_with_change": { "params": { "…": "…", "ciphertextHex": "ee… (128B)" }, "expectedIxDataHex": "…", "accountMetas": ["pool(ro)","merkle_tree(mut)","vault(mut)","destination_token_account(mut)","nullifier_record(mut)","fee_payer(signer,mut)","wchange_vk(ro)","token_program(ro)","system_program(ro)"] }
}
```

Fill the `…` with the real hex from Step 1.

- [ ] **Step 3: Write the ICO contract spec**

Create `docs/superpowers/specs/2026-07-13-ico-deposit-withdrawchange-memo-contract.md` stating the frozen contract for ICO Claude:
- `deposit` and `withdraw_with_change` each gain a trailing `ciphertext: [u8; 128]` argument (Borsh: `u32le(len)+bytes`, len must equal 128 — reject otherwise), appended AFTER `proof_bytes`. Exact byte layouts (deposit 440 B total, withdraw_with_change 504 B total) copied from the design spec §"Ix byte layout".
- Both emit the existing `NoteCiphertext { leaf_index: u64, ciphertext: [u8; 128] }` event (already defined/emitted by `transfer`) with the note's leaf index.
- The memo is NOT a circuit input → verifying keys and circuits are unchanged (no circom rebuild, no trusted-setup impact).
- Byte-parity is asserted against `deposit-withdrawchange-memo-golden.json` (same precedent as `transfer-golden.json`).
- Ciphertext is required (fail-closed); no optional field.

- [ ] **Step 4: Full-suite + typecheck regression**

Run: `npx tsc --noEmit` → clean.
Run: `npx jest` → all green (2 pre-existing skipped suites allowed).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-13-ico-deposit-withdrawchange-memo-contract.md
git commit -m "docs(shielded): ICO contract spec + golden vector for deposit/withdraw_change memo"
```

(The golden JSON lives in `~/Downloads`, outside the repo — it is handed to ICO Claude, mirroring `transfer-golden.json`.)

---

## Self-Review

- **Spec coverage:** deposit memo → Task 1+3; withdraw_change memo → Task 2+4; ix byte layout / ICO contract → Tasks 1,2,5; recovery (scan) → unchanged, already covered by `noteScan.test.ts` (noted, no task); no-migration / noteSecret-stays-random / full-withdraw-untouched → design decisions, no code (Task 3/4 touch only the change/deposit paths). Golden vector + ICO handoff → Task 5. All spec sections mapped.
- **Placeholder scan:** the only `…` are in Task 5's golden JSON template, explicitly filled from Step 1's real output — not a code placeholder. No TODO/TBD in implementation steps.
- **Type consistency:** `ciphertext: Uint8Array` (128) added identically to both param interfaces; `encryptNote(viewKeyG1, amount: bigint, noteSecret: bigint) → Uint8Array`; `getViewPublicKey(seed) → Uint8Array`; `tryDecryptNote(skView, ct) → {amount: bigint, noteSecret: bigint} | null`; `w.changeAmount: bigint`; `note.noteSecret: string` (→ `BigInt(...)` before `encryptNote`). Offsets: deposit len-prefix @308, withdraw_change @372 — consistent with each builder's field sizes.

## Not in this plan (ICO / on-device, out of scope)

- ICO implements the program change + redeploys (devnet first) per the Task 5 contract spec.
- On-device restore-from-mnemonic end-to-end verification (deposit → wipe → recover → spend) after ICO deploys — needs a device build.
- Migration of pre-memo devnet notes — intentionally omitted (design spec §Scope).
