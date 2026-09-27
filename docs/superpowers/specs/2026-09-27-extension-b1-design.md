# Noctura Extension B1 — a browser wallet, transparent mode

**Status:** design approved section by section in conversation, 2026-09-27. Awaiting review of
this written form before an implementation plan is written.

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
- Networks other than mainnet. Sign-In With Solana. Hardware wallets. The AI Guard from the
  S2 security spec. A desktop build.
- `wallet.noc-tura.io` stays reserved for this product (a landing page, later); B1 does not
  need it.

---

## Decisions, and who took them

| decision | choice | why |
|---|---|---|
| Scope of B1 | wallet core, connection to sites, multiple accounts, presale in the extension | owner, all four offered options |
| Unlock | **password (required) + passkey (optional)** | owner. The password always works, on any machine; a passkey is the fast, phishing-resistant path when available |
| Distribution | **Chrome Web Store and Firefox Add-ons** | owner |
| Broadcast | **reads through the coordinator proxy, sending to public RPC** | owner. The proxy keeps its provable property that it cannot put anything on chain |
| Window | **popup 360×600 for daily use, a full tab for onboarding and security** | owner. A popup closes on any click outside it — fatal in the middle of writing down a seed |
| Build approach | **Vite + a small in-repo manifest generator**, beside `web/` | owner, over WXT and over forking a wallet: fewest dependencies in a thing that holds keys, and the reproducibility `web/` already proves |
| Address display in confirmations | **full address, groups of four, equal weight, plus a label for known addresses and a first-send warning** | owner, over the design file's first-6/last-6 highlight — see §3 |
| Auto-lock default | 15 minutes idle (5–60 configurable), browser close, manual | Claude, secure default |
| Networks | mainnet only | Claude, YAGNI |

---

## 1. Architecture and boundaries

Four parts, talking only by message:

1. **Background** — service worker (Chrome) / event page (Firefox). The only part that ever
   holds a seed or a private key. It unlocks the vault, derives keys, signs, builds
   transactions with `core/`, reads through the proxy and broadcasts to public RPC. When the
   vault locks or the browser closes, the key is gone from memory.
2. **UI windows** — the popup and the onboarding/security tab, built from the owner's design
   file. They **never see a key**: they ask the background for state or for a signature and
   receive the result. The single exception is one dedicated screen that shows the seed
   phrase (§2).
3. **Content script** — a thin relay between the page and the background. No logic, no keys.
4. **Injected provider** — in the page, registers "Noctura" through Wallet Standard. It knows
   nothing beyond what it may ask for.

Rules at the boundary:

- A page never receives anything but the **public address of an account it was granted** and
  **signatures the user confirmed**.
- Every request carries the page's origin **as the browser reports it**
  (`MessageSender.origin` / `sender.url`), never as the page claims it, and the background
  checks it on every message.
- A signature is **always confirmed in an extension window**, never inside the page.
- **No remote code.** Everything ships in the package; the extension CSP forbids `eval` and
  any external script, as `web/` does.

The honest limit: this is browser origin isolation, not hardware. Code with access to the
user's browser profile can reach an unlocked vault. Short auto-lock, the unlock factors in §2
and keeping the seed in the background only are what bound that.

## 2. Vault and keys

**Seed and derivation.**
- Create: **24 words** (256 bits), as the Android app (`generate(wordlist, 256)`).
- Import: 12 or 24 words, with the app's **scheme auto-detection** — standard SLIP-0010
  (`m/44'/501'/{account}'/0'`, `micro-key-producer/slip10`) or `cli` (the first 32 bytes of
  the BIP-39 seed, no derivation, as `solana-keygen` does). The same seed gives the same
  address in the extension as on the phone.
- **Multiple accounts:** `m/44'/501'/0'/0'`, `/1'/0'`, `/2'/0'` …, renameable. The `cli`
  scheme has exactly one account, because it has no derivation.
- Derivation moves from `src/modules/keyDerivation/` into **`core/`**, so app and extension
  run the same code, proven by the app's existing vectors.

**Encryption: one envelope, two locks.**
- The seed is encrypted with a random 256-bit **data key**, AES-256-GCM.
- The data key is wrapped twice:
  1. by the **password** through **Argon2id** (64 MiB, t = 3, p = 1; `@noble/hashes`,
     already a dependency) — expensive to guess from a stolen copy;
  2. by a **passkey**, when added: WebAuthn **PRF** output → HKDF-SHA-256 → AES-KW.
- On disk (`storage.local`) only the encrypted envelope, with a format version, salt, KDF
  parameters, IVs and the wrapped keys. No password and no seed in the clear anywhere.
- Password: at least 12 characters. Recovery is the seed phrase and nothing else — no cloud,
  no server copy.

**Unlocked state.**
- Browsers stop the background at will. While unlocked, the data key lives in
  **`storage.session`** — memory only, never written to disk, readable only by the
  extension — so a restarted background does not demand the password again.
- **Auto-lock** after 15 minutes idle (5–60 configurable, `alarms`), on browser close, and
  manually. Locking deletes the session key.
- Wrong passwords get an increasing delay in the UI. That slows a person at the keyboard; it
  does nothing against a stolen copy of the envelope, where only Argon2id's cost stands. The
  spec says so rather than implying otherwise.

**Showing the seed phrase.**
- Only in the tab, only after the password is entered again.
- **No copy to clipboard.** This is the one screen where UI code ever sees the seed.
- The seed never goes to logs, to any backend, or into a message towards a page.

## 3. Connecting to sites, and signing

**Offered through Wallet Standard:** `standard:connect`, `standard:disconnect`,
`standard:events` (account change, lock), `solana:signTransaction`,
`solana:signAndSendTransaction`, `solana:signMessage`. Chain `solana:mainnet` only.

**Connecting.**
- The first request from an origin opens the extension's connection screen (the design's
  dApp connection request) showing the origin **as the browser reports it**; an
  internationalised domain (punycode, e.g. a Cyrillic `о` in `nоc-tura.io`) is warned about.
- The user grants **one chosen account to that origin**; the page learns its public address
  and nothing else.
- Granted sites are listed with revoke (screen #49). Silent reconnection only for granted
  origins. `app.noc-tura.io` is marked **verified**.

**Signing — always in an extension window.**
- The transaction is **simulated** through the proxy first; the window shows **balance
  changes** ("−0.5 SOL, +394 NOC") and the fee.
- Known programs are decoded into words — SOL transfer, token transfer, presale purchase.
  An **unknown program** gets a plain warning.
- **Addresses:** in full, in groups of four, at equal weight (`AddressGroups`, as in `web/`),
  with a **label** where the address is known — "your account 2", "Noctura treasury", "from
  your address book" — and a warning on the **first send to a new address**.
  - ⚠️ **Deviation from the design file, stated loudly.** `screen.md` highlights the first
    six and last six characters on review screens. That is far safer than the four-and-four
    an address-poisoning account matched against this project in September 2026, but it
    still trains the eye to read only the ends. Labels and a first-send warning protect more
    than any character highlight; the owner chose them over 6+6.
- **`signAndSendTransaction`:** sign in the background, send to public RPC (§4), confirm
  through the proxy, then the status screen.
- **`signMessage`:** shows the text; a message that is not readable text, or that parses as
  a transaction, is **refused** — nobody signs a transaction blind in a message's clothing.
- **Limits:** one pending request per origin, requests time out, a locked vault asks for
  unlock first.

## 4. Wallet features

Every screen comes from the owner's `index.html` / `screen.md`.

**Dashboard.** SOL, NOC, USDC, USDT for the selected account, with dollar values and an
account switcher. NOC is valued "at stage price", as on `web/`, because it has no market
before TGE. Prices from the coordinator's `/wallet/prices`; balances from chain through the
proxy.

**Send (#12 → #19 simulate → #20 confirm → #21 status).**
- Token choice; amounts are **BigInt in the smallest unit** (cardinal rule 2); fee shown;
  a warning when SOL for the fee is short.
- **Non-canonical token accounts:** a transfer spends from the account that actually holds
  the most of that token, not from the derived ATA — the owner's own wallet holds tokens that
  way. The app already does this; it moves to `core/`.
- If the recipient has no account for the token, the transaction creates one; its SOL cost
  is shown up front.
- The button locks on tap for at least 500 ms (cardinal rule 6).

**Receive (#13).** Full address in groups of four, copy (clipboard cleared after 30 s, as in
the app, never on background), and a **QR code** from a small reviewed library with no
dependencies, or an in-repo encoder — never from a CDN.

**History (#27 and the list).** Signatures for the address through the proxy, decoded into
sent / received / purchase, with an explorer link.

**Presale in the extension.**
- The same builders as `web/` and the app (`core/presale`), the same purchase gate
  (min $10, max $50,000, fee reserve).
- **Jurisdiction gate and sanctions list from `core/geo`.** A list older than its allowed age
  **closes** the purchase — never proceeds on a stale list. The app ran five months on a
  stale fallback list in 2026; this is the lesson, as a rule.
- Referral: the link and bonus shown; a captured referrer applied.
- Presale is a **separate module behind one flag**, so a store review that objects to it can
  be answered by switching it off without touching the wallet.

**Moves into `core/`:** key derivation; SOL/SPL transfer building with holding-account
selection; balance reads; history decoding — one codebase for app, web and extension, proven
by the app's existing tests, as the presale move was.

**RPC, measured 2026-09-27 against `app.noc-tura.io/rpc`.** Allowed: `getBalance`,
`getAccountInfo`, `getMultipleAccounts`, `getLatestBlockhash`, `simulateTransaction`,
`getSignaturesForAddress`, `getTransaction`, `getSignatureStatuses`,
`getRecentPrioritizationFees`, `getTokenAccountsByOwner` (jsonParsed).
Refused: `sendTransaction` (by design), `getFeeForMessage`, `getMinimumBalanceForRentExemption`.
So the extension computes the fee itself (5 000 lamports per signature plus the priority fee
from `core/solana/priorityFee`), and the rent for a new token account is the fixed
165-byte-account minimum computed locally — or the coordinator adds those two read-only
methods. The plan decides which, with a test either way.

**Broadcast.** Signed transactions go to 2–3 public mainnet endpoints with retry and backoff;
confirmation is read through the proxy. No API key ships in the extension.

## 5. Build, gates, release

**Build.** `extension/` beside `web/`: Vite, and one manifest source rendered for Chrome
(MV3, service worker) and Firefox (MV3, event page), as the nginx config is rendered from one
source. Two packages; **reproducible** — two builds, one sha256, published. Firefox Add-ons
requires the source and build instructions so its reviewer can rebuild; reproducibility is
what makes that check meaningful.

**Gates in `npm run verify`**, the `web/` pattern:
- tsc, tests, secret scan;
- **extension CSP**: own code only, no `eval`, no external script;
- **host allowlist over the package**: `api.noc-tura.io` and the chosen public RPC endpoints,
  each with a reason, stale entries failing;
- **minimal permissions**: `storage`, `alarms`. No `tabs`, no history, no page reading. The
  content script must match every page or the wallet cannot be found by sites — the one broad
  grant, justified in the manifest and in the store listing;
- reproducibility and a manifest check.

**Tests.**
- Crypto: vectors for Argon2id, AES-GCM and the envelope format; derivation must produce the
  **Android app's addresses** from the app's existing vectors.
- Protocol: origin checked on every message, request queue, lock, refusal of transaction-shaped
  messages — each with a mutation that proves the test can fail.
- End to end: Playwright loads the extension into Chromium; a test page connects and asks for
  a signature against a simulated RPC, so tests move no real funds.

**Needed from the coordinator (ICO Claude).**
- Accept the extension's origin. Chrome gives a stable `chrome-extension://<id>`. **Firefox
  gives a random `moz-extension://<uuid>` per install**, which cannot be allowlisted by name;
  the mechanism is agreed with the coordinator before Firefox work starts.
- A decision on `getFeeForMessage` / `getMinimumBalanceForRentExemption` (§4).

**Release gates.**
1. **Internal adversarial review**, at least two rounds, of this spec and of the code — the
   S0 web plan needed three.
2. **An independent external security review before either store listing.** For a wallet
   holding real funds this is a precondition, not a nicety. Cost and vendor are the owner's.
3. Developer accounts for the Chrome Web Store and Firefox Add-ons are opened by the owner; a
   privacy policy ("collects no data") is written with the listing.

**Phases, each its own PR.**
- **B1a** — `core/` moves (derivation, transfers, balances) and the vault.
- **B1b** — the wallet: onboarding, send, receive, history, accounts.
- **B1c** — connection to sites (Wallet Standard provider, permissions, confirmations).
- **B1d** — presale with the jurisdiction gate.
- **B1e** — hardening, Firefox, packaging, release.
