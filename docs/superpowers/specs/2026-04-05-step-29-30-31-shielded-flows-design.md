# Step 29-30-31: Shielded Deposit, Transfer, Withdraw Flows

## Overview

Three shielded mode screens + shared business logic module for the Noctura Wallet privacy layer. Users move funds between transparent and shielded balances, and send privately between shielded addresses.

**Architecture:** Shared `src/modules/shielded/` module encapsulates note management, privacy assessment, address encoding, and proof-to-relayer orchestration. Thin screen components wire the module to UI.

---

## Module Layer: `src/modules/shielded/`

### `types.ts`

```typescript
interface ShieldedNote {
  commitment: string;       // 32-byte hex
  nullifier: string;        // 32-byte hex
  mint: string;             // base58 token mint
  amount: bigint;           // lamports
  index: number;            // Merkle leaf index
  spent: boolean;
  createdAt: number;        // Unix ms
}

interface DepositParams {
  mint: string;
  amount: bigint;
  senderPubkey: string;     // transparent address funding the deposit
}

interface ShieldedTransferParams {
  mint: string;
  amount: bigint;
  recipientAddress: string; // noc1... Bech32m
  memo?: string;            // optional encrypted memo
}

interface WithdrawParams {
  mint: string;
  amount: bigint;
  destinationPubkey: string; // transparent Solana address (Base58)
}

interface ShieldedTxResult {
  txSignature: string;
  proofType: 'deposit' | 'transfer' | 'withdraw';
  amount: bigint;
  timestamp: number;
}

interface CircuitConfig {
  maxInputs: number;        // e.g. 4
  maxOutputs: number;       // e.g. 2
  treeDepth: number;        // e.g. 32
}

interface PrivacyLevel {
  level: 'low' | 'moderate' | 'good';
  message: string;
  color: 'red' | 'yellow' | 'green';
  shouldShow: boolean;      // false when >= 10000 and not first deposit
}

type ConsolidationProgress = {
  currentStep: number;
  totalSteps: number;
};
```

### `noteStore.ts` — MMKV-persisted note management

Storage: `mmkvSecure` under `SHIELDED_NOTES_PREFIX + mint`.

```
getNotes(mint: string): ShieldedNote[]
  Returns all unspent notes for a given token mint.

getBalance(mint: string): bigint
  Sum of all unspent note amounts for a mint. Returns 0n if no notes.

selectNotes(mint: string, amount: bigint, fee: bigint): ShieldedNote[]
  Greedy selection of notes whose sum >= amount + fee.
  Sorts by amount descending (prefer fewer notes).
  Throws E013 (INSUFFICIENT_NOC_FEE) if total unspent < amount + fee.

addNote(note: ShieldedNote): void
  Persists a new note (after deposit or as change output).

markSpent(nullifiers: string[]): void
  Sets spent=true for notes matching the given nullifiers.
  Persists immediately to mmkvSecure.

clearMint(mint: string): void
  Removes all notes for a mint (used during full resync).
```

### `privacyMeter.ts` — pure functions

```
getPrivacyLevel(leafCount: number, isFirstDeposit: boolean): PrivacyLevel

  leafCount < 100:    { level: 'low',      message: 'Privacy pool is very small. May be traceable.',  color: 'red',    shouldShow: true }
  leafCount < 1000:   { level: 'moderate', message: 'Privacy pool is growing. Moderate protection.',   color: 'yellow', shouldShow: true }
  leafCount < 10000:  { level: 'good',     message: 'Good privacy protection.',                        color: 'green',  shouldShow: true }
  leafCount >= 10000: { level: 'good',     message: 'Good privacy protection.',                        color: 'green',  shouldShow: isFirstDeposit }

shouldRepeatWarning(leafCount: number): boolean
  Returns true when leafCount < 1000. When true, privacy meter is shown
  before every deposit/transfer even if previously dismissed.
```

### `shieldedAddressCodec.ts` — Bech32m encode/decode

HRP: `noc` (from `SHIELDED_ADDRESS_HRP` constant).

```
encodeShieldedAddress(publicKey: Uint8Array): string
  Encodes a BLS12-381 G1 compressed public key (48 bytes) as Bech32m.
  Returns string starting with "noc1".

decodeShieldedAddress(address: string): Uint8Array
  Decodes a noc1... Bech32m string to 48-byte public key.
  Throws E110 (INVALID_SHIELDED_ADDR) if:
    - Does not start with "noc1"
    - Invalid Bech32m checksum
    - Decoded data is not 48 bytes

isValidShieldedAddress(address: string): boolean
  Returns true if decodeShieldedAddress would succeed. Never throws.

formatShieldedAddress(address: string): string
  Returns truncated display: first 8 + "..." + last 4 characters.
  Example: "noc1qzp5...k7j2"
```

Uses `@scure/base` for Bech32m (already a dependency via `@scure/bip32`).

### `shieldedService.ts` — orchestrator

Dependencies: `zkProver`, `feeEngine`, `noteStore`, `pinnedFetch`, `merkleModule`.

```
fetchCircuitConfig(): Promise<CircuitConfig>
  GET /v1/config/circuit → { maxInputs, maxOutputs, treeDepth }
  Cached in memory for session lifetime.

submitToRelayer(proof: ZKProof): Promise<string>
  POST /v1/relayer/submit with proof data.
  Returns txSignature.
  Throws on HTTP error or relayer rejection.

deposit(params: DepositParams, stakingDiscount: number): Promise<ShieldedTxResult>
  1. Get fee via feeEngine.getEffectiveFee('crossModeDeposit', stakingDiscount)
  2. Build deposit witness (no note selection needed — funding from transparent)
  3. zkProver.prove('deposit', witness)
  4. submitToRelayer(proof)
  5. Add new note to noteStore
  6. Return ShieldedTxResult

transfer(
  params: ShieldedTransferParams,
  stakingDiscount: number,
  onConsolidationProgress?: (progress: ConsolidationProgress) => void
): Promise<ShieldedTxResult>
  1. Validate recipient via decodeShieldedAddress (throws E110)
  2. Get fee via feeEngine.getEffectiveFee('privateTransfer', stakingDiscount)
  3. selectNotes(mint, amount, fee)
  4. Fetch circuitConfig
  5. If selected.length > maxInputs:
     a. Compute consolidation steps needed
     b. For each step: prove('transfer' self-transfer) → relayer → update noteStore
     c. Call onConsolidationProgress({ currentStep, totalSteps })
     d. Re-select notes after consolidation
  6. Build transfer witness with recipient, amount, change output
  7. zkProver.prove('transfer', witness)
  8. submitToRelayer(proof)
  9. markSpent(input nullifiers), addNote(change output if any)
  10. Return ShieldedTxResult

withdraw(params: WithdrawParams, stakingDiscount: number): Promise<ShieldedTxResult>
  1. Get fee via feeEngine.getEffectiveFee('crossModeWithdraw', stakingDiscount)
  2. selectNotes(mint, amount, fee)
  3. Build withdraw witness with destination transparent address
  4. zkProver.prove('withdraw', witness)
  5. submitToRelayer(proof)
  6. markSpent(input nullifiers), addNote(change output if any)
  7. Return ShieldedTxResult
```

---

## Screen Layer: `src/screens/shielded/`

All screens follow state machine: `input → confirm → proving → success | error`.

### `DepositScreen.tsx` — "Move to private balance"

Route params: `{ token?: string }` (pre-selects token if provided).

**Input state:**
- TokenSelector (SOL / NOC / SPL tokens)
- Amount input with "Max" button
- FeeDisplayRow showing crossModeDeposit fee
- PrivacyMeter (shown before confirmation, dismissable, repeats if leafCount < 1000)

**Confirm state:**
- Summary: token, amount, fee, destination "Your private balance"
- "Confirm" button (debounce 500ms, disable on tap)

**Proving state:**
- ProofProgressOverlay: "Securing transaction..."
- No cancel (proof is in-flight)

**Success state:**
- Checkmark, amount moved, "View private balance" button

**Error handling:**
- E013: "Not enough NOC for privacy fee"
- E032: "Privacy service temporarily unavailable. Try again later."
- E030: "Privacy proof failed. Please try again."

### `ShieldedTransferScreen.tsx` — "Send privately"

Route params: `{ recipient?: string }` (pre-fills from deep link or address book).

**Input state:**
- ShieldedAddressInput (validates noc1..., paste, address book)
- TokenSelector + amount input
- Optional memo field (encrypted)
- FeeDisplayRow showing privateTransfer fee

**Confirm state:**
- Summary: recipient (truncated), amount, fee, memo preview
- Change output line: "Remainder stays in your private balance"
- PrivacyMeter (same rules as deposit)
- "Send" button (debounce 500ms)

**Consolidating state (conditional):**
- ProofProgressOverlay: "Optimizing your private balance... (step 1/3)"
- Shown only when selectNotes returns more than maxInputs

**Proving state:**
- ProofProgressOverlay: "Securing transaction..."

**Success state:**
- Checkmark, amount sent, recipient (truncated)

**Error handling:**
- E110: "Invalid private address" (inline on address input)
- E090: "Balance needs optimization" (should not normally appear — auto-consolidation handles this)
- Same proof/relayer errors as deposit

### `WithdrawScreen.tsx` — "Move to public balance"

Route params: none.

**Input state:**
- Transparent address input (Base58, uses existing `validateAddress`)
- Amount input
- FeeDisplayRow showing crossModeWithdraw fee
- Warning banner: "Withdrawal is NOT linkable to your deposit history"

**Confirm state:**
- Summary: destination, amount, fee
- "Confirm" button (debounce 500ms)

**Proving state:**
- ProofProgressOverlay: "Securing transaction..."

**Success state:**
- Checkmark, amount withdrawn, destination (truncated)

---

## Shared Components

### `PrivacyMeter.tsx`

Props: `{ leafCount: number; isFirstDeposit: boolean; onDismiss: () => void }`

Renders colored banner (red/yellow/green) with message from `getPrivacyLevel()`. Dismiss button present but warning repeats per `shouldRepeatWarning()`.

### `FeeDisplayRow.tsx`

Props: `{ feeInfo: FeeDisplayInfo }`

Renders: `"Fee: 0.0005 NOC (10% staking discount)"` or `"Fee: Free (until TGE)"` or `"Fee: Free ✓"`.

### `ProofProgressOverlay.tsx`

Props: `{ message: string; consolidation?: ConsolidationProgress }`

Full-screen semi-transparent overlay with spinner. When `consolidation` is provided, shows "Optimizing your private balance... (step 1/3)". Otherwise shows the message (typically "Securing transaction...").

### `ShieldedAddressInput.tsx`

Props: `{ value: string; onChange: (addr: string) => void; error?: string }`

Text input with paste button, address book picker, inline validation against `isValidShieldedAddress()`. Shows E110 error message when invalid.

---

## Terminology Rules (Enforced)

These labels are hardcoded in screens, never derived from backend/module names:

| Context | Label |
|---------|-------|
| Deposit button/title | "Move to private balance" |
| Transfer button/title | "Send privately" |
| Withdraw button/title | "Move to public balance" |
| During proof | "Securing transaction..." |
| During consolidation | "Optimizing your private balance..." |
| Change output | "Remainder stays in your private balance" |
| Commitment | NEVER shown to user |
| Nullifier | NEVER shown to user |
| Note count | NEVER shown (Settings > Advanced only) |

---

## File Structure

```
src/
├── modules/
│   └── shielded/
│       ├── types.ts
│       ├── noteStore.ts
│       ├── privacyMeter.ts
│       ├── shieldedAddressCodec.ts
│       ├── shieldedService.ts
│       └── __tests__/
│           ├── noteStore.test.ts
│           ├── privacyMeter.test.ts
│           ├── shieldedAddressCodec.test.ts
│           └── shieldedService.test.ts
├── screens/
│   └── shielded/
│       ├── DepositScreen.tsx
│       ├── ShieldedTransferScreen.tsx
│       ├── WithdrawScreen.tsx
│       └── __tests__/
│           ├── DepositScreen.test.tsx
│           ├── ShieldedTransferScreen.test.tsx
│           └── WithdrawScreen.test.tsx
��── components/
    ├── PrivacyMeter.tsx
    ├── FeeDisplayRow.tsx
    ├── ProofProgressOverlay.tsx
    └── ShieldedAddressInput.tsx
```

---

## Testing Strategy

**Module tests (TDD, unit):**
- noteStore: selection algorithm (greedy, fewest notes), insufficient balance → E013, spent marking, persistence round-trip
- privacyMeter: all 4 threshold bands, shouldRepeatWarning, first deposit logic
- shieldedAddressCodec: encode/decode round-trip, invalid addresses (wrong HRP, bad checksum, wrong length), format truncation
- shieldedService: deposit/transfer/withdraw happy paths (mock zkProver + relayer), consolidation triggering + step counting, error propagation (prover failure, relayer rejection)

**Screen tests (component, mock shieldedService):**
- State transitions: input → confirm → proving → success
- PrivacyMeter shown before confirm, dismissable
- "Securing transaction..." during proof
- Consolidation progress display
- Error states render correct messages
- Buttons disabled during proving (no double-submit)
