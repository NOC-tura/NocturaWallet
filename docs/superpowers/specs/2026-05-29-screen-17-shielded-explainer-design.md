# Screen #17 — Shielded Explainer

## Overview

First-run education screen shown the first time the user toggles Shielded mode on the Dashboard. Renders only when MMKV flag `v1_shielded_explained !== true`; on Continue tap, sets the flag and navigates directly to ShieldUnshield (#16). Mirrors the §s17 design from the canonical wallet design HTML maintained outside this repository. All visual, copy, and behavioral specifics from that source are reproduced verbatim below — no external file access is required to implement against this spec.

The implementation defined by this spec also retires the existing generic `PrivacyExplainerScreen.tsx` (which used different copy, layout, and MMKV key naming) — that file is deleted as part of the implementation work, per CLAUDE.md guidance on not leaving deprecated shims. **Scope note:** this spec doc has been merged ahead of the implementation; the file deletion and screen rewrite land in a follow-up PR that executes the plan in `docs/superpowers/plans/2026-05-29-screen-17-shielded-explainer.md`.

---

## Section 1: File Changes

```
DELETE  src/screens/PrivacyExplainerScreen.tsx
CREATE  src/screens/shielded/ShieldedExplainerScreen.tsx
CREATE  src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx
EDIT    src/constants/mmkvKeys.ts
EDIT    src/types/navigation.d.ts
EDIT    src/app/Navigator.tsx
EDIT    src/screens/dashboard/DashboardScreen.tsx
```

No new npm dependencies. `react-native-svg` (already present via `lucide-react-native`) is used for the vault hero stripe pattern.

---

## Section 2: Visual Structure

```
SafeAreaView (edges: top, bottom, left, right) · bg-bg-base
├─ Top bar (h: 48dp, px-5, flex-row, justify-between)
│  ├─ Pressable [close ×]   — 48dp tap target, X icon (lucide)
│  ├─ Centered overline     — shield-lock icon + "SHIELDED" (accent-shielded)
│  └─ Step counter          — "1 / 1" (overline color)
├─ ScrollView (flex-1)
│  ├─ <VaultHero/>          — 88dp disc, accent ring, halo, diagonal stripes, lucide Vault icon
│  ├─ Text h1               — "Private SOL, three steps."
│  ├─ Text deck             — full description verbatim (Section 3)
│  ├─ <ExplainerStep n=1 …/>
│  ├─ <ExplainerStep n=2 …/>
│  ├─ <ExplainerStep n=3 …/>
│  └─ Footer note row       — shield-lock 14dp + "Screenshots disabled across this flow."
└─ Sticky bar (px-5, pb-inset, gap-3)
   ├─ Pressable [Continue]   — 56dp, bg-accent-shielded, body-lg semibold
   └─ Button [Learn more]    — variant=tertiary, 48dp
```

### VaultHero (composite SVG approach — A1)

Inline component in `ShieldedExplainerScreen.tsx`:

- `View` 88×88 dp, `rounded-full`, `border` 1px `accent-shielded`, accent halo (box-shadow via `shadowColor`/`shadowOpacity` for iOS + `elevation` for Android)
- Absolute-positioned `<Svg>` 88×88 with `<Defs><Pattern>` rendering diagonal stripes at 6% accent opacity, clipped to a circle (`<Circle cx=44 cy=44 r=43 fill="url(#stripes)"/>`)
- Centered lucide `<Vault size=44 color="#5BE3C2" strokeWidth=1.75/>` on top

### ExplainerStep (inline)

```
<View flex-row gap-4 mb-6>
  <View w-7 h-7 rounded-full bg-accent-shielded-tint items-center justify-center>
    <Text variant="body-sm" mono numeral className="text-accent-shielded">{n}</Text>
  </View>
  <View flex-1>
    <Text variant="h3" mb-1>{title}</Text>
    <Text variant="body-sm" className="text-fg-secondary">{body}</Text>
  </View>
</View>
```

Lives inline (used only on this screen — no `components/` extraction).

---

## Section 3: Copy (verbatim from index.html §s17)

| Element | Text |
|---|---|
| Overline | `SHIELDED` |
| Step counter | `1 / 1` |
| H1 | `Private SOL, three steps.` |
| Deck | `Shielded mode moves SOL into a ZK pool. Senders, recipients, and amounts of future shielded transfers are unlinkable from your public address.` |
| Step 1 title | `Move into the vault` |
| Step 1 body | `Deposit SOL from your public address. The deposit itself is visible on-chain (it has to be — it's how you fund the vault), but everything from this point onward is private.` |
| Step 2 title | `Generate a ZK proof` |
| Step 2 body | `For every shielded action, your phone produces a Plonk-style zero-knowledge proof locally. The proof shows you own the funds without revealing which note you're spending.` |
| Step 3 title | `Send privately` |
| Step 3 body | `Settled on Solana with the proof attached. Validators verify the proof; nobody — not even Noctura — sees the recipient or the amount.` |
| Footer | `Screenshots disabled across this flow.` |
| Primary CTA | `Continue` |
| Tertiary CTA | `Learn more` |

---

## Section 4: Navigation Contract

| Action | Behavior |
|---|---|
| Tap **Continue** | (1) `mmkvPublic.set(MMKV_KEYS.SHIELDED_EXPLAINED, true)`; (2) `useShieldedStore.getState().setMode('shielded')`; (3) `navigation.replace('ShieldUnshieldModal', {direction: 'private'})`. `replace` (not `navigate`) so the explainer is not in the back-stack. |
| Tap **Learn more** | `Linking.openURL('https://noc-tura.io/privacy')`. Placeholder until v0.3 in-app WebView (per spec line 8161). |
| Tap **close ×** | `navigation.goBack()`. Does **not** set the MMKV flag. Does **not** flip mode. |
| Android predictive back | Identical to close × (no override needed — default RN navigation behavior). |

### Dashboard wiring change

`src/screens/dashboard/DashboardScreen.tsx` already gates the first shielded toggle on the explainer flag. Only change needed: rename the key constant usage from `MMKV_KEYS.PRIVACY_EXPLAINER_SHOWN` to `MMKV_KEYS.SHIELDED_EXPLAINED`. The `onFirstShieldedToggle` callback continues to navigate to the root-level explainer route.

### Navigator wiring change

`src/app/Navigator.tsx`:
- Rename route `PrivacyExplainer` → `ShieldedExplainer` (also in `src/types/navigation.d.ts`)
- Import `ShieldedExplainerScreen` from new path
- Inside the screen wrapper, pass nav prop and let the screen call `navigation.replace('ShieldUnshieldModal', {direction: 'private'})` itself rather than going through an `onDismiss` callback (the screen needs to navigate to a sibling route, not just dismiss, so the callback indirection no longer fits)

---

## Section 5: MMKV + Constants

### `src/constants/mmkvKeys.ts`

- Replace existing `PRIVACY_EXPLAINER_SHOWN: 'v1_privacy.explainerShown'` with `SHIELDED_EXPLAINED: 'v1_shielded_explained'`
- **Delete** the old constant entirely (no `// deprecated` shim — per CLAUDE.md *"If you are certain that something is unused, you can delete it completely"*)

### Migration impact

Dev / test users who had previously dismissed the old `PrivacyExplainerScreen` will see the new `ShieldedExplainerScreen` once. This is acceptable for a feature still in development; not relevant for end users (no production releases yet).

---

## Section 6: Testing (TDD)

### `src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx`

Test cases (each with RED → GREEN cycle, no implementation before failing test):

1. **renders all spec copy** — H1 "Private SOL, three steps.", all 3 step titles, footer "Screenshots disabled across this flow."
2. **renders Continue + Learn more CTAs**
3. **renders close × button**
4. **tap Continue writes MMKV flag** — assert `mmkvPublic.getBoolean('v1_shielded_explained') === true` after tap (real MMKV instance, not callback spy — see decision below)
5. **tap Continue sets shielded mode** — assert `useShieldedStore.getState().mode === 'shielded'` after tap
6. **tap Continue navigates to ShieldUnshield** — assert mocked navigation `replace('ShieldUnshield')` was called
7. **tap close × does NOT write MMKV flag** — assert flag is still `false`/undefined after tap
8. **tap close × calls goBack** — assert mocked navigation `goBack()` was called
9. **tap Learn more opens external URL** — assert `Linking.openURL` called with `https://noc-tura.io/privacy`

### Decision: real MMKV vs callback spy

Use the real MMKV instance (already mocked at the jest level via `react-native-mmkv` jest mock — in-memory store). Rationale: the entire point of the screen is the persistence so it never re-shows. A callback-only spy test would pass even if we forgot to call `mmkv.set`. Real persistence test catches that regression.

### Dashboard test update

If `DashboardScreen` tests exist that touch the explainer flag (none currently — verified via `find src/screens/dashboard/__tests__`), update them to use `SHIELDED_EXPLAINED` constant. No tests currently exist for Dashboard — no edits needed.

---

## Section 7: Accessibility

| Element | Role | Label |
|---|---|---|
| Close × button | `button` | `Close` |
| Continue button | `button` | `Continue` |
| Learn more button | `button` | `Learn more` |
| Step number disc | (decorative — no role) | — |
| Vault hero | `image` | `Shielded vault illustration` |

WCAG contrast already verified in spec (D) Caption AA audit:
- footer note `--shield-300` on `--bg-base` · 14.4:1 — PASS
- deck/body `--fg-secondary` · 8.4:1 — PASS

---

## Section 8: Out of Scope (Deferred)

- In-app WebView for "Learn more" link — placeholder external `Linking.openURL` for now (deferred to v0.3 per spec line 8161)
- Vault hero Lottie / animated entrance — pure CSS-equivalent static render only
- Material You dynamic accent disabling — default RN behavior already does not pull system accent
- FLAG_SECURE on this screen — `NO` per spec (no secrets shown; "Screenshots disabled" footer previews #18 behavior, not this screen's)

---

## Section 9: Acceptance Criteria

- [ ] All 9 test cases in §6 pass
- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean
- [ ] Manual smoke on Android emulator: fresh install → onboarding → tap Shielded toggle on Dashboard → explainer renders → tap Continue → lands on ShieldUnshield screen, dashboard mode is 'shielded' on back
- [ ] Manual smoke: tap close × on explainer → returns to Dashboard, mode still 'transparent', tap Shielded again → explainer re-appears (flag not set)
- [ ] Old `PrivacyExplainerScreen.tsx` file is deleted, no orphan imports remain (verified via `grep`)
