# Noctura Extension B1d — presale in the extension (buy, allocation, referral, jurisdiction gate)

**Status:** **draft rev 1** — owner-approved design (sections 1–4), next: Fable review. The owner approved the design
in conversation section by section (`.superpowers/sdd/b1d-approved-design.md`, approach A) and took decisions D1–D6
(`.superpowers/sdd/b1d-owner-decisions.md`). Everything this spec adds beyond that text is a controller ruling (C1–C27
below) or a string in §10 (Q01–Q42), each flagged for the owner. Research map: `.superpowers/sdd/b1d-context.md`; every
fact used here was re-read from the code it cites on 2026-10-18 (§8.2 lists where).

**Owner rule kept throughout:** no TGE date, no countdown and no relative time-to-TGE anywhere — not in a string, a
test, a fixture, a comment or this document. The design files contain the date; nothing here was copied from those
lines. The only TGE copy is D5's "Claimable after TGE". The config account's `tge_timestamp` field is never read by B1d
(§2.1).

**What this is.** The extension sells NOC in the presale to the user's own account, on mainnet: the design's #23 presale
(23a active, 23b pending, and an allocation row), #24 referral (as the Android app corrected it), #50b region blocked
(presale variant) and the #11 presale banner with the Buy quick action (`/home/user/Downloads/index.html` ix 10603-10902,
10903-11233, 19612-19906, 6272-6621; `screen.md` §11, §23, §24, §50). A purchase is a new intent in B1b's send pipeline
(approach A): the background builds it with `core/presale`, simulates it, shows it on #20, asks #10 when a rule says so,
records it in `v1_pending` before the existing broadcast route, and follows it on #21 and #26. It realises B1 spec §4
"Presale in the extension" (`2026-09-27-extension-b1-design.md`), which stays binding where this spec does not refine it;
every refinement, and every design element not built as drawn, is a row in §9.

**Built on** `main` at 0b79442 (B1c complete, PRs #110–#112). Transparent mode only. Mainnet only.

**One spec, two plans** (approved, section 4):

| plan | content |
|---|---|
| **B1d-1 — foundations** | the build-time switch `__NOCTURA_PRESALE__` and its gate (§6.2); the intent-kind registry that keeps the shared pipeline free of presale code (§1.3); account layouts generated from the pinned IDL (§2.1); `state.ts`; `core/geo/fetch.ts` + `geo.ts`; the `presale-buy` intent through quote, prepare (simulation), #20, #10, sign, `v1_pending`, broadcast and #21 (with the "Presale" badge); #23a, #23b and the allocation row; #11 banner + Buy; #50b with every reason; unit tests, gates, E2E 1–7 and the visual pass of these screens |
| **B1d-2 — referral and recording** | #24 and its #31 row; `POST /solana/purchase` after confirmation with background retry (`v1_presale_records`); the "Presale" badge on #26 and the unrecorded line on #27; E2E 8–9; the remaining visual pass |

**B1d-1 is a merge-to-`main` milestone, not a release (C26).** No build with presale on leaves the repository before
B1d-2 is on `main` (B1d-1 alone buys without recording the purchase for referral and stats). Whether a store build
carries presale at all is B1e's decision (D2).

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
| D6 | **Sanctions-list freshness:** the coordinator refreshes the OFAC list automatically (with `reviewed_at`); the owner's manual review for RU / CN / ZW stays — an ICO-side precondition before B1d ships | §7 |

### Controller rulings (most secure default, stated; C1–C27)

C1 and C2 are the two rulings recorded with the owner's decisions; the rest are this spec's. "B1c's C13" means B1c
spec's ruling C13 ("the window decides nothing"), which the approved design cites as "the background decides".

| # | ruling | why |
|---|---|---|
| C1 | **#24 follows the Android app's corrected version** (`src/screens/referral/ReferralScreen.tsx`): the address is the code; no copy without an on-chain or coordinator source | owner-recorded ruling |
| C2 | **Stablecoin purchases spend from the actual holding account** (`selectSourceTokenAccount`, the largest one), not the derived ATA. The program constrains the payer account's owner and mint only (ICO `lib.rs` `stablecoin_ata_for_user`: `mint ∈ {config.usdc_address, config.usdt_address}`, `owner == user`) | owner-recorded ruling; memory "non-canonical token accounts" |
| C3 | **The background is the only decider** (B1c's C13): every `presale.*` input from the popup is untrusted; the popup shows only what the background returns and computes no amount, limit, price or gate itself | approved §1 |
| C4 | **The switch is one compile-time constant**, `__NOCTURA_PRESALE__`, substituted by Vite's `define` from `scripts/build.mjs`; presale code is reachable only through `if (__NOCTURA_PRESALE__)` branches, so Rollup drops it from the off build (§1.1) | "not one line of presale code in the bundle" must be checkable, not hoped |
| C5 | **The treasury is pinned as well as read.** `config.sol_treasury` must equal `MAINNET_SOL_TREASURY`, `config.usdc_address` / `usdt_address` must equal `MAINNET_USDC_MINT` / `MAINNET_USDT_MINT`; otherwise the presale is unavailable. The stablecoin destination is `findAssociatedTokenAddress(config.sol_treasury, mint)` and must equal the pinned vault ATA (§2.1) and exist as a token account of that mint owned by `config.sol_treasury` | the admin key `KnZ5…` is a single, immutable key on one laptop (memory "mainnet key exposure"); a config change could redirect every buyer's money. A pin fails closed (the presale closes, nobody pays), which `core`'s "never a constant" concern (a stale constant makes purchases *fail*) does not contradict: we still read config, and refuse when it moves |
| C6 | **The per-user cap is a pinned program constant:** `PRESALE_MAX_TOTAL_PER_USER_USD = 20_000_000` cents ($200 000, ICO `lib.rs:36`, checked against `total_spent_cents` at `lib.rs:344-351`). The config has no field for it | approved "max per user minus the existing allocation", made exact: the program's cumulative cap is on cents spent, not on NOC |
| C7 | **No referrer capture in B1d.** A referrer already registered on chain is always honoured (`resolveReferrer(reader, user, null)`: the purchase passes that referrer's allocation PDA, as the program requires); a new one is never registered (`register_referrer` is never built) | an extension has no capture channel (no deep link, no page reading) and the design draws no referral field on #23; B1 §4's "a captured referrer applied" is refined in §9 |
| C8 | **Without a SOL price, SOL is not offered** (Buy disabled, Q19); USDC and USDT still are | a SOL purchase's limits and estimate need a price; the program prices at Pyth, but a wallet that cannot say what $ amount the user is spending must not offer it |
| C9 | **MAX keeps the paying account rent-exempt:** SOL MAX = balance − network fee − rent of the PDAs this purchase creates − `SYSTEM_ACCOUNT_RENT_LAMPORTS` (890 880), then capped by the limits; stablecoin MAX = the largest holding account, capped by the limits | approved "MAX for SOL leaves fees and rent"; a wallet that empties itself cannot pay its next fee |
| C10 | **One in-flight transaction per account, a purchase included.** B1b's `inFlightFor` counts a `presale-buy` record like a send: neither a send nor a purchase is built while either is open | approved "one in-flight presale-buy per account", via the rule that already exists — stricter, one rule |
| C11 | **The simulation is checked exactly** (§3.3): SOL out = amount + fee + new-PDA rent; the source token account loses exactly the amount; `total_spent_cents` rises by Δc and `total_tokens` by exactly `tokensFor(Δc, stage)`; `purchase_count` by 1 | approved "outflow equal to the entered amount (+ fee) and an allocation increase", made testable; rent is the refinement (two `init_if_needed` PDAs, ICO `lib.rs:2904-2919`) |
| C12 | **Geo:** `/geo/check` is fetched on every #23 mount, every prepare and every signature; the list is cached ≤ 10 minutes, its freshness evaluated against the clock every time; **either fetch failing is `no_check`**; the extension bundles no fallback list | approved "re-checked on every #23 mount and before every signature"; a bundled list always counts as stale (B1 §4), so carrying one buys nothing |
| C13 | **The NOC valuation for B1b's dollar rule (`deps.stagePrice`, `/stats`) is unchanged.** It is not presale code and exists in both builds | moving it to `state.ts` would put presale code in the off build |
| C14 | **`core/geo/fetch.ts` is used only by the extension in B1d.** Moving web and the app onto it changes *their* purchase gates (web ignores staleness today) and is a separate change | approved "the fetcher goes into core/geo for web and app too": it lives where they can adopt it; adopting it is flagged to the owner (§8.1) |
| C15 | **"Share invite link" copies the link** (`useCopy`, B1b's honest copy: "Copied" only when the clipboard accepted it). The popup has no share sheet | the design's Android `ACTION_SEND` has no popup equivalent; `navigator.share` is absent on Linux Chrome and Firefox desktop |
| C16 | **#24 is reached from a #31 Settings row "Refer a friend"** (the app's entry, Profile → Settings) | the design's "[More] menu" does not exist in the popup |
| C17 | **#23 shows 23b while the active account has an open `presale-buy` record** (`pending` or `stuck`); #21's Done after a purchase returns to #23 | the design's states are backend-driven; ours is `v1_pending` |
| C18 | **"Not available in your region?" opens #50b with the current answer**, an "open" variant (Q20) when the gate is open | the link is drawn always visible; the app made #50 region-accurate (memory "geo gate") |
| C19 | **The shared pipeline knows kinds, not presale.** Prepared entries, re-auth challenges and pending records carry a `kind`; `send` is registered always, `presale-buy` only under the switch (§1.3). A stored entry whose kind has no handler is refused at signing; a pending record whose kind has no handler is still polled and shown generically (Q42) | the off build must not contain presale code, yet an update that turns presale off must not hide or orphan a signed purchase |
| C20 | **The currency choice is the design's unit label made a selector:** it opens B1b's token sheet (#43) limited to SOL, USDC and USDT | keeps 23a's drawn layout (input + unit label + MAX) |
| C21 | **"First purchase from this account"** = the allocation PDA is absent or its `purchase_count` is 0, read in the same state read as the purchase | D3, from chain; an unreadable PDA closes the presale anyway (§2.1) |
| C22 | **A config re-read at signing:** `presale.buy` re-reads config (one `getAccountsData`) and refuses if `presale_active` is false, the stage moved from the prepared one (Q15), or C5's pins fail | a transaction the program would reject still pays its fee if broadcast |
| C23 | **Program errors in a simulation map to fixed codes** (§3.3, `Custom` 6002, 6020–6024); anything else is "The purchase could not be simulated." | the program is authoritative for SOL limits (it prices at Pyth) |
| C24 | **Recording:** after a purchase confirms, the background POSTs it once, then retries at 1 min, 5 min, 30 min, 2 h, 12 h and every 24 h until 72 h after confirmation, through the shared 403 latch; `v1_presale_records` in `storage.local` (§2.4) | approved "retried with backoff capped at a few days", made exact |
| C25 | **A purchase carries no Noctura fee:** the markup policy (`feePolicy.ts`) is not applied to a `presale-buy`; #20's fee rows are network, priority and account setup (rent) | the markup is a transfer fee (B1 decisions table); a purchase is not a transfer |
| C26 | **B1d-1 is a merge-to-`main` milestone, not a release** | as B1c's D10: plan 1 buys without recording (header) |
| C27 | **The stage the user saw travels with the intent** (`{currency, amount, stage}`, the design's `{op:'presale-buy', amount, stage}`); prepare refuses a mismatch with Q15 and the popup re-reads the view | approved "a stage change between view and click → refusal 'Price changed — review again' + new simulation" |

---

## 1. Architecture

```
popup (#11 #23 #24 #50b #20 #21 #26 #27)       — shows what the background answers; decides nothing (C3)
        │ runtime.sendMessage  presale.*  (privileged partition, popup/tab only)
background
  ├─ presale/  (only when __NOCTURA_PRESALE__)  state.ts · geo.ts · quote.ts · buy.ts · record.ts · layouts.ts · api.ts
  ├─ intents.ts  kind registry  (send always; presale-buy registered by presale/api.ts)
  └─ B1b pipeline: prepared entries (storage.session) → #10 challenge → sign → v1_pending → broadcast route → poller
        │ through the shared 403 latch (deps.ts): /rpc (getAccountsData, getTokenAccountsByOwner, simulateTransaction, …),
        │ /tx/broadcast, /geo/check, /geo/restricted-list, /referral-stats/:address, POST /solana/purchase
unlock.html (#10)  — renders the background's description of a presale-buy challenge; nothing untrusted
```

### 1.1 The build-time switch (D2, C4)

- **The constant.** `__NOCTURA_PRESALE__: boolean`, declared once in `extension/src/features.d.ts`, substituted by
  Vite's `define` (`'__NOCTURA_PRESALE__': JSON.stringify(on)`) in **both** `vite.config.ts` and
  `vite.content.config.ts` (the content scripts never contain presale code; a stray reference there compiles to `false`,
  never to a runtime `ReferenceError`). `vitest` runs with it `true`; a second config, `vitest.nopresale.config.ts`,
  runs the named off-build test files with it `false` (§6.1 "switch"), both in `npm run test`.
- **The selector.** `node scripts/build.mjs [outDir] [--no-presale]`. Default **on** (approved: "Default on for B1d
  builds"). `--no-presale` sets the constant `false`. The flag is passed to every `vite build` the script runs.
  `build.mjs` writes `<outDir>/app.features.json` = `{"presale": true|false}` next to `app.modules.json` (never inside
  `app/`), which the gates read to know what they scan.
- **Reachability.** Presale modules are imported only inside `if (__NOCTURA_PRESALE__) { … }` (background
  registration in `src/background/index.ts`, popup routes in `src/app/presale/index.ts` loaded from the router, the
  #10 description in `src/unlock/presale.ts`). No other module imports them; `check-no-presale.mjs` proves it from the
  module map, with a positive control (§6.2).
- **What does not change with the switch:** the manifest (no new permission, host or CSP entry in either build); B1b's
  history row "Presale purchase" and #27's "PRESALE PURCHASE" (a website purchase must still read correctly in the
  off build); B1c's presale instruction decoder (`dapp/decode/presaleIdl.ts`) and its F2 treatment of the website's
  purchases; `deps.stagePrice` (C13).
- **Off build behaviour:** no #11 banner, no Buy, no #31 "Refer a friend" row, no presale routes; every `presale.*`
  message is refused as an unknown type (`messages.ts`: "Any message type outside both lists is refused").

### 1.2 Background modules (`extension/src/background/presale/`)

| module | does |
|---|---|
| `layouts.ts` (generated) | the three account layouts from the pinned IDL (§2.1) — written by `scripts/gen-presale-idl.mjs`, never by hand |
| `state.ts` | one `getAccountsData([config, userAccount, userAllocation])` through the proxy → `PresaleState` (§2.1); every check fails closed |
| `geo.ts` | `core/geo/fetch.ts` + `presaleGeoGate` → `GeoAnswer` (§2.2) |
| `quote.ts` | the estimate, MAX and the limit line from the last snapshot (§3.2) — no network |
| `buy.ts` | `presale-buy` intent kind: parse, digest, prepare (build + simulate + checks), sign-time checks, #10 description (§3.3) |
| `record.ts` (B1d-2) | the coordinator record and its retry (§2.4) |
| `referral.ts` (B1d-2) | #24's data (§4.4) |
| `api.ts` | the `presale.*` handlers (§1.4); registers `presale-buy` in `intents.ts` |

`core/` gains: `core/geo/fetch.ts` (`fetchGeoInputs(get: JsonGetter)`, §2.2) and `core/presale/limits.ts` (bigint:
`usdCentsForStable`, `tokensFor`, `checkLimits`, §3.2). `deps.ts` gains `createJsonPoster(fetch, latch)` (B1d-2) —
generic, beside `createJsonGetter`, the one place allowed to call the global fetch (`check-rpc-methods.mjs`).

### 1.3 The intent-kind registry (C19)

`extension/src/background/intents.ts`: `registerIntentKind({kind, parseIntent, intentDigest, describe, beforeSign})`.
B1b's `send` registers itself unconditionally; `presale/api.ts` registers `presale-buy`.

- `PreparedSend` gains `kind: string`; `intent` becomes the kind's parsed intent. `preparedIntegrity` and the challenge
  digest include `kind`. `wallet.preparedFor` returns only `kind: 'send'` entries; `presale.preparedFor` only
  `presale-buy`. **Every prepare, of any kind, replaces every prepared entry of that account** (today's rule in
  `prepareSend`, extended across kinds), so an account has at most one prepared entry.
- `sendPrepared` (sign + submit) is kind-agnostic: it looks the kind up, refuses `prepared-invalid` when none is
  registered, runs the kind's `beforeSign` (presale: C12 geo, C22 config re-read), then the unchanged
  `signPrepared` → `submitSigned`. The 30 s TTL, single-use `takePrepared`, integrity check and challenge consumption
  are unchanged.
- `PendingRecord` gains `extra: {kind: string; data: unknown} | null` (null for a send and for a dApp record).
  `presale-buy` stores `{currency, amount, stage, priceTicks, nocBase, spentCents, treasury}` (§2.3) — display only,
  validated by the presale module when read; a value it cannot parse shows as the generic row (Q42), and the record
  is never dropped (B1b: "a pending send must never be hidden").
- `inFlightFor` counts every wallet-own record (C10). The poller, expiry, same-bytes resend (#54) and #44 are
  kind-agnostic and unchanged.

### 1.4 Messages (privileged partition, from the popup and the full tab only)

Added to `PRIVILEGED` only under the switch; `approve.html` and `unlock.html` may send none of them (B1c's inclusive
list for `approve.html` stands; the vault page reads a presale challenge through the existing `vault.challengeInfo`).

| type | payload | answer |
|---|---|---|
| `presale.view` | `{account}` | `PresaleView` (§2.5) — a fresh state read **and** a fresh geo check (C12) |
| `presale.banner` | `{}` | `{stage, priceTicks, stagePercent}` or `null` — the last config snapshot ≤ 60 s old, else a config-only read (§2.1 rules 1–4); **no geo check**; `null` on any failure or an inactive sale |
| `presale.quote` | `{account, currency, amount: string \| 'max'}` | `Quote` (§3.2) from the last `presale.view` snapshot of that account ≤ 30 s old; older → `{stale: true}` |
| `presale.prepareBuy` | `{account, intent: {currency, amount, stage}, challengeId?}` | `PurchaseView` (§3.3) or a refusal code (§5) |
| `presale.preparedFor` | `{account}` | the newest `presale-buy` prepared entry's view, `expired` as B1b's `wallet.preparedFor` |
| `presale.buy` | `{id}` | `PendingView` or a refusal code; via the kind-agnostic `sendPrepared` (§1.3) |
| `presale.discardPrepared` | `{account}` | B1b's `discardPrepared` (all of the account's entries and their challenges) |
| `presale.referral` (B1d-2) | `{account}` | `ReferralView` (§4.4) |
| `presale.unrecorded` (B1d-2) | `{account}` | the signatures of this account's confirmed purchases not yet accepted by the coordinator |

Every payload is parsed strictly (extra keys, a non-address `account`, an amount not `^[1-9]\d{0,19}$` or above u64,
a currency not in `{SOL, USDC, USDT}`, a stage not an integer 0–9) → `malformed`. `account` must be in the unlocked
session → else `locked` / `unknown-account`.

---

## 2. State

### 2.1 The program state (`state.ts`, D4)

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
`presaleIdl.ts` (B1c) is unchanged. The fields B1d reads, as generated (offsets checked against the IDL on 2026-10-18):

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

**The read.** `state.ts` derives `config`, `["user", account]` and `["allocation", account]` (`derivePresalePdas`) and
reads all three with one `getAccountsData` (an allowed proxy method; no new RPC method). `PresaleState` is valid only
when **all** hold; otherwise it is `{unavailable: <code>}` and the presale is closed:

1. Config present, owner = the presale program, length = 370, discriminator = Config's; **positional controls**
   `admin@8 = MAINNET_ADMIN_ADDRESS` and `sale_token@40 = MAINNET_NOC_MINT` (as `readSolTreasury`).
2. **C5 pins:** `sol_treasury = MAINNET_SOL_TREASURY`, `usdc_address = MAINNET_USDC_MINT`, `usdt_address = MAINNET_USDT_MINT`.
3. `presale_active` byte is 0 or 1 (anything else: malformed); `current_stage` ∈ 0…9 (a known stage).
4. `presale_active = 1`, `presale_start_time ≤ now` (UTC seconds) and `tokens_sold < 102 400 000 × 10⁹` (the
   program's hard-cap check) — else `{inactive}` (Q13), a valid read of a closed sale. While active,
   `stage_tokens_sold < 10 240 000 × 10⁹` (the program advances the stage before it could reach it) — else malformed.
5. User account: absent, or owner = program, length 58, discriminator = UserAccount's, `is_blocked` 0 or 1;
   `is_blocked = 1` → `{blocked}` (Q14).
6. Allocation: absent (`exists: false`, totals 0), or owner = program, length 117, discriminator =
   PresaleAllocation's, `user@8 = account` (the positional control of `fetchOnChainAllocation`), `claimed` 0 or 1.

Any failed read (403, timeout, unreachable, an RPC error) → `{unavailable: 'read-failed'}` or `'refused'` (a 403 or
the latch's cool-down); any other failed rule → `{unavailable: 'malformed'}`. **Never open on doubt.**

**Derived values** (bigint; USD as integer cents; price in the program's own unit, ten-thousandths of a dollar):

- `stage` = `current_stage` (0-indexed); display stage = `stage + 1`, "of 10".
- `priceTicks` = `STAGE_PRICES[stage]` — the program's table (ICO `lib.rs:42-53`), identical to
  `core/presale/stagePrices.ts` as ticks `1501 … 3499`. `core/presale/limits.ts` gains `STAGE_PRICE_TICKS` (bigint)
  with a test that it equals `PRESALE_STAGE_PRICES × 10 000` element by element. `nextPriceTicks` = the next entry, or
  null at stage 9.
- `minCents` = `min_purchase_usd` if > 0 else 2 500; `maxTxCents` = `max_per_user_usd` if > 0 else 5 000 000 (the
  program's fallback rule, `lib.rs:333-334`, `2414-2415`; the field `max_per_user_usd` is a per-transaction limit
  despite its name). Read 2026-09-21: `min_purchase_usd = 1000` ($10), `max_per_user_usd = 0` ($50 000)
  (`core/presale/purchaseGate.ts:8-20`). Never restated as constants in B1d.
- `userRemainingCents` = 20 000 000 − `total_spent_cents` (C6), floored at 0.
- `firstPurchase` = allocation absent or `purchase_count = 0` (C21).
- `newPdaRent` = 1 294 560 lamports if the user account is absent + 1 705 200 if the allocation is absent — rent-exempt
  minimums `(128 + length) × 6 960` for lengths 58 and 117, the same formula that gives the existing
  `SYSTEM_ACCOUNT_RENT_LAMPORTS` (890 880 for 0 bytes) and `TOKEN_ACCOUNT_RENT_LAMPORTS` (2 039 280 for 165). New
  constants `PRESALE_USER_ACCOUNT_RENT_LAMPORTS`, `PRESALE_ALLOCATION_RENT_LAMPORTS` in `core/presale/limits.ts`, each
  with that formula as its test (`getMinimumBalanceForRentExemption` stays off the proxy's allowlist).
- `referrerAllocation` = `resolveReferrer(reader, account, null)` from the allocation already read (C7).

### 2.2 The jurisdiction gate (`geo.ts`, B1 §4, C12)

`core/geo/fetch.ts` — `fetchGeoInputs(get: JsonGetter): Promise<{location, list}>`:

- `GET /geo/check` → `{countryCode: string, isVpn: boolean}` exactly (no envelope — the live contract, `web/src/geo/useGeo.ts`);
  any other shape throws `GeoMalformed`.
- `GET /geo/restricted-list` → `{success: true, data: {countries: [{code, category}], updated_at, reviewed_at,
  max_staleness_days, stale}}` (coordinator `restrictedList.js`); `countries` non-empty, each `code` `^[A-Z]{2}$`,
  `category ∈ {sanctioned, restricted}`; otherwise `GeoMalformed`. Mapped to `ListMeta {source: 'server', updatedAt,
  reviewedAt, maxStalenessDays, serverStale}`.

`geo.ts` decides, in this order:

| condition | `GeoAnswer.reason` |
|---|---|
| either GET answered 403, or the shared latch is cooling down | `refused` |
| either GET failed otherwise (timeout, unreachable, non-200, `GeoMalformed`) | `no_check` |
| `presaleGeoGate({freshness: evaluateListFreshness(meta, now), location, restricted})` | its own `stale_list` / `no_check` / `unknown_country` / `sanctioned` / `null` (open) |

`presaleGeoGate` (`core/geo/freshness.ts:132`, tested, unused until now) already encodes B1 §4: missing or unparsable
dates are stale, a date more than a day in the future is unparsable, a server `stale: false` never overrides a locally
computed age, an unknown or empty country (not `^[A-Z]{2}$`, or `XX` / `ZZ`) closes, and a sanctioned country closes
whatever `isVpn` says (`sanctionedWinsOverVpn`; `isVpn` is always `false` today — B1 §5 coordinator answer 5 — and is read as nothing).
A `restricted` country is open (OFAC-only policy, `classify.ts` `isPresaleBlocked`). The list is cached in the worker's
memory ≤ 10 minutes; `/geo/check` is never cached. `GeoAnswer` = `{open, reason, countryCode | null}`.

### 2.3 The purchase in `v1_pending`

A `presale-buy` record is a B1b `PendingRecord` with `intent: null`, `origin: null`, `firstBroadcast: 'done'`, `fee`
as prepared (network part; markup `'0'`, C25) and `extra = {kind: 'presale-buy', data: {currency, amount, stage,
priceTicks, nocBase, spentCents, treasury}}`: what was paid (base units), the stage and price it was simulated at, the
simulated NOC (`Δtotal_tokens`) and cents (`Δtotal_spent_cents`), and the treasury (or vault ATA) it pays. All
decimal strings. Shown by #23b, #21, #26 and #27; never used to decide anything.

### 2.4 The coordinator record (`record.ts`, B1d-2, C24)

`storage.local` `v1_presale_records`, background-owned (added to `BACKGROUND_OWNED_KEYS` and to `WALLET_DATA_KEYS`:
wiped by a wallet delete, kept by a restore), at most 50 entries (the oldest given-up entry dropped first):
`{signature, account, payload, confirmedAt, attempts, nextAt, state: 'due' | 'done' | 'given-up'}`.

- Written when the poller sees a `presale-buy` record reach `confirmed` (a hook in `presale/` the poller calls through
  the kind registry's `onConfirmed`). `payload` = core's `PresalePurchaseRecord`: `txHash` = the signature,
  `buyerAddress` = the account, `paymentToken`, `paymentAmount` (display units, as a decimal string the coordinator
  accepts), `nocAmount` and `usdValue` (the simulation's `nocBase` / `spentCents` converted to the coordinator's
  decimal numbers at this edge only), `stage` (1-indexed), `referrerAddress` (the on-chain referrer or absent).
- Sent through `createJsonPoster` (B1d-2: POST JSON to a bare path under `API_BASE`, through the shared latch,
  `REQUEST_TIMEOUT_MS`). `200` with `success: true` → `done`. Any other answer → the next slot of C24's schedule; a 403
  trips the latch and the entry waits for the cool-down (never retried inside it); past 72 h after `confirmedAt` →
  `given-up`. An `alarms` alarm (`presale-record`, existing permission) wakes the worker at `min(nextAt)`.
- Never more than one POST in flight; never two POSTs for one signature within a slot. Idempotency by signature is the
  coordinator's (§7 P2).
- The purchase stands on chain whatever the record's state; nothing in the popup says it failed. #27 says Q34 while the
  record is `due` or `given-up`.

### 2.5 What the popup receives (`PresaleView`)

```
PresaleView =
  | {open: false, why: 'unavailable', code: 'read-failed' | 'refused' | 'malformed'}
  | {open: false, why: 'inactive' | 'blocked', state: StageView}
  | {open: false, why: 'geo', geo: GeoAnswer, state: StageView | null}
  | {open: true, state: StageView, limits, allocation, balances, solUsdMicros | null, pending: PendingView | null}
StageView  = {stage, priceTicks, nextPriceTicks | null, stageSoldBase, stageCapBase, raisedCents}
limits     = {minCents, maxTxCents, userRemainingCents, firstPurchase}
allocation = {exists, totalBase, bonusBase}
balances   = {SOL: lamports, USDC: {largest, total}, USDT: {largest, total}}
```

All numbers are decimal strings of bigints. `pending` is the account's open `presale-buy` record (C17). The popup
renders from this and from `Quote`; it parses no account data and holds no constant of the program.

---

## 3. Features

### 3.1 The gate (approved §3, "fail closed")

The presale is **open** for an account only when all hold: the build has `__NOCTURA_PRESALE__`; the wallet is unlocked
and the account is in the session; `PresaleState` is valid (§2.1) with `presale_active`, a known stage and the account
not blocked; `GeoAnswer.open` (fresh list, known country, not sanctioned, both GETs answered). It is checked on every
`presale.view`, on every `presale.prepareBuy`, and before every signature (`beforeSign`: geo again and C22's config
re-read). Otherwise #23 offers no Buy and says why (§4.1, §4.3). The coordinator unreachable → closed; the wallet keeps
working (B1 §4).

### 3.2 Quote, limits and MAX (`quote.ts`, `core/presale/limits.ts`)

Integer arithmetic only (cardinal rule 2); every division floors, as the program's does.

- `usdCentsForStable(amount6)` = `amount × 100 / 10⁶` (the program's conversion, `lib.rs` stablecoin internal).
- SOL estimate: `usdCentsEstimate(lamports)` = `usdMicros(lamports, 9, solUsd) / 10 000` (B1b's `reauthPolicy.ts`
  helper; null without a price → C8). The program uses Pyth (≤ 120 s old); ours is `/wallet/prices` — an estimate,
  shown with "≈".
- `tokensFor(cents, stage)` = `cents × 10⁹ × 100 / STAGE_PRICE_TICKS[stage]` (the program's
  `calculate_tokens_for_usd`, `lib.rs:2793-2818`), NOC base units.
- `checkLimits({cents, minCents, maxTxCents, userRemainingCents})` → `null` | `below-min` | `above-max-tx` |
  `above-user-limit`: `cents < minCents`; `cents > maxTxCents`; `cents > userRemainingCents` — checked in that order.
- Balance lines: SOL needs `amount + networkFee + newPdaRent` ≤ balance and must leave 0 or ≥ 890 880 (B1b's
  `sender-below-rent` rule); a stablecoin needs `amount` ≤ the largest holding (`split-balance` when the total covers it
  and the largest does not; `insufficient-token` otherwise) and SOL ≥ `networkFee + newPdaRent` (`insufficient-sol`).
- `Quote` = `{amount, cents, nocBase, line: LimitCode | BalanceCode | 'no-sol-price' | null}`; `amount: 'max'` answers
  C9's MAX (capped by `maxTxCents` and `userRemainingCents` converted back — for SOL at our price, floored, then
  re-checked), or `line` when even MAX is below the minimum.
- Empty or zero input → `{line: null}` and Buy disabled (no nagging, as `canBuy`). `core/presale/purchaseGate.ts`'s
  float `canBuy` is not used by the extension (§9).

### 3.3 Prepare, simulate, sign (`buy.ts`, approach A)

`presale.prepareBuy {account, intent, challengeId?}`:

1. Session, account and **C10** (`in-flight` when an open record exists for the account).
2. Fresh `PresaleState` and `GeoAnswer` (§3.1). `intent.stage ≠ state.stage` → `price-changed` (Q15, C27).
3. Limits and balances (§3.2); refusal codes as §5. For a stablecoin, holdings via `getTokenAccountsByOwner(account,
   {mint})`; source = `selectSourceTokenAccount(holdings, amount)` (C2).
4. Build: `estimatePriorityFee(reader, 'normal')`, `getLatestBlockhash`, then `buildBuyInstructions(user, lamports,
   price, {referrerAllocation, registerReferrer: null}, treasury)` or `buildStablecoinBuyInstructions(…)` with
   `treasury = config.sol_treasury` (already pinned, C5). **The stablecoin builder gains a `sourceTokenAccount`
   parameter** (required, like `treasury`; the app and web pass their derived ATA, so nothing changes for them).
   `buy.ts` — not core, so web and the app keep their behaviour (C14) — asserts that the built instruction's account 6
   equals `MAINNET_VAULT_USDC_ATA` / `_USDT_ATA` and reads that account: it must be a classic SPL token account of that
   mint owned by `config.sol_treasury` (else `presale-unavailable`). Every compiled instruction's program is Compute Budget or the presale program; anything else
   is an engine bug (thrown, never shown).
5. Simulate with `accounts = [payer, userAllocation, source token account?]` (payer first, as B1b's `prepareSend`).
   Decide on `err` first (B1b §11.5): `{InstructionError: [i, {Custom: n}]}` on the presale instruction maps to
   6022 → `below-min`, 6023 → `above-limit` (the program uses one code for the per-transaction and the per-user
   maximum), 6002 → `blocked`, 6020 / 6021 / 6024 → `presale-closed`; B1b's rent refusal → `sender-below-rent`; any
   other error → `simulation-failed` (Q16). Then, with `err === null`, **all** of:
   - SOL spent by the payer = `(currency = SOL ? amount : 0) + newPdaRent + networkFee`, or that minus `networkFee`
     (B1b's two accepted readings);
   - stablecoin: the source token account after = mint, owner = account, `before − after = amount`;
   - the allocation after: PresaleAllocation layout and controls (§2.1 rule 6); `Δpurchase_count = 1`;
     `Δc = Δtotal_spent_cents > 0`; `Δtotal_tokens = tokensFor(Δc, stage)` exactly; for a stablecoin
     `Δc = usdCentsForStable(amount)` exactly; `Δc` passes `checkLimits`.
   Any failure → `simulation-mismatch` (Q16), never offered with a warning (approved §3).
6. Re-auth reasons (§3.4); challenge issued / re-based exactly as `prepareSend` (bound to the intent digest, which
   includes `kind`, `account`, `currency`, `amount`, `stage`).
7. Store the prepared entry (§1.3) and answer `PurchaseView = {id, currency, amount, stage, priceTicks, nocBase: Δtokens,
   spentCents: Δc, treasury, fees: {networkLamports, priorityLamports, rentLamports: newPdaRent}, reauth, validUntil,
   simulation: {slot, elapsedMs}}`.

`presale.buy {id}` → `sendPrepared` (§1.3) with `beforeSign` = C12's geo check and C22's config re-read; then
`signPrepared` → `submitSigned` (records in `v1_pending` before the broadcast, B1b) → `armAutolock`. The 500 ms
double-submit lock is #20's `LockedButton` (cardinal rule 6), as for a send. The recorded bytes are sent at most once
(B1b's exactly-once; #54's resend sends the same bytes).

### 3.4 Re-authentication (D3)

`presaleReauthReasons({firstPurchase, amount, balance, usdMicros, thresholdCents})`:
`first-purchase` (C21) · `over-5-percent` (`amount × 100 > balance × 5`, balance = the paying token's total held; a
zero balance counts as above) · `over-usd-threshold` (`usdMicros` of the payment at `/wallet/prices` — SOL, USDC or USDT
— null counts as above; threshold = `settings.reauthUsdCents`, default $100). B1b's `first-send` and
`whole-balance-to-new` do not apply: the recipient is the program and its treasury is pinned (C5). #10 shows the
reasons (Q17 for `first-purchase`; B1b's lines for the other two) and the purchase rows of §4.2.

### 3.5 Referral (#24, B1d-2, C1)

`ReferralView = {link, earnedBase | null, referrals | null, referredCents | null}`: `link` = `buildReferralLink(account)`
(`https://noc-tura.io?ref=<address>`, `core/referral/index.ts`); `earnedBase` = the allocation's
`referral_bonus_tokens` from chain (the coordinator reports 0 for a chain-credited bonus — memory "referral and backend
contract"); `referrals` and `referredCents` from `GET /referral-stats/<address>` (`fetchReferralStats`; aggregate only;
USD converted to cents at this edge). A source that fails gives `null` for its own fields only, shown "—". No stat
without a source (approved).

---

## 4. Screens (design binding; departures in §9)

Popup width 412 px, max 600 px high; the body scrolls, the sticky bar stays. New routes (only under the switch, in
`router.ts`'s closed list through `src/app/presale/index.ts`): `presale` (#23), `presale-confirm` (#20 purchase variant,
`entry: 'flow' {preparedId}` or `'resume'`), `geo` (#50b, carrying nothing — it asks `presale.view`), `referral` (#24).
#21 is the existing `status` route. Every CTA follows rule 6 (`LockedButton`).

### 4.1 #23 presale — states of ix 10603-10902

**On mount, every time:** `presale.view`. While it is answering, the stage card and the pay card show B1b's skeletons.

- **Closed answers.** `why: 'geo'` → the route is **replaced** by #50b (approved: "re-checked at every presale screen
  mount"). `why: 'unavailable'` → title "NOC presale", one line in place of the cards: Q11, or Q12 for `refused`, no
  Buy. `why: 'inactive'` → the stage card as last read with the eyebrow "Stage N of 10" (no "· live") and Q13, no Buy.
  `why: 'blocked'` → the stage card and Q14, no Buy.
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
  - **Your allocation** row (approved; no drawn state), in the receipt-row style (`.noc-body-sm`, `.noc-numeral` on
    the value): label Q04, value "<total> NOC", sub **"Claimable after TGE"** (D5). Shown only when
    `allocation.exists` and `totalBase > 0`.
  - **"Not available in your region?"** (`.btn-tertiary`, `--accent`, 13 px) → #50b (C18). Visible even with an empty
    input (design F).
  - Sticky **[Buy <estimate> NOC]**, or **[Buy NOC]** while there is no estimate (screen.md §23). Disabled while a
    line shows or the quote is stale; tap → `presale.prepareBuy` → `presale-confirm` (`flow`).
  - Typing calls `presale.quote` (debounced 250 ms); the popup re-reads `presale.view` every 30 s while #23 is visible
    (so `Quote` never goes stale under the user) — each re-read includes the geo check.
- **23b pending** (`pending` set, C17): title "NOC presale"; the ring spinner (static under
  `prefers-reduced-motion`); **"Order pending"**; sub Q05 (replaces "Tokens will be claimable when stage 3 closes",
  D5); rows **Paid** "<amount> <CUR>", **Estimated NOC** "<nocBase> NOC", **Stage** "Stage N of 10 · @ $ 0.1501",
  **Tx hash** (`.noc-mono` 12 px, the signature's first 4 … last 6 as drawn; the full value on hover and in the
  explorer link); banner Q06; **[View on Solana explorer]** (`explorerUrl(signature)`, the one external link, as #27)
  and **[Done]** → #11. "Order ID" omitted (§9). The screen re-reads `presale.view` on focus and every 6 s (the
  design's interval; it reads the record, the B1b poller does the watching).
- **After confirmation** the record is no longer open: #23 is 23a again with the allocation row updated. A failed or
  expired record follows B1b (#44, #54 from the pending row and #21).

### 4.2 #20 purchase variant, #10 and #21

- **#20 (`presale-confirm`)**: B1b's #20 chrome, quote countdown ("Quote valid N s", 30 s re-prepare carrying the
  challenge), Cancel (`presale.discardPrepared`) and resume path. Title Q07, lede Q08. Rows: **You pay**
  "<amount> <CUR>" (+ "≈ $ X" from `spentCents`); **You receive (est.)** "<nocBase> NOC" (the simulation's
  `Δtotal_tokens`, not the popup's estimate); **Stage** "N of 10"; **Price** "$ 0.1501 / NOC"; **Fee** — B1b's fees
  card with network + priority and an **account setup** row for `rentLamports` when > 0 (Q09), no Noctura-fee row
  (C25); **To** "Noctura presale" (Q10) over the full treasury (SOL) or vault ATA (stablecoin) address in groups of
  four, equal weight (B1's address rule) — no first-send warning (§3.4). Send button label "Buy NOC" (screen.md).
  Re-auth reasons → #10 exactly as a send.
- **#10**: the vault page renders the challenge's description from the background: header Q18 and the rows above;
  reason lines Q17 + B1b's. `src/unlock/presale.ts` holds that description renderer (off-build-excluded, in the
  vault-isolation gate's fixtures).
- **#21**: unchanged flow; for a record with `extra.kind = 'presale-buy'` the title/amount line reads Q32 and a
  **"Presale"** badge (`StatusPill`, Q31) sits beside the status; Done → #23 (C17).

### 4.3 #50b region blocked (presale) — ix 19612-19906

Route `geo`; on mount `presale.view` (a fresh geo check — "Re-checked at every presale screen mount"). Chrome as drawn:
top bar **"Not available here"** (`.t-title`) with back and ✕ (→ #11); hero glyph (72 px circle, `--warning` + i-lock);
headline; sub; region card; reason row; info banner; "What still works"; sticky **[Got it]** → back to the trigger
(#23 or #11), never a dead end.

| reason | headline | sub | region card | reason row (head · sub) |
|---|---|---|---|---|
| `sanctioned` | **"NOC presale isn't open in your region"** | Q21 | **"Detected region: <Country>"** (+ **" · EU"** for the 27 EU members) · **"Approximated from your IP. No GPS, no device location."** | **"Presale geofence active"** · Q22 |
| `stale_list` | Q23 | **"The restricted-region list is out of date."** (approved) | as above when a country is known | Q24 · Q25 |
| `unknown_country` | Q23 | Q26 (approved: "unknown country") | the disclosure line only | Q24 · Q25 |
| `no_check` | Q23 | **"The region check is unavailable — try again later."** (approved) | the disclosure line only | Q24 · Q25 |
| `refused` | Q23 | **"The presale service refused this network."** (approved) | the disclosure line only | Q24 · Q27 |
| open (C18) | Q20 | — | as `sanctioned` | — |

- Country name: `Intl.DisplayNames(['en'], {type: 'region'}).of(code)`; the code itself if that throws. The EU-27
  table is a static list in the screen module. The design's CSS flag tile is omitted (§9).
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
the link). Info banner Q39 (the app's copy). Legalese **"Referral payouts are subject to program terms. Self-referrals
are detected and rejected."** (as drawn and as the app; "program terms" unlinked until the terms page exists, B1e).
Empty (24b): zeros as returned; the "Recent rewards" empty state is omitted with the list (§9).

### 4.5 #11 banner and Buy

- **Banner** (below the token list, as drawn): **"NOC Presale · Stage N"** / **"$ 0.1501 · P% to next stage"**
  (P = `floor(100 × stageSold / stageCap)`), from `presale.banner`; shown only when it answers non-null with an active
  sale. Tap → the Buy routing below.
- **Buy quick action** (third, after Send and Receive; Swap stays removed): shown while `presale.banner` is non-null.
  Tap → `presale.view`: `open` → #23; `why: 'geo'` → #50b; any other answer → no route, the action hides (approved:
  "else #50b or nothing"). Disabled offline and in the 403 cool-down, as Send (B1b D36).
- **Pending row**: an open `presale-buy` record shows on #11's pending row as Q33 (B1b's row, its tap → #21).

### 4.6 #26 and #27 (B1d-2)

- **#26**: a `purchase` history row (B1b's "Presale purchase" / "NOC") gains the **"Presale"** badge (Q31) — on every
  purchase row, the website's included (the row kind is the chain's, not ours); the badge is under the switch, the row
  itself is B1b's and stays in the off build.
- **#27**: the `purchase` variant (B1b) gains Q34 while `presale.unrecorded` lists its signature.

---

## 5. Errors and edge cases

Refusal codes of the presale kind (`presale/` only — not in the shared `SendRefusal`); each is a fixed code the popup
translates; nothing internal is shown.

| code / case | where | behaviour |
|---|---|---|
| `presale-unavailable` (read failed, malformed, pin failed) | view, prepare, sign | #23: Q11, no Buy; on #20: back to #23 |
| `coordinator-refused` (403 / cool-down) | anywhere | Q12 on #23; `refused` on #50b; never retried inside the cool-down; one shared latch |
| `presale-closed` (inactive, 6020/6021/6024) | view, prepare | Q13 |
| `blocked` (`is_blocked`, 6002) | view, prepare | Q14 |
| `geo-closed` | view, prepare, sign | #50b with the reason; a prepared entry is discarded |
| `price-changed` (stage moved: C27 at prepare, C22 at sign) | prepare, sign | Q15 on #23; the popup re-reads the view (a new simulation follows the next Buy) |
| `below-min` / `above-max-tx` / `above-user-limit` / `above-limit` (6023) | quote, prepare | the line under the input (Q40 a/b/c); Buy disabled |
| `insufficient-sol` / `insufficient-token` / `split-balance` / `sender-below-rent` | quote, prepare | the line (Q41 a–d) |
| `no-sol-price` | quote | Q19; SOL disabled, stablecoins offered (C8) |
| `simulation-failed` / `simulation-mismatch` | prepare | Q16 on #23; never offered with a warning |
| `in-flight` | prepare | #23 is 23b already (C17); a second click while one is pending refused (C10) |
| `reauth-required`, `prepared-expired`, `unknown-prepared`, `prepared-invalid`, `locked` | buy | B1b's handling and copy, unchanged |
| a double click on Buy / on #20 | popup | `LockedButton` 500 ms + disable on tap; the prepared entry is single-use |
| the worker stops between sign and broadcast | — | B1b: the record is written before the broadcast; never signed twice, never broadcast twice |
| the stage advances between simulation and landing | — | accepted: the program prices at execution; "(est.)" on #23 / #20; the allocation row shows the real total after confirmation |
| Pyth older than 120 s at simulation | prepare | the simulation fails → Q16 |
| the coordinator is unreachable | — | presale closed (§3.1); the wallet keeps working; a recorded purchase keeps retrying (§2.4) |
| the record POST keeps failing | B1d-2 | the purchase stands; Q34 on #27; given up after 72 h |
| an update turns the switch off with a purchase pending | off build | C19: the record is polled and shown generically (Q42); nothing is lost, nothing re-signed |
| a sanctioned country behind a VPN | geo | closed (`sanctionedWinsOverVpn`); `isVpn` is never read as evidence |
| the user buys on another device meanwhile | prepare | the allocation Δ check (§3.3) refuses a simulation that does not match → Q16; the next view re-reads |

---

## 6. Testing

### 6.1 Unit and component (vitest, against the real background)

Each item has a **named mutation** that must turn a test red (tsc's own exit code checked first, as the mutation sweep
does), and a positive control wherever a negative is asserted.

- **Layouts (§2.1):** generator recomputes every account discriminator (mutation: skip the check → a wrong IDL
  discriminator passes); `u32` accepted, an unknown type throws; generated offsets = core's hand constants; the
  output's pinned hash; no `presale/` module mentions `tge_timestamp`.
- **State (§2.1):** a valid fixture opens (positive control); one refusal per rule — wrong owner, length 369/371,
  wrong discriminator, admin@8 or sale_token@40 moved, each C5 pin, `presale_active` = 2, stage 10 and 255,
  `stage_tokens_sold` at the cap, hard cap, start time in the future, user account malformed, `is_blocked`, allocation
  `user@8` foreign, `claimed` = 2, a 403, a timeout. Each with its mutation (drop the rule → red).
- **Geo (§2.2):** every reason — fresh list + `SI` → open; `KP` → `sanctioned`; `KP` with `isVpn: true` → `sanctioned`;
  `CN` (restricted) → open; `UNKNOWN`, `''`, `XX`, `ZZ`, `si` → `unknown_country`; list 31 days old → `stale_list`;
  missing dates, a date two days ahead, `stale: false` on an old list → `stale_list`; check 500 / timeout / malformed
  → `no_check`; list 404 → `no_check`; either 403 → `refused`. The cache: a second view within 10 min does not refetch
  the list but re-evaluates its age (fake clock past the limit → `stale_list`); `/geo/check` is fetched every time.
- **Limits (§3.2):** at every boundary — `minCents − 1` (below), `minCents` (ok), `maxTxCents`, `maxTxCents + 1`,
  `userRemainingCents` and `+ 1` with an existing `total_spent_cents`; the program's fallback when a field is 0;
  `usdCentsForStable` floors (`9 999` base units → 0 cents); `tokensFor` against the program's own example (`10 000`
  cents at stage 0 → `666 222 518 320` base units) and at stage 9; STAGE_PRICE_TICKS = core's float table × 10 000.
- **MAX (C9):** SOL leaves exactly `890 880` + fees + new-PDA rent; capped by each limit; a stablecoin's MAX is the
  largest holding.
- **Build (§3.3):** a stablecoin purchase from a **non-canonical** holding account (the largest of two, neither the
  ATA) uses it as account 5; the destination equals the pinned vault ATA (mutation: derive from the admin → red); a
  split balance refuses; SOL and stablecoin account lists equal the IDL's (`presaleIdl.ts` rows) in order; only
  Compute Budget + presale programs; `register_referrer` never built; an on-chain referrer's allocation PDA passed.
- **Simulation checks (C11, C23):** wrong SOL outflow, wrong token outflow, a token account of another owner, no
  allocation increase, `Δpurchase_count = 2`, `Δtokens = tokensFor(Δc) − 1`, a stablecoin `Δc` off by one, each Custom
  error → its code, an unknown error → `simulation-failed`; a correct one passes (positive control).
- **Re-auth (D3):** `first-purchase` (allocation absent; `purchase_count` 0; not for 1), 5 % at the boundary, the
  dollar threshold at the boundary, a missing price → above; `first-send` never produced for a purchase.
- **Pipeline (§1.3):** `kind` in the integrity and the digest (mutation: drop it → a send's challenge satisfies a
  purchase → red); a prepare of either kind replaces the account's other entry; `wallet.preparedFor` never returns a
  purchase; `beforeSign` geo closed → refused, nothing signed; C22 stage moved → refused; exactly-once — restart
  between record and broadcast → one broadcast; the lock hook during prepare leaves nothing behind; `in-flight` across
  kinds both ways.
- **Recording (B1d-2):** written on `confirmed` only; the payload's fields; the schedule's slots on a fake clock; a 403
  waits for the cool-down; given up at 72 h; one POST in flight; delete wipes, restore keeps.
- **Switch (off build, `__NOCTURA_PRESALE__ = false`):** `PRIVILEGED` contains no `presale.*`; a `presale.view` is
  refused `unknown type`; `intents.ts` has no `presale-buy`; a stored `presale-buy` pending record is still polled and
  rendered with Q42 (C19).
- **Screens:** every state of §4 with its verbatim strings — 23a (SOL, USDC, below min, MAX), 23b, allocation row,
  each closed answer, #20 purchase rows, #21 badge, #50b × 6, #24 (populated, nulls, copy failed), #11 banner and Buy
  routing, #26 badge, #27 line. TGE assertions are boolean with neutral messages (public CI logs): no date pattern and
  no countdown appears in any rendered presale screen.

### 6.2 Gates

- **`check-no-presale.mjs <offDir> <onDir>`** (new, in `npm run verify`, which builds both: `dist/` on and
  `dist-nopresale/` off; each `app.features.json` must say what its directory is, else the gate fails):
  1. **Modules:** the off build's `app.modules.json` contains no module of the **B1d set** — `src/background/presale/**`,
     `src/app/presale/**`, `src/unlock/presale.ts`, `core/geo/fetch.ts`, `core/presale/limits.ts`,
     `core/presale/buyInstructions.ts`, `core/presale/referrer.ts`, `core/presale/record.ts`, `core/referral/**`.
     **Positive control:** every listed path matches at least one module of the on build — a renamed or moved module
     fails the gate instead of passing it silently.
  2. **Strings:** no file under the off build's `app/`, `chrome/`, `firefox/` contains a **marker** — every `presale.*`
     message type, the route names `presale-confirm` and `referral`, `presale-buy`, `v1_presale_records`, and the
     strings "NOC presale", "YOU RECEIVE (EST.)", "Claimable after TGE", "Refer a friend", "Not available here",
     "Order pending", and every §10 string not marked (core) or (B1b) — each literal part of at least 8 characters
     between placeholders. The list is explicit in the gate file. **Positive control:** each marker is found in the on
     build; a marker that B1b or B1c already ships (found in the off build's own sources before B1d) is a gate bug and
     fails its self-test.
  3. The B1b/B1c presale strings that must stay ("Presale purchase", "PRESALE PURCHASE", the decoder's instruction
     names) are **found** in the off build (a control that the gate did not strip what it should keep).
- **No-TGE-date gates:** `extension/scripts/check-no-tge-date.mjs` (src + dist) and the repo's
  `scripts/check-no-tge-date.mjs` (every tracked file) cover the new sources and both builds.
- **RPC methods gate:** no new method (`getAccountsData` → `getMultipleAccounts`, `getTokenAccountsByOwner`,
  `simulateTransaction`, `getLatestBlockhash`, `getRecentPrioritizationFees` are on the list).
- **Permissions / CSP:** unchanged for both builds (no `clipboardWrite`, no new host, `connect-src` unchanged).
- **Vault isolation:** `src/unlock/presale.ts` in the fixtures; `v1_presale_records` in `BACKGROUND_OWNED_KEYS`.
- **Classes:** the design classes of §4 in `check-classes.mjs`.
- **Reproducible:** both builds rebuild byte-identically.

### 6.3 E2E (Playwright, contained)

Against `e2e/fakeCoordinator.ts`, extended with fake program state: Config / UserAccount / PresaleAllocation account
bytes built from `layouts.ts`, a simulation responder that applies the program's arithmetic to the posted transaction
(or a scripted error), `/geo/check` and `/geo/restricted-list` with scriptable answers, `/referral-stats`, and
`POST /solana/purchase` with scriptable status. Every spec runs normally and under `unshare -rn` (containment: no real
network).

1. **SOL purchase end to end:** #11 Buy → #23a → amount → #20 (rows) → #10 (first purchase) → #21 → confirmed → #26
   row with the badge (B1d-2 asserts the badge; B1d-1 the row).
2. **USDC from a non-canonical account:** the transaction's account 5 is the held account, account 6 the vault ATA.
3. **Below minimum refused:** the line, Buy disabled; a forced prepare is refused by the background (C3).
4. **Geo blocked:** #50b for each reason (`sanctioned`, `stale_list`, `unknown_country`, `no_check`, `refused`); Got it
   → back; nothing was prepared.
5. **Coordinator unreachable:** #23 closed with Q11; Send and Receive still work.
6. **Stage moved:** the fake advances the stage between view and Buy → Q15; the next Buy simulates at the new price.
7. **Off build:** `dist-nopresale` loaded; no banner, no Buy, no #31 row; `presale.view` from the popup's context is
   refused; a `v1_pending` presale record seeded into storage is shown generically and polled to `confirmed`.
8. **Recording (B1d-2):** the POST fails twice (500, then timeout) and succeeds on the third slot (fake clock); #27's
   Q34 disappears.
9. **Referral (B1d-2):** #31 → #24 with stats; `/referral-stats` failing → "—" for its two stats, EARNED still shown;
   Copy → the clipboard holds the link.

### 6.4 Visual

`e2e/visual-presale.spec.ts` shoots at 412 px: #23a (SOL, USDC, below min, after MAX), #23b, the allocation row, each
#23 closed answer, #20 purchase (with and without account setup), #21 with the badge, #50b × 6, #11 with the banner and
Buy, #24 (populated, empty, a null stat, copied), #26 badge, #27 line; the opus-tier review against `index.html` as in
B1b and B1c, every departure checked against §9.

### 6.5 Release gates (B1e)

- B1d-1 and B1d-2 on `main` (C26); §7's preconditions confirmed by ICO Claude and checked live once (slowly — CrowdSec).
- B1e decides whether the store build is `--no-presale`; if presale ships, the privacy disclosure lists presale
  (B1 §5: "public addresses (balances, history, presale, referral)"), the store listing describes the token sale, and
  the external security review covers §3.3.

---

## 7. ICO-side preconditions (for ICO Claude — B1d does not ship without them)

| # | precondition | why / found |
|---|---|---|
| P1 | **Automatic OFAC refresh** of `lib/restricted-countries.json` with `reviewed_at` (D6); the owner's manual review for RU / CN / ZW stays and is recorded per entry (`basis`). | The list served today says `updated_at` / `reviewed_at` 2026-09-21 with `max_staleness_days` 30: from 2026-10-22 B1d's gate (and B1 §4's rule) closes the presale for everyone until it is refreshed |
| P2 | **`POST /api/v1/solana/purchase` is live and idempotent by signature** for a JSON POST from the extension origin. | Found while writing (coordinator `server.js:416-560` at 75450df): the purchases row upserts on `(chain, tx_hash)`, but `recordAllocation` and `recordEarlyBuyerBonus` run on every call, so a retry may count twice; and `nocAmount` / `usdValue` are taken from the body unverified (the EVM §6 lesson, memory "coordinator EVM ingest"). ICO to confirm or fix both; **owner to rule whether the second blocks B1d** |
| P3 | **The 403 behaviour:** which of `/geo/check`, `/geo/restricted-list`, `/rpc`, `/referral-stats/:address` and `POST /solana/purchase` CrowdSec answers with 403 and which with silence, and that the coordinator itself never answers 403 to the extension's `Origin` (B1 §5 coordinator answer 2, measured for GETs only). | B1d's copy distinguishes "refused" (403 → Q12, `refused`) from "unavailable" (silence / timeout) |

Also asked, not blocking: whether `/referral-stats` counts referrals made through the extension's purchases (they carry
`referrerAddress` only when an on-chain referrer exists, C7).

---

## 8. Out of scope, and where things live

### 8.1 Out of scope

- **#23c claim and #23d done** (D1): claim is rejected before the TGE timestamp (`lib.rs:591-594`), transfers the whole
  allocation at once (no vesting), and cannot be tested on mainnet before then. Named in §9.
- Staking (#22) and every staking line; notifications (#29) and their presale rows; fiat on-ramp (#50c) and #50a swaps;
  the referral history sheet and reward rows; `register_referrer` / referrer capture (C7); EVM cross-chain allocations
  and `link_solana_wallet`; the TGE countdown the app shows (the owner's open question, not B1d's).
- **Web and the app adopting `core/geo/fetch.ts`** (C14) — flagged to the owner: it would make their gates fail closed
  on a stale list, which today they do not (web ignores staleness, the app fails open).
- Moving the NOC valuation for B1b's dollar rule to chain (C13).
- **Accepted limits:** the SOL estimate uses our price, the program Pyth's (the simulation shows the program's numbers
  before signing); a stage that advances between simulation and landing changes what is received (shown as "est.");
  the geo gate is the wallet's, by IP, and a VPN outside a sanctioned country passes (the program has no geofence);
  the coordinator stores what the record says (P2); every input goes through one host (`api.noc-tura.io`) — an outage
  closes the presale (B1 §4, accepted by the owner).

### 8.2 Where things live

| path | what |
|---|---|
| `extension/scripts/build.mjs`, `vite.config.ts`, `vite.content.config.ts`, `src/features.d.ts` | the switch (§1.1) |
| `extension/scripts/check-no-presale.mjs` (+ `__tests__`) | the off-build gate (§6.2) |
| `extension/scripts/gen-presale-idl.mjs` | + `layouts.ts` output, `LAYOUTS_SHA256` |
| `extension/src/background/intents.ts`; `prepare.ts`, `send.ts`, `pendingStore.ts`, `pending.ts`, `reauthChallenges.ts` | the kind registry and its uses (§1.3) |
| `extension/src/background/presale/` | `layouts.ts`, `state.ts`, `geo.ts`, `quote.ts`, `buy.ts`, `api.ts`; B1d-2 `record.ts`, `referral.ts` |
| `extension/src/background/deps.ts` | `createJsonPoster` (B1d-2) |
| `extension/src/app/presale/` | #23, #20 purchase variant, #50b, #24, the routes |
| `extension/src/app/screens/Home.tsx`, `Settings.tsx`, `Status.tsx`, `Activity.tsx`, `TxDetail.tsx`, `router.ts` | #11 banner/Buy/pending row, #31 row, #21/#26 badge, #27 line, the guarded routes |
| `extension/src/unlock/presale.ts` | #10's purchase description |
| `core/geo/fetch.ts`, `core/presale/limits.ts`, `core/presale/addresses.ts`, `core/presale/buyInstructions.ts` | fetcher; bigint limits, ticks, rents; the vault ATAs; the `sourceTokenAccount` parameter |
| `extension/e2e/presale*.spec.ts`, `visual-presale.spec.ts`, `fakeCoordinator.ts` | E2E, visual, fake program state |

Facts re-read for this spec: `core/presale/{addresses,allocation,buyInstructions,purchaseGate,record,referrer,stats,stagePrices}.ts`,
`core/geo/{freshness,classify,restrictedList}.ts`, `core/referral/index.ts`, `core/solana/{rpc,transfer}.ts`,
`extension/src/background/{prepare,send,sendTypes,pendingStore,reauthPolicy,deps,messages,walletApi}.ts`,
`extension/scripts/{build,gen-presale-idl,check-no-tge-date}.mjs`, `extension/src/app/{router,history,explorer}.ts`,
`ui/useCopy.ts`; ICO 75450df `lib/idl.json` (sha256 checked), `programs/solana-ico-enhanced/src/lib.rs` (constants,
SOL and stablecoin purchase, `calculate_tokens_for_usd`, `SPACE`s, stablecoin constraints, `register_referrer`),
`coordinator/src/api/{server.js,restrictedList.js,walletRoutes.js}`, `lib/restricted-countries.json`; the app's
`src/screens/referral/ReferralScreen.tsx`.

---

## 9. Design ↔ B1 rulings and declared omissions

| design / B1 | ruling |
|---|---|
| B1 §4 "the same purchase gate (`core/presale/purchaseGate.ts`: min $10, max $50,000, fee reserve)" | **refined:** limits read from config with the program's fallback (§2.1), plus the per-user $200 000 constant (C6), in bigint cents (§3.2); `canBuy` (floats, static limits, no cumulative cap, no PDA rent) is not used. The fee reserve becomes the exact fee + rent + rent-exempt rule (C9) |
| approved §2 "limits from the program (min $25 SOL, $10 stablecoins as config says, max per user)" | **the program applies one minimum to both paths:** `config.min_purchase_usd` if non-zero (read: $10), else the $25 constant (`lib.rs:333`, `2414`). There is no SOL-only $25 floor while the field is set; "as config says" is what is built. "Max per user" is two limits: `max_per_user_usd` (per transaction, despite its name) and the cumulative $200 000 (C6) |
| B1 §4 "classified by `core/geo/classify.ts`" | **refined:** `presaleGeoGate` (`core/geo/freshness.ts`), which classifies with `sanctionedWinsOverVpn` and adds the stale-list and unknown-country rules B1 §4 lists |
| B1 §4 "the bundled fallback list always counts as stale" | the extension bundles no list; an unreachable list is `no_check` (C12) — the same closed outcome, a truthful reason line |
| B1 §4 "Referral: link and bonus shown; a captured referrer applied" | link and earned bonus shown (#24); **capture not built** (C7) — an on-chain referrer is honoured; flagged to the owner |
| B1 §4 "a separate module behind one flag, switchable off" | a **build-time** switch (D2, C4) with its gate |
| B1 re-auth "first send to a new address", "whole balance to a first-time address" | not applied to a purchase; **first purchase** instead (D3, C21) |
| B1 fee policy (transparent markup) | not applied to a purchase (C25) |
| #23 lede "Four backend-driven states: active · pending · claim · done" | active and pending built; **claim (23c) and done (23d) not built** (D1): no on-chain source before TGE, no vesting exists, untestable on mainnet |
| 23a "$ 1.55 M raised · $ 5.00 M stage cap" | "raised" from `total_usd_raised_cents` (the sale's total); the stage cap is 10 240 000 NOC, not dollars → progress and cap in NOC (Q01) |
| 23a "Ends in 14 days" | **omitted:** no data |
| 23a "1 SOL = $ 198.42" | our display price, shown with "≈" (Q02); #20 shows the program's numbers from the simulation |
| 23a price "$ 0.025" (3 decimals) | the program's price to its 4 decimals ("$ 0.1501") — the drawn value is a placeholder |
| 23a "SOL" (only currency drawn) | SOL / USDC / USDT through the unit label as a selector (C20) |
| 23a nav "re-auth IF SOL spend > 5 % balance OR > 5 SOL absolute" | D3's rules: first purchase, 5 %, the dollar threshold setting — no 5 SOL absolute |
| 23b "Order ID ord_7f3c2d1a-4b9e" | **omitted:** no order id exists; the signature (Tx hash) replaces it |
| 23b "Tokens will be claimable when stage 3 closes." | wrong (claim is at TGE, for all stages) → Q05 with "Claimable after TGE" (D5) |
| 23b banner "we'll notify you when your tokens are claimable" | **omitted:** the extension has no notifications (B1b-2a D28); Q06 |
| 23b "non-refundable per presale terms" (a link) | kept as text, **without a link** until the terms page exists (B1e) |
| 23b "polls 6 s"; Android WorkManager / push; iOS Live Activity | the popup re-reads every 6 s while open; the B1b poller watches in the background; push and Live Activity are mobile-only |
| 23b "pending order ID held in encrypted SQLite" | `v1_pending` (B1b) |
| #23 "Your allocation" (no drawn state) | built in the receipt-row style (approved), Q04 |
| #23 (F)/(G) Android and iOS notes (decimal-pad IME, predictive back, haptics, Liquid Glass) | `inputmode="decimal"`; the rest mobile-only |
| #24 code "NOCT-7F3C-2D1A" (HMAC-derived) | **the address is the code** (C1); the link is shown whole, as the app |
| #24 "ACTIVE · staking now" | **omitted:** no source (staking not in B1); the app's REFERRED (Q36) in its place |
| #24 "Earn 5 % of every referral's stake rewards · paid in NOC · auto-credited each epoch." | **omitted:** does not exist; the app's banner (Q39) |
| #24 "Recent rewards", "View all", reward rows and their long-press menu, 24b's rewards empty state | **omitted:** the coordinator has aggregates only; no per-referral source |
| #24a-bis "Code copied · auto-clears clipboard 28 s" | **omitted:** no `clipboardWrite` → no auto-clear (B1 §4); `useCopy`'s "Copied" |
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
| #11 "Buy → presale (#23) if active else fiat-onramp sheet" | #23 when open, #50b when geo-closed, otherwise no Buy (approved); no fiat |
| #11 shielded-tint banner variant; TipKit "Tap to see presale stage" / Android "New" badge | B2 / mobile-only — omitted |
| #20 "recipient" for a purchase | "Noctura presale" + the full treasury / vault ATA address (B1's address rule) |
| #21 / #26 "Presale" badge | not drawn; approved in the design conversation (Q31) |
| #29 presale notification rows | out of B1 (D28) |
| screen.md §50 "back to trigger"; ✕ → dashboard | kept |
| plan split "presale-buy through simulation and #20/#10" in B1d-1 | B1d-1 also signs, records and broadcasts (#21) — the inherited pipeline; a purchase that cannot complete is untestable end to end (E2E 1) |

---

## 10. Owner copy to confirm (strings the design does not draw, or adapts)

Every string is flagged to the owner. "(approved)" = worded in the design conversation; "(app)" = the Android app's
existing copy; "(core)" = `core/presale/purchaseGate.ts`'s existing copy; the rest is controller copy. None contains a
date or a time to TGE.

| # | where | string |
|---|---|---|
| Q01 | #23a meta, the cap | "10.24 M NOC stage cap" |
| Q02 | #23a receive sub, SOL | "@ $ <price> · 1 SOL ≈ $ <sol price>" |
| Q03 | #23a receive sub, a stablecoin | "@ $ <price>" |
| Q04 | #23 allocation row label | "Your allocation" (approved) |
| Q05 | #23b sub | "Waiting for confirmation. Claimable after TGE." (D5) |
| Q06 | #23b banner | "You can close the popup — Noctura keeps watching this purchase. Funds are non-refundable per presale terms." |
| Q07 | #20 title, purchase | "Confirm purchase" |
| Q08 | #20 lede, purchase | "You are about to buy" |
| Q09 | #20 fee row, new PDAs | "Account setup (first purchase)" |
| Q10 | #20 recipient label | "Noctura presale" (approved) |
| Q11 | #23 state unreadable | "Presale unavailable — try again later." (approved) |
| Q12 | #23 coordinator 403 | "The presale service refused this network." (approved) |
| Q13 | #23 sale inactive | "The presale is not open." |
| Q14 | #23 account blocked | "This account can't buy in the presale." |
| Q15 | #23 stage moved | "Price changed — review again" (approved) |
| Q16 | #23 simulation refused | "The purchase could not be simulated." (approved) |
| Q17 | #10 reason line | "Re-auth required for your first presale purchase from this account." |
| Q18 | #10 header | "Confirm buying NOC with <amount> <CUR>" |
| Q19 | #23 no SOL price | "SOL price unavailable — pay with USDC or USDT, or try again later." |
| Q20 | #50b open variant headline | "NOC presale is open in your region" |
| Q21 | #50b sanctioned sub | "This wallet doesn't offer the presale in your region. You can still hold, send and receive any NOC you already have." |
| Q22 | #50b sanctioned reason sub | "Checked by this wallet against the restricted-region list" |
| Q23 | #50b headline, a fail-closed reason | "The presale can't be opened right now" |
| Q24 | #50b reason head, fail-closed | "Region check required" |
| Q25 | #50b reason sub, fail-closed | "The presale opens only after a successful check against a current list" |
| Q26 | #50b sub, unknown country | "Your region could not be determined from your IP." (approved: "unknown country") |
| Q27 | #50b reason sub, 403 | "Noctura's server did not answer requests from this network" |
| Q28 | #50b info banner sub | "Token sales are restricted by jurisdiction · this wallet checks before every purchase" |
| Q29 | #50b info line | "If the restricted-region list changes, this screen lifts on its own." |
| Q30 | #50b what still works | "View balances" |
| Q31 | #21 / #26 badge | "Presale" (approved) |
| Q32 | #21 amount line, purchase | "Buying NOC with <amount> <CUR>" |
| Q33 | #11 pending row, purchase | "Buying NOC · pending" / "Buying NOC · taking longer than usual" |
| Q34 | #27 purchase, not recorded | "Recorded on chain; presale service not yet updated" (approved) |
| Q35 | #24 REFERRALS sub | "total joined" (app) |
| Q36 | #24 third stat | "REFERRED" / "from your invites" (app) |
| Q37 | #24 code eyebrow | "YOUR INVITE LINK" (app) |
| Q38 | #24 copy states | "Copied" / "Copy failed" (B1b — `useCopy`'s existing copy) — also for "Share invite link" |
| Q39 | #24 info banner | "Earn 10% in NOC when someone buys with your link — up to 30% on larger buys." (app — unverified against the coordinator's current tier rule; owner to confirm) |
| Q40 | #23 limit lines | a "Minimum $<min>" (core) · b "Maximum $<max> per transaction" (core) · c "Above your presale limit — you can buy up to $<remaining> more" |
| Q41 | #23 balance lines | a "Insufficient <CUR> balance" (core) · b "Need a little SOL for the network fee" (core) · c "Your <CUR> is split across accounts — at most <n> <CUR> in one purchase" · d "Keep at least 0.00089088 SOL, or buy with less" |
| Q42 | off build, a presale record (C19) | "Transaction · pending" (#11 row and #21 title) |

