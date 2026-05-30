# Screen #18 — ZK Proof

## Overview

Always-shielded screen reached from `ShieldUnshieldScreen` (#16) when the user taps Shield/Unshield. Renders a 4-stage progress engine (Build witness → Prove → Verify locally → Ready) while running the real `zkProver` chain in parallel. On failure, presents a 2-CTA recovery (Retry locally / Use Noctura hosted prover); the hosted path opens a bottom sheet with full disclosure of what the server sees before consent. FLAG_SECURE is active throughout because the prover surfaces witness / nullifier / spend-key material.

Mirrors §s18 from the canonical wallet design HTML maintained outside this repository. All visual, copy, and state-machine specifics are reproduced verbatim below.

**Scope reality (read this before implementing):** Local prover (`localProver.ts`) is a stub that always throws — the Polygen WASM runtime is not yet wired. Hosted prover (`zkProverModule.proveHosted`) is real HTTP but the backend service does not exist yet. The screen therefore always exercises the failure path in practice; this is intentional per the existing project memory ("Real HTTP for hosted prover + queue, stub only local Polygen; let failures exercise fallback chain naturally"). The UI mock animation (timer-driven) gives the user the spec experience while the chain runs in the background.

---

## Section 1: File Changes

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/screens/shielded/ZkProofScreen.tsx` | Screen + reducer + inline `HostedProverSheet` + `StagesList` + `HeroBlock` |
| Create | `src/screens/shielded/__tests__/ZkProofScreen.test.tsx` | Unit tests covering all 7 states + transitions + chain mock integration |
| Modify | `src/types/navigation.d.ts` | Add route `ZkProofModal: {direction: 'private' \| 'public'; amount: string; recipient?: string}` |
| Modify | `src/app/Navigator.tsx` | Register route + screen wrapper |
| Modify | `src/screens/shielded/ShieldUnshieldScreen.tsx` | Replace placeholder `Alert` CTA with `navigation.replace('ZkProofModal', {...})` |

No new npm dependencies.

---

## Section 2: State Machine

7 visible states, modeled as `useReducer` with the discriminated state below:

```ts
type Stage = 'pending' | 'active' | 'done' | 'errored';

type State =
  | {kind: 'idle'}                                                  // 1
  | {kind: 'building'; pct: number; startedAt: number}              // 2
  | {kind: 'proving'; pct: number; startedAt: number}               // 3
  | {kind: 'verifying'; pct: number; startedAt: number}             // 4
  | {kind: 'ready'; proof: ZKProof}                                 // 5
  | {kind: 'failed'; erroredStage: 1 | 2 | 3; reason: string;
      hostedBanner?: string}                                        // 6
  | {kind: 'sheet'; failureState: Extract<State, {kind: 'failed'}>} // 7 (modal over 6)
  | {kind: 'hosted-proving'};                                       // sub-state for hosted call in flight
```

### Actions

```ts
type Action =
  | {type: 'START'}                          // mount → idle to building
  | {type: 'STAGE_TICK'; pct: number}        // setInterval percentage update
  | {type: 'STAGE_ADVANCE'}                  // setTimeout end-of-stage
  | {type: 'CHAIN_SUCCESS'; proof: ZKProof}  // real prover returned ok
  | {type: 'CHAIN_FAIL'; reason: string}     // real prover threw
  | {type: 'RETRY_LOCAL'}                    // user tapped Retry locally
  | {type: 'OPEN_SHEET'}                     // user tapped Use Noctura hosted prover
  | {type: 'CLOSE_SHEET'}                    // sheet Cancel / back swipe
  | {type: 'START_HOSTED'}                   // sheet Proceed
  | {type: 'HOSTED_FAIL'; reason: string};   // hosted call failed
```

### Race rule (mock animation × real chain)

- Animation runs through stages on a fixed schedule: building 2 s · proving 3 s · verifying 2 s · ready 400 ms hold.
- Real chain (`zkProver.prove(...)`) runs in parallel via `useEffect`.
- **At the end of each animated stage**, reducer checks `chainResult`:
  - If `chainResult === 'success'` → fast-forward to ready (skip remaining stages).
  - If `chainResult === 'failed'` → jump to state 6, mark the just-finished stage as `errored`, capture reason.
  - Else continue animation.
- Minimum visible time of the building stage is 2 s — prevents instant-flash failure when local stub throws synchronously.

### State transition table

| Current | Trigger | Next |
|---|---|---|
| idle | mount `START` | building (pct=0) + start chain in effect |
| building | `STAGE_TICK` | building (pct updated) |
| building | `STAGE_ADVANCE` (after 2 s) + chain success | ready |
| building | `STAGE_ADVANCE` (after 2 s) + chain failed | failed (erroredStage=1) |
| building | `STAGE_ADVANCE` (after 2 s) + chain pending | proving (pct=0) |
| proving | `STAGE_ADVANCE` (after 3 s) | (same race rule) |
| verifying | `STAGE_ADVANCE` (after 2 s) | (same race rule) |
| ready | 400 ms timer | navigate to success destination |
| failed | `RETRY_LOCAL` | idle (full reset, new chain effect) |
| failed | `OPEN_SHEET` | sheet |
| sheet | `CLOSE_SHEET` | failed (restored from failureState) |
| sheet | `START_HOSTED` | hosted-proving |
| hosted-proving | `CHAIN_SUCCESS` | ready |
| hosted-proving | `HOSTED_FAIL` | failed (with hostedBanner set) |

---

## Section 3: Visual Structure

```
SafeAreaView (edges: top, bottom, left, right) · bg-bg-base
├─ Top bar (h: 48dp, px-5, flex-row)
│  ├─ Pressable [back ←]         — 48dp, X icon, confirm dialog if mid-proof
│  ├─ Centered overline          — shield-lock 12dp + "SHIELDED" (accent-shielded)
│  └─ Step chip "ZK"             — overline color
├─ ScrollView (flex-1)
│  ├─ <HeroBlock state={state}/>     — cpu ring (animated when active) + stage label + stage sub
│  ├─ <StagesList state={state}/>    — 4 numbered rows with copy + meta + status
│  └─ "Local prover slow?" link      — visible in building / proving / verifying, no-op for now
├─ Footer note (always visible above sticky bar)
│  └─ shield-lock 14dp + "FLAG_SECURE · screenshots blocked"
└─ Sticky bar (conditional)
   ├─ states 1-5 → null (hidden)
   └─ state 6 → [Retry locally] (primary mint 56dp) + [Use Noctura hosted prover] (secondary surface 56dp)
                — inverted hierarchy: retry-local is the privacy-preserving choice

Modal (state 7, transparent overlay):
└─ View (bg dim 50%, justify-end)
   └─ View (bg-surface-1, rounded-lg-top, p-5)
      ├─ Grabber bar (centered, 40×4dp)
      ├─ Text h2 "Use Noctura hosted prover"
      ├─ View flex-row gap-3 (2-column grid)
      │  ├─ <DisclosureCard accent="warn"  title="Server SEES"      items={SEES_ITEMS}/>
      │  └─ <DisclosureCard accent="shield" title="Server CAN'T SEE" items={CANT_SEE_ITEMS}/>
      ├─ Text caption opt-in (—shield-300 accent)
      └─ Pressable [Proceed with hosted proof] (primary mint 56dp)
```

### HeroBlock variants

| State | Hero label | Hero sub |
|---|---|---|
| idle | `Preparing proof` | `Securely generating a zero-knowledge proof of ownership for this transfer. Stays on-device.` |
| building | `Building witness` | `Loading commitment tree and constructing the witness. About 4 seconds.` |
| proving | `Proving` | `Running the Plonk prover. About 6 seconds.` |
| verifying | `Verify locally` | `Sanity-checking the proof on-device before broadcast.` |
| ready | `Ready` | `Proof generated. Submitting to the network.` |
| failed | `Couldn't generate proof` | `<reason>` (e.g. `Local prover ran out of memory.`) |
| hosted-proving | `Generating on hosted prover` | `Connecting to the Noctura proving service.` |

### Stage row meta

For pending stages: `— · pending` with status dot `·`.
For active stage: `running · N.Ns` with percentage `42 %` on the right.
For done stages: `done · N.Ns` with checkmark.
For errored stage (only one possible): `error · OOM` (or whatever reason) with red triangle.

---

## Section 4: Copy (verbatim from spec §s18)

| Element | Text |
|---|---|
| Overline | `SHIELDED` |
| Step chip | `ZK` |
| Stage 1 title | `Build witness` |
| Stage 2 title | `Prove` |
| Stage 3 title | `Verify locally` |
| Stage 4 title | `Ready` |
| Footer | `FLAG_SECURE · screenshots blocked` |
| Slow link | `Local prover slow?` |
| Retry CTA | `Retry locally` |
| Hosted CTA | `Use Noctura hosted prover` |
| Sheet title | `Use Noctura hosted prover` |
| Sheet "SEES" header | `Server SEES` |
| Sheet "SEES" items | `Pedersen-hashed commitments`, `Network fee`, `Anonymity set ID` |
| Sheet "CAN'T SEE" header | `Server CAN'T SEE` |
| Sheet "CAN'T SEE" items | `Spend key`, `Recipient address`, `Amount in clear` |
| Sheet opt-in | `By proceeding you opt in to a one-time hosted proof. You'll be asked again on the next failure.` |
| Sheet primary | `Proceed with hosted proof` |
| Back-during-proof confirm title | `Cancel proof generation?` |
| Back-during-proof confirm body | `Your transaction will not be sent.` |
| Success Alert title | `Proof ready` |
| Success Alert body | `Transaction simulation (#19) not yet wired — returning to dashboard.` |

---

## Section 5: zkProver Integration

```ts
useEffect(() => {
  let cancelled = false;

  async function runChain() {
    try {
      // Fabricated mock witness + publicInputs; real values flow in once
      // shielded send is wired end-to-end in a later PR.
      const witness = buildMockWitness(route.params);
      const publicInputs = buildMockPublicInputs(route.params);
      const proof = await zkProver.prove({
        type: route.params.direction === 'private' ? 'deposit' : 'withdraw',
        witness,
        publicInputs,
      });
      if (!cancelled) {
        dispatch({type: 'CHAIN_SUCCESS', proof});
      }
    } catch (err) {
      if (!cancelled) {
        dispatch({type: 'CHAIN_FAIL', reason: extractErrorMessage(err)});
      }
    }
  }

  void runChain();
  return () => {
    cancelled = true;
  };
}, [route.params, retryCounter]); // retryCounter re-runs the effect on Retry locally
```

`buildMockWitness` and `buildMockPublicInputs` are local helpers that produce zero-filled buffers matching the `ProofWitness` / `ProofPublicInputs` type shapes from `src/modules/zkProver/types.ts`. They exist solely so the call type-checks; the local stub throws regardless of input contents.

`extractErrorMessage` collapses `ProverUnavailableError`, `ProofGenerationError`, and network errors into a user-readable string.

### Expected runtime behavior (today)

1. Mount → state `building`, chain effect kicks off
2. `localProver.generate()` throws `ProverUnavailableError('Polygen WASM not yet wired')` synchronously
3. `zkProverModule` catches, attempts `proveHosted()` → HTTP fails (no backend) → returns `ProofGenerationError`
4. Chain effect: `dispatch({type: 'CHAIN_FAIL', reason: 'Hosted prover unreachable'})`
5. At end of building stage (2 s), reducer sees `chainResult === 'failed'` → transition to state 6
6. User taps Retry → state 6 → idle → building → same fail
7. User taps Use Noctura hosted prover → state 7 sheet
8. User taps Proceed → state `hosted-proving` → `proveHosted` again → HTTP fail → state 6 with `hostedBanner: 'Hosted prover also failed: <reason>'`

---

## Section 6: Navigation Contract

| Action | Behavior |
|---|---|
| Entry | `navigation.navigate('ZkProofModal', {direction, amount, recipient?})` from `ShieldUnshieldScreen` — using `navigate` (push), not `replace`, so the user's back gesture returns to ShieldUnshield (#16) where they can adjust the amount and try again |
| Back ← (states 1-5) | Confirm dialog "Cancel proof generation? Your transaction will not be sent." → if confirmed `navigation.goBack()` |
| Back ← (state 6) | Direct `navigation.goBack()` (no proof in progress) |
| Back ← (state 7) | Equivalent to sheet Cancel → `CLOSE_SHEET` |
| Ready (after 400 ms hold) | `Alert.alert('Proof ready', 'Transaction simulation (#19) not yet wired — returning to dashboard.', [{onPress: () => navigation.popToTop()}])` |
| Retry locally (state 6) | `dispatch({type: 'RETRY_LOCAL'})` — increments retryCounter, effect re-fires |
| Use Noctura hosted prover (state 6) | `dispatch({type: 'OPEN_SHEET'})` |
| Sheet Cancel | `dispatch({type: 'CLOSE_SHEET'})` |
| Sheet Proceed | `dispatch({type: 'START_HOSTED'})` → effect runs `proveHosted()` directly (bypasses `localProver`) |

### Navigator wiring

```tsx
// src/types/navigation.d.ts
ZkProofModal: {direction: 'private' | 'public'; amount: string; recipient?: string};

// src/app/Navigator.tsx
function ZkProofScreenNav(props: NativeStackScreenProps<RootStackParamList, 'ZkProofModal'>) {
  return <ZkProofScreen {...props} />;
}
<RootNav.Screen name="ZkProofModal" component={ZkProofScreenNav} options={modalScreenOptions} />
```

### ShieldUnshieldScreen update

Replace existing `Alert.alert(...)` CTA handler (around line 127) with:

```ts
function handleShieldCta() {
  const rawAmount = parseTokenAmount(amount, SOL_DECIMALS).toString();
  navigation.navigate('ZkProofModal', {direction, amount: rawAmount, recipient: undefined});
}
```

(Exact line numbers will be in the plan; this is the design contract.)

---

## Section 7: FLAG_SECURE

Per spec §s18 (D): YES, live (not preview).

```ts
useEffect(() => {
  void securityManager.enableSecureScreen();
  return () => {
    void securityManager.disableSecureScreen();
  };
}, []);
```

Cleanup also fires when the hosted-prover Modal dismisses, even though the parent `ZkProofScreen` survives — that's expected (Modal is a child render of the parent; parent's effect stays mounted across sheet open/close).

In `__DEV__` debug builds, `ScreenSecurityManager` no-ops (per existing escape hatch) — verification will require a release build, as documented in PR #5.

---

## Section 8: Testing (TDD)

`src/screens/shielded/__tests__/ZkProofScreen.test.tsx`. Mock `zkProver` module to control chain outcome per test.

| # | Test |
|---|---|
| 1 | renders state idle on mount: hero "Preparing proof", all 4 stages "pending" |
| 2 | after 2 s timer advance + chain pending: stage 1 marked done, stage 2 active |
| 3 | chain success during animation: fast-forwards to ready, navigates to success destination after 400 ms |
| 4 | chain failure on local stub: transitions to state 6 (failed) after at least 2 s, shows 2 CTAs |
| 5 | tap Retry locally → state resets, chain effect re-fires |
| 6 | tap Use Noctura hosted prover → sheet renders with title, both disclosure cards, opt-in caption, Proceed button |
| 7 | sheet Cancel → returns to state 6, sheet unmounts |
| 8 | sheet Proceed → calls `zkProver.proveHosted` (mocked), transitions to hosted-proving |
| 9 | hosted success → state ready → success Alert + navigation.popToTop |
| 10 | hosted failure → state 6 with hostedBanner text visible |
| 11 | tap back during proof shows confirm dialog; back when failed dismisses immediately |
| 12 | renders footer note "FLAG_SECURE · screenshots blocked" in all states 1-5 |

Test setup uses `jest.useFakeTimers()` + `act(() => jest.advanceTimersByTime(2000))` to drive stage transitions deterministically. `zkProver` is mocked at the module level so per-test behavior is controllable.

---

## Section 9: Out of Scope (Deferred)

- **Proof queue integration** — failed proofs do not enqueue for background retry. #18 is foreground-only. Queue work (state recovery on app open, retry on connectivity) is a separate later PR.
- **Real witness / publicInputs** — fabricated zero-filled mock data; #16 → #18 doesn't yet pass real shielded inputs. Lands in shielded send PR.
- **#19 tx-simulate destination** — success Alert + `popToTop()` placeholder. When #19 ships, swap one nav call.
- **iOS Liquid Glass material** on the sheet — default RN surface; polish later (Round 3b note).
- **"Local prover slow?" link** — visible per spec but tap is a no-op (deferred to v0.3 docs WebView, same as #17 Learn more).
- **Hosted retry queueing** — if hosted also fails, user must manually tap Retry; no auto-retry-with-backoff.

---

## Section 10: Acceptance Criteria

- [ ] All 12 unit tests in `ZkProofScreen.test.tsx` pass
- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint 'src/**/*.{ts,tsx}' '__mocks__/**/*.ts'` 0 errors
- [ ] Manual smoke on Android: fresh install → tap Shielded on Dashboard → explainer → Continue → ShieldUnshield (#16) → tap Shield → ZkProof screen renders state idle → animates to building → after ~2 s transitions to state 6 (failed) → tap Retry → same flow → tap Use Noctura hosted prover → sheet renders with full disclosure → tap Proceed → hosted-proving → fails again → state 6 with hosted banner
- [ ] Manual smoke: tap back during state building → confirm dialog appears; tap back from state 6 → direct dismiss
