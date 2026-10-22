# Noctura Extension B1d — presale in the extension (buy, allocation, referral, jurisdiction gate)

**Status:** **approved rev 3**, 2026-10-19 (owner: "ok je") — Fable reviews 1–2 applied with owner decisions D7–D15; next: plan B1d-1a →  Fable review. The owner approved
the design in conversation section by section (`.superpowers/sdd/b1d-approved-design.md`, approach A) and took
decisions D1–D6, then D7–D14 on Fable's review 1 and D15 on review 2 (`.superpowers/sdd/b1d-owner-decisions.md`,
`.superpowers/sdd/b1d-spec-review-1.md`, `.superpowers/sdd/b1d-spec-review-2.md`).
Everything this spec adds beyond that text is a controller ruling (C1–C39 below) or a string in §10 (Q01–Q52, final
under D14). Research map: `.superpowers/sdd/b1d-context.md`. Where each review finding landed: §11.

**Ledger (review L12).** The order, so nobody has to guess it: the facts were re-read from the code on 2026-10-18 (§8.2)
and rev 1 was written from them; the owner's decisions D1–D6 and D7–D14 carry the date the decisions file records,
2026-10-19, which is also the date in this file's name; rev 2 was written after both sets of decisions, and every
rev 2 fix was checked again against the code it cites (wallet `main` at 0b79442, ICO at 75450df); rev 3 (review 2,
D15, 2026-10-19) likewise.

**Owner rule kept throughout:** no TGE date, no countdown and no relative time-to-TGE anywhere — not in a string, a
test, a fixture, a comment or this document. The design files contain the date; nothing here was copied from those
lines. The only TGE copy is D5's "Claimable after TGE". The config account's `tge_timestamp` field is never read by B1d
(§2.1).

**What this is.** The extension sells NOC in the presale to the user's own account, on mainnet: the design's #23 presale
(23a active, 23b pending, and an allocation row), #24 referral (as the Android app corrected it), #50b region blocked
(presale variant) and the #11 presale banner with the Buy quick action (`/home/user/Downloads/index.html` ix 10603-10902,
10903-11233, 19612-19906, 6272-6621; `screen.md` §11, §23, §24, §50). A purchase is a new intent in B1b's send pipeline
(approach A): the background builds it with `core/presale`, simulates it, shows it on #20, asks #10 when a rule says so,
records it in `v1_pending` before the existing broadcast route, and follows it on #21 and #26. It also closes the
website path: a presale purchase a site sends through B1c's #48 is refused, with no override, whenever the extension's
own jurisdiction gate is not open (D9, §3.6). It realises B1 spec §4 "Presale in the extension"
(`2026-09-27-extension-b1-design.md`), which stays binding where this spec does not refine it; every refinement, and
every design element not built as drawn, is a row in §9.

**Built on** `main` at 0b79442 (B1c complete, PRs #110–#112). Transparent mode only. Mainnet only.

**One spec, three plans** (D10b):

| plan | content |
|---|---|
| **B1d-1a — foundations (no presale UI in either build)** | the build-time switch: `__NOCTURA_PRESALE__`, the `presaleSwitch` Vite plugin and its three off-build stubs (§1.1); `check-no-presale.mjs` with the off-build allowlist and its fixture (§6.2); `core/solana/encoding.ts` (§6.2, M2); the intent-kind registry and the shared-shape changes — `PreparedSend.kind`, the kind in the integrity and the challenge digest, `sendPrepared`'s order with `beforeSign` (§1.3), `PendingRecord.extra` with the validator, `inFlightFor`, `viewOf` and the generic rendering of a null-intent record on #11 / #26 / #21 / #44 / #54 (Q42, the only visible change of 1a, in both builds); the account layouts from the pinned IDL (§2.1); `state.ts`; the shared jurisdiction gate `core/geo/fetch.ts` + `src/background/geo/gate.ts` (both builds, D15); `core/presale/limits.ts`; the three on-path entry modules as skeletons (§1.1, review 2 M2); their unit tests, the gates with 1a's positive-control list (§6.2) and E2E 7 (off build, review 2 L10) |
| **B1d-1b — the purchase** | `quote.ts`, `buy.ts`, `api.ts` and the `presale.*` messages (§1.4) through prepare (simulation with the destination check, §3.3), #20 purchase variant, #10, sign, `v1_pending`, broadcast and #21 (with the "Presale" badge); the resume paths (§4.2); #23a, #23b and the allocation row; #11 banner, Buy and pending row; #50b with every reason; #48's presale region block F12 (D9, D15, §3.6 — controller ruling: stays in 1b); E2E 1–6, 8–9 and the visual pass of these screens |
| **B1d-2 — referral and recording** | #24 and its #31 row; the optional referral address on #23 (D8, §3.5); `POST /solana/purchase` after confirmation with background retry (`v1_presale_records`, §2.4) — **blocked by ICO precondition P2a** (D11, §7); the "Presale" badge on #26 and the unrecorded line on #27; E2E 10–12; the remaining visual pass |

**B1d-1a and B1d-1b are merge-to-`main` milestones, not releases (C26).** No build with presale on leaves the
repository before B1d-2 is on `main` (1a buys nothing; 1b buys without recording the purchase for referral and stats).
Whether a store build carries presale at all is B1e's decision (D2); the jurisdiction gate (1a) and F12 (1b, §3.6)
ship in every build (D15).

---

## Decisions

### Owner decisions (2026-10-19)

| # | decision | applied here |
|---|---|---|
| D1 | **Scope:** purchase (#23, SOL / USDC / USDT) + referral (#24, the app's corrected version) + geo gate #50b + #11 banner and Buy + own allocation shown. **Claim, vesting and countdown are omitted** (no on-chain source before TGE; claim is untestable on mainnet before it) — stated loudly in §9 | §3, §4, §9 |
| D2 | **A build-time switch:** a store build can leave presale out entirely; whether it ships in a store is B1e's decision | §1.1, §6.2 |
| D3 | **Re-authentication:** first purchase from this account, plus B1b's rules — over 5 % of the paying token's balance, over the dollar threshold setting; a missing price counts as above | §3.4 |
| D4 | **State source:** the on-chain presale program — config and the user's PDAs via `getAccountsData` through the proxy, parsed with layouts from the IDL; the coordinator only for display extras (referral counts) | §2.1 |
| D5 | **TGE:** only "Claimable after TGE" — no date, no countdown | §4, §6.2 |
| D6 | **Sanctions-list freshness:** the coordinator refreshes the OFAC list automatically (with `reviewed_at`); the owner's manual review for RU / CN / ZW stays — an ICO-side precondition before B1d ships | §7 P1 |
| D7 | **Minimum:** the program's rule — `config.min_purchase_usd` for every currency; no client-only $25 SOL floor | §2.1 `minCents`, §3.2, §9 |
| D8 | **Referrer:** an optional "Referral address" field on #23 in B1d-2 — undrawn, a new element, flagged; a valid Solana address, never the buyer's own; a referrer already registered on chain always wins | C7, C32, §3.5, §9, §10 Q45–Q48 |
| D9 | **dApp path:** B1c's #48 blocks a decoded presale purchase instruction with **no override** when the extension's geo gate is closed or unreachable (the same rule as #23), whichever site sends it | C31, §3.6, §9, §10 Q49–Q51 |
| D10b | **Plans:** three — B1d-1a (switch, plugin, gate, shared pending/send shape change, program state + geo; no UI), B1d-1b (quote/buy, screens, E2E, visual), B1d-2 (referral + recording) | header, every plan reference |
| D11 | **P2:** coordinator idempotency by signature on `/solana/purchase` (P2a) blocks B1d-2 (the retry); the `nocAmount` / `usdValue` trust (P2b) is a separate urgent ICO fix (amounts from the on-chain receipt, as EVM §6) that does not block B1d-1 | §7, C24 |
| D12 | **Web and the app keep their current geo behaviour in B1d;** adopting `core/geo` + `presaleGeoGate` there is a separate later task | C14, §8.1 |
| D13 | **Q39 without numbers:** "Earn NOC when friends you invite buy in the presale." until the coordinator's tier rule is confirmed | §10 Q39 |
| D14 | **Copy Q01–Q4x delegated to the controller** ("Odloči se ti") | §10 (every row: "controller copy, owner-delegated 2026-10-19") |
| D15 | **The dApp-path jurisdiction gate ships in both builds as compliance code:** a no-presale build blocks a site's presale purchase exactly when the presale build would (gate closed or unreachable); Q50c disappears; `core/geo/**` joins the off-build allowlist. Controller ruling with it: F12 stays in B1d-1b | C31, C38, §1.1, §1.2, §2.2, §3.6, §6.2, §8.1, §10 Q50 |

### Controller rulings (most secure default, stated; C1–C39)

C1 and C2 are the two rulings recorded with the owner's decisions; the rest are this spec's. "B1c's C13" means B1c
spec's ruling C13 ("the window decides nothing"), which the approved design cites as "the background decides".

| # | ruling | why |
|---|---|---|
| C1 | **#24 follows the Android app's corrected version** (`src/screens/referral/ReferralScreen.tsx`): the address is the code; no copy without an on-chain or coordinator source | owner-recorded ruling |
| C2 | **Stablecoin purchases spend from the actual holding account** (`selectSourceTokenAccount`, the largest one), not the derived ATA. The program constrains the payer account's owner and mint only (ICO `lib.rs` `stablecoin_ata_for_user`: `mint ∈ {config.usdc_address, config.usdt_address}`, `owner == user`) | owner-recorded ruling; memory "non-canonical token accounts" |
| C3 | **The background is the only decider** (B1c's C13): every `presale.*` input from the popup is untrusted; the popup shows only what the background returns and computes no amount, limit, price, referrer validity or gate itself | approved §1 |
| C4 | **The switch is one build input with two mechanisms** (review M1): the `presaleSwitch` Vite plugin resolves the three B1d entry modules to empty stubs in the off build, and the compile-time constant `__NOCTURA_PRESALE__` (Vite `define`) folds inline branches. Both read the same flag in both Vite configs (§1.1). No `import()` anywhere | the background is a **module service worker** (`manifest/source.mjs:77,82`): a static import cannot sit in an `if`, `import()` is disallowed on a service-worker global, and a guarded call site does not stop Rollup keeping a module whose top level builds `PublicKey`s. Resolving the import itself is the only mechanism that removes the module; the gate (§6.2) is the proof |
| C5 | **The treasury is pinned as well as read.** `config.sol_treasury` must equal `MAINNET_SOL_TREASURY`, `config.usdc_address` / `usdt_address` must equal `MAINNET_USDC_MINT` / `MAINNET_USDT_MINT`; otherwise the presale is unavailable. The stablecoin destination is `findAssociatedTokenAddress(config.sol_treasury, mint)` and must equal the pinned vault ATA (§2.1) and exist as a token account of that mint owned by `config.sol_treasury` | the admin key `KnZ5…` is a single, immutable key on one laptop (memory "mainnet key exposure"); a config change could redirect every buyer's money. A pin fails closed (the presale closes, nobody pays), which `core`'s "never a constant" concern (a stale constant makes purchases *fail*) does not contradict: we still read config, and refuse when it moves |
| C6 | **The per-user cap is a pinned program constant:** `PRESALE_MAX_TOTAL_PER_USER_USD = 20_000_000` cents ($200 000, ICO `lib.rs:36`, checked against `total_spent_cents` at `lib.rs:344-351`). The config has no field for it | approved "max per user minus the existing allocation", made exact: the program's cumulative cap is on cents spent, not on NOC |
| C7 | **Referrer (D8).** A referrer already registered on chain is always honoured from B1d-1b on (`resolveReferrerWith(ref, user, null)`: the purchase passes that referrer's allocation PDA, as the program requires). A new one is registered only through #23's optional field, in B1d-2, under C32's rules; there is no other capture channel (no deep link, no page reading) | D8; an extension has no capture channel, and the field is the owner's choice of one |
| C8 | **Without a SOL price, SOL is not offered** (Buy disabled, Q19); USDC and USDT still are | a SOL purchase's limits and estimate need a price; the program prices at Pyth, but a wallet that cannot say what $ amount the user is spending must not offer it |
| C9 | **MAX keeps the paying account rent-exempt:** SOL MAX = balance − network fee − rent of the PDAs this purchase creates − `SYSTEM_ACCOUNT_RENT_LAMPORTS` (890 880), then capped by the limits; stablecoin MAX = the largest holding account, capped by the limits | approved "MAX for SOL leaves fees and rent"; a wallet that empties itself cannot pay its next fee |
| C10 | **One in-flight transaction per account, a purchase included.** B1b's `inFlightFor` counts a `presale-buy` record like a send — which needs the shared validator to read it at all (review H1, §1.3): neither a send nor a purchase is built while either is open | approved "one in-flight presale-buy per account", via the rule that already exists — stricter, one rule |
| C11 | **The simulation is checked exactly** (§3.3): SOL out = amount + fee + new-PDA rent; the source token account loses exactly the amount; **the pinned destination gains exactly the amount** (C28); `total_spent_cents` rises by Δc and `total_tokens` by exactly `tokensFor(Δc, stage)`; `purchase_count` by 1 | approved "outflow equal to the entered amount (+ fee) and an allocation increase", made testable; rent is the refinement (two `init_if_needed` PDAs, ICO `lib.rs:2904-2919`) |
| C12 | **Geo:** `/geo/check` is fetched on every #23 mount, every prepare, every signature, and for #48 on every simulation and approval of a request carrying a presale purchase (§3.6); the list is cached ≤ 10 minutes, its freshness evaluated against the clock every time; **either fetch failing is `no_check`**; the extension bundles no fallback list | approved "re-checked on every #23 mount and before every signature"; a bundled list always counts as stale (B1 §4), so carrying one buys nothing |
| C13 | **The NOC valuation for B1b's dollar rule (`deps.stagePrice`, `/stats`) is unchanged.** It is not presale code and exists in both builds | moving it to `state.ts` would put presale code in the off build |
| C14 | **`core/geo/fetch.ts` is used only by the extension in B1d** (D12). Moving web and the app onto it changes *their* purchase gates (web ignores staleness today, the app fails open) and is a separate later task | owner decision D12 |
| C15 | **"Share invite link" copies the link** (`useCopy`, B1b's honest copy: "Copied" only when the clipboard accepted it). The popup has no share sheet | the design's Android `ACTION_SEND` has no popup equivalent; `navigator.share` is absent on Linux Chrome and Firefox desktop |
| C16 | **#24 is reached from a #31 Settings row "Refer a friend"** (the app's entry, Profile → Settings) | the design's "[More] menu" does not exist in the popup |
| C17 | **#23 shows 23b while the active account has an open `presale-buy` record** (`pending` or `stuck`), **whatever the gate says** (C30); #21's Done after a purchase returns to #23 | the design's states are backend-driven; ours is `v1_pending` |
| C18 | **"Not available in your region?" opens #50b with the current answer**, an "open" variant (Q20) when the gate is open | the link is drawn always visible; the app made #50 region-accurate (memory "geo gate") |
| C19 | **The shared pipeline knows kinds, not presale.** Prepared entries, re-auth challenges and pending records carry a `kind`; `send` is registered always, `presale-buy` only through the presale entry module (§1.3). A stored entry whose kind has no handler is refused at signing; a pending record whose kind has no handler is still read, counted, polled and shown generically (Q42) | the off build must not contain presale code, yet an update that turns presale off must not hide or orphan a signed purchase |
| C20 | **The currency choice is the design's unit label made a selector:** it opens B1b's token sheet (#43) limited to SOL, USDC and USDT | keeps 23a's drawn layout (input + unit label + MAX) |
| C21 | **"First purchase from this account"** = the allocation PDA is absent or its `purchase_count` is 0, read in the same state read as the purchase | D3, from chain; an unreadable PDA closes the presale anyway (§2.1) |
| C22 | **A state re-read at signing** (review L5): `beforeSign` re-reads the whole §2.1 snapshot (one `getAccountsData`) and refuses if `presale_active` is false, the stage moved (Q15), C5's pins fail, the account is blocked (Q14), the prepared Δc now exceeds the per-user remainder (Q40c), or the allocation's existence, `purchase_count` or referrer changed since prepare (Q43) | a transaction the program would reject still pays its fee if broadcast; the same call carries the user's PDAs at no cost |
| C23 | **Program errors in a simulation map to fixed codes** (§3.3, `Custom` 6002, 6020–6024); anything else is "The purchase could not be simulated." | the program is authoritative for SOL limits (it prices at Pyth) |
| C24 | **Recording:** after a purchase confirms, the background POSTs it once, then retries at 1 min, 5 min, 30 min, 2 h, 12 h and every 24 h until 72 h after confirmation, through the shared 403 latch; `v1_presale_records` in `storage.local` (§2.4). **The retry ships only against a coordinator that has P2a** (D11) | approved "retried with backoff capped at a few days", made exact; today's route double-counts on a retry (review M6) |
| C25 | **A purchase carries no Noctura fee:** the markup policy (`feePolicy.ts`) is not applied to a `presale-buy`; #20's fee rows are network, priority and account setup (rent) | the markup is a transfer fee (B1 decisions table); a purchase is not a transfer |
| C26 | **B1d-1a and B1d-1b are merge-to-`main` milestones, not releases** | as B1c's D10: 1b buys without recording (header) |
| C27 | **The stage the user saw travels with the intent** (`{currency, amount, stage}`, the design's `{op:'presale-buy', amount, stage}`; B1d-2 adds `referrer`); prepare refuses a mismatch with Q15 and the popup re-reads the view | approved "a stage change between view and click → refusal 'Price changed — review again' + new simulation" |
| C28 | **The money must arrive at the pinned destination** (review H2): the simulation includes the destination — the SOL treasury, or the pinned vault ATA — and its gain must equal the amount exactly, against a "before" from the same snapshot as the config (§3.3 step 5) | the pins make the *addresses* right; only the program binary makes the money land there, and its upgrade authority is one key on one laptop. One more account in the simulation closes the single-failure case: a lying program is then caught by an honest proxy, a lying proxy by an honest program |
| C29 | **`beforeSign` runs after the challenge check and before the single-use take** (review M4): a sign-time refusal burns neither the prepared entry nor the re-authentication proof | the re-prepare that follows a refusal not caused by the user must not ask them to re-authenticate; a slow check is caught by `takePrepared`'s unchanged TTL (`prepared-expired` → #20's 30 s path) |
| C30 | **An open purchase is never hidden** (review M3): `PresaleView.pending` is in every variant, read from `v1_pending` before any network call; on #23 an open `presale-buy` record shows 23b whatever the state read or the gate answers, the closed line (if any) beneath its rows; 23b itself polls only the record (`presale.pending`, no network) | B1b's rule "a pending send must never be hidden"; the design's 23b exists to be watched |
| C31 | **#48 refuses a presale purchase when the gate is not open — F12, Reject only, no override** (D9, §3.6). **The gate is the same in both builds** (D15): `src/background/geo/gate.ts` is shared compliance code, so a no-presale build blocks a site's purchase exactly when the presale build would — sanctioned, stale list, unknown country, no check, 403 | D9's "the same rule as #23, whichever site sends it", true in every build (D15); D2's switch is about the extension's *own* purchase, not about whether the wallet screens a site's. The cost: one `/geo/check` (and the cached list) in the off build when a site sends a purchase |
| C32 | **The referral address (D8)** is validated by the background only: a 32-byte base58 key, not the default key, not the buyer, **not any account of this wallet**, whose `["allocation", referrer]` PDA exists as a valid PresaleAllocation; it is offered only when it can take effect (first purchase, no on-chain referrer) and is then registered by `register_referrer` in the purchase transaction (§3.5) | "never the buyer's own" made stricter (allowed): the program's legalese rejects self-referrals and a second account of the same wallet is one. A referrer with no allocation earns nothing (the program skips the bonus when `referrer_allocation` is empty, `lib.rs:378`) and the registration is permanent (`AlreadyHasReferrer`, `lib.rs:916`), so accepting it would spend the buyer's one chance for nothing. **No `total_referral_bonuses` rule** (review 2 L8, corrected): purchases alone cannot exhaust the bonus pool (12.8 M NOC, `COMMUNITY_REWARDS_ALLOCATION`, `lib.rs:39`, above 10 % of the whole presale, 10.24 M), but the pool counter is shared with the admin's giveaways (`lib.rs:723-770` add to `total_referral_bonuses`), so exhaustion is reachable by admin action only. Then the program pays no bonus and keeps the purchase (`lib.rs:372-375`); the buyer's own allocation is unaffected, so the wallet reads no pool state and adds no line |
| C33 | **#19 is not shown for a purchase** (review M7): `index.html` #23 (E) goes to #20 directly; #20's purchase variant carries #19's facts (slot, programs, account setup) | the design's own chain for #23; screen.md's "tx-simulate" is satisfied by the simulation #20 already shows |
| C34 | **Geo bodies are parsed for their required keys only** (review M8): unknown keys are ignored in both bodies; `GeoMalformed` only for a non-200, a non-object body, or a missing or wrongly typed required key | fail closed is about what the gate needs, not about fields the coordinator adds (it added three on 2026-09-21) |
| C35 | **#23a re-reads every 25 s while visible, and only what the quote and the gate need** (review 1 L9, review 2 M3): the §2.1 snapshot and `/geo/check` — two requests; balances are read on mount, on focus, on a currency change and after a purchase confirms; the re-read pauses while `document.visibilityState !== 'visible'` | Buy never flickers off at `Quote`'s 30 s boundary, and the presale screen cannot spend the per-IP budget whose 403 trips the shared latch and so disables **Send** for the cool-down (B1b D36): a full view is ~5 requests, 12 a minute at this interval |
| C36 | **The dollar re-auth rule takes the larger valuation** (review L6): `/wallet/prices`' or the simulation's `Δtotal_spent_cents` (the program's own Pyth valuation); unknown only when both are | fail closed; the program's number is the one that is actually charged |
| C37 | **Account indices in this spec are 0-based** (review L2), as `buyInstructions.ts` counts them | one convention; the IDL order is listed once (§3.3) |
| C38 | **The off build may contain, from `core/presale/**`, only an explicit allowlist** (review 1 M2): `core/presale/addresses.ts`, `allocation.ts`, `stagePrices.ts`; **`core/geo/**` is allowed whole** (D15: the jurisdiction gate is compliance code in both builds). **From `../web/**` (Task 2 fix round 1, review I1) it may carry only `web/src/ui/**` and `web/src/styles/**`** — `web/src/presale/**` imports only erased `core/presale` types, so a denylist would miss it | a denylist lets an unlisted module leak silently; today's off-build needs (B1b, B1c) are exactly these three once the three shared symbols move out of `buyInstructions.ts` (§6.2), plus the shared gate |
| C39 | **The busy-destination retry re-runs everything** (review 2 M1): the same message bytes are simulated again (nothing rebuilt); the fresh snapshot replaces the first for every rule, pin, stage comparison, limit, `firstPurchase`, referrer and "before"; all of §3.3 step 5 runs on the second result; the entry stores the second snapshot's values; one retry per prepare, only for a destination-only mismatch whose simulation slot is not below the snapshot's | a retry that re-checks less than the first pass would widen what is accepted; a simulation older than the snapshot is a stale answer, not a race (review 2 L1) |

---

## 1. Architecture

```
popup (#11 #23 #24 #50b #20 #21 #26 #27)       — shows what the background answers; decides nothing (C3)
        │ runtime.sendMessage  presale.*  (privileged partition, popup/tab only)
background
  ├─ presale/  (entry api.ts; the off build resolves it to a stub)  state.ts · quote.ts · buy.ts · record.ts · referral.ts · layouts.ts
  ├─ geo/gate.ts  the jurisdiction gate — shared compliance code, both builds (D15): #23's gate and F12's (§2.2, §3.6)
  ├─ intents.ts  kind registry  (send always; presale-buy registered by presale/api.ts)
  └─ B1b pipeline: prepared entries (storage.session) → #10 challenge → beforeSign → sign → v1_pending → broadcast route → poller
        │ through the shared 403 latch (deps.ts): /rpc (getAccountsData, getTokenAccountsByOwner, simulateTransaction, …),
        │ /tx/broadcast, /geo/check, /geo/restricted-list, /referral-stats/:address, POST /solana/purchase
unlock.html (#10)  — renders the background's description of a presale-buy challenge; nothing untrusted
approve.html (#48) — renders F12 as stored with the simulation; computes nothing (B1c's C13)
```

### 1.1 The build-time switch (D2, C4)

- **The flag.** One input, `NOCTURA_PRESALE`, set by `scripts/build.mjs` in the environment of **every** `vite build`
  it runs: `'1'` on, `'0'` off. Both `vite.config.ts` and `vite.content.config.ts` read it through one helper,
  `extension/scripts/presaleFlag.mjs` (`presaleFlag(env)`: `'1'` or unset → `true`, `'0'` → `false`, anything else
  throws), and from it set both mechanisms below. Default **on** (approved: "Default on for B1d builds").
- **The selector.** `node scripts/build.mjs [outDir] [--no-presale]`. `build.mjs` writes `<outDir>/app.features.json`
  = `{"presale": true|false}` next to `app.modules.json` (never inside `app/`), which the gates read to know what they
  scan.
- **Mechanism 1 — the plugin (removes modules).** `extension/scripts/presaleSwitch.mjs` exports a Vite plugin
  `presaleSwitch(on)`, used by both configs. When off, its `resolveId` hook resolves exactly three B1d entry modules
  to stubs outside every presale directory:

  | entry (on) | stub (off) | the stub exports |
  |---|---|---|
  | `src/background/presale/api.ts` | `src/presale-off/background.ts` | `registerPresale(host): void` that does nothing; `PRESALE_MESSAGE_TYPES = []` |
  | `src/app/presale/index.ts` | `src/presale-off/app.ts` | `presaleRoutes = []`, `presaleSlots = null` (#11 banner and Buy, #31 row, the resume hook, kind renderers) |
  | `src/unlock/presale.ts` | `src/presale-off/unlock.ts` | `describePresale(): null` |

  Shared code imports these three modules **unconditionally** and calls what they export (`index.ts` calls
  `registerPresale(...)`; `PRIVILEGED` is built from `PRESALE_MESSAGE_TYPES`; the router and Home take
  `presaleRoutes` / `presaleSlots`). No other shared module may import anything under a presale directory — the
  module rule of §6.2 proves it, so a fourth entry added without a stub fails the gate. A stub contains no marker
  string (§6.2). The plugin throws when `on` is not a boolean or a stub file is missing. When on, it resolves nothing.
  **The three on-path entries exist from B1d-1a** (review 2 M2) as skeletons — `registerPresale` registers nothing,
  `PRESALE_MESSAGE_TYPES = []`, `presaleRoutes = []`, `presaleSlots = null`, `describePresale(): null` — so the plugin
  maps something real in both builds from 1a on and the module rule has something to prove; 1b and 2 fill them.
- **Mechanism 2 — the constant (folds branches).** `__NOCTURA_PRESALE__: boolean`, declared once in
  `extension/src/features.d.ts`, substituted by `define` (`JSON.stringify(on)`) in both configs, for inline branches in
  shared code that need no module (e.g. a test of the build's own mode). It never guards an import.
- **No dynamic `import()`** anywhere in the extension (the background is a module service worker, where it throws).
- **Tests run in both modes:** `vitest` with the flag on; `vitest.nopresale.config.ts` with `NOCTURA_PRESALE=0` runs
  the named off-build test files (§6.1 "switch"), both in `npm run test`; that run contains a test asserting that
  `__NOCTURA_PRESALE__` is `false` and that `src/background/presale/api.ts` resolved to the stub (review L10).
- **What does not change with the switch:** the manifest (no new permission, host or CSP entry in either build); B1b's
  history row "Presale purchase" and #27's "PRESALE PURCHASE" (a website purchase must still read correctly in the
  off build); B1c's presale instruction decoder (`dapp/decode/presaleIdl.ts`) and its F2 treatment of the website's
  purchases; the jurisdiction gate `src/background/geo/gate.ts` with `core/geo/**` and F12 (D15, §2.2, §3.6); the
  generic rendering of a null-intent record (Q42); `deps.stagePrice` (C13).
- **Off build behaviour:** no #11 banner, no Buy, no #31 "Refer a friend" row, no presale routes; every `presale.*`
  message is refused as an unknown type (`messages.ts`: "Any message type outside both lists is refused"); every
  presale purchase a site sends is decided by the same jurisdiction gate as in the on build — F12, Reject only, exactly
  when the gate is closed or unreachable (C31, D15).

### 1.2 Background modules (`extension/src/background/presale/`)

| module | plan | does |
|---|---|---|
| `layouts.ts` (generated) | 1a | the three account layouts from the pinned IDL (§2.1) — written by `scripts/gen-presale-idl.mjs`, never by hand |
| `state.ts` | 1a | one `getAccountsData` of the §2.1 snapshot through the proxy → `PresaleState`; every check fails closed |
| `quote.ts` | 1b | the estimate, MAX and the limit line from the last snapshot (§3.2) — no network |
| `buy.ts` | 1b | `presale-buy` intent kind: parse, digest, prepare (build + simulate + checks), `beforeSign`, #10 description (§3.3) |
| `api.ts` | 1a skeleton, 1b filled | the entry module: `registerPresale` (the `presale-buy` kind, the `presale.*` handlers, §1.4), `PRESALE_MESSAGE_TYPES` |
| `record.ts` | 2 | the coordinator record and its retry (§2.4) |
| `referral.ts` | 2 | #24's data and the referral-address check (§3.5) |

**Shared, both builds (D15):** `src/background/geo/gate.ts` (1a) — `core/geo/fetch.ts` + `presaleGeoGate` →
`GeoAnswer` (§2.2), the list cache; it imports nothing under a presale directory. #23 (through `presale/`) and F12
(through `dapp/`) both call it.

`core/` gains: `core/geo/fetch.ts` (`fetchGeoInputs(get: JsonGetter)`, §2.2), `core/presale/limits.ts` (bigint:
`usdCentsForStable`, `tokensFor`, `checkLimits`, ticks, rents, §3.2) and `core/solana/encoding.ts` (`SPL_TOKEN_PROGRAM`,
`encodeU64LE`, `findAssociatedTokenAddress` moved out of `buyInstructions.ts`, which re-exports all three for the app and
web, so no caller outside the extension changes; §6.2). `deps.ts` gains `createJsonPoster(fetch, latch)` (B1d-2) — generic, beside
`createJsonGetter`, the one place allowed to call the global fetch (`check-rpc-methods.mjs`).

### 1.3 The intent-kind registry and the shared shapes (C19; B1d-1a)

`extension/src/background/intents.ts`: `registerIntentKind({kind, parseIntent, intentDigest, describe, beforeSign,
onConfirmed?})`. B1b's `send` registers itself unconditionally; `presale/api.ts` registers `presale-buy`.

- **Prepared entries.** `PreparedSend` gains `kind: string`; `intent` becomes the kind's parsed intent.
  `preparedIntegrity` and the challenge digest include `kind` (`intentDigest(kind, account, intent)`; a challenge
  issued before the update no longer matches and is asked again — fail closed). `wallet.preparedFor` returns only
  `kind: 'send'` entries; `presale.preparedFor` only `presale-buy`. **Every prepare, of any kind, replaces every
  prepared entry of that account** (today's rule in `prepareSend`, extended across kinds), so an account has at most
  one prepared entry.
- **`sendPrepared` (sign + submit), kind-agnostic, in this order** (C29; today's order in `send.ts:33-70` with one step
  inserted):
  1. session (`locked`); `peekPrepared` (`unknown-prepared`); the kind is registered (else `prepared-invalid`);
  2. `challengeSatisfied` on the peeked entry (`reauth-required` + the challenge id, as today — nothing burned);
  3. **the kind's `beforeSign(peeked)`** (presale: C12's geo check and C22's state re-read) — a refusal here burns
     nothing: the entry stays, the proof stays proven, and the popup re-prepares carrying the challenge id;
  4. `takePrepared` — single-use, and its unchanged 30 s TTL: a slow step 3 ends in `prepared-expired` → #20's
     re-prepare path; the taken entry's `integrity` must equal the peeked one's (else `prepared-invalid`);
  5. integrity and intent digest recomputed (as today), `consumeChallenge`, the session again, `signPrepared` →
     `submitSigned` → `armAutolock`, unchanged.
- **Pending records (review H1).** `PendingRecord` gains `extra: {kind: string; data: unknown} | null` (null for a send
  and for a dApp record). The validator in `pendingStore.ts` (`isRecord` / `recordOf`, shared code in both builds)
  accepts three shapes:
  - a dApp record — `origin` an https origin and `intent` null (today);
  - the wallet's send — `origin` null or missing and `intent` a send intent (today);
  - **the wallet's other kinds — `origin` null or missing and `intent` null.** `extra` reads as `{kind, data}` when it
    is an object whose `kind` is a string of `^[a-z][a-z0-9-]{0,31}$` (`data` copied as stored), and as `null`
    otherwise; **the record is kept either way** (a display field never drops a record — B1b: "a pending send must
    never be hidden").
  `inFlightFor` (origin null, open) therefore counts it (C10); the poller, expiry, the same-bytes resend (#54, `resend`
  refuses only dApp records) and #44 are kind-agnostic and see it; `wallet.pending` (origin null) lists it; `viewOf`
  copies `extra` (a fresh object, `data` as stored) into `PendingView`.
- **Screens that read `intent` (B1d-1a, shared):** `Home.tsx:55` (#11 pending row), `Activity.tsx:19` (#26 pending row),
  `Status.tsx:216-235` (#21), `Failed.tsx:133-139` (#44), `Stuck.tsx:117,306` (#54) dereference `intent.*` today. Each
  renders a record with `intent: null` through `presaleSlots`' kind renderer when one is registered for `extra.kind` and
  the renderer accepts `extra.data` (on build: §4.2, Q32/Q33), and otherwise generically: Q42, no amount and no
  recipient rows; the signature, explorer link, fee rows and B1b's actions (resend, explorer) as for a send.
- **`presale-buy`'s `extra.data`** = `{currency, amount, stage, priceTicks, nocBase, spentCents, destination, referrer}`
  (§2.3) — display only, parsed by the presale renderer; never used to decide anything.
- **`onConfirmed`** (optional): the poller calls the kind's hook once when a record first reaches `confirmed`
  (B1d-2's record, §2.4); no hook registered → nothing.

### 1.4 Messages (privileged partition, from the popup and the full tab only; B1d-1b unless marked)

Added to `PRIVILEGED` through `PRESALE_MESSAGE_TYPES` (empty in the off build); `approve.html` and `unlock.html` may send
none of them (B1c's inclusive list for `approve.html` stands; the vault page reads a presale challenge through the
existing `vault.challengeInfo`).

| type | payload | answer |
|---|---|---|
| `presale.view` | `{account, refresh?: 'gate'}` | `PresaleView` (§2.5) — the account's open record first (no network), then a fresh state read **and** a fresh geo check (C12), then balances and the SOL price; with `refresh: 'gate'` the balances and price are the last full view's (C35) — never older than that view, and a view without one answers in full |
| `presale.pending` | `{account}` | `PendingView \| null` — the account's open `presale-buy` record from `v1_pending`; **no network call** (C30, 23b's poll) |
| `presale.banner` | `{}` | `{stage, priceTicks, stagePercent}` or `null` — the last config snapshot ≤ 60 s old, else a config-only read (§2.1 rules 1–4); **no geo check**; `null` on any failure or an inactive sale |
| `presale.quote` | `{account, currency, amount: string \| 'max'}` | `Quote` (§3.2) from the last `presale.view` snapshot of that account ≤ 30 s old; older → `{stale: true}` |
| `presale.prepareBuy` | `{account, intent: {currency, amount, stage}, challengeId?}` (B1d-2: `intent.referrer: string \| null`) | `PurchaseView` (§3.3) or a refusal code (§5) |
| `presale.preparedFor` | `{account}` | the account's `presale-buy` prepared entry's view, `expired` as B1b's `wallet.preparedFor` |
| `presale.buy` | `{id}` | `PendingView` or a refusal code; via the kind-agnostic `sendPrepared` (§1.3) |
| `presale.discardPrepared` | `{account}` | B1b's `discardPrepared` (all of the account's entries and their challenges) |
| `presale.checkReferrer` (B1d-2) | `{account, referrer}` | `{ok: true}` or `{ok: false, line: 'referrer-invalid' \| 'referrer-self' \| 'referrer-no-allocation' \| 'referrer-not-applicable'}` (§3.5); a read failure → `presale-unavailable` |
| `presale.referral` (B1d-2) | `{account}` | `ReferralView` (§3.5) |
| `presale.unrecorded` (B1d-2) | `{account}` | the signatures of this account's confirmed purchases not yet accepted by the coordinator |

Every payload is parsed strictly (extra keys, a non-address `account`, an amount not `^[1-9]\d{0,19}$` or above u64,
a currency not in `{SOL, USDC, USDT}`, a stage not an integer 0–9, a `referrer` neither null nor a string of 32–44
base58 characters) → `malformed`. `account` must be in the unlocked session → else `locked` / `unknown-account`.

---

## 2. State

### 2.1 The program state (`state.ts`, D4; B1d-1a)

**Constants quoted from the code** (`core/presale/addresses.ts`): program `6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt`,
admin `KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr`, NOC mint `B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW`,
SOL treasury (Squads vault) `6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd`, Pyth SOL/USD
`7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE`, USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, USDT
`Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`. **Derived** (computed 2026-10-18 with web3.js from those constants and
`core/presale/allocation.ts` / `buyInstructions.ts`; both match the treasury-migration record in memory
"presale stablecoin gap"): config PDA `["config", admin]` = `8MwasPrRzsCDuH78PJSDdWhdjFXT15MX7pHs3iE4b7Gx`; vault USDC ATA
`DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3`; vault USDT ATA `8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp`; default
referrer allocation `["allocation", 11111111111111111111111111111111]` = `C6TE5HwdPxJhUcAdwt6DRr2ceoavWBPqfCqcyFVFAWkQ`.
The two ATAs become constants in `core/presale/addresses.ts` (`MAINNET_VAULT_USDC_ATA`, `MAINNET_VAULT_USDT_ATA`) with a
test that re-derives them from `MAINNET_SOL_TREASURY` (C5) — whole addresses, never a truncation (the poisoning
address `6ZiahdPaj8K4…oSoo6Vd` truncates identically to the vault).

**Layouts from the IDL (one source of truth).** `scripts/gen-presale-idl.mjs` gains a second output,
`src/background/presale/layouts.ts`, from the same pinned IDL (`IDL_SHA256 f3112275…c86a`, ICO `lib/idl.json` at
75450df): for `Config`, `PresaleAllocation` and `UserAccount`, the account discriminator (recomputed as
`sha256("account:<Name>")[0..8]` and checked against the IDL's, as the script does for instructions), the field list
in order with types, each field's offset and the total length. The type table gains `u32` (`purchase_count`); any other
unknown type still throws. The new output has its own pinned hash (`LAYOUTS_SHA256`) and the CI test that rebuilds it
from its own content, as `presaleIdl.ts` has. `layouts.ts` lives under `presale/`, so the off build does not carry it;
`presaleIdl.ts` (B1c) is unchanged. The fields B1d reads, as generated (offsets checked against the IDL on 2026-10-18
and confirmed by review 1):

| account (length, discriminator) | field @ offset : type |
|---|---|
| Config (370, `[155,12,170,224,30,250,204,130]`) | `admin@8`, `sale_token@40`, `usdt_address@72`, `usdc_address@104`, `current_stage@168:u8`, `stage_tokens_sold@169:u64`, `tokens_sold@177:u64`, `total_usd_raised_cents@185:u64`, `presale_start_time@193:i64`, `presale_active@209:bool`, `max_per_user_usd@322:u64`, `min_purchase_usd@330:u64`, `sol_treasury@338` |
| PresaleAllocation (117, `[202,26,199,26,125,244,253,18]`) | `user@8`, `total_tokens@40:u64`, `total_spent_cents@48:u64`, `purchase_count@56:u32`, `referral_bonus_tokens@76:u64`, `referrer@84`, `claimed@116:bool` |
| UserAccount (58, `[211,33,136,16,186,110,242,127]`) | `is_blocked@8:bool`, `referrer@9` |

A test pins the generated offsets against `core/presale/allocation.ts`'s hand constants (`ALLOCATION_TOTAL_TOKENS_OFFSET`
40, `ALLOCATION_REFERRAL_BONUS_OFFSET` 76, `ALLOCATION_ACCOUNT_LENGTH` 117, `CONFIG_SOL_TREASURY_OFFSET` 338,
`CONFIG_ACCOUNT_LENGTH` 370) — two independent derivations that must agree. `tge_timestamp@201` is generated (it is in
the layout) but no B1d module reads it; a test asserts that no module under `presale/` other than the generated
`layouts.ts` contains that field name.

**The snapshot.** `state.ts` derives `config`, `["user", account]` and `["allocation", account]` (`derivePresalePdas`)
and reads, with **one** `getAccountsData` (an allowed proxy method; no new RPC method), six accounts: config, user
account, allocation, `MAINNET_SOL_TREASURY`, `MAINNET_VAULT_USDC_ATA`, `MAINNET_VAULT_USDT_ATA` (the last three are
pinned, so they are known before config is parsed; C28's "before" comes from this one read). `PresaleState` is valid
only when **all** hold; otherwise it is `{unavailable: <code>}` and the presale is closed:

1. Config present, owner = the presale program, length = 370, discriminator = Config's; **positional controls**
   `admin@8 = MAINNET_ADMIN_ADDRESS` and `sale_token@40 = MAINNET_NOC_MINT` (as `readSolTreasury`).
2. **C5 pins:** `sol_treasury = MAINNET_SOL_TREASURY`, `usdc_address = MAINNET_USDC_MINT`, `usdt_address = MAINNET_USDT_MINT`.
3. `presale_active` byte is 0 or 1 (anything else: malformed); `current_stage` ∈ 0…9 (a known stage).
4. `presale_active = 1`, `presale_start_time ≤ now` (UTC seconds) and `tokens_sold < 102 400 000 × 10⁹` (the
   program's hard-cap check) — else `{inactive}` (Q13), a valid read of a closed sale. While active,
   `stage_tokens_sold < 10 240 000 × 10⁹` (the program advances the stage before it could reach it) — else malformed.
   **The order of these two sentences is load-bearing** (review 2 L9): the `inactive` test is evaluated first. Every
   program path that adds to `stage_tokens_sold` runs the stage-advance loop and adds to `tokens_sold` with it
   (`lib.rs` 439-460, 1138-1160, 2069-2095, 2284-2320), so at stage 9 a stage total at the cap happens only past the
   hard cap — which the first sentence already answers `inactive`, never `malformed`.
5. User account: absent, or owner = program, length 58, discriminator = UserAccount's, `is_blocked` 0 or 1;
   `is_blocked = 1` → `{blocked}` (Q14).
6. Allocation: absent (`exists: false`, totals 0, no referrer), or owner = program, length 117, discriminator =
   PresaleAllocation's, `user@8 = account` (the positional control of `fetchOnChainAllocation`), `claimed` 0 or 1;
   `referrer@84` all zero → none.
7. Treasury: present, owned by the System program, 0 bytes of data (its lamports are C28's SOL "before"). Verified from
   the records (review 2 L4): the vault `6Zia…o6Vd` is an off-curve Squads v4 vault PDA, measured on mainnet as
   System-owned with no data (memory "fee treasury placeholder", 2026-06-24, and "mainnet key exposure", with two
   executed outbound Squads transfers); the program pays it with a System transfer. The rule stays; 1a re-reads the
   account once, slowly, and records the owner and data length in its plan before the rule is enabled.
8. Each vault ATA: present, owned by the SPL Token program, 165 bytes, mint@0 = its mint, owner@32 =
   `config.sol_treasury`, state@108 = 1 (initialized); its `amount@64` is C28's stablecoin "before".

Any failed read (403, timeout, unreachable, an RPC error) → `{unavailable: 'read-failed'}` or `'refused'` (a 403 or
the latch's cool-down); any other failed rule → `{unavailable: 'malformed'}`. **Never open on doubt.**

**Derived values** (bigint; USD as integer cents; price in the program's own unit, ten-thousandths of a dollar):

- `stage` = `current_stage` (0-indexed); display stage = `stage + 1`, "of 10".
- `priceTicks` = `STAGE_PRICES[stage]` — the program's table (ICO `lib.rs:42-53`), identical to
  `core/presale/stagePrices.ts` as ticks `1501 … 3499`. `core/presale/limits.ts` gains `STAGE_PRICE_TICKS` (bigint)
  with a test that it equals `PRESALE_STAGE_PRICES × 10 000` element by element. `nextPriceTicks` = the next entry, or
  null at stage 9.
- `minCents` = `min_purchase_usd` if > 0 else 2 500; `maxTxCents` = `max_per_user_usd` if > 0 else 5 000 000 — **the
  program's rule, for every currency** (D7; `lib.rs:333-334`, `2414-2415`: the SOL and the stablecoin paths read the
  same field with the same fallback; the field `max_per_user_usd` is a per-transaction limit despite its name). Read
  2026-09-21: `min_purchase_usd = 1000` ($10), `max_per_user_usd = 0` ($50 000) (`core/presale/purchaseGate.ts:8-20`).
  Never restated as constants in B1d; there is no client-side floor of any currency.
- `userRemainingCents` = 20 000 000 − `total_spent_cents` (C6), floored at 0.
- `firstPurchase` = allocation absent or `purchase_count = 0` (C21).
- `onChainReferrer` = the allocation's `referrer` (or none) — the `AllocationRef` that `resolveReferrerWith` takes,
  built from this snapshot (no second read).
- `newPdaRent` = 1 294 560 lamports if the user account is absent + 1 705 200 if the allocation is absent — rent-exempt
  minimums `(128 + length) × 6 960` for lengths 58 and 117, the same formula that gives the existing
  `SYSTEM_ACCOUNT_RENT_LAMPORTS` (890 880 for 0 bytes) and `TOKEN_ACCOUNT_RENT_LAMPORTS` (2 039 280 for 165). New
  constants `PRESALE_USER_ACCOUNT_RENT_LAMPORTS`, `PRESALE_ALLOCATION_RENT_LAMPORTS` in `core/presale/limits.ts`, each
  with that formula as its test (`getMinimumBalanceForRentExemption` stays off the proxy's allowlist).
- `referrerAllocation` = `resolveReferrerWith(() => snapshotRef, account, captured)` — `captured` null before B1d-2 (C7).

### 2.2 The jurisdiction gate (`src/background/geo/gate.ts`, both builds — D15; B1 §4, C12, C34; B1d-1a)

`core/geo/fetch.ts` — `fetchGeoInputs(get: JsonGetter): Promise<{location, list}>`. Both bodies: a non-200, a body
that is not a JSON object, or a required key missing or of the wrong type → `GeoMalformed`; **every other key is
ignored** (C34):

- `GET /geo/check` → required `countryCode: string`, `isVpn: boolean`, at the top level (no envelope — the live
  contract, `walletRoutes.js:97-100`, `web/src/geo/useGeo.ts`).
- `GET /geo/restricted-list` → required `success: true` and `data` an object with `countries` a non-empty array whose
  every entry has `code` matching `^[A-Z]{2}$` and `category ∈ {sanctioned, restricted}` (an entry's other keys, e.g.
  `basis`, ignored); `updated_at`, `reviewed_at` each a string or null; `max_staleness_days` a number or null; `stale`
  a boolean or null (the coordinator reports a missing value as null, `restrictedList.js:56-69`; a null is not
  malformed — it reaches `evaluateListFreshness` as an absent date or limit, which is stale). Envelope keys such as
  `reviewed_by`, `source`, `age_days` are ignored. Mapped to `ListMeta {source: 'server', updatedAt, reviewedAt,
  maxStalenessDays, serverStale}` (null → absent).

`gate.ts` decides, in this order:

| condition | `GeoAnswer.reason` |
|---|---|
| either GET answered 403, or the shared latch is cooling down | `refused` |
| either GET failed otherwise (timeout, unreachable, non-200, `GeoMalformed`) | `no_check` |
| `presaleGeoGate({freshness: evaluateListFreshness(meta, now), location, restricted})` | its own `stale_list` / `no_check` / `unknown_country` / `sanctioned` / `null` (open) |

`presaleGeoGate` (`core/geo/freshness.ts:132`, tested, unused until now) already encodes B1 §4: missing or unparsable
dates are stale, a date more than a day in the future is unparsable, a server `stale: false` never overrides a locally
computed age, an unknown or empty country (not `^[A-Z]{2}$`, or `XX` / `ZZ`) closes, and a sanctioned country closes
whatever `isVpn` says (`sanctionedWinsOverVpn`; `isVpn` is always `false` today — B1 §5 coordinator answer 5 — and is
read as nothing). A `restricted` country is open (OFAC-only policy, `classify.ts` `isPresaleBlocked`). The list is
cached in the worker's memory ≤ 10 minutes; `/geo/check` is never cached. `GeoAnswer` = `{open, reason, countryCode | null}`.
The same `gate.ts` answers #23 and F12 (§3.6), in both builds (D15): it is compliance code, not presale code, so it
and `core/geo/**` are on the off-build allowlist (C38) and outside every presale directory.

### 2.3 The purchase in `v1_pending`

A `presale-buy` record is a B1b `PendingRecord` with `intent: null`, `origin: null`, `firstBroadcast: 'done'`, `fee`
as prepared (network part; markup `'0'`, C25) and `extra = {kind: 'presale-buy', data: {currency, amount, stage,
priceTicks, nocBase, spentCents, destination, referrer}}`: what was paid (base units), the stage and price it was
simulated at, the simulated NOC (`Δtotal_tokens`) and cents (`Δtotal_spent_cents`), the treasury or vault ATA it pays,
and the effective referrer (or null). All strings (decimal strings for numbers). Readable in both builds (§1.3).
Shown by #23b, #11, #21, #26, #27, #44 and #54; never used to decide anything.

### 2.4 The coordinator record (`record.ts`, B1d-2, C24)

`storage.local` `v1_presale_records`, background-owned (added to `BACKGROUND_OWNED_KEYS` and to `WALLET_DATA_KEYS`:
wiped by a wallet delete, kept by a restore), at most 50 entries (the oldest given-up entry dropped first):
`{signature, account, payload, confirmedAt, attempts, nextAt, state: 'due' | 'done' | 'given-up'}`.

- Written when the poller sees a `presale-buy` record reach `confirmed` (the kind's `onConfirmed`, §1.3). `payload`:
  `txHash` = the signature, `buyerAddress` = the account, `paymentToken`, **`paymentAmount` as a decimal string in
  display units** (no float leaves the background for it; review L4 — core's `PresalePurchaseRecord.paymentAmount`
  widens to `number | string`, so web and the app keep passing numbers unchanged (D12) and the route stores either
  into `DECIMAL(30,18)`, `db/migrate.js:20`), `nocAmount` and `usdValue` (the simulation's `nocBase` / `spentCents`
  converted to the coordinator's decimal numbers at this edge only — the route requires `typeof nocAmount ===
  'number'`, `server.js:444`), `stage` (1-indexed), `referrerAddress` (the effective referrer or absent).
- Sent through `createJsonPoster` (POST JSON to a bare path under `API_BASE`, through the shared latch,
  `REQUEST_TIMEOUT_MS`); core's `recordPresalePurchase` is not used (it swallows every answer, so nothing could be
  retried). `200` with `success: true` → `done`. Any other answer → the next slot of C24's schedule; a 403 trips the
  latch and the entry waits for the cool-down (never retried inside it); past 72 h after `confirmedAt` → `given-up`. An
  `alarms` alarm (`presale-record`, existing permission) wakes the worker at `min(nextAt)`.
- Never more than one POST in flight; never two POSTs for one signature within a slot. **The retry is correct only
  against a coordinator that makes every side effect idempotent by signature — P2a (§7), a B1d-2 blocker (D11).**
- The purchase stands on chain whatever the record's state; nothing in the popup says it failed. #27 says Q34 while the
  record is `due` or `given-up`.

### 2.5 What the popup receives (`PresaleView`)

```
PresaleView =
  | {open: false, why: 'unavailable', code: 'read-failed' | 'refused' | 'malformed', pending}
  | {open: false, why: 'inactive' | 'blocked', state: StageView, pending}
  | {open: false, why: 'geo', geo: GeoAnswer, state: StageView | null, pending}
  | {open: true, state: StageView, limits, allocation, balances, solUsdMicros | null, referral, pending}
pending    = PendingView | null                — the account's open presale-buy record, in every variant (C30)
StageView  = {stage, priceTicks, nextPriceTicks | null, stageSoldBase, stageCapBase, raisedCents}
limits     = {minCents, maxTxCents, userRemainingCents, firstPurchase}
allocation = {exists, totalBase, bonusBase}
balances   = {SOL: lamports, USDC: {largest, total}, USDT: {largest, total}}
referral   = {onChain: address | null, canRegister: boolean}   — B1d-2; canRegister = firstPurchase and no onChain
```

All numbers are decimal strings of bigints. The popup renders from this and from `Quote`; it parses no account data
and holds no constant of the program.

---

## 3. Features

### 3.1 The gate (approved §3, "fail closed")

The presale is **open** for an account only when all hold: the build has presale on; the wallet is unlocked and the
account is in the session; `PresaleState` is valid (§2.1) with `presale_active`, a known stage and the account not
blocked; `GeoAnswer.open` (fresh list, known country, not sanctioned, both GETs answered). It is checked on every
`presale.view`, on every `presale.prepareBuy`, and before every signature (`beforeSign`: geo again and C22's re-read).
Otherwise #23 offers no Buy and says why (§4.1, §4.3) — beneath 23b when a purchase is open (C30). The coordinator
unreachable → closed; the wallet keeps working (B1 §4).

### 3.2 Quote, limits and MAX (`quote.ts`, `core/presale/limits.ts`)

Integer arithmetic only (cardinal rule 2); every division floors, as the program's does.

- `usdCentsForStable(amount6)` = `amount × 100 / 10⁶` (the program's conversion, `lib.rs` stablecoin internal).
- SOL estimate: `usdCentsEstimate(lamports)` = `usdMicros(lamports, 9, solUsd) / 10 000` (B1b's `reauthPolicy.ts`
  helper; null without a price → C8). The program uses Pyth (≤ 120 s old); ours is `/wallet/prices` — an estimate,
  shown with "≈".
- `tokensFor(cents, stage)` = `cents × 10⁹ × 100 / STAGE_PRICE_TICKS[stage]` (the program's
  `calculate_tokens_for_usd`, `lib.rs:2793-2818`), NOC base units.
- `checkLimits({cents, minCents, maxTxCents, userRemainingCents})` → `null` | `below-min` | `above-max-tx` |
  `above-user-limit`: `cents < minCents`; `cents > maxTxCents`; `cents > userRemainingCents` — checked in that order,
  the same for SOL, USDC and USDT (D7).
- Balance lines: SOL needs `amount + networkFee + newPdaRent` ≤ balance and must leave 0 or ≥ 890 880 (B1b's
  `sender-below-rent` rule); a stablecoin needs `amount` ≤ the largest holding (`split-balance` when the total covers it
  and the largest does not; `insufficient-token` otherwise) and SOL ≥ `networkFee + newPdaRent` (`insufficient-sol`).
- `Quote` = `{amount, cents, nocBase, line: LimitCode | BalanceCode | 'no-sol-price' | null}`; `amount: 'max'` answers
  C9's MAX (capped by `maxTxCents` and `userRemainingCents` converted back — for SOL at our price, floored, then
  re-checked), or `line` when even MAX is below the minimum.
- Empty or zero input: the popup never asks `presale.quote` for it — it renders `{line: null}` with Buy disabled itself
  (no nagging, as `canBuy`; displaying nothing is no decision); the background answers `malformed` to `"0"` or `""`
  like any amount outside `^[1-9]\d{0,19}$` (review 2 L2). `core/presale/purchaseGate.ts`'s
  float `canBuy` is not used by the extension (§9).

### 3.3 Prepare, simulate, sign (`buy.ts`, approach A; B1d-1b)

**Account lists (0-based, C37), in the IDL's order.** SOL purchase (`presale_purchase_with_sol`): 0 config, 1
user_account, 2 user_allocation, 3 referrer_allocation, 4 pyth_sol_usd_price, 5 user, 6 sol_treasury, 7
system_program. Stablecoin purchase (`_with_usdc` / `_with_usdt`): 0 config, 1 user_account, 2 user_allocation, 3
referrer_allocation, 4 stablecoin_ata_for_user, 5 stablecoin_ata_for_admin (the vault ATA), 6 stablecoin_mint, 7
user, 8 token_program, 9 system_program. `register_referrer` (B1d-2): 0 user_account, 1 user_allocation, 2 user,
3 system_program, argument `referrer: Pubkey`.

`presale.prepareBuy {account, intent, challengeId?}`:

1. Session, account and **C10** (`in-flight` when an open wallet-own record exists for the account).
2. Fresh `PresaleState` (the §2.1 snapshot) and `GeoAnswer` (§3.1). `intent.stage ≠ state.stage` → `price-changed`
   (Q15, C27). B1d-2: `intent.referrer` checked as §3.5 (`referrer-*` codes).
3. Limits and balances (§3.2); refusal codes as §5. For a stablecoin, holdings via `getTokenAccountsByOwner(account,
   {mint})`; source = `selectSourceTokenAccount(holdings, amount)` (C2).
4. Build: `estimatePriorityFee(reader, 'normal')`, `getLatestBlockhash`, then `buildBuyInstructions(user, lamports,
   price, resolved, treasury)` or `buildStablecoinBuyInstructions(…)` with `treasury = config.sol_treasury` (already
   pinned, C5) and `resolved` = §2.1's `referrerAllocation` (B1d-2: with `registerReferrer` when §3.5 applies). **The
   stablecoin builder gains a `sourceTokenAccount` parameter** (required, like `treasury`; the app and web pass their
   derived ATA, so nothing changes for them). `buy.ts` — not core, so web and the app keep their behaviour — asserts
   that the built instruction's account 5 equals `MAINNET_VAULT_USDC_ATA` / `_USDT_ATA` and account 4 the selected
   source; the vault ATA was already checked in the snapshot (§2.1 rule 8). Every compiled instruction's program is
   Compute Budget or the presale program; anything else is an engine bug (thrown, never shown).
5. Simulate with `accounts = [payer, userAllocation, destination, source token account?]` — payer first, as B1b's
   `prepareSend`; `destination` = `MAINNET_SOL_TREASURY` for SOL, the pinned vault ATA for a stablecoin (C28).
   Decide on `err` first (B1b §11.5): `{InstructionError: [i, {Custom: n}]}` on the presale instruction maps to
   6022 → `below-min`, 6023 → `above-limit` (the program uses one code for the per-transaction and the per-user
   maximum), 6002 → `blocked`, 6020 / 6021 / 6024 → `presale-closed`; B1b's rent refusal → `sender-below-rent`; any
   other error → `simulation-failed` (Q16). Then, with `err === null`, **all** of:
   - SOL spent by the payer = `(currency = SOL ? amount : 0) + newPdaRent + networkFee`, or that minus `networkFee`
     (B1b's two accepted readings);
   - **the destination (C28):** SOL — the treasury's lamports after − its lamports in the snapshot = `amount`
     exactly; stablecoin — the vault ATA after is a token account of that mint owned by `config.sol_treasury`, and its
     `amount` after − its amount in the snapshot = `amount` exactly;
   - stablecoin: the source token account after = mint, owner = account, `before − after = amount`;
   - the allocation after: PresaleAllocation layout and controls (§2.1 rule 6); `Δpurchase_count = 1`;
     `Δc = Δtotal_spent_cents > 0`; for a stablecoin `Δc = usdCentsForStable(amount)` exactly; `Δc` passes
     `checkLimits`; `Δtotal_tokens = tokensFor(Δc, stage)` exactly — **except** that when `Δtotal_tokens =
     tokensFor(Δc, s')` for some stage `s' ≠ intent.stage`, the answer is `price-changed` (Q15, review L3: the stage
     moved between the read and the simulation); B1d-2 — when a referrer is registered, `referrer@84` after = it.
   - **One retry for a busy destination (C39, review 2 M1):** when every other check passed and only the destination's
     Δ differs (another buyer's purchase or a treasury movement landed between the snapshot and the simulation), and
     the simulation's `context.slot` is **not below** the snapshot's (a lower slot is a stale proxy answer, not a race —
     `simulation-mismatch` at once, no retry; review 2 L1), prepare takes one fresh snapshot and simulates **the same
     message bytes** again (nothing rebuilt: same blockhash, fee and instructions). The fresh snapshot **replaces** the
     first for everything — §2.1's rules and C5's pins, `intent.stage` against its stage (→ `price-changed`), the limits,
     `firstPurchase` and `newPdaRent`, the referrer (B1d-2), and every "before" — and **all** of this step runs again on
     the second result. If the fresh snapshot changes what the message was built from (`newPdaRent`, the referrer
     resolution, the stage), prepare refuses with that check's code rather than simulating stale bytes. The entry stores
     the second snapshot's values. One retry per prepare; no other failure is retried. A second destination-only
     mismatch → `presale-busy` (Q52, "it was simulated, twice" — not Q16).
   Any other failure → `simulation-mismatch` (Q16), never offered with a warning (approved §3).
6. Re-auth reasons (§3.4); challenge issued / re-based exactly as `prepareSend` (bound to the intent digest, which
   includes `kind`, `account`, `currency`, `amount`, `stage` and — B1d-2 — `referrer`).
7. Store the prepared entry (§1.3) and answer `PurchaseView = {id, currency, amount, stage, priceTicks, nocBase: Δtokens,
   spentCents: Δc, destination, referrer: {address, registers: boolean} | null, fees: {networkLamports,
   priorityLamports, rentLamports: newPdaRent}, reauth, validUntil, simulation: {slot, elapsedMs, programs:
   ['compute-budget', 'presale'], instructionCount}}` — `simulation` carries #19's facts for #20 (C33).

`presale.buy {id}` → `sendPrepared` (§1.3, C29) with `beforeSign` = C12's geo check and C22's re-read of the §2.1
snapshot; then `signPrepared` → `submitSigned` (records in `v1_pending` before the broadcast, B1b) → `armAutolock`. The
500 ms double-submit lock is #20's `LockedButton` (cardinal rule 6), as for a send. The recorded bytes are sent at most
once (B1b's exactly-once; #54's resend sends the same bytes). On a `beforeSign` refusal the background keeps the entry
and the proof (C29); the popup discards the entry itself (`presale.discardPrepared`) when no re-prepare can succeed
(`geo-closed`, `presale-closed`, `blocked`) and keeps it for `price-changed`, `state-changed` and
`referrer-not-applicable` (the next Buy re-prepares carrying the challenge id).

### 3.4 Re-authentication (D3)

`presaleReauthReasons({firstPurchase, amount, balance, usdMicros, thresholdCents})`:
`first-purchase` (C21) · `over-5-percent` (`amount × 100 > balance × 5`, balance = the paying token's total held; a
zero balance counts as above) · `over-usd-threshold` — the payment's value is **the larger** of its value at
`/wallet/prices` (SOL, USDC or USDT) and the simulation's `Δtotal_spent_cents` (the program's own valuation), unknown
— and so above — only when both are missing (C36); threshold = `settings.reauthUsdCents`, default $100. B1b's
`first-send` and `whole-balance-to-new` do not apply: the recipient is the program and its treasury is pinned (C5).
#10 shows the reasons (Q17 for `first-purchase`; B1b's lines for the other two) and the purchase rows of §4.2. A
registration of a referrer (B1d-2) happens only on a first purchase, so it is always re-authenticated, and #10 shows
its row (Q47).

### 3.5 Referral — #24 and the referral address on #23 (B1d-2, C1, D8, C32)

**#24's data.** `ReferralView = {link, earnedBase | null, referrals | null, referredCents | null}`: `link` =
`buildReferralLink(account)` (`https://noc-tura.io?ref=<address>`, `core/referral/index.ts`); `earnedBase` = the
allocation's `referral_bonus_tokens` from chain (the coordinator reports 0 for a chain-credited bonus — memory
"referral and backend contract"); `referrals` and `referredCents` from `GET /referral-stats/<address>`
(`fetchReferralStats`; aggregate only; USD converted to cents at this edge). A source that fails gives `null` for its own
fields only, shown "—". No stat without a source (approved).

**The referral address (D8; an undrawn element, §9).** How a referrer enters a purchase, from the IDL and the program:
the purchase instructions take **no** referrer argument. The referrer is the buyer's `user_allocation.referrer`, which
only `register_referrer(referrer: Pubkey)` sets — once (`AlreadyHasReferrer`, `lib.rs:916`), refusing the default key
(`InvalidReferrer`) and the signer (`CannotReferYourself`), creating the two user PDAs if needed (`init_if_needed`,
`lib.rs:3265-3285`, so their rent moves into this instruction and `newPdaRent` is unchanged in total). The purchase then
passes `referrer_allocation = ["allocation", referrer]` (account 3), and the program credits the one-time bonus to that
PDA only on the buyer's first purchase (`purchase_count == 0`) and only if that PDA holds data (`lib.rs:360-415`; the
stablecoin path likewise, `lib.rs:2455-2500`). `core/presale/referrer.ts` already encodes this: `resolveReferrerWith(ref,
user, captured)` returns `registerReferrer` only when there is no on-chain referrer, the capture is valid and it is
the first purchase, and `referrerAllocation` for the *effective* referrer; `buildBuyInstructions` /
`buildStablecoinBuyInstructions` put `register_referrer` between the compute-budget instructions and the purchase.

- **Shown** on 23a only while `view.referral.canRegister` (first purchase, no on-chain referrer). An on-chain referrer
  always wins: the field is then absent and #20 shows the existing referrer (Q47, without the note).
- **Validated by the background only** (C3): on blur the popup asks `presale.checkReferrer`, which answers, in this
  order: `referrer-invalid` (not 32 bytes of base58, or the default key — `captureIsValid`), `referrer-self` (the buyer
  **or any account of this wallet's session**), `referrer-not-applicable` (the snapshot says an on-chain referrer exists
  or this is not a first purchase), `referrer-no-allocation` (one `getAccountsData([["allocation", referrer]])`: absent,
  or not a valid PresaleAllocation by §2.1 rule 6 with `user@8 = referrer`). The line (Q46 a–c, Q48) shows under the
  field and Buy is disabled while it shows. An empty field is no referrer.
- **Re-checked at prepare and at signing**, never trusted from the popup: prepare repeats every check against its fresh
  snapshot and builds with `resolveReferrerWith(snapshotRef, account, intent.referrer)`; it refuses — never drops —
  a referrer that would not be registered (`referrer-not-applicable`, Q48), so the user's input is never silently
  ignored; `beforeSign` (C22) refuses `state-changed` when the allocation's referrer or `purchase_count` moved since.
- **#20 and #10** show "Referred by" with the whole address in groups of four and Q47's note when this purchase
  registers it (permanent).
- **The record** carries the effective referrer as `referrerAddress` (§2.4).

### 3.6 Website purchases through #48 — F12, the presale region block (D9, D15, C31; B1d-1b)

B1c's #48 shows a site's presale purchase today as F2 "non-transfer" (a warning, `redFlags.ts:386` — the presale is a
decoded program), so a user in a sanctioned country can buy on any site through the extension, behind only the site's
own check. D9 closes it with the same rule as #23.

- **Detection.** A transaction of a `signTransaction` / `signAndSendTransaction` request carries a presale purchase when
  any top-level instruction's program is the presale program (`6nTT…LJvt`) and its first 8 data bytes are one of the
  six purchase discriminators in `presaleIdl.ts` — `presale_purchase_with_sol`, `_with_usdc`, `_with_usdt`,
  `presale_purchase_and_vest_stake`, `presale_purchase_usdc_and_vest_stake`, `presale_purchase_usdt_and_vest_stake` —
  whether or not the rest of it parses strictly (an unparsable one is also F1, as today). A purchase reached only by a
  CPI from another program is not detected (that program is F1's named unknown program; §8.1).
- **The gate (D15).** F12 calls the shared `src/background/geo/gate.ts` (§1.2, §2.2) directly — the same module, list
  cache and rules as #23, present in both builds. There is no registration hook and no "not in this build" answer: a
  no-presale build blocks a site's purchase exactly when the presale build would (C31).
- **Where it plugs in.** `runSimulation` (`dapp/signTx.ts:79`) asks the gate — fresh `/geo/check`, list from the
  ≤ 10-minute cache (C12) — beside `recipientFacts`, only when a transaction of the request carries a purchase, and
  stores the answer with the simulation (`sim.presaleRegion`, parsed back field by field like every stored flag). A
  failure of the check itself is `no_check`, never a missing answer. `redFlagsOf` (`dapp/redFlags.ts:161`) then emits,
  for each such transaction, **F12** `{kind: 'presale-region', severity: 'refuse', word: null, at: <the purchase
  instruction's index>, reason}` when the answer is not open (`sanctioned`, `stale_list`, `unknown_country`,
  `no_check`, `refused`). `severity: 'refuse'` is new: it is neither a warning nor an overridable block —
  `expectedOverrides` never asks a word for it and `overridesMatch` cannot satisfy it. Three places the plan must
  change with it (review 2 L7): `redFlagsOf`'s sort (`redFlags.ts:169`) compares severity two ways today (block before
  warn) — it becomes a three-way rank, `refuse` < `block` < `warn`, so F12 sorts first; the stored-flag parser
  (`redFlags.ts:450` on, `exactly` with its kind and severity checks) gains the kind, accepting only `severity:
  'refuse'`, `word: null`, a valid index and a known reason; `KIND_ORDER` gains it.
- **Approval.** `txRefused` (`dapp/signTx.ts:208`) answers a new refusal `presale-region` for any request with an F12
  in any transaction — its row goes **right after the `simulation-failed` row** (the dependent-failure check) and before
  the override words (`overridesMatch`), so no word, no re-authentication and no setting can approve it (C31; "no
  setting disables a block", B1c §3.3). At the decision, before the entry moves to `deciding` (B1c §1.5 step 2, so a
  refusal burns nothing), the background asks the gate again for a request carrying a purchase ("before every
  signature", C12); not open → the refusal, and the request is re-simulated so #48 shows the F12 it now has. An open
  answer adds nothing: the purchase stays F2's warning, as today.
- **#48 (window).** F12 renders as `.s9-flag-banner danger` in its transaction's section, first among blocks: head Q49,
  body Q50 (a — sanctioned, with the country name; b — every fail-closed reason), meta Q51. No typed field; Approve is
  not drawn — [Reject] only, as for a failed simulation; the top-bar eyebrow is B1c's "Critical · Blocked transaction"
  (B1c Q35). The window computes nothing (B1c's C13); Q49–Q51 live in the window bundle of both builds. **The country
  name** comes from a shared UI helper, `src/app/ui/regionName.ts` (`Intl.DisplayNames(['en'], {type: 'region'})`, the code
  itself when it throws or answers undefined, and the EU-27 table), imported by both `src/approve/Tx.tsx` and #50b, beside
  the `app/ui` modules the approve window already imports (`ExtIcon`, `LockedButton`) — the approve bundle never
  imports a presale directory (review 2 L6).
- **Plan: B1d-1b** (controller ruling with D15; D10b keeps 1a free of UI). It needs the gate (1a) and #48 copy; it is
  shared code that ships in both builds. No build carrying B1c's dApp path is released without it (§6.5).

---

## 4. Screens (design binding; departures in §9; B1d-1b unless marked)

Popup width 412 px, max 600 px high; the body scrolls, the sticky bar stays. New routes (only on the on build, in
`router.ts`'s closed list through `presaleRoutes`): `presale` (#23), `presale-confirm` (#20 purchase variant,
`entry: 'flow' {preparedId}` or `'resume'`), `geo` (#50b, carrying nothing — it asks `presale.view`), `referral` (#24,
B1d-2). #21 is the existing `status` route. Every CTA follows rule 6 (`LockedButton`).

### 4.1 #23 presale — states of ix 10603-10902

**On mount, every time:** `presale.view`. While it is answering, the stage card and the pay card show B1b's skeletons.

- **Precedence (C30):** `pending` set → **23b**, whatever else the answer says; the closed line of the answer (Q11–Q14,
  or "Not available here — <reason>" as a link to #50b for `why: 'geo'`) sits beneath 23b's rows. Only with no open
  record do the closed answers below apply.
- **Closed answers** (no open record). `why: 'geo'` → the route is **replaced** by #50b (approved: "re-checked at every
  presale screen mount"). `why: 'unavailable'` → title "NOC presale", one line in place of the cards: Q11, or Q12 for
  `refused`, no Buy. `why: 'inactive'` → the stage card as last read with the eyebrow "Stage N of 10" (no "· live") and
  Q13, no Buy. `why: 'blocked'` → the stage card and Q14, no Buy.
- **23a active** (`open: true`, `pending: null`), top to bottom as drawn:
  - Top bar: back, title **"NOC presale"** (`.noc-h3`).
  - Stage card: eyebrow **"Stage N of 10 · live"** (`.noc-overline` + `--accent`); **"$ 0.1501"** (`.noc-balance-lg`
    + `.noc-numeral`, the program price to its 4 decimals) **"/ NOC"** (`.noc-body-lg`); progress bar, CSS-only fill
    = `stageSoldBase / stageCapBase` (stage cap 10 240 000 NOC); meta row 1: **"$ X raised"** from
    `total_usd_raised_cents` (the sale's total, formatted "$ 1.55 M" at ≥ 1 M, "$ 12,345" below, floored) · Q01 (the
    cap in NOC); meta row 2: **"Next stage $ 0.1723"** from `nextPriceTicks` (absent at stage 10); "Ends in 14 days"
    omitted (§9).
  - Pay card: **"YOU PAY"** (`.noc-overline`), **"Available <balance> <CUR>"** (SOL balance; a stablecoin's largest
    holding account — what one purchase can spend); the amount input (`.noc-balance-lg` + `.noc-numeral`, decimal
    keyboard on `inputmode="decimal"`); the unit label as the currency selector (C20); **[MAX]** (`presale.quote` with
    `'max'`). The limit or balance line (§3.2) under the input in the error style; Buy disabled while a line shows.
  - Receive card: **"YOU RECEIVE (EST.)"** (`.noc-overline`); sub **"@ $ 0.1501 · 1 SOL ≈ $ 198.42"** (Q02 for the
    "≈"; for a stablecoin "@ $ 0.1501" alone, Q03); the estimate **"15,873.60 NOC"** (`.noc-balance-md` +
    `.noc-numeral`, from `Quote.nocBase`, formatted by B1b's amount formatter to 2 decimals, floored).
  - **Referral address** (B1d-2, D8, undrawn — §9): shown only while `referral.canRegister`; B1b's single-line input
    style (`.input`, the value in `.noc-mono`), label and placeholder Q45, the line under it (Q46, Q48) in the error
    style; `autocapitalize`, `autocorrect` and `spellcheck` off; paste allowed; no QR.
  - **Your allocation** row (approved; no drawn state), in the receipt-row style (`.noc-body-sm`, `.noc-numeral` on
    the value): label Q04, value "<total> NOC", sub **"Claimable after TGE"** (D5). Shown only when
    `allocation.exists` and `totalBase > 0`.
  - **"Not available in your region?"** (`.btn-tertiary`, `--accent`, 13 px) → #50b (C18). Visible even with an empty
    input (design F).
  - Sticky **[Buy <estimate> NOC]**, or **[Buy NOC]** while there is no estimate (screen.md §23). Disabled while a
    line shows or the quote is stale; tap → `presale.prepareBuy` → `presale-confirm` (`flow`).
  - Typing calls `presale.quote` (debounced 250 ms). Mount and focus call `presale.view` in full (snapshot, geo,
    balances, price — about five requests); the popup then re-reads **every 25 s** while #23 is visible with
    `presale.view {account, refresh: 'gate'}` — the §2.1 snapshot and `/geo/check` only, two requests, the balances
    of the last full view kept (C35, review 2 M3). A currency change and a confirmed purchase ask a full view; the
    re-read pauses while `document.visibilityState !== 'visible'` and resumes with a full view.
- **23b pending** (`pending` set, C17, C30): title "NOC presale"; the ring spinner (static under
  `prefers-reduced-motion`); **"Order pending"**; sub Q05 (replaces "Tokens will be claimable when stage 3 closes",
  D5); rows **Paid** "<amount> <CUR>", **Estimated NOC** "<nocBase> NOC", **Stage** "Stage N of 10 · @ $ 0.1501",
  **Tx hash** (`.noc-mono` 12 px, the signature's first 4 … last 6 as drawn; the full value on hover and in the
  explorer link); banner Q06; **[View on Solana explorer]** (`explorerUrl(signature)`, the one external link, as #27)
  and **[Done]** → #11. "Order ID" omitted (§9). 23b re-reads **`presale.pending`** (no network) on focus and every 6 s
  (the design's interval); the B1b poller does the watching. When it answers null (confirmed, failed or expired), #23
  asks `presale.view` once and renders what that answers.
- **After confirmation** the record is no longer open: #23 is 23a again with the allocation row updated. A failed or
  expired record follows B1b (#44, #54 from the pending row and #21).

### 4.2 #20 purchase variant, #10, #21 and the resume paths

- **#20 (`presale-confirm`)**: B1b's #20 chrome, quote countdown ("Quote valid N s", 30 s re-prepare carrying the
  challenge), Cancel (`presale.discardPrepared`) and resume entry. Title Q07, lede Q08. Rows: **You pay**
  "<amount> <CUR>" (+ "≈ $ X" from `spentCents`); **You receive (est.)** "<nocBase> NOC" (the simulation's
  `Δtotal_tokens`, not the popup's estimate); **Stage** "N of 10"; **Price** "$ 0.1501 / NOC"; **Fee** — B1b's fees
  card with network + priority and an **account setup** row for `rentLamports` when > 0 (Q09), no Noctura-fee row
  (C25); **To** "Noctura presale" (Q10) over the full treasury (SOL) or vault ATA (stablecoin) address in groups of
  four, equal weight (B1's address rule) — no first-send warning (§3.4); **Referred by** (B1d-2, Q47) when the purchase
  passes a referrer. **#19's facts (C33):** a "Simulation" receipt block — Q44's "Simulated at slot <N>" and
  "Programs · Compute Budget · Noctura presale" (from `PurchaseView.simulation`); the account-setup row above is #19's
  third fact. Send button label "Buy NOC" (screen.md). Re-auth reasons → #10 exactly as a send.
- **#10**: the vault page renders the challenge's description from the background: header Q18 and the rows above;
  reason lines Q17 + B1b's. `src/unlock/presale.ts` holds that description renderer (resolved to the stub in the off
  build, in the vault-isolation gate's fixtures).
- **#21**: unchanged flow; for a record with `extra.kind = 'presale-buy'` the title/amount line reads Q32 and a
  **"Presale"** badge (`StatusPill`, Q31) sits beside the status; Done → #23 (C17). #44 and #54 render the purchase
  with Q32 as their amount line; #44 for a landed-but-failed purchase shows the network fee paid and no NOC; #54 offers
  B1b's same-bytes resend.
- **Resume paths (review M5).** B1b's popup resume hook (`App.tsx:116-123`) asks `wallet.preparedFor`; on the on build it
  also asks `presale.preparedFor` through `presaleSlots` (there is at most one entry per account, §1.3, so whichever
  answers non-null) and pushes `presale-confirm` `resume` for a purchase. The full tab's `resume` route (the vault
  page's hand-over after #10, `#/send/resume?account=`, `router.ts:120`) does the same. The off build has no
  `presale.preparedFor`; a purchase entry left there is unsendable and expires (C19).

### 4.3 #50b region blocked (presale) — ix 19612-19906

Route `geo`; on mount `presale.view` (a fresh geo check — "Re-checked at every presale screen mount"). When #50b
**replaced** #23 (a closed answer, no open record), it renders first from the `PresaleView` it was routed with and its
mount re-check replaces that answer when it lands — one view for the replacement, one for the mount, as approved
(review 2 L3). Chrome as drawn:
top bar **"Not available here"** (`.t-title`) with back and ✕ (→ #11); hero glyph (72 px circle, `--warning` + i-lock);
headline; sub; region card; reason row; info banner; "What still works"; sticky **[Got it]** → back to the trigger:
#23 when #50b was opened from #23's link (#23 is on the stack), **#11** when #50b replaced #23 or came from #11's
Buy — never a dead end.

| reason | headline | sub | region card | reason row (head · sub) |
|---|---|---|---|---|
| `sanctioned` | **"NOC presale isn't open in your region"** | Q21 | **"Detected region: <Country>"** (+ **" · EU"** for the 27 EU members) · **"Approximated from your IP. No GPS, no device location."** | **"Presale geofence active"** · Q22 |
| `stale_list` | Q23 | **"The restricted-region list is out of date."** (approved) | as above when a country is known | Q24 · Q25 |
| `unknown_country` | Q23 | Q26 (approved: "unknown country") | the disclosure line only | Q24 · Q25 |
| `no_check` | Q23 | **"The region check is unavailable — try again later."** (approved) | the disclosure line only | Q24 · Q25 |
| `refused` | Q23 | **"The presale service refused this network."** (approved) | the disclosure line only | Q24 · Q27 |
| open (C18) | Q20 | — | as `sanctioned` | — |

- Country name and " · EU": the shared `src/app/ui/regionName.ts` (§3.6) — `Intl.DisplayNames(['en'], {type:
  'region'}).of(code)`, the code itself if that throws or answers undefined; the EU-27 table is a static list there. The design's CSS flag tile is omitted (§9).
- Info banner: head **"Why this matters"**, sub Q28 (replaces "we honor the program's restrictions"); line Q29
  (replaces "If the program updates its allowlist…"); **"Re-checked at every presale screen mount."** kept.
- "What still works": **"Send / Receive NOC"** kept; Q30 replaces "View portfolio"; "Stake existing NOC" and the
  post-TGE claim line omitted (§9).

### 4.4 #24 referral (B1d-2) — ix 10903-11233, as the app corrected it (C1)

Route `referral` from the #31 row **"Refer a friend"** (C16); on mount `presale.referral`. Title **"Refer a friend"**
(`.noc-h3`); three stat cards (`.noc-overline` label, `.noc-balance-md` + `.noc-numeral` value, `.noc-caption` sub):
**REFERRALS** / Q35 (`referrals`), **EARNED** / **"NOC lifetime"** (`earnedBase`, from chain), **REFERRED** / Q36
(`referredCents`) — the app's three (the design's ACTIVE "staking now" has no source, §9); "—" for a null. Code card:
eyebrow Q37 (the app's "YOUR INVITE LINK"), **"Used N times"** / **"Not used yet"** (N = `referrals`; the line hidden
when null), the full link in `.noc-mono` (never truncated, as the app), **Copy** (`useCopy`; "Copied" / Q38; no
auto-clear and no countdown toast — the extension has no `clipboardWrite`, B1 §4), **"Share invite link"** (C15: copies
the link). **24a-bis kept as drawn, minus the toast (review L8):** while `useCopy` says `copied` (its 2 s), the Copy
icon is the checkmark and the code row carries the `--accent` border; "Copy failed" shows no checkmark. Info banner
Q39 (D13). Legalese **"Referral payouts are subject to program terms. Self-referrals are detected and rejected."** (as
drawn and as the app; "program terms" unlinked until the terms page exists, B1e). Empty (24b): zeros as returned; the
"Recent rewards" empty state is omitted with the list (§9).

### 4.5 #11 banner, Buy and the pending row

- **Banner** (below the token list, as drawn): **"NOC Presale · Stage N"** / **"$ 0.1501 · P% to next stage"**
  (P = `floor(100 × stageSold / stageCap)`), from `presale.banner`; shown only when it answers non-null with an active
  sale. Tap → the Buy routing below.
- **Buy quick action** (third, after Send and Receive; Swap stays removed): shown while `presale.banner` is non-null.
  Tap → `presale.view`: `pending` set or `open` → #23; `why: 'geo'` → #50b; any other answer → no route, the action
  hides (approved: "else #50b or nothing"). Disabled offline and in the 403 cool-down, as Send (B1b D36).
- **Pending row**: an open `presale-buy` record shows on #11's pending row as Q33 (B1b's row, its tap → #21); in the off
  build as Q42 (B1d-1a).

### 4.6 #26 and #27 (B1d-2)

- **#26**: a `purchase` history row (B1b's "Presale purchase" / "NOC") gains the **"Presale"** badge (Q31) — on every
  purchase row, the website's included (the row kind is the chain's, not ours); the badge is on the on build only, the
  row itself is B1b's and stays in the off build. An open purchase's pending row on #26 reads Q33.
- **#27**: the `purchase` variant (B1b) gains Q34 while `presale.unrecorded` lists its signature.

---

## 5. Errors and edge cases

Refusal codes of the presale kind (`presale/` only — not in the shared `SendRefusal`); each is a fixed code the popup
translates; nothing internal is shown.

| code / case | where | behaviour |
|---|---|---|
| `presale-unavailable` (read failed, malformed, pin failed, a vault ATA failed §2.1 rule 8) | view, prepare, sign | #23: Q11, no Buy; on #20: back to #23 |
| `coordinator-refused` (403 / cool-down) | anywhere | Q12 on #23; `refused` on #50b; never retried inside the cool-down; one shared latch |
| `presale-closed` (inactive, 6020/6021/6024) | view, prepare, sign | Q13 |
| `blocked` (`is_blocked`, 6002) | view, prepare, sign | Q14 |
| `geo-closed` | view, prepare, sign | #50b with the reason; at sign the background keeps the entry (C29) and the popup discards it |
| `price-changed` (stage moved: C27 at prepare, L3 in the simulation, C22 at sign) | prepare, sign | Q15 on #23; the popup re-reads the view (a new simulation follows the next Buy, the challenge carried) |
| `state-changed` (the allocation's existence, `purchase_count` or referrer moved since prepare, C22) | sign | Q43 on #23; the view re-read, the challenge carried |
| `below-min` / `above-max-tx` / `above-user-limit` / `above-limit` (6023) | quote, prepare, sign (`above-user-limit`) | the line under the input (Q40 a/b/c); Buy disabled |
| `insufficient-sol` / `insufficient-token` / `split-balance` / `sender-below-rent` | quote, prepare | the line (Q41 a–d) |
| `no-sol-price` | quote | Q19; SOL disabled, stablecoins offered (C8) |
| `simulation-failed` / `simulation-mismatch` | prepare | Q16 on #23; never offered with a warning |
| `presale-busy` (the destination moved twice, C39) | prepare | Q52 on #23; Buy stays enabled (a later try is a new prepare) |
| `referrer-invalid` / `referrer-self` / `referrer-no-allocation` (B1d-2) | checkReferrer, prepare | the line under the field (Q46 a/b/c); Buy disabled |
| `referrer-not-applicable` (B1d-2) | checkReferrer, prepare | Q48; the view re-read (the field disappears) |
| `in-flight` | prepare | #23 is 23b already (C17, C30); a second click while one is pending refused (C10) |
| `reauth-required`, `prepared-expired`, `unknown-prepared`, `prepared-invalid`, `locked` | buy | B1b's handling and copy, unchanged |
| `presale-region` (F12) | #48 approval | Reject only, no override (§3.6) |
| a double click on Buy / on #20 | popup | `LockedButton` 500 ms + disable on tap; the prepared entry is single-use |
| the worker stops between sign and broadcast | — | B1b: the record is written before the broadcast; never signed twice, never broadcast twice |
| the stage advances between simulation and landing | — | accepted: the program prices at execution; "(est.)" on #23 / #20; the allocation row shows the real total after confirmation |
| another purchase lands on the treasury between snapshot and simulation | prepare | one fresh snapshot and the same bytes simulated again, every check re-run (§3.3 step 5, C39); a second destination-only mismatch → `presale-busy` (Q52); a simulation slot below the snapshot's → Q16 at once |
| a referrer registered from another device between signing and landing (B1d-2, review 2 L11) | on chain | the purchase fails on chain (`AlreadyHasReferrer`, 6016), the network fee paid, nothing bought — #44 `landed` with Q32; the next view re-reads (the field is gone, the on-chain referrer shown on #20) |
| Pyth older than 120 s at simulation | prepare | the simulation fails → Q16 |
| the coordinator is unreachable | — | presale closed (§3.1); F12 on #48; the wallet keeps working; a recorded purchase keeps retrying (§2.4) |
| the record POST keeps failing | B1d-2 | the purchase stands; Q34 on #27; given up after 72 h |
| an update turns the switch off with a purchase pending | off build | C19: the record is read, counted by `inFlightFor`, polled and shown generically (Q42); nothing is lost, nothing re-signed |
| geo `no_check` or a stale list while a purchase is pending | view | 23b stays, the closed line beneath (C30) |
| a sanctioned country behind a VPN | geo | closed (`sanctionedWinsOverVpn`); `isVpn` is never read as evidence |
| the user buys on another device meanwhile | prepare, sign | the allocation Δ check (§3.3) refuses a simulation that does not match → Q16; at sign `state-changed` (Q43); the next view re-reads |

---

## 6. Testing

### 6.1 Unit and component (vitest, against the real background)

Each item has a **named mutation** that must turn a test red (tsc's own exit code checked first, as the mutation sweep
does), and a positive control wherever a negative is asserted. The plan that builds the code builds its tests.

- **Switch (1a, §1.1):** `presaleSwitch` resolves each of the three entries to its stub when off and to itself when on
  (mutation: drop one mapping → the off build carries that entry → the module check red); it throws on a non-boolean
  and on a missing stub; `presaleFlag` maps `'1'`/unset/`'0'` and throws on anything else; **both configs, for each flag
  value, set the same `define` value and the same plugin mode** (a test importing both config factories — review L11;
  mutation: drop `define` from the content config → red).
- **Shared shapes (1a, review H1):** a stored `presale-buy` record (`intent: null`, `origin: null`, `extra` set) is read
  back by `readPending` (mutation: drop the new validator branch → the record vanishes → red); one with a malformed
  `extra` is kept with `extra: null`; a dApp record and a send read as today (positive controls); `inFlightFor` finds it
  and a send's prepare is then `in-flight`, and the other way round; `pollOnce` confirms it; `resend` sends its bytes;
  `viewOf` copies `extra`; Home, Activity, Status, Failed and Stuck render Q42 for `intent: null` with an unregistered
  kind (and Q32/Q33 with the presale renderer, 1b).
- **Pipeline order (1a, §1.3, C29, review M4):** `kind` in the integrity and the digest (mutation: drop it → a send's
  challenge satisfies a purchase → red); a prepare of either kind replaces the account's other entry; `wallet.preparedFor`
  never returns a purchase; `beforeSign` refusing (a test kind) → refused, the entry still present, the challenge still
  proven, nothing signed (mutation: move `beforeSign` after `takePrepared` → the entry is gone → red); a `beforeSign`
  slower than the TTL → `prepared-expired`; a taken entry whose integrity differs from the peeked one → `prepared-invalid`;
  exactly-once — restart between record and broadcast → one broadcast; the lock hook during prepare leaves nothing
  behind.
- **Layouts (1a, §2.1):** generator recomputes every account discriminator (mutation: skip the check → a wrong IDL
  discriminator passes); `u32` accepted, an unknown type throws; generated offsets = core's hand constants; the
  output's pinned hash; no `presale/` module mentions `tge_timestamp`.
- **State (1a, §2.1):** a valid fixture opens (positive control); one refusal per rule — wrong owner, length 369/371,
  wrong discriminator, admin@8 or sale_token@40 moved, each C5 pin, `presale_active` = 2, stage 10 and 255,
  `stage_tokens_sold` at the cap, hard cap, start time in the future, user account malformed, `is_blocked`, allocation
  `user@8` foreign, `claimed` = 2, the treasury absent or not System-owned, each vault ATA absent / wrong mint / wrong
  owner / uninitialised, a 403, a timeout. Each with its mutation (drop the rule → red). One `getAccountsData` call for
  all six accounts (a spy).
- **Geo (1a, §2.2, C34, review M8):** every reason — fresh list + `SI` → open; `KP` → `sanctioned`; `KP` with `isVpn:
  true` → `sanctioned`; `CN` (restricted) → open; `UNKNOWN`, `''`, `XX`, `ZZ`, `si` → `unknown_country`; list 31 days
  old → `stale_list`; missing dates, null dates, a date two days ahead, `stale: false` on an old list → `stale_list`;
  check 500 / timeout → `no_check`; list 404 → `no_check`; either 403 → `refused`. Parsing: a check body with an extra
  key → parsed; `isVpn` missing or a string → malformed (`no_check`); a list entry with `basis` and an envelope with
  `reviewed_by`, `source`, `age_days` → parsed; `max_staleness_days: null` → parsed, then stale; a non-object body →
  malformed. The cache: a second view within 10 min does not refetch the list but re-evaluates its age (fake clock past
  the limit → `stale_list`); `/geo/check` is fetched every time.
- **Limits (1a, §3.2):** at every boundary — `minCents − 1` (below), `minCents` (ok), `maxTxCents`, `maxTxCents + 1`,
  `userRemainingCents` and `+ 1` with an existing `total_spent_cents`; the program's fallback when a field is 0; the
  same minimum for SOL, USDC and USDT (D7; mutation: a SOL-only floor → red); `usdCentsForStable` floors (`9 999` base
  units → 0 cents); `tokensFor(10 000, 0)` = **`666 222 518 321`** (10¹⁵ / 1501, floored — review L1; the program's own
  comment is off by 1 000× and is not the oracle) and `tokensFor(10 000, 9)` = `285 795 941 697`; STAGE_PRICE_TICKS =
  core's float table × 10 000.
- **MAX (1b, C9):** SOL leaves exactly `890 880` + fees + new-PDA rent; capped by each limit; a stablecoin's MAX is the
  largest holding.
- **Build (1b, §3.3):** a stablecoin purchase from a **non-canonical** holding account (the largest of two, neither the
  ATA) uses it as account 4; account 5 equals the pinned vault ATA (mutation: derive from the admin → red); a split
  balance refuses; SOL and stablecoin account lists equal the IDL's (`presaleIdl.ts` rows) in order; only Compute
  Budget + presale programs; `register_referrer` never built in 1b; an on-chain referrer's allocation PDA passed.
- **Retry (1b, C39, review 2 M1, L1):** a destination-only mismatch, then a fresh snapshot whose stage moved →
  `price-changed` (mutation: the retry re-checks the destination only → passes → red); the second simulation's bytes
  equal the first's (mutation: the retry rebuilds the message → red); a fresh snapshot with a new `newPdaRent` → its
  code, not a simulation; a simulation slot below the snapshot's → Q16 without a retry; two destination-only
  mismatches → `presale-busy`; the entry stores the second snapshot's values.
- **#23 request budget (1b, C35, review 2 M3):** a request spy counts five requests on mount and exactly two per 25 s
  re-read (mutation: balances in the re-read → red); no re-read while hidden; a currency change asks a full view.
- **Simulation checks (1b, C11, C23, C28, review H2, L3):** a correct one passes (positive control); wrong SOL outflow,
  wrong token outflow, a token account of another owner, no allocation increase, `Δpurchase_count = 2`, `Δtokens =
  tokensFor(Δc) − 1`, a stablecoin `Δc` off by one, each Custom error → its code, an unknown error →
  `simulation-failed`; **"the amount lands on the referrer PDA instead of the treasury"** → mismatch, **"the vault ATA
  gains amount − 1"** → mismatch (mutation: drop the destination check → both pass → red); a destination-only mismatch
  is retried once and a second one refuses (mutation: retry on any mismatch → a wrong outflow retried → red);
  `Δtokens = tokensFor(Δc, stage + 1)` → `price-changed`.
- **Sign time (1b, C22, review L5):** stage moved, `presale_active` false, a pin moved, `is_blocked`, Δc above the
  remainder, `purchase_count` moved → each refused with its code, the entry still present.
- **Re-auth (1b, D3, C36):** `first-purchase` (allocation absent; `purchase_count` 0; not for 1), 5 % at the boundary,
  the dollar threshold at the boundary — the price below it and the simulation's cents above it → above (mutation: take
  the price only → red); both missing → above; `first-send` never produced for a purchase.
- **Resume (1b, review M5):** the popup hook and the tab's `resume` route push `presale-confirm` `resume` for a purchase
  entry and `confirm` `resume` for a send.
- **F12 (1b, §3.6, D9, D15):** for each of the six purchase discriminators, with the gate answering each closed reason
  → F12 and `txRefused` = `presale-region` with every override word given and the re-authentication proven (mutation:
  give F12 a word → approvable → red); the gate throwing → `no_check`; open → no F12, F2 as today (positive control); a
  non-purchase presale instruction (`register_referrer`) → no F12; a batch with one purchase transaction → the request
  refused; the decision re-asks the gate (a spy) and a closed answer there refuses before `deciding` is written; F12
  sorts before every block and warning (mutation: the two-way sort → a block first → red); a stored F12 is parsed back
  and a malformed one (a word, `severity: 'block'`, an unknown reason) is not; `txRefused`'s row order — a
  non-dependent failed simulation is still `simulation-failed`. **The same tests run in `vitest.nopresale`** with the same
  answers (D15: the off build blocks exactly when the on build does; mutation: stub the gate in the off build → red).
- **Recording (2):** written on `confirmed` only; the payload's fields, `paymentAmount` a string; the schedule's slots
  on a fake clock; a 403 waits for the cool-down; given up at 72 h; one POST in flight; delete wipes, restore keeps.
- **Referral address (2, §3.5, C32):** each `checkReferrer` code with its boundary (a 31-byte key, the default key, the
  buyer, another session account, an absent referrer allocation, a foreign `user@8`, an on-chain referrer present,
  `purchase_count` 1); a valid one → `register_referrer` built between the compute-budget instructions and the purchase,
  account 3 = `["allocation", referrer]`, the digest changes with the referrer; prepare refuses `referrer-not-applicable`
  rather than dropping the input (mutation: drop silently → red); the simulation's `referrer@84` check.
- **Switch, off build (`vitest.nopresale`):** `__NOCTURA_PRESALE__ === false` and the stub resolved (review L10);
  `PRIVILEGED` contains no `presale.*`; a `presale.view` is refused `unknown type`; `intents.ts` has no `presale-buy`; a
  stored `presale-buy` pending record is polled and rendered with Q42 (C19); `src/background/geo/gate.ts` and
  `core/geo/fetch.ts` are present and answer as in the on build (D15).
- **Screens:** every state of §4 with its verbatim strings — 23a (SOL, USDC, below min, MAX), 23b, 23b with a closed
  line beneath (geo `no_check` with an open record → 23b rendered, nothing hidden; mutation: drop the precedence → #50b
  → red), the allocation row, each closed answer, #20 purchase rows with the simulation block, #21 badge, #44 and #54 for
  a purchase, #50b × 6 (and Got it → #11 when #50b replaced #23, → #23 from the link) and `regionName` with
  `Intl.DisplayNames` throwing → the code shown (in the popup and in the approve window), #24 (populated, nulls, copied with the
  checkmark, copy failed), #11 banner and Buy routing, the `presale.banner` null paths (403, malformed, inactive), #48
  with F12 for Q50a and Q50b (Reject only), and in B1d-2 the referral field with each line, #26 badge, #27 line. TGE
  assertions are boolean with neutral messages (public CI logs): no date pattern and no countdown appears in any
  rendered presale screen.

### 6.2 Gates

- **`core/solana/encoding.ts` (1a, review M2):** three symbols move there — `SPL_TOKEN_PROGRAM`, `encodeU64LE` and
  `findAssociatedTokenAddress`; `core/solana/transfer.ts` (`encodeU64LE`, `findAssociatedTokenAddress`),
  `core/solana/history.ts` (`findAssociatedTokenAddress`) and `core/solana/balances.ts` (`SPL_TOKEN_PROGRAM`) import them
  from it; `core/presale/buyInstructions.ts` re-exports all three, so web and the app are unchanged. Today those three
  modules import them from `buyInstructions.ts` (`transfer.ts:3`, `history.ts:3`, `balances.ts:3`), which is why that
  module is in today's off-build-to-be bundle (`dist/app.modules.json` at 0b79442); moving only two would leave it there
  (B1d-1a plan, Task 1).
- **`check-no-presale.mjs <offDir> <onDir>`** (1a, in `npm run verify`, which builds both: `dist/` on and
  `dist-nopresale/` off; each `app.features.json` must say what its directory is, else the gate fails):
  1. **Modules:** the off build's module maps (`app.modules.json` and every other `*.modules.json`) contain no module
     under `src/background/presale/**`, `src/app/presale/**`, `src/unlock/presale.ts` or `core/referral/**`, and —
     **allowlist (C38)** — from `core/presale/**` only `core/presale/addresses.ts`, `core/presale/allocation.ts` and
     `core/presale/stagePrices.ts`; `core/geo/**` is allowed (D15). **Both builds** contain `src/background/geo/gate.ts`
     and `core/geo/fetch.ts` (D15's control: the off build did not lose the gate). **Positive control, staged per plan**
     (review 2 M2) — the list lives in the gate file and each plan's PR extends it, so `verify` is green at the end of
     every plan without loosening anything: **1a** — `presale/{layouts,state}.ts`, the three on-path entries
     (`presale/api.ts`, `src/app/presale/index.ts`, `src/unlock/presale.ts`, skeletons from 1a, §1.1), `core/presale/limits.ts`;
     **1b** adds `presale/{quote,buy}.ts`; **2** adds `presale/{record,referral}.ts` and `core/referral/index.ts`. A
     renamed or moved module fails the gate instead of passing it silently. **Self-test:** a fixture module map
     (`scripts/__tests__/fixtures/app.modules.0b79442.json`) produced by the 1a plan by building commit 0b79442 (`dist/`
     is untracked — review 2 L5) and naming that commit in its first key, fails the gate naming exactly
     `core/presale/buyInstructions.ts`, and passes with that one entry removed.
  2. **Strings:** no file under the off build's `app/`, `chrome/`, `firefox/` contains a **marker** — every `presale.*`
     message type, the route names `presale-confirm` and `referral`, `presale-buy`, `v1_presale_records`, and the
     strings "NOC presale", "YOU RECEIVE (EST.)", "Claimable after TGE", "Refer a friend", "Not available here",
     "Order pending", and every §10 string whose source is "new", "approved" or "app" and whose build is "on" — each
     literal part of at least 8 characters between placeholders. The list is explicit in the gate file and staged like
     item 1 (1a ships no marker — Q42 is "both" — so 1a's list is empty and the item is armed by 1b). **Positive
     control:** each marker is found in the on build. A marker that also lives in a shared module shows up in the off
     build and fails the scan itself — the author renames it; no separate self-test of sources is needed (review 2 L5).
  3. **Must stay:** the B1b/B1c presale strings ("Presale purchase", "PRESALE PURCHASE", the decoder's instruction
     names), Q42 and F12's Q49–Q51 are **found** in the off build (a control that the switch did not strip what both
     builds need).
- **No-TGE-date gates:** `extension/scripts/check-no-tge-date.mjs` (src + dist) and the repo's
  `scripts/check-no-tge-date.mjs` (every tracked file) cover the new sources and both builds.
- **RPC methods gate:** no new method (`getAccountsData` → `getMultipleAccounts`, `getTokenAccountsByOwner`,
  `simulateTransaction`, `getLatestBlockhash`, `getRecentPrioritizationFees` are on the list).
- **Permissions / CSP:** unchanged for both builds (no `clipboardWrite`, no new host, `connect-src` unchanged).
- **Vault isolation:** `src/unlock/presale.ts` and its stub in the fixtures; `v1_presale_records` in `BACKGROUND_OWNED_KEYS`.
- **Classes:** the design classes of §4 in `check-classes.mjs`.
- **Reproducible:** **both** builds rebuild byte-identically (on and off — review L10).

### 6.3 E2E (Playwright, contained)

Against `e2e/fakeCoordinator.ts`, extended with fake program state: Config / UserAccount / PresaleAllocation account
bytes built from `layouts.ts`, the treasury and vault ATAs, a simulation responder that applies the program's
arithmetic to the posted transaction (or a scripted error or a scripted wrong destination), `/geo/check` and
`/geo/restricted-list` with scriptable answers, `/referral-stats`, and `POST /solana/purchase` with scriptable status.
Every spec runs normally and under `unshare -rn` (containment: no real network).

B1d-1a: E2E 7 (it needs only a seeded record and B1b's fake signature statuses, not 1b's fake program state —
review 2 L10). B1d-1b: the rest of 1–9.

1. **SOL purchase end to end:** #11 Buy → #23a → amount → #20 (rows, the simulation block) → #10 (first purchase) →
   #21 → confirmed → #26 row (B1d-2 adds the badge assertion).
2. **USDC from a non-canonical account:** the transaction's account 4 is the held account, account 5 the vault ATA.
3. **Below minimum refused:** the line, Buy disabled; a forced prepare is refused by the background (C3).
4. **Geo blocked:** #50b for each reason (`sanctioned`, `stale_list`, `unknown_country`, `no_check`, `refused`); Got it
   → back; nothing was prepared. And with a purchase pending: 23b stays, the closed line beneath (C30).
5. **Coordinator unreachable:** #23 closed with Q11; Send and Receive still work.
6. **Stage moved:** the fake advances the stage between view and Buy → Q15; the next Buy simulates at the new price.
7. **Off build:** `dist-nopresale` loaded; no banner, no Buy, no #31 row; `presale.view` from the popup's context is
   refused; a `v1_pending` record of exactly §2.3's shape (`intent: null`, `origin: null`, `extra` of kind
   `presale-buy`) seeded into storage is shown generically (Q42) on #11 and #21, blocks a send (`in-flight`) and is
   polled to `confirmed`.
8. **Resume (review M5):** close the popup on #10 for a purchase, prove in the vault page, reopen → #20 purchase variant
   with `proven` true, Buy enabled; and the tab's hand-over lands on the same.
9. **#48 F12 (D9):** a fake site sends a presale purchase through the provider (`StandardWalletAdapter`): geo
   `sanctioned` → F12 with Q50a, Reject only; geo `no_check` → Q50b; the same two in the off build (D15); geo open →
   F2 warning, approvable (positive control).

B1d-2:

10. **Recording:** the POST fails twice (500, then timeout) and succeeds on the third slot (fake clock); #27's Q34
    disappears.
11. **Referral:** #31 → #24 with stats; `/referral-stats` failing → "—" for its two stats, EARNED still shown;
    Copy → the clipboard holds the link, the checkmark shows.
12. **Referral address:** a first purchase with a valid referrer → #20 "Referred by" with Q47's note → the transaction
    carries `register_referrer` and account 3 = the referrer's allocation; the buyer's own address → Q46b, Buy disabled;
    an account with an on-chain referrer → no field.

### 6.4 Visual

`e2e/visual-presale.spec.ts` shoots at 412 px: #23a (SOL, USDC, below min, after MAX), #23b (and with a closed line
beneath), the allocation row, each #23 closed answer, #20 purchase (with and without account setup), #21 with the badge,
#44 and #54 for a purchase, #50b × 6, #11 with the banner and Buy, #48 with F12 (B1d-1b); #24 (populated, empty, a null
stat, copied), the referral field with a line, #20 with "Referred by", #26 badge, #27 line (B1d-2); the opus-tier review
against `index.html` as in B1b and B1c, every departure checked against §9.

### 6.5 Release gates (B1e)

- B1d-1a, B1d-1b and B1d-2 on `main` (C26); §7's preconditions confirmed by ICO Claude and checked live once (slowly —
  CrowdSec).
- **F12 in every released build** (D9): no build carrying B1c's dApp path is released before B1d-1b is on `main`,
  whether presale is on or off.
- B1e decides whether the store build is `--no-presale` (site purchases through it are screened by the same gate
  either way, D15); if
  presale ships, the privacy disclosure lists presale (B1 §5: "public addresses (balances, history, presale,
  referral)"), the store listing describes the token sale, and the external security review covers §3.3 and §3.6.

---

## 7. ICO-side preconditions (for ICO Claude)

Each is written so ICO Claude can act on it without this spec's context. Code references are ICO main at 75450df.

**P1 — Automatic OFAC refresh of the restricted-country list (D6). Blocks: any B1d release (and today's live gate).**
What: `lib/restricted-countries.json` is refreshed automatically from OFAC with `updated_at` / `reviewed_at`; the
owner's manual review for RU / CN / ZW stays and is recorded per entry (`basis`). Why: the served list says `updated_at`
/ `reviewed_at` 2026-09-21 with `max_staleness_days` 30; from **2026-10-22** `evaluateListFreshness` (age 31 > 30)
closes B1d's gate — and F12 — for everyone until it is refreshed. Done when: `GET /api/v1/geo/restricted-list` answers
dates no older than the limit without a manual edit, and the refresh job's failure is alerted, not silent.

**P2a — `POST /api/v1/solana/purchase` idempotent by signature. Blocks: B1d-2 (the background retry, C24) — D11.**
What is wrong (`coordinator/src/api/server.js:416-560`): the purchases row upserts on `(chain, tx_hash)`
(`db/postgres.js:143`), but `recordAllocation` runs on every call with `ON CONFLICT … SET total_noc = total_noc +
EXCLUDED.total_noc, purchase_count = purchase_count + 1` (`db/postgres.js:446-460`), and `recordEarlyBuyerBonus` also
runs on every call — so a second POST of the same signature counts the allocation (and possibly the bonus) twice. The
extension retries after a timeout that may have followed a committed write; that retry must be harmless. Ask: in one
database transaction, insert the purchase with `ON CONFLICT (chain, tx_hash) DO NOTHING RETURNING …` (or an equivalent
that tells insert from conflict), and run `recordAllocation` and `recordEarlyBuyerBonus` **only when a row was
inserted**; a repeat answers `200 {success: true}` (a `duplicate: true` flag is welcome; the extension treats any
`success: true` as done) and changes no counter. Done when: a test posts the same body twice, and two at once, and the
allocation's `total_noc` / `purchase_count` and the bonus rows change exactly once; and a one-off query reports any
address whose allocation counters already exceed the sum of its purchase rows (the web and the app have posted
without retries, but a user's double click or a reload could have repeated a POST).

**P2b — Amounts from the verified transaction, not the request body. Urgent, separate; does not block B1d-1a / B1d-1b — D11.**
What is wrong: the same route takes `nocAmount` and `usdValue` from the body with only a range check
(`server.js:444-449`; the transaction is fetched, but only its `err` and the referral log are read), and the
early-buyer bonus keys on the body's `usdValue >= 500`. Anyone can post a real signature with a larger `nocAmount`.
This is the EVM §6 lesson on the Solana path (memory "coordinator EVM ingest"; web and the app post the same fields
today, so it is pre-existing and not caused by B1d). Ask: derive every amount from the confirmed transaction — the
buyer is the purchase instruction's signer (account 5 for SOL, 7 for a stablecoin) and must equal `buyerAddress`; the
payment token and amount from the instruction's discriminator and `u64` argument; the NOC from the program's own
`Allocation recorded: <n> tokens to user, <m> referral bonus` log line and the USD cents (SOL) from `USD value: <n>
cents`, **accepted only inside the presale program's own invocation frame** (`Program 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt
invoke [1]` … `success`), as `referralBonus` is already parsed; a body that disagrees is stored with the derived values
(or refused) and logged. Done when: a test posting a real signature with `nocAmount` × 10 stores the transaction's
amount, and a transaction whose log line comes from another program is refused.

**P3 — The 403 behaviour. Blocks: B1d-1b's copy being true (Q12 vs Q11).** What: which of `/geo/check`,
`/geo/restricted-list`, `/rpc`, `/referral-stats/:address` and `POST /solana/purchase` CrowdSec answers with 403 and
which with silence, and that the coordinator itself never answers 403 to the extension's `Origin` (B1 §5 coordinator
answer 2, measured for GETs only). Why: the extension shows "refused" (403 → Q12, `refused`) apart from "unavailable"
(silence / timeout). **And the per-IP rate budget per route** (review 2 M3): how many requests a minute CrowdSec allows
from one IP before it answers 403 or silence, so 1b can size #23's 25 s re-read (C35) and the poller against a number.
Done when: one written answer per route.

Also asked, not blocking: whether `/referral-stats` counts referrals made through the extension's purchases (they carry
`referrerAddress` whenever a referrer is effective, §2.4), and whether the stablecoin purchase path writes the same
`Allocation recorded` log line as the SOL path (P2b depends on it).

---

## 8. Out of scope, and where things live

### 8.1 Out of scope

- **#23c claim and #23d done** (D1): claim is rejected before the TGE timestamp (`lib.rs:591-594`), transfers the whole
  allocation at once (no vesting), and cannot be tested on mainnet before then. Named in §9.
- Staking (#22) and every staking line; notifications (#29) and their presale rows; fiat on-ramp (#50c) and #50a swaps;
  the referral history sheet and reward rows; referrer capture by link or page (C7: only #23's field); EVM cross-chain
  allocations and `link_solana_wallet`; the TGE countdown the app shows (the owner's open question, not B1d's).
- **Web and the app adopting `core/geo/fetch.ts` + `presaleGeoGate`** (D12, C14) — a separate later task.
- Moving the NOC valuation for B1b's dollar rule to chain (C13).
- **Accepted limits:**
  - the SOL estimate uses our price, the program Pyth's (the simulation shows the program's numbers before signing); a
    stage that advances between simulation and landing changes what is received (shown as "est.");
  - the geo gate is the wallet's, by IP, and a VPN outside a sanctioned country passes (the program has no geofence);
  - **with C28, a lying proxy** can misstate the stage, the price and the NOC received (the simulation is its answer),
    but cannot change the bytes signed: the user still pays exactly what they typed, to the pinned destination the
    program constrains. **With both the program and the proxy lying**, nothing client-side helps (review H2, L7);
  - F12 sees top-level instructions only: a purchase reached by a CPI from another program is F1's named unknown
    program, not F12 (§3.6);
  - **an off build screens a site's presale purchase exactly as the on build does** (D15, C31): blocked when the gate
    is closed or unreachable, allowed (as B1c's F2 warning) when it is open; the cost is one `/geo/check` (and the
    cached list) when a site sends a purchase — so a `--no-presale` store build still contains the jurisdiction gate
    and `core/geo/**`, as compliance code, never presale UI;
  - the coordinator stores what the record says until P2b; every input goes through one host (`api.noc-tura.io`) — an
    outage closes the presale (B1 §4, accepted by the owner).

### 8.2 Where things live

| path | plan | what |
|---|---|---|
| `extension/scripts/build.mjs`, `presaleFlag.mjs`, `presaleSwitch.mjs`, `vite.config.ts`, `vite.content.config.ts`, `vitest.nopresale.config.ts`, `src/features.d.ts`, `src/presale-off/*` | 1a | the switch (§1.1) |
| `extension/scripts/check-no-presale.mjs` (+ `__tests__`, the module-map fixture) | 1a | the off-build gate (§6.2) |
| `extension/scripts/gen-presale-idl.mjs` | 1a | + `layouts.ts` output, `LAYOUTS_SHA256` |
| `extension/src/background/intents.ts`; `prepare.ts`, `send.ts`, `pendingStore.ts`, `pending.ts`, `reauthChallenges.ts` | 1a | the kind registry and its uses (§1.3) |
| `extension/src/app/screens/Home.tsx`, `Activity.tsx`, `Status.tsx`, `Failed.tsx`, `Stuck.tsx` | 1a (generic), 1b (kind) | null-intent rendering (Q42; Q32/Q33) |
| `extension/src/background/presale/` | 1a: `layouts.ts`, `state.ts`, `api.ts` (skeleton); 1b: `quote.ts`, `buy.ts`, `api.ts` filled; 2: `record.ts`, `referral.ts` | the presale background |
| `extension/src/background/geo/gate.ts` | 1a | the jurisdiction gate, both builds (D15) |
| `extension/src/background/dapp/redFlags.ts`, `signTx.ts`, `decide.ts`; `src/approve/Tx.tsx`; `src/app/ui/regionName.ts` | 1b | F12 (§3.6) and the shared country name |
| `extension/src/background/deps.ts` | 2 | `createJsonPoster` |
| `extension/src/app/presale/` | 1a (`index.ts` skeleton), 1b, 2 | #23, #20 purchase variant, #50b, #24, the routes, `presaleSlots` |
| `extension/src/app/App.tsx`, `router.ts`, `screens/Settings.tsx`, `TxDetail.tsx` | 1b, 2 | resume, guarded routes, #31 row, #27 line |
| `extension/src/unlock/presale.ts` | 1a (skeleton), 1b | #10's purchase description |
| `core/geo/fetch.ts`, `core/presale/limits.ts`, `core/solana/encoding.ts` | 1a | fetcher; bigint limits, ticks, rents; the three moved symbols (`SPL_TOKEN_PROGRAM`, `encodeU64LE`, `findAssociatedTokenAddress`) |
| `core/presale/addresses.ts`, `core/presale/buyInstructions.ts`, `core/presale/record.ts`; `core/solana/{transfer,history,balances}.ts` | 1a, 1b, 2 | the vault ATAs; the `sourceTokenAccount` parameter and the three re-exports; `paymentAmount: number \| string`; the imports from `encoding.ts` (1a) |
| `extension/e2e/presale*.spec.ts`, `visual-presale.spec.ts`, `fakeCoordinator.ts` | 1b, 2 | E2E, visual, fake program state |

Facts re-read for this spec: `core/presale/{addresses,allocation,buyInstructions,purchaseGate,record,referrer,stats,stagePrices}.ts`,
`core/geo/{freshness,classify,restrictedList}.ts`, `core/referral/index.ts`, `core/solana/{rpc,transfer}.ts`,
`extension/src/background/{prepare,send,sendTypes,pendingStore,pending,reauthPolicy,deps,messages,walletApi}.ts`,
`extension/src/background/dapp/{redFlags,signTx}.ts`, `extension/src/app/{App.tsx,router.ts,history.ts,explorer.ts}`,
`extension/src/app/screens/{Home,Activity,Status,Failed,Stuck}.tsx`, `extension/src/app/ui/useCopy.ts`,
`extension/manifest/source.mjs`, `extension/dist/app.modules.json` (0b79442),
`extension/scripts/{build,gen-presale-idl,check-no-tge-date}.mjs`; ICO 75450df `lib/idl.json` (sha256 checked),
`programs/solana-ico-enhanced/src/lib.rs` (constants, SOL and stablecoin purchase, referral bonus, `register_referrer`
and `RegisterReferrer`, `calculate_tokens_for_usd`, `SPACE`s, stablecoin constraints, log lines),
`coordinator/src/api/{server.js,restrictedList.js,walletRoutes.js}`, `coordinator/src/db/{postgres,migrate}.js`,
`lib/restricted-countries.json`; the app's `src/screens/referral/ReferralScreen.tsx`.

---

## 9. Design ↔ B1 rulings and declared omissions

| design / B1 | ruling |
|---|---|
| B1 §4 "the same purchase gate (`core/presale/purchaseGate.ts`: min $10, max $50,000, fee reserve)" | **refined:** limits read from config with the program's fallback (§2.1), plus the per-user $200 000 constant (C6), in bigint cents (§3.2); `canBuy` (floats, static limits, no cumulative cap, no PDA rent) is not used. The fee reserve becomes the exact fee + rent + rent-exempt rule (C9) |
| approved §2 "limits from the program (min $25 SOL, $10 stablecoins as config says, max per user)" | **D7:** the program's minimum for every currency — `config.min_purchase_usd` if non-zero (read: $10), else the program's own fallback for both paths (`lib.rs:333`, `2414`); no client-only $25 SOL floor. "Max per user" is two limits: `max_per_user_usd` (per transaction, despite its name) and the cumulative $200 000 (C6) |
| B1 §4 "classified by `core/geo/classify.ts`" | **refined:** `presaleGeoGate` (`core/geo/freshness.ts`), which classifies with `sanctionedWinsOverVpn` and adds the stale-list and unknown-country rules B1 §4 lists |
| B1 §4 "the bundled fallback list always counts as stale" | the extension bundles no list; an unreachable list is `no_check` (C12) — the same closed outcome, a truthful reason line |
| B1 §4 "Referral: link and bonus shown; a captured referrer applied" | link and earned bonus shown (#24); **the captured referrer is #23's optional field** (D8, C32, B1d-2); an on-chain referrer always wins |
| B1 §4 "a separate module behind one flag, switchable off" | a **build-time** switch (D2, C4) with its gate |
| B1 re-auth "first send to a new address", "whole balance to a first-time address" | not applied to a purchase; **first purchase** instead (D3, C21) |
| B1 fee policy (transparent markup) | not applied to a purchase (C25) |
| B1c #48: a site's presale purchase shown as F2 (a warning) | **F12, Reject only, no override, when the gate is not open, in both builds** (D9, D15, §3.6) — an undrawn #48 state: banner Q49–Q51 in B1c's danger-banner style, no typed field, no Approve |
| #23 lede "Four backend-driven states: active · pending · claim · done" | active and pending built; **claim (23c) and done (23d) not built** (D1): no on-chain source before TGE, no vesting exists, untestable on mainnet |
| screen.md §23 "[Buy NOC] → tx-simulate → tx-confirm → tx-status" vs `index.html` #23 (E) "→ #20" | **#19 is not shown for a purchase** (C33, index.html's (E)); #20's purchase variant shows #19's facts: "Simulated at slot <N>", "Programs · Compute Budget · Noctura presale" (Q44) and the account-setup row |
| 23a "$ 1.55 M raised · $ 5.00 M stage cap" | "raised" from `total_usd_raised_cents` (the sale's total); the stage cap is 10 240 000 NOC, not dollars → progress and cap in NOC (Q01) |
| 23a "Ends in 14 days" | **omitted:** no data |
| 23a "1 SOL = $ 198.42" | our display price, shown with "≈" (Q02); #20 shows the program's numbers from the simulation |
| 23a price "$ 0.025" (3 decimals) | the program's price to its 4 decimals ("$ 0.1501") — the drawn value is a placeholder |
| 23a "SOL" (only currency drawn) | SOL / USDC / USDT through the unit label as a selector (C20) |
| 23a — no referral field drawn | **added (D8, an undrawn element):** "Referral address (optional)" between the receive card and the allocation row, only while it can take effect (Q45–Q48); #20 / #10 "Referred by" (Q47) |
| 23a nav "re-auth IF SOL spend > 5 % balance OR > 5 SOL absolute" | D3's rules: first purchase, 5 %, the dollar threshold setting — no 5 SOL absolute |
| 23b "Order ID ord_7f3c2d1a-4b9e" | **omitted:** no order id exists; the signature (Tx hash) replaces it |
| 23b "Tokens will be claimable when stage 3 closes." | wrong (claim is at TGE, for all stages) → Q05 with "Claimable after TGE" (D5) |
| 23b banner "we'll notify you when your tokens are claimable" | **omitted:** the extension has no notifications (B1b-2a D28); Q06 |
| 23b "non-refundable per presale terms" (a link) | kept as text, **without a link** until the terms page exists (B1e) |
| 23b "polls 6 s"; Android WorkManager / push; iOS Live Activity | the popup reads the record every 6 s while open (no network, C30); the B1b poller watches in the background; push and Live Activity are mobile-only |
| 23b "pending order ID held in encrypted SQLite" | `v1_pending` (B1b) |
| 23b shown only while the sale is open (backend-driven states) | 23b whenever a purchase is open, whatever the gate says, the closed line beneath (C30) |
| #23 "Your allocation" (no drawn state) | built in the receipt-row style (approved), Q04 |
| #23 (F)/(G) Android and iOS notes (decimal-pad IME, predictive back, haptics, Liquid Glass) | `inputmode="decimal"`; the rest mobile-only |
| #24 code "NOCT-7F3C-2D1A" (HMAC-derived) | **the address is the code** (C1); the link is shown whole, as the app |
| #24 "ACTIVE · staking now" | **omitted:** no source (staking not in B1); the app's REFERRED (Q36) in its place |
| #24 "Earn 5 % of every referral's stake rewards · paid in NOC · auto-credited each epoch." | **omitted:** does not exist; Q39 without numbers (D13) |
| #24 "Recent rewards", "View all", reward rows and their long-press menu, 24b's rewards empty state | **omitted:** the coordinator has aggregates only; no per-referral source |
| #24a-bis "Code copied · auto-clears clipboard 28 s" toast; the copy icon flipping to a checkmark with an accent border on the code row | **toast omitted:** no `clipboardWrite` → no auto-clear (B1 §4); `useCopy`'s "Copied". **Checkmark and accent border kept** for `useCopy`'s 2 s (review L8) |
| #24 "Share invite link" → Android chooser | copies the link (C15), Q38 |
| #24 entry "[More] menu or settings #31" | #31 row (C16) |
| #50b "Program enforces region check at claim_ix" | **omitted:** the gate is the wallet's; Q22 |
| #50b "The presale program enforces a regional geofence. You can still hold and stake any NOC…" | the program has no geofence and staking is not in B1 → Q21 |
| #50b "we honor the program's restrictions" / "If the program updates its allowlist, this screen automatically lifts." | Q28 / Q29 (the list is ours, not the program's) |
| #50b fail-closed reasons (stale list, unknown country, no check, 403) | not drawn → the approved lines + Q23–Q27 |
| #50b "What still works": "Stake existing NOC", the post-TGE claim line, "View portfolio" | stake and the claim line **omitted** (not in B1; the TGE date); "View portfolio" → Q30 (no #25 in B1) |
| #50b CSS flag tile | **omitted:** one gradient per country is not worth it; the region text carries the information |
| #50 "v1_geo_seen_at · suppresses re-rendering within 24 h" (annotation, v0.3) | **omitted:** the screen re-checks on every mount (approved) |
| #50b reached when the region is fine (the link is always visible) | the open variant (C18, Q20) |
| #11 "Buy → presale (#23) if active else fiat-onramp sheet" | #23 when open or a purchase is pending, #50b when geo-closed, otherwise no Buy (approved); no fiat |
| #11 shielded-tint banner variant; TipKit "Tap to see presale stage" / Android "New" badge | B2 / mobile-only — omitted |
| #20 "recipient" for a purchase | "Noctura presale" + the full treasury / vault ATA address (B1's address rule) |
| #21 / #26 "Presale" badge | not drawn; approved in the design conversation (Q31) |
| a purchase record in a build without presale | not drawn: the generic row and title (Q42) |
| #29 presale notification rows | out of B1 (D28) |
| screen.md §50 "back to trigger"; ✕ → dashboard | kept |
| plan split "B1d-1 foundations … presale-buy through simulation and #20/#10" (approved §4) | **three plans (D10b):** 1a foundations without UI, 1b the purchase — which also signs, records and broadcasts (#21), the inherited pipeline (a purchase that cannot complete is untestable end to end, E2E 1) — and 2 referral and recording |

---

## 10. Copy (final — D14)

The owner delegated every string below to the controller on 2026-10-19 (D14: "Odloči se ti"); each is **controller
copy, owner-delegated 2026-10-19**, final for the plans. "Source" records where the wording came from: "approved" =
worded in the design conversation; "app" = the Android app's existing copy; "core" = `core/presale/purchaseGate.ts`'s
existing copy; "B1b" = B1b's existing copy; "D13" = the owner's words; "new" = written for B1d. "Build" = which builds
carry it (§6.2's markers are the "on" rows of source new / approved / app). None contains a date or a time to TGE.

| # | where | string | source | build | status |
|---|---|---|---|---|---|
| Q01 | #23a meta, the cap | "10.24 M NOC stage cap" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q02 | #23a receive sub, SOL | "@ $ <price> · 1 SOL ≈ $ <sol price>" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q03 | #23a receive sub, a stablecoin | "@ $ <price>" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q04 | #23 allocation row label | "Your allocation" | approved | on | controller copy, owner-delegated 2026-10-19 |
| Q05 | #23b sub | "Waiting for confirmation. Claimable after TGE." | new (D5's words) | on | controller copy, owner-delegated 2026-10-19 |
| Q06 | #23b banner | "You can close the popup — Noctura keeps watching this purchase. Funds are non-refundable per presale terms." | new | on | controller copy, owner-delegated 2026-10-19 |
| Q07 | #20 title, purchase | "Confirm purchase" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q08 | #20 lede, purchase | "You are about to buy" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q09 | #20 fee row, new PDAs | "Account setup (first purchase)" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q10 | #20 recipient label | "Noctura presale" | approved | on | controller copy, owner-delegated 2026-10-19 |
| Q11 | #23 state unreadable | "Presale unavailable — try again later." | approved | on | controller copy, owner-delegated 2026-10-19 |
| Q12 | #23 coordinator 403 | "The presale service refused this network." | approved | on | controller copy, owner-delegated 2026-10-19 |
| Q13 | #23 sale inactive | "The presale is not open." | new | on | controller copy, owner-delegated 2026-10-19 |
| Q14 | #23 account blocked | "This account can't buy in the presale." | new | on | controller copy, owner-delegated 2026-10-19 |
| Q15 | #23 stage moved | "Price changed — review again" | approved | on | controller copy, owner-delegated 2026-10-19 |
| Q16 | #23 simulation refused | "The purchase could not be simulated." | approved | on | controller copy, owner-delegated 2026-10-19 |
| Q17 | #10 reason line | "Re-auth required for your first presale purchase from this account." | new | on | controller copy, owner-delegated 2026-10-19 |
| Q18 | #10 header | "Confirm buying NOC with <amount> <CUR>" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q19 | #23 no SOL price | "SOL price unavailable — pay with USDC or USDT, or try again later." | new | on | controller copy, owner-delegated 2026-10-19 |
| Q20 | #50b open variant headline | "NOC presale is open in your region" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q21 | #50b sanctioned sub | "This wallet doesn't offer the presale in your region. You can still hold, send and receive any NOC you already have." | new | on | controller copy, owner-delegated 2026-10-19 |
| Q22 | #50b sanctioned reason sub | "Checked by this wallet against the restricted-region list" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q23 | #50b headline, a fail-closed reason | "The presale can't be opened right now" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q24 | #50b reason head, fail-closed | "Region check required" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q25 | #50b reason sub, fail-closed | "The presale opens only after a successful check against a current list" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q26 | #50b sub, unknown country | "Your region could not be determined from your IP." | approved ("unknown country") | on | controller copy, owner-delegated 2026-10-19 |
| Q27 | #50b reason sub, 403 | "Noctura's server did not answer requests from this network" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q28 | #50b info banner sub | "Token sales are restricted by jurisdiction · this wallet checks before every purchase" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q29 | #50b info line | "If the restricted-region list changes, this screen lifts on its own." | new | on | controller copy, owner-delegated 2026-10-19 |
| Q30 | #50b what still works | "View balances" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q31 | #21 / #26 badge | "Presale" | approved | on | controller copy, owner-delegated 2026-10-19 |
| Q32 | #21 / #44 / #54 amount line, purchase | "Buying NOC with <amount> <CUR>" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q33 | #11 / #26 pending row, purchase | "Buying NOC · pending" / "Buying NOC · taking longer than usual" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q34 | #27 purchase, not recorded | "Recorded on chain; presale service not yet updated" | approved | on | controller copy, owner-delegated 2026-10-19 |
| Q35 | #24 REFERRALS sub | "total joined" | app | on | controller copy, owner-delegated 2026-10-19 |
| Q36 | #24 third stat | "REFERRED" / "from your invites" | app | on | controller copy, owner-delegated 2026-10-19 |
| Q37 | #24 code eyebrow | "YOUR INVITE LINK" | app | on | controller copy, owner-delegated 2026-10-19 |
| Q38 | #24 copy states, also "Share invite link" | "Copied" / "Copy failed" | B1b (`useCopy`) | both | controller copy, owner-delegated 2026-10-19 |
| Q39 | #24 info banner | "Earn NOC when friends you invite buy in the presale." | D13 | on | controller copy, owner-delegated 2026-10-19 |
| Q40 | #23 limit lines | a "Minimum $<min>" · b "Maximum $<max> per transaction" · c "Above your presale limit — you can buy up to $<remaining> more" | a, b core; c new | on | controller copy, owner-delegated 2026-10-19 |
| Q41 | #23 balance lines | a "Insufficient <CUR> balance" · b "Need a little SOL for the network fee" · c "Your <CUR> is split across accounts — at most <n> <CUR> in one purchase" · d "Keep at least 0.00089088 SOL, or buy with less" | a, b core; c, d new | on | controller copy, owner-delegated 2026-10-19 |
| Q42 | any build, a wallet record of a kind the build cannot show (C19) | a "Transaction · pending" / "Transaction · taking longer than usual" (#11 and #26 pending rows) · b "Transaction" (#21, #44, #54 amount line; no amount, no recipient) | new | both | controller copy, owner-delegated 2026-10-19 |
| Q43 | #23, the account changed since prepare (C22) | "Your presale account changed — review again" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q44 | #20 purchase, #19's facts (C33) | "Simulated at slot <N>" · "Programs" / "Compute Budget · Noctura presale" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q45 | #23a referral field (D8) | label "Referral address (optional)" · placeholder "Solana address of the person who invited you" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q46 | #23a referral field lines | a "Not a valid Solana address" · b "You can't refer yourself or another account in this wallet" · c "This address has no presale allocation, so it can't receive a referral bonus" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q47 | #20 / #10 referrer row | "Referred by" · note when this purchase registers it: "Saved to your presale account with this purchase. It can't be changed later." | new | on | controller copy, owner-delegated 2026-10-19 |
| Q48 | #23, the referrer can no longer apply | "This account can no longer take a referrer — review again" | new | on | controller copy, owner-delegated 2026-10-19 |
| Q49 | #48 F12 banner head (D9) | "Presale purchase blocked" | new | both | controller copy, owner-delegated 2026-10-19 |
| Q50 | #48 F12 banner body | a (sanctioned) "This transaction buys NOC in the presale, which this wallet doesn't allow from your region (<Country>)." · b (any fail-closed reason) "This transaction buys NOC in the presale. The wallet's region check did not succeed, so it can't be approved — try again later." (c removed in rev 3, D15) | new | both | controller copy, owner-delegated 2026-10-19 |
| Q51 | #48 F12 banner meta | "Only Reject is available · no override" | new | both | controller copy, owner-delegated 2026-10-19 |
| Q52 | #23, the destination moved twice during prepare (C39) | "The presale is busy right now — try again." | new | on | controller copy, owner-delegated 2026-10-19 |

---

## 11. Reviews

### Review 1 (Fable 5.1) → rev 2

| finding | where it landed |
|---|---|
| H1 the shared pending store drops a `presale-buy` record | §1.3 "Pending records" (three validator shapes, `inFlightFor`, `viewOf`, the five screens), C10, C19, §2.3, §6.1 "Shared shapes", E2E 7; plan 1a |
| H2 the money's arrival at the pinned destination is unchecked | C28, §2.1 snapshot rules 7–8, §3.3 step 5 (destination Δ exact, one retry for a busy destination), §6.1 "Simulation checks", §8.1 |
| M1 the switch cannot work in a module service worker | C4, §1.1 (the `presaleSwitch` plugin, three stubs, `presaleFlag`, no `import()`), §6.1 "Switch" |
| M2 the gate's module set is wrong today and open-ended | `core/solana/encoding.ts` (§1.2, §6.2), C38 allowlist, §6.2 item 1 with the 0b79442 fixture self-test |
| M3 23b re-runs the full view and a closed gate hides an open purchase | C30, C17, §1.4 `presale.pending`, §2.5 (`pending` in every variant), §4.1 precedence and 23b, §4.5, §5, §6.1 "Screens", E2E 4 |
| M4 `beforeSign` unordered against the take and the proof | C29, §1.3 `sendPrepared` steps 1–5, §3.3 last paragraph, §5 `geo-closed`, §6.1 "Pipeline order" |
| M5 resume paths for a purchase | §4.2 "Resume paths", `presaleSlots` (§1.1), §6.1 "Resume", E2E 8 |
| M6 P2 confirmed: retry double-counts, amounts are the client's | §7 P2a (B1d-2 blocker) and P2b (urgent, not blocking), C24, §2.4 — owner decision D11 |
| M7 #19's omission undeclared | C33, §3.3 step 7 (`simulation` facts), §4.2 #20, §9 row, Q44 |
| M8 geo bodies parsed too strictly | C34, §2.2 (required keys, nulls, unknown keys ignored), §6.1 "Geo" |
| L1 wrong test vector | §6.1 "Limits" (`666 222 518 321`, stage 9 `285 795 941 697`) |
| L2 account index base | C37, §3.3 account lists, §3.3 step 4, §6.1 "Build", E2E 2 |
| L3 stage moved before the simulation | §3.3 step 5 (`price-changed`), §5, §6.1 |
| L4 `paymentAmount` type | §2.4 (decimal string; core widens to `number \| string`), §8.2 |
| L5 sign-time re-read of the user's PDAs | C22, §5 (`blocked`, `above-user-limit`, `state-changed` at sign), §6.1 "Sign time", Q43 |
| L6 dollar re-auth source | C36, §3.4, §6.1 "Re-auth" |
| L7 accepted limits of a lying proxy | §8.1 |
| L8 24a-bis checkmark and border | §4.4, §9 row |
| L9 quote window vs the 30 s re-read | C35, §4.1 (25 s) |
| L10 tests to add | §6.1 (`Intl.DisplayNames`, #44 / #54, `presale.banner` nulls, the off-build constant), §6.2 reproducible both builds |
| L11 the two configs must name the same flag | §1.1 `presaleFlag`, §6.1 "Switch" (both configs, both values) |
| L12 header dates | the header's "Ledger" |
| Owner Q1 → D7 minimum | §2.1 `minCents`, §3.2, §9, §6.1 "Limits" |
| Owner Q2 → D11 P2 | §7 P2a / P2b, C24, header (B1d-2 blocked by P2a) |
| Owner Q3 → D8 referrer field | C7, C32, §1.4, §2.5 `referral`, §3.3, §3.5, §4.1, §4.2, §5, §6.1, E2E 12, §9, Q45–Q48 |
| Owner Q4 → D9 dApp path | C31, §3.6 (F12), §1.1, §6.1 "F12", §6.2 item 3, E2E 9, §6.5, §8.1, §9, Q49–Q51 |
| Owner Q5 → D10b three plans | header table, §1.2, §8.2, §6.1, §6.3, §6.5, C26, §9 |
| Owner Q6 → D12 web/app unchanged | C14, §8.1 |
| Owner Q7 → D13 Q39 | §10 Q39, §9 |
| Owner Q8 → D14 copy | §10 (final, Q01–Q51 without gaps (rev 3: Q01–Q52), every row "controller copy, owner-delegated 2026-10-19") |

### Review 2 → rev 3 (Fable 5.1, with owner decision D15)

| finding | where it landed |
|---|---|
| M1 the busy-destination retry underspecified | C39, §3.3 step 5 (same bytes, the fresh snapshot replaces the first for everything, all of step 5 re-run, the entry stores the second), §5, §6.1 "Retry" |
| M2 the 1a gates cannot be green at the end of 1a | §1.1 (the three on-path entries as 1a skeletons), §6.2 items 1–2 (positive controls staged per plan), §8.2, header table |
| M3 #23a's 25 s re-read through the Send-disabling latch | C35, §1.4 `presale.view {refresh: 'gate'}`, §4.1 (two requests per re-read, balances on mount / focus / currency change / confirmation, paused while hidden), §7 P3 (per-IP budget per route), §6.1 "#23 request budget" |
| L1 Q16 untrue after two busy simulations; stale-slot answers | `presale-busy` + Q52, C39 (a simulation slot below the snapshot's is not retried), §5 |
| L2 `presale.quote` empty/zero contradiction | §3.2 (the popup never asks; the background answers `malformed`) |
| L3 #50b Got it after a replacement | §4.3 (→ #11 when #50b replaced #23; renders first from the routed view) |
| L4 rule 7's System ownership | §2.1 rule 7 — verified from the records (System-owned, 0 bytes; Squads v4 vault with executed transfers), kept with a one-time live re-read in 1a |
| L5 fixture provenance; the marker source self-test | §6.2 item 1 (built from 0b79442 by the 1a plan, commit named in the file), item 2 (the scan itself is the detector) |
| L6 the country name in the approve window | §3.6, §4.3 — shared `src/app/ui/regionName.ts` |
| L7 F12's sort, parser and `txRefused` row | §3.6 "Where it plugs in" (three-way severity rank, the parser, `KIND_ORDER`) and "Approval" (after `simulation-failed`), §6.1 "F12" |
| L8 pool exhaustion | C32 — **corrected**: the pool counter is shared with admin giveaways (`lib.rs:723-770`), so exhaustion is reachable by admin action; still no rule (the bonus is skipped, the buyer is unaffected) |
| L9 rule 4's order | §2.1 rule 4 (stated as load-bearing, with the write sites) |
| L10 E2E 7 tests 1a's code | §6.3 (E2E 7 runs in 1a), header table |
| L11 the sign-to-land referrer race | §5 row (`AlreadyHasReferrer`, #44 `landed`) |
| Owner Q1 → D15 the gate in both builds | D15 row, C31, C38, §1.1, §1.2 (`src/background/geo/gate.ts`), §2.2, §3.6 (no hook, no `not-in-build`), §6.1 F12 in `vitest.nopresale`, §6.2 (`core/geo/**` allowed, present in both builds), §6.3 E2E 9, §6.5, §8.1, §8.2, §9, Q50c removed |
| Owner Q2 → controller ruling: F12 in 1b | header table, §3.6 "Plan" |
