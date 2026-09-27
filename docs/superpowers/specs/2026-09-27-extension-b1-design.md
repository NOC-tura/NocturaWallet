# Noctura Extension B1 — a browser wallet, transparent mode

**Status:** revision 2, 2026-09-27. Revision 1 was approved section by section in conversation,
then reviewed adversarially by a second model (Fable 5.1), which found one blocker, four highs
and a dozen mediums. Every finding is answered below; the owner took the four decisions the
review raised. Awaiting the owner's review of this revision, then a second review round, before
an implementation plan is written.

**What B1 is.** A browser extension named **Noctura** for Chrome-family browsers and Firefox
that holds the user's seed, derives the same addresses as the Android app, sends and receives
SOL, NOC, USDC and USDT on mainnet, buys NOC in the presale, and offers itself to web pages as
a Solana wallet through Wallet Standard — so `app.noc-tura.io` and any other Solana site can
connect to it the way they connect to Phantom.

**Where it sits.** Point A (`app.noc-tura.io`) holds no key and asks a connected wallet to
sign. Point C (Android) holds the key behind Android Keystore. B1 is the missing middle: the
answer to "the user has no wallet" in a browser. It is the first Noctura surface whose key
boundary is **software origin isolation** rather than hardware — stated here once, plainly,
and designed around rather than hidden.

**Not in B1**, deliberately:
- **Shielded mode (B2).** The shielded pool is a devnet proof of concept, its key model is
  broken (the note secret is the sole spend authority; the A0 freeze replaces it), and it
  needs a ceremony and an audit before real funds. Cardinal rule 4 — `sk_spend` never in
  JavaScript — cannot be met by an extension, which is all JavaScript. B2 starts, at most, as
  *viewing* shielded balances (`sk_view` in JS is permitted); spending stays on Android until
  the owner decides explicitly how rule 4 applies to a browser.
  **And one consequence that holds already in B1:** the BIP-39 seed the extension stores is
  also the root of the shielded EIP-2333 keys (`src/modules/keyDerivation/paths.ts`). A seed
  that leaks from the extension leaks the phone's future shielded spend authority with it.
  Users who intend to use shielded mode should know that importing the phone's seed into a
  browser weakens it; onboarding says so.
- Networks other than mainnet. Sign-In With Solana. Hardware wallets. The AI Guard from the
  S2 security spec. A desktop build.

---

## Decisions, and who took them

| decision | choice | why |
|---|---|---|
| Scope of B1 | wallet core, connection to sites, multiple accounts, presale in the extension | owner, all four offered options |
| Unlock | **password (required) + passkey (optional), passkey bound to `wallet.noc-tura.io`, passkey unlock in a tab** | owner. Review finding 1: WebAuthn in an extension needs an RP ID the extension holds a host permission for, and the action popup closes when the credential prompt opens |
| Distribution | **Chrome Web Store and Firefox Add-ons** | owner |
| Broadcast | **reads through the coordinator proxy, sending to public RPC** | owner. The proxy keeps its provable property that it cannot put anything on chain |
| Window | **popup (412 px wide, max 600 px high) for daily use; a full tab for onboarding, security and passkey unlock** | owner. A popup closes on any click outside it. 412 px is the design file's Pixel 9 width; 600 px is Chrome's popup height limit |
| Build approach | **Vite + a small in-repo manifest generator**, beside `web/` | owner, over WXT and over forking a wallet |
| Address display in confirmations | **full address, groups of four, equal weight, plus labels for known addresses and a first-send warning** | owner, over the design file's first-6/last-6 highlight — see §3 |
| Stale sanctions list | **closes the purchase** in the extension, including when the coordinator is unreachable | owner. Review finding 9 |
| Auto-lock default | **5 minutes** idle (1–60 configurable), plus browser close and manual | owner, following S2 (revision 1 had 15) |
| Re-authentication while unlocked | **first send to a new address; amount above a threshold (default $100, configurable); security-settings changes; whole balance to a first-time address** | owner, all four offered, following S2 |
| Networks | mainnet only | Claude, YAGNI |

---

## 1. Architecture and boundaries

Four parts, talking only by message:

1. **Background** — service worker (Chrome) / event page (Firefox). Holds the unlocked
   **signing keys**, signs, builds transactions with `core/`, reads through the proxy and
   broadcasts to public RPC. It never holds the seed at rest (§2).
2. **UI windows** — the popup and the full tab, built from the owner's design file. They ask
   the background for state or for a signature and receive the result.
3. **Content script** — a thin relay between the page and the background. No logic, no keys.
4. **Injected provider** — a content script in the page's **main world**, which registers
   "Noctura" through Wallet Standard. It knows nothing beyond what it may ask for, and the
   background treats everything it sends as hostile input (§3).

**The honest limit, stated precisely.** Revision 1 said the UI "never sees a key" and that
session storage is "readable only by the extension". Both overstate it. Every extension page
— popup, tab, background — is a trusted context and can read `storage.session` and
`storage.local`; Firefox has no `storage.session.setAccessLevel` at all. So the boundary
between the background and the UI is **code discipline enforced by gates**, not a platform
wall. The real platform boundary is between the extension and **web pages**, which cannot
read extension storage. What limits damage inside the extension:
- the seed and the data key are never in session storage (§2) — only per-account signing
  keys, which do not lead back to the seed or to other accounts;
- a build gate fails if any UI bundle imports `storage.session` or the vault module;
- the extension CSP forbids `eval` and any external script, so no code arrives that was not
  reviewed and shipped;
- a short auto-lock.

Code with access to the user's browser profile can still reach an unlocked vault. The unlock
factors in §2 and the 5-minute auto-lock bound that; nothing in a browser removes it.

**Rules at the boundary with pages:**
- A page never receives anything but the **public address of an account it was granted** and
  **signatures the user confirmed**.
- A signature is **always confirmed in an extension window**, never inside the page.
- **No remote code.** Everything ships in the package.

## 2. Vault and keys

**Seed and derivation.**
- Create: **24 words** (256 bits), as the Android app (`mnemonicUtils.ts`,
  `generate(wordlist, 256)`).
- Import: 12 or 24 words, with the app's scheme **auto-detection**
  (`accountDetection.ts`: SLIP-0010 accounts 0–4 and `cli`) — standard SLIP-0010
  `m/44'/501'/{account}'/0'` (`micro-key-producer/slip10`) or `cli` (the first 32 bytes of
  the BIP-39 seed, no derivation, as `solana-keygen`). The same seed gives the same address in
  the extension as on the phone.
- **Accounts.** A wallet has **one scheme**, fixed at creation or import: `slip10` wallets
  have accounts 0, 1, 2 … (renameable); a `cli` wallet has exactly one account, because `cli`
  has no derivation. Import picks the scheme the detection finds funded; if both are funded,
  the user chooses, and the other stays reachable by importing again. The phone shows one
  scheme string today (`derivationScheme.ts`), so accounts beyond 0 exist in the extension
  only until the app learns multiple accounts — onboarding says so.
- Derivation moves from `src/modules/keyDerivation/` into **`core/`** (see §5 on tests).

**Encryption: one envelope, two locks.**
- The seed is encrypted with a random 256-bit **data key**, AES-256-GCM.
- The data key is wrapped twice:
  1. by the **password** through **Argon2id** (64 MiB, t = 3, p = 1; `@noble/hashes`,
     already a dependency). Measured: **3.4 s** on an 8-core laptop in Node 24, 123 MiB RSS;
     expect 2–3× on low-end machines. It runs in a **Web Worker inside the unlock page**,
     never in the background, where it would block every message for seconds;
  2. by a **passkey**, when added: WebAuthn **PRF** output → HKDF-SHA-256 → AES-KW.
- On disk (`storage.local`) only the envelope: format version, salt, KDF parameters, IVs,
  the wrapped keys, and the list of accounts with their public keys. No password, no seed, no
  data key in the clear anywhere.
- Password: at least 12 characters. Recovery is the seed phrase and nothing else — no cloud,
  no server copy.

**Passkey (owner decision).**
- The relying-party ID is **`wallet.noc-tura.io`**; the extension declares a host permission
  for it, which is what lets an extension claim an RP ID (Chrome 122+, Firefox 150+). A
  passkey created there is bound to that domain for good; the domain is reserved for this
  product and must never be given to anything else.
- Adding a passkey and unlocking with it happen **in the full tab** (or a dedicated window),
  never in the action popup, which closes when the credential prompt opens. The popup offers
  "Unlock with passkey" as a button that opens the tab.
- PRF is capability-detected (`getClientExtensionResults().prf`). An authenticator without PRF
  gets a plain message — "this device cannot unlock the wallet with a passkey; your password
  still works" — never a silent failure.

**Unlocking and the unlocked state.**
- The unlock page derives the data key (password in the worker, or passkey), decrypts the
  seed **in the unlock page**, derives the **per-account Ed25519 signing keys**, hands those
  to the background, and drops the seed and the data key. The seed exists in memory only for
  that moment.
- While unlocked, the per-account signing keys (32 bytes each) live in **`storage.session`**
  — memory only, never on disk, cleared on browser restart, not exposed to content scripts
  by default (Chrome 102+, Firefox 115+) — so a restarted background does not ask again.
  **Never the seed, never the data key.** Anything that needs the seed (reveal, add an
  account, export) asks for the password or passkey again and re-derives it.
- **Auto-lock** after **5 minutes** idle (1–60 configurable, via `alarms`; any user action in
  an extension window or an approved signature resets it), on browser close, and manually.
  Locking clears `storage.session`.
- **Browser close is detected, not assumed.** Chrome can keep running with no windows
  ("continue running background apps"), in which case nothing restarts and session storage
  survives. So the background also locks on `windows.onRemoved` when `windows.getAll()` is
  empty (no permission needed).
- Wrong passwords get an increasing delay in the UI, on top of the ~3 s Argon2id cost. That
  slows a person at the keyboard; against a stolen copy of the envelope only Argon2id's cost
  stands, and the spec says so.

**Showing the seed phrase.**
- Only in the tab, only after re-authentication.
- **No copy to clipboard.**
- Never in logs, never to any backend, never in a message towards a page.

## 3. Connecting to sites, and signing

**Offered through Wallet Standard:** `standard:connect`, `standard:disconnect`,
`standard:events` (account change, lock), `solana:signTransaction`,
`solana:signAndSendTransaction`, `solana:signMessage`. Chain `solana:mainnet`
(`@solana/wallet-standard-chains`).

**Injection.** The provider is a content script with `world: "MAIN"` (Chrome 111+,
Firefox 128+), `run_at: "document_start"`, **top frame only**. In the main world the page's
CSP applies and the page can observe and tamper with the script (MDN), so the provider holds
nothing and everything it forwards is validated in the background. Registration order is
handled by the Wallet Standard protocol itself (it works whether the wallet or the app loads
first). A second, isolated-world content script relays to the background.

**The origin of a request.**
- The background accepts a page request only if `sender.id === runtime.id`, `sender.tab` is
  present, `sender.frameId === 0`, and **`sender.origin`** (Chrome 80+, Firefox 126+) is an
  `https:` origin. An opaque or `null` origin (sandboxed iframe) is refused. There is **no
  fallback to `sender.url`**, which can be `about:blank` or `srcdoc`.
- `sender.origin` is already ASCII, so the internationalised-domain rule is concrete: **any
  `xn--` label gets a warning** on the connection and signing screens.

**Connecting (#47).**
- The first request from an origin opens the connection screen with the origin as the
  browser reports it.
- The user grants **one chosen account to that origin**, with the design's session scope:
  **"This session only" (default) / "Until revoked"**.
- Granted sites are listed with revoke (#49), including **"Disconnect all" with a typed
  confirmation**, as the design specifies. Silent reconnection only for granted origins.
  `app.noc-tura.io` is marked **verified**.
- A request from an origin other than the one the account was granted to is **refused**
  (S2 rule).

**Signing — always in an extension window (#48).**
- The transaction is **simulated** through the proxy; the window shows **balance changes**
  ("−0.5 SOL, +394 NOC") and the fee. If the user has not confirmed within **30 seconds**,
  it is simulated again; the signature is bound to the blockhash of the simulation shown.
- **Simulation has one source**, the coordinator. A compromised proxy could lie about balance
  changes; the decoded instructions below do not depend on it and are shown beside the
  simulation, so the two can be compared.
- Known programs are decoded into words: SOL transfer, SPL token transfer, associated token
  account creation, compute-budget settings, presale purchase.
- **Deterministic red flags** (the design's #48 rules engine and the S2 hard rules):

  | condition | action |
  |---|---|
  | a program not in the decoded set | warning: "unknown program" |
  | an instruction of a known program outside its decoded set (e.g. SPL `SetAuthority`, `Approve`, `CloseAccount`, `Burn`) | warning: named instruction, "not a transfer" |
  | SPL `SetAuthority` on an account the user owns | **blocked** by default; unblocking is a security setting (re-auth) |
  | SPL `Approve` of the whole balance or u64 max | **blocked**; a bounded `Approve` is a warning |
  | durable nonce (`AdvanceNonceAccount` first) | warning: "this transaction does not expire" |
  | whole or nearly whole balance to a first-time address | warning + **re-authentication** |
  | request origin differs from the granted origin | **blocked** |

  On any red-flag screen **Confirm is disabled for 1.5 seconds**, has **no default focus**,
  and **Enter does not confirm** (S2).
- **Addresses:** in full, in groups of four, at equal weight (`AddressGroups`, as in `web/`),
  with a **label** where the address is known — "your account 2", "Noctura treasury", "from
  your address book" — and a warning on the **first send to a new address**.
  - ⚠️ **Deviation from the design file.** `screen.md` highlights the first six and last six
    characters on review screens. The owner chose labels and a first-send warning instead: the
    eye trained on ends is what address poisoning exploits.
- **Re-authentication** (owner decision) before signing: first send to a new address; amount
  above the threshold; whole balance to a first-time address; any security-settings change.
- **`signAndSendTransaction`:** sign in the background, broadcast (§4), confirm through the
  proxy, then the status screen.
- **`signMessage`:** refused if the bytes deserialize as a legacy `Transaction`, a
  `VersionedTransaction` or a `VersionedMessage`; refused if they are not valid UTF-8 or
  contain control or bidi-override characters; otherwise the text is shown. Each rule has a
  test with a message that trips it and one that does not.
- **Limits:** one pending request per origin; requests time out; a locked vault asks for
  unlock first. Connect and Approve buttons lock on tap for 500 ms (rule 6).

## 4. Wallet features

Every screen comes from the owner's `index.html` / `screen.md`, at the popup's 412-px width.

**Dashboard.** SOL, NOC, USDC, USDT for the selected account, with dollar values and an
account switcher. NOC is valued "at stage price", as on `web/`, because it has no market
before TGE. Prices from the coordinator's `/wallet/prices`.

**Send (#12 → #19 simulate → #20 confirm → #21 status).**
- Token choice; amounts are **BigInt in the smallest unit** (rule 2); fee shown; a warning
  when SOL for the fee is short.
- **Non-canonical token accounts:** a transfer spends from the account that holds the most of
  that token, not from the derived ATA, and refuses when the amount is split across accounts
  (`src/modules/solana/transactionBuilder.ts:66-110`); this moves to `core/`.
- If the recipient has no account for the token, the transaction creates one; its SOL cost
  is shown up front.
- The button locks on tap for at least 500 ms (rule 6).

**Receive (#13).** Full address in groups of four, copy, and a **QR code** from a small
reviewed library with no dependencies, or an in-repo encoder — never from a CDN. The clipboard
is cleared after 30 s **only while the Receive screen stays open**; a popup's timers die when
it closes, and clearing from the background would need an offscreen document (Chrome) or
`clipboardWrite` (Firefox) that B1 does not request. The screen says so ("clears in 30 s if
this stays open").

**History (#27 and the list).** Signatures for the address through the proxy, decoded into
sent / received / purchase, with an explorer link.

**Presale in the extension.**
- The same builders as `web/` and the app (`core/presale`), the same purchase gate
  (`core/presale/purchaseGate.ts`: min $10, max $50,000, fee reserve).
- **Jurisdiction:** learned the only way it can be — the coordinator's IP-based
  `/geo/check` — and classified by `core/geo/classify.ts`.
- **Stale sanctions list closes the purchase (owner decision). This is new work, not an
  existing property.** Today `core/geo/restrictedList.ts` carries the 30-day rule only as a
  comment, and `web/src/geo/useGeo.ts` falls back to the bundled list and reports
  `listStale` without anyone acting on it. B1 adds, in `core/geo`: staleness computed from the
  payload's own dates (the coordinator reports `stale`, `age_days`, `max_staleness_days`),
  the bundled fallback always counting as stale, and a purchase gate that refuses on stale.
  Consequence, accepted: **when the coordinator is unreachable, the presale in the extension
  is closed**; the wallet itself keeps working.
- Referral: link and bonus shown; a captured referrer applied.
- Presale is a **separate module behind one flag**, so a store review that objects to it can
  be answered by switching it off without touching the wallet.

**Moves into `core/`:** key derivation; SOL/SPL transfer building with holding-account
selection; balance reads; history decoding; the stale-list gate.

**RPC — the proxy (reads).**
- Measured 2026-09-27. Allowed: `getBalance`, `getAccountInfo`, `getMultipleAccounts`,
  `getLatestBlockhash`, `simulateTransaction`, `getSignaturesForAddress`, `getTransaction`,
  `getSignatureStatuses`, `getRecentPrioritizationFees`, `getTokenAccountsByOwner`. Refused:
  `sendTransaction` (by design), `getFeeForMessage`, `getMinimumBalanceForRentExemption`,
  `getSlot`, `getEpochInfo`, `isBlockhashValid`, `getTokenAccountBalance`,
  `getProgramAccounts`, `getHealth`, `getVersion`. `getBlockHeight` (needed to detect an
  expired blockhash while confirming) is used by `web/src/presale/useBuy.ts` against the
  proxy and must be confirmed allowed.
- **A refused method is not just an error.** The proxy answers it with HTTP 403, and a few
  403s in a burst make the host's CrowdSec bouncer **ban the user's IP from the whole domain**
  — `app.`, `api.` and the apex — for hours. This happened during the review of this spec.
  So: the methods the extension calls are a **compile-time list with a test** that every
  RPC call maps to an allowed method (S0 §6.6 did the same); a 403 from the proxy is
  **terminal, never retried**; confirmation polling is no faster than every 2 s; and the
  coordinator is asked to answer refused methods with **HTTP 200 and a JSON-RPC error**, so
  the bouncer does not count them (below).
- Fee and rent without the refused methods: the fee is computed locally (5 000 lamports per
  signature plus the priority fee from `core/solana/priorityFee.ts`); the rent for a new
  token account is the fixed minimum for a 165-byte account, computed locally. Or the
  coordinator adds those two read-only methods; the plan picks one, with a test either way.

**RPC — broadcast.** Signed transactions go to **`https://api.mainnet.solana.com`** and
**`https://api.mainnet-beta.solana.com`** (the app's existing fallback,
`src/modules/solana/connection.ts`), with retry and backoff, at most one send per second.
Solana's public endpoints allow 100 requests per 10 s per IP and are "not intended for
production applications"; a failure is shown as "the network did not accept it, try again",
never as success. Both answer CORS for extension origins (measured).
**Privacy, stated:** each broadcast shows the operator of that endpoint the user's IP
address and the signed transaction, and therefore the user's address. The privacy policy says
so. No API key ships in the extension.

**Permissions and hosts, one list.** `storage`, `alarms`; **host permissions** for
`https://api.noc-tura.io/*` (reads through the proxy and the coordinator's API, so responses
are readable without CORS), `https://wallet.noc-tura.io/*` (the passkey RP ID), and the two
broadcast endpoints; a content script on `<all_urls>` (Wallet Standard needs to be present on
every page — the one broad grant, which produces the "read and change all your data on all
websites" warning and is justified in the manifest and the store listing). No `tabs`, no
history, no page reading. Revision 1's "storage, alarms only" contradicted every fetch the
background makes; this is the corrected list.

## 5. Build, gates, release

**Build.** `extension/` beside `web/`: Vite, and one manifest source rendered for Chrome
(MV3, `background.service_worker`) and Firefox (MV3, `background.scripts` event page), as the
nginx config is rendered from one source. A `key` field keeps the Chrome ID stable between
development and store builds. Two packages; **reproducible** — two builds, one sha256,
published. Firefox Add-ons signs the XPI, so the published hash is of the **unsigned
contents**. AMO requires the source and build instructions so its reviewer can rebuild;
reproducibility is what makes that check meaningful. Minimum versions follow from the
platform features used: **Chrome 122, Firefox 150**.

**Gates in `npm run verify`**, the `web/` pattern:
- tsc, tests, secret scan;
- **extension CSP**: `script-src 'self'` (plus `'wasm-unsafe-eval'` only if a WASM module is
  ever added), no external script;
- **host allowlist over the package**: exactly the hosts in §4, each with a reason, stale
  entries failing;
- **permissions**: the manifest's permissions equal the list in §4, each justified;
- **UI isolation**: no UI bundle imports `storage.session` or the vault module;
- **RPC method list**: every call maps to an allowed method;
- reproducibility and a manifest check.

**Tests.**
- Crypto: vectors for Argon2id, AES-GCM and the envelope format; derivation must produce the
  **Android app's addresses** from the app's pinned vectors (`transparent.test.ts`).
- **Where moved code is tested.** The root jest ignores `core/` (`jest.config.js`); `core/`
  tests run under vitest in Node (`web/`, CI `web.yml`). So code moved into `core/` leaves the
  app's jest and its Hermes-relevant path. Byte-level encoders that leave `src/` (u64 LE and
  the like — the Hermes `Buffer` trap passes on Node and fails on device) keep an **app-side
  test** that imports them from `core/` and runs under the app's jest, and the on-device
  check stays part of the release of any app build that uses them.
- Protocol: origin checks, request queue, lock, the red-flag table, the `signMessage` rules —
  each with a mutation that proves the test can fail.
- End to end: Playwright loads the extension into Chromium; a test page connects and asks for
  a signature against a simulated RPC, so tests move no real funds.

**Needed from the coordinator (ICO Claude), before the work that depends on each:**
1. Accept requests from the extension. With a host permission the browser sends the
   extension's origin (`chrome-extension://<id>`; Firefox: a **random** `moz-extension://<uuid>`
   per install, which cannot be allowlisted by name). The mechanism is agreed before any
   extension code calls the API — and before Firefox work.
2. Refused JSON-RPC methods answered with HTTP 200 and a JSON-RPC error, not 403 (§4).
3. `getBlockHeight` confirmed allowed; a decision on `getFeeForMessage` and
   `getMinimumBalanceForRentExemption`.

**S2 security spec — kept, deferred, rejected.**

| S2 requirement | B1 |
|---|---|
| auto-lock 5 min | **kept** (owner) |
| re-auth for new recipients, above a threshold, settings changes | **kept** (owner) |
| SetAuthority blocked, unlimited Approve blocked, durable-nonce warning, whole balance to first-time address, origin mismatch blocked | **kept** (§3 table) |
| Confirm disabled 1–2 s on red flags, no default focus, Enter does not confirm | **kept** (§3) |
| re-simulate after ~30 s, signature bound to the shown blockhash | **kept** (§3) |
| simulation from more than one party | **deferred**: one source (the coordinator), mitigated by showing decoded instructions beside it; a second simulator is B1e or later |
| anti-phishing phrase shown after unlock | **deferred** to B1e |
| lockfile, `ignore-scripts`, audit on every PR | **kept** as CI gates |
| sandboxed vault origin + non-extractable WebCrypto key (S2's web design) | **replaced** by the extension's own origin; S2 was a web page, B1 is an extension |
| AI Guard | **rejected for B1** |

**Release gates.**
1. **Internal adversarial review**, at least two rounds, of this spec and of the code. Round 1
   of the spec is done (Fable 5.1, 2026-09-27); this is revision 2.
2. **An independent external security review before either store listing.** For a wallet
   holding real funds this is a precondition, not a nicety. Cost and vendor are the owner's.
3. Developer accounts for the Chrome Web Store and Firefox Add-ons are opened by the owner.
   The privacy policy and both stores' data disclosures say **truthfully** what leaves the
   device: the user's IP address to the coordinator (jurisdiction check, reads) and to the
   public broadcast endpoints; the user's public address to the coordinator (balances,
   presale, referral, purchase history) and to the broadcast endpoints. No seed, no private
   key, no browsing data, no analytics. Revision 1's "collects no data" was false.

**Phases, each its own PR.**
- **B1a** — `core/` moves (derivation, transfers, balances, stale-list gate) and the vault
  (envelope, Argon2id worker, passkey, session keys, auto-lock).
- **B1b** — the wallet: onboarding, send, receive, history, accounts.
- **B1c** — connection to sites (provider, origin checks, permissions, confirmations, red
  flags).
- **B1d** — presale with the jurisdiction gate.
- **B1e** — hardening, Firefox, packaging, release.
