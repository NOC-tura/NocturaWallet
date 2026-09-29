# Noctura Extension B1 — a browser wallet, transparent mode

**Status:** revision 3, 2026-09-28. Revision 1 was approved section by section in
conversation; two adversarial reviews by a second model (Fable 5.1) followed. Round 1 found a
blocker and four highs, answered in revision 2. Round 2 found that revision 2's broadcast path
could not work at all — see §4, and the correction note there — plus three highs; this
revision answers every round-2 finding. The owner took every decision the reviews raised.
Awaiting the owner's review, then the implementation plan.

**Revision 4 (2026-09-29).** A small follow-up round on the B1a implementation, folded back into
§2 and §5:
- the seed's AES-GCM `additionalData` is a fixed-order JSON encoding of `{v, scheme, kdf: {alg,
  m, t, p}, accounts: [{index, publicKey}, …]}` (account names excluded; any later code that
  adds or removes an account, e.g. B1b, must re-encrypt the seed);
- Argon2id parameters a stored envelope declares are bounded to `[PRODUCTION_KDF, cap]`;
- a malformed or tampered envelope is `CorruptEnvelope`, surfaced to the unlock flow as the
  fixed `'damaged'` outcome (never `'wrong'`, never charged against the backoff);
- unlock compares every derived public key against the envelope's stored ones before sending
  any key to the background;
- the vault-isolation gate's scope: the whole package (not just `src/`), the HTML entries at
  the package root, and 5 built-output markers as a backstop;
- the end-to-end Playwright suite runs in CI;
- the extension installs with `npm ci --ignore-scripts`;
- `storage.session` is pinned to `TRUSTED_CONTEXTS` at service-worker start.

**Revision 5 (2026-09-29), from implementing B1b-1 (the wallet engine).** Decisions taken during
implementation and its reviews, folded back here:
- the extension CSP gains **`connect-src https://api.noc-tura.io`** — the run-time backstop behind
  the RPC-method and network gates (a text gate cannot see a computed name);
- **`v1_vault` has one writer, the background**: the vault page sends `vault.storeEnvelope
  {expectedRevision, envelope}` (vault page only); the background compare-and-sets on a revision
  hash of everything but account names, validates the envelope's bounds and lengths, and refuses a
  change of scheme, KDF, salt, password wrap or an existing account's public key; `null` is the
  first write and never overwrites a wallet;
- pending sends live in **`storage.local`** (owner, 2026-09-29), so a browser restart cannot hide a
  transaction that may still land; a lock clears `storage.session` only;
- "no funds moved" needs the height past `lastValidBlockHeight + 32` **and** two null full-history
  status checks ≥ 2 s apart; only a *confirmed/finalized* error closes a send as failed; only a
  broadcast-route **400** whose body names a contract reason (`malformed`, `unsigned`, `rejected`)
  means "not forwarded" (any other 400, and a 403 response, keep the send pending);
- every coordinator request has a deadline (20 s reads, 30 s broadcast) and all go through one
  serialised, persisted 403 latch;
- the **Noctura fee** in the extension is 0 with the visible reason "status unknown" until the
  coordinator reports the fee status (the app has no source for it either — see the coordinator
  asks); NOC is valued at the current **stage price** for the $100 re-authentication rule (owner),
  and an unreadable stage price counts as above the threshold;
- import accepts exactly 12 or 24 words; a scheme probe that cannot read every balance makes the
  user choose.
- a send's re-authentication is bound to its **intent** (account, token, recipient, amount), not to
  the message bytes: a prepared send lives 30 s (the re-simulation rule), a human re-authentication
  routinely takes longer, and a re-prepare of the same intent carrying the challenge keeps the
  proof while the message gets a fresh blockhash; the stored message keeps its own integrity
  digest, and `wallet.preparedFor` lets a reopened popup resume.

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
  **A consequence that holds already in B1:** the BIP-39 seed the extension stores is also
  the root of the shielded EIP-2333 keys (`src/modules/keyDerivation/paths.ts`). A seed that
  leaks from the extension leaks the phone's future shielded spend authority with it;
  onboarding says so to anyone importing the phone's seed.
- Networks other than mainnet. Sign-In With Solana. Hardware wallets. The AI Guard from the
  S2 security spec. A desktop build.

---

## Decisions, and who took them

| decision | choice | why |
|---|---|---|
| Scope of B1 | wallet core, connection to sites, multiple accounts, presale in the extension | owner, all four offered options |
| Unlock | **password (required) + passkey (optional), passkey bound to `wallet.noc-tura.io`, passkey unlock in a tab** | owner, after review round 1 |
| Distribution | **Chrome Web Store and Firefox Add-ons** | owner |
| Reads | **through the coordinator's `/api/v1/rpc` proxy** | owner |
| Broadcast | **a narrow broadcast-only route on the coordinator** (revision 2's "public RPC" cannot work — §4) | owner, after review round 2 |
| Window | **popup (412 px wide, max 600 px high) for daily use; a full tab for onboarding, security and passkey unlock** | owner. 412 px is the design file's Pixel 9 width; 600 px is Chrome's popup limit |
| Build approach | **Vite + a small in-repo manifest generator**, beside `web/` | owner, over WXT and over forking a wallet |
| Address display in confirmations | **full address, groups of four, equal weight, plus labels for known addresses and a first-send warning** | owner, over the design file's first-6/last-6 highlight — §3 |
| Stale sanctions list | **closes the purchase**, including when the coordinator is unreachable | owner |
| Auto-lock default | **5 minutes** idle (1–60 configurable), plus browser close and manual | owner, following S2 |
| Re-authentication while unlocked | **first send to a new address; amount above 5 % of the account's balance or above an absolute threshold (default $100); whole balance to a first-time address; security-settings changes** | owner (four triggers), with the design file's 5 % rule (`screen.md` §0) |
| Dangerous instructions | **blocked by default; overridable per transaction only**, by typing the token symbol (the design's #48 rule) plus re-authentication — never by a permanent setting | design file #48, after review round 2 |
| Transparent send fee | **the same as the app**: no Noctura markup before TGE; after TGE the app's markup to the fee treasury unless the user is zero-fee eligible, with the staking discount. The policy moves into `core/` in B1b so app and extension share one rule and one disclosed fee line | owner, 2026-09-28 |
| Networks | mainnet only | Claude, YAGNI |

---

## 1. Architecture and boundaries

Five parts, talking only by message:

1. **Background** — service worker (Chrome) / event page (Firefox). Holds the unlocked
   per-account **signing keys**, signs, builds transactions with `core/`, reads through the
   proxy and broadcasts through the coordinator. Never holds the seed or the data key.
2. **Vault page** — `unlock.html` and its Web Worker. The only code that ever handles the
   password, the passkey output, the data key or the seed. It renders **nothing untrusted**:
   no dApp names, no token metadata, no page-supplied text. It is its own bundle.
3. **UI pages** — the popup and the full tab (everything else), built from the owner's design
   file. They ask the background for state or a signature and receive the result.
4. **Relay content script** (isolated world) — passes page messages to the background. No
   logic, no keys.
5. **Provider content script** (main world) — registers "Noctura" through Wallet Standard.
   It holds nothing, and everything it sends is hostile input (§3).

**Two message partitions, enforced in the background:**
- **Privileged** — `vault.setKeys`, `vault.lock`, `settings.*`, `grants.*`, `accounts.*`:
  accepted only when `sender.origin` equals the extension's own origin
  (`new URL(runtime.getURL('')).origin` — `chrome-extension://<id>`, `moz-extension://<uuid>`;
  BCD `MessageSender.origin`: Chrome 80, Firefox 126). `vault.setKeys` additionally only from
  the vault page's URL; `settings.*` that weaken protection additionally require
  re-authentication (§2). A full-tab page has `sender.tab` set too, so "has a tab" is never
  used to decide trust.
- **Page** — `connect`, `disconnect`, `signTransaction`, `signAndSendTransaction`,
  `signMessage`: accepted only under the origin rule in §3.
- Any message type outside both lists is refused. Each partition gets a mutation test: a page
  sending a privileged type must be refused.

**The honest limit.** Every extension page is a trusted context: the popup, the tab and the
vault page can all read `storage.session` and `storage.local`, and Firefox has no
`storage.session.setAccessLevel`. So the separation *inside* the extension is **code
discipline enforced by gates**, not a platform wall; the platform wall is between the
extension and web pages. What limits damage inside:
- the seed and the data key exist only in the vault page, only during unlock or
  re-authentication — in a DOM document bounded by `script-src 'self'` and by rendering
  nothing untrusted (a weakening against revision 1's background-only design, accepted because
  Argon2id cannot run in the background; §2);
- `storage.session` holds only per-account signing keys, which lead back to neither the seed
  nor other accounts;
- build gates: the vault module is imported only by the vault bundle; `storage.session` is
  touched only by the background;
- no remote code: the extension CSP forbids `eval` and external scripts;
- a 5-minute auto-lock.

Code with access to the user's browser profile can still reach an unlocked vault. Nothing in a
browser removes that; the unlock factors and the short auto-lock bound it.

## 2. Vault and keys

**Seed and derivation.**
- Create: **24 words** (256 bits), as the Android app (`mnemonicUtils.ts`,
  `generate(wordlist, 256)`).
- Import: 12 or 24 words, with the app's scheme **auto-detection** (`accountDetection.ts`:
  SLIP-0010 accounts 0–4 and `cli`) — SLIP-0010 `m/44'/501'/{account}'/0'`
  (`micro-key-producer/slip10`) or `cli` (the first 32 bytes of the BIP-39 seed, no
  derivation, as `solana-keygen`). The same seed gives the same address as on the phone.
- **Accounts.** A wallet has **one scheme**, fixed at creation or import: `slip10` wallets have
  accounts 0, 1, 2 … (renameable); a `cli` wallet has exactly one. Import picks the scheme
  detection finds funded; if both are funded the user chooses. The phone persists one scheme
  string (`derivationScheme.ts`), so accounts beyond 0 exist only in the extension until the
  app learns multiple accounts — onboarding says so.
- Derivation moves from `src/modules/keyDerivation/` into **`core/`** (§5 on tests).

**Encryption: one envelope, two locks.**
- The seed is encrypted with a random 256-bit **data key**, AES-256-GCM.
- The data key is wrapped twice:
  1. by the **password** through **Argon2id** (64 MiB, t = 3, p = 1; `@noble/hashes`, already a
     dependency) — measured 3.4 s on an 8-core laptop in Node 24; expect 2–3× on low-end
     machines. It runs in the **vault page's Web Worker**, never in the background, where it
     would block every message;
  2. by a **passkey**, when added (below).
- On disk (`storage.local`) only the envelope: format version, Argon2id salt and parameters,
  IVs, the wrapped keys, the passkey credential ID and PRF salt, and the accounts with their
  public keys. No password, seed or data key in the clear.
- Password: at least 12 characters. Recovery is the seed phrase and nothing else.
- **The seed ciphertext's AES-GCM `additionalData` binds it to the envelope's own header**: a
  fixed-order JSON encoding of `{v, scheme, kdf: {alg, m, t, p}, accounts: [{index,
  publicKey}, …]}` — account **names** excluded (renaming needs no re-encryption), so any code
  that adds or removes an account (B1b) must re-encrypt the seed under the same data key. A
  stored value this code could not have written — the wrong shape, or a header that no longer
  matches its ciphertext — is `CorruptEnvelope`, surfaced to the unlock flow as the fixed
  `'damaged'` outcome. `'damaged'` is never `'wrong'`: it is never charged against the
  wrong-password backoff, and the vault page never invites a retry that cannot succeed.
- **Argon2id parameters are bounded on both sides**: a stored envelope must declare a cost
  between `PRODUCTION_KDF` (the floor, the values above) and a fixed cap, checked before the
  KDF ever runs; a declared cost outside that range is also `'damaged'`.

**Passkey.**
- **RP ID `wallet.noc-tura.io`**, claimed through a host permission for it (Chrome 122+,
  Firefox 150+, MDN "Use the WebAuthn API in web extensions"). Nothing needs to be served at
  that domain. A passkey created there is bound to it for good; the domain is reserved for
  this product and must never be given to anything else.
- `create()` with `userVerification: 'required'`, `residentKey: 'preferred'`; the credential ID
  is stored in the envelope.
- **PRF input:** a random 32-byte salt per wallet, stored in the envelope (a fixed salt would
  make the PRF output a function of the passkey alone, shared by every wallet on it).
  Wrapping key = HKDF-SHA-256(PRF output, salt = envelope salt,
  info = `"noctura-ext-v1/passkey-wrap"`) → AES-KW of the data key.
- **Whether PRF works is decided by a `get()` immediately after `create()`**, not by the
  creation result: Windows Hello surfaces PRF only on `get()` on older Chrome. No PRF output →
  "this device cannot unlock the wallet with a passkey; your password still works", and the
  unused credential is left unregistered in the envelope.
- Adding a passkey and unlocking with it happen **in a tab**, never the action popup, which
  closes when the credential prompt opens; the popup's "Unlock with passkey" opens the tab.
- Stated limits: any *other* extension holding a host permission for `wallet.noc-tura.io`
  (or `<all_urls>`) can also prompt the user for this RP ID, so the prompt alone is not proof
  of Noctura; and a **synced** passkey keeps its PRF secret in the provider's cloud (Google,
  Apple, a password manager). Both still need the envelope from this browser profile, which
  is why the PRF salt lives there.

**Unlocking and the unlocked state.**
- The vault page derives the data key (Argon2id in the worker, or passkey), decrypts the seed,
  derives the per-account Ed25519 signing keys, **compares each derived public key against the
  one the envelope records for that account** (index by index — a mismatch sends nothing and
  reports a failed unlock), sends them to the background as `vault.setKeys` (privileged, from
  the vault page's URL only; §1), and drops the seed and the data key. The seed exists in
  memory only for that moment.
- While unlocked, the signing keys live in **`storage.session`** — memory only, cleared on
  browser restart, not exposed to content scripts by default (Chrome 102+, Firefox 115+).
  **Never the seed, never the data key.** Adding an account, revealing the seed or exporting
  asks for the password or passkey again and re-derives.
- **Encoding:** Chrome serialises extension messages and `storage.session` as JSON, turning a
  `Uint8Array` into an object. Keys cross both as **base64 strings**, with a cross-browser test.
- **Auto-lock** after **5 minutes** idle (1–60 configurable, via `alarms`; any action in an
  extension window or an approved signature resets it), on browser close, and manually.
  Locking clears `storage.session`.
- **Browser close is detected, not assumed**: Chrome can keep running with no windows
  ("continue running background apps"), so the background also locks on `windows.onRemoved`
  when `windows.getAll()` is empty (no permission needed).
- Wrong passwords get an increasing delay on top of the ~3 s Argon2id cost. That slows a
  person at the keyboard; against a stolen envelope only Argon2id's cost stands.

**Re-authentication is a proof, not a flag.** Password → Argon2id → unwrap the data key →
decrypt → re-derive the account's key and compare it with the key in `storage.session`; or the
passkey → PRF → unwrap, the same way. It runs in the vault page. A mismatch locks the vault.

**Showing the seed phrase.** Only in the tab, only after re-authentication, in the vault page.
**No copy to clipboard.** Never in logs, to any backend, or towards a page.

## 3. Connecting to sites, and signing

**Offered through Wallet Standard:** `standard:connect`, `standard:disconnect`,
`standard:events` (account change, lock), `solana:signTransaction`,
`solana:signAndSendTransaction`, `solana:signMessage`. Chain `solana:mainnet`
(`@solana/wallet-standard-chains`).

**Injection.** The provider is a content script with `world: "MAIN"` (Chrome 111+,
Firefox 128+), `run_at: "document_start"`, **top frame only**. The page can observe and tamper
with main-world code (MDN), so the provider holds nothing and the background validates
everything it forwards. Registration order is handled by the Wallet Standard protocol.

**The origin of a page request.** Accepted only if `sender.id === runtime.id`, `sender.tab`
is present, `sender.frameId === 0`, and `sender.origin` is an `https:` origin. Opaque or
`null` origins are refused; there is no fallback to `sender.url`. Any `xn--` label gets an
internationalised-domain warning. **Stated consequences:** a dApp inside an iframe cannot
connect, and neither can `http://localhost` development; a development build may allow
`http://localhost` and `http://127.0.0.1`, a store build never.

**Connecting (#47).**
- The first request from an origin opens the connection screen with the origin as the
  browser reports it; a lookalike of a known domain offers the design's **"Reject and
  report"**.
- The user grants **one chosen account to that origin**, with the design's session scope:
  **"This session only" (default) / "Until revoked"**.
- Granted sites are listed with revoke (#49), including **"Disconnect all" with a typed
  confirmation**. Silent reconnection only for granted origins. `app.noc-tura.io` is marked
  **verified**.
- A request from an origin other than the one the account was granted to is **refused**.

**Signing — always in an extension window (#48).**
- **Batches:** `signTransaction` accepts several inputs; a batch is one request, shown on one
  screen with each transaction's effects, and approved or refused as a whole.
- **Address lookup tables:** v0 transactions are resolved by fetching the tables
  (`getMultipleAccounts`, allowed) before decoding; an address that cannot be resolved makes
  the instruction "unknown program".
- The transaction is **simulated** through the proxy; the window shows **balance changes**
  ("−0.5 SOL, +394 NOC") and the fee. After **30 seconds** unconfirmed it is simulated again;
  the signature is bound to the blockhash of the simulation shown. If simulation fails, a
  dApp transaction shows the design's #19 state ("Couldn't simulate") with a red warning;
  approving it anyway counts as a red flag.
- **Simulation has one source**, the coordinator, and a compromised coordinator could lie
  about balance changes. The decoded instructions do not depend on it (once lookup tables are
  resolved) and are shown beside it.
- Decoded programs: System (transfer, create account), SPL Token **and Token-2022** (transfer,
  transferChecked, approve/approveChecked, revoke, setAuthority, closeAccount, burn, and the
  Token-2022 extensions below), Associated Token Account, Compute Budget, the presale program.
- **Deterministic red flags** (the design's #48 rules engine and the S2 hard rules):

  | condition | action |
  |---|---|
  | a program not in the decoded set | warning: "unknown program" |
  | an instruction of a decoded program that is not a transfer | warning, named |
  | System `Assign` or `Allocate` on the user's own wallet account | **blocked** |
  | SPL/Token-2022 `SetAuthority` (any authority type: owner, close, mint, freeze) on an account the user owns | **blocked** |
  | `Approve`/`ApproveChecked` of the whole balance or u64 max | **blocked** |
  | a bounded `Approve`/`ApproveChecked` | warning + re-authentication |
  | Token-2022 transfer hook, permanent delegate, or freeze authority on a token the user holds | warning, named |
  | durable nonce (`AdvanceNonceAccount` first) | warning: "this transaction does not expire" |
  | whole or nearly whole balance to a first-time address | warning + re-authentication |
  | simulation failed and the user continues | warning |
  | request origin differs from the granted origin | **blocked, no override** |

  **"Blocked"** means refused unless the user overrides **that one transaction**: by typing the
  token symbol (the design's #48 rule for unlimited approvals) or, for non-token rows, the word
  shown, **plus re-authentication**. There is no setting that disables a block — a permanent
  toggle is what a drainer coaches a victim to flip. On any red-flag screen **Confirm is
  disabled for 1.5 s**, has **no default focus**, and **Enter does not confirm**.
- **Addresses:** in full, in groups of four, at equal weight (`AddressGroups`, as `web/`), with
  a **label** where known — "your account 2", "Noctura treasury", "from your address book" —
  and a warning on the **first send to a new address**.
  - ⚠️ **Deviation from the design file.** `screen.md` highlights the first six and last six
    characters on review screens; the owner chose labels and a first-send warning instead.
- **Re-authentication** before signing: first send to a new address; amount above **5 % of the
  account's balance** or above the absolute threshold (default $100); whole balance to a
  first-time address; bounded approvals; overrides. The dollar value comes from the
  coordinator's prices: **a missing price counts as above the threshold** (fail closed), and a
  lying coordinator could suppress the dollar rule — accepted and stated; the 5 % and
  first-send rules do not depend on it.
- **`signAndSendTransaction`:** sign, send through the coordinator's broadcast route (§4), and
  **return the signature to the dApp as soon as the route accepts it** (dApps confirm
  themselves). A second identical request while the first is unresolved is refused.
- **`signMessage` (#46):** the design's sign-message screen (origin card, verified badge,
  "won't move funds"). Refused if the bytes deserialize as a legacy `Transaction`, a
  `VersionedTransaction` or a `VersionedMessage`; refused if not valid UTF-8 or containing
  control or bidi-override characters; the Solana off-chain message format
  (`\xff solana offchain` prefix) is refused in B1. Tests include a **UTF-8-valid legacy
  message that deserializes** (the one case the UTF-8 rule alone would miss) and a normal
  sign-in text that must pass.
- **Limits:** one pending request per origin; requests time out; a locked vault asks for
  unlock first. Connect and Approve lock on tap for 500 ms (rule 6).

## 4. Wallet features

Every screen comes from the owner's `index.html` / `screen.md`, at the popup's 412-px width.

**Dashboard.** SOL, NOC, USDC, USDT for the selected account, with dollar values and an
account switcher. NOC is valued "at stage price", as on `web/`. Prices from the coordinator's
`/wallet/prices`.

**Send (#12 → #19 simulate → #20 confirm → #21 status → #54 stuck).**
- Token choice; amounts **BigInt in the smallest unit** (rule 2); fee shown; a warning when SOL
  for the fee is short.
- **Noctura fee (owner decision):** the app's policy, shared through `core/` —
  `src/modules/fees/feeEngine.ts` `getEffectiveFee('transferMarkup')`: 0 before TGE, 0 for
  zero-fee-eligible users, otherwise the markup (minus any staking discount) as a separate
  transfer to the fee treasury. Always shown as its own line when non-zero; never charged
  undisclosed (the app once did, and MAX-send broke on it).
- **Non-canonical token accounts:** spend from the account holding the most of that token, and
  refuse when the amount is split across accounts (`src/modules/solana/transactionBuilder.ts`);
  this moves to `core/`.
- If the recipient has no account for the token, the transaction creates one; its cost is
  shown up front.
- **No double spend.** After the first send the transaction is **pending** until it is
  confirmed or its blockhash expires (`getSignatureStatuses` and `getBlockHeight` against
  `lastValidBlockHeight`). While pending, "send again" **re-sends the same signed bytes**
  (same signature — idempotent), never a new transaction; a new transaction is offered only
  after expiry, as the app already does (`src/modules/solana/signAndSend.ts`,
  `docs/superpowers/specs/2026-06-13-reliable-send-design.md`). Pending past ~90 s goes to
  the design's #54 stuck-transaction screen, whose re-broadcast cannot be pressed twice in a
  row. The button locks on tap for at least 500 ms (rule 6).

**Receive (#13).** Full address in groups of four, copy, and a **QR code** from a small reviewed
library with no dependencies, or an in-repo encoder — never from a CDN. **The clipboard is not
cleared automatically**: clearing needs `clipboardWrite` (a timer has no user activation, MDN
"Interact with the clipboard"), which B1 does not request, and a popup's timers die when it
closes. The screen says so. This is a deviation from the app's 30-second clear.

**History (#27 and the list).** Signatures for the address through the proxy, decoded into sent
/ received / purchase, with an explorer link; `getTransaction` calls are paced (at most 2 per
second) and cached, well inside the proxy's 240 requests per minute.

**Presale in the extension.**
- The same builders as `web/` and the app (`core/presale`), the same purchase gate
  (`core/presale/purchaseGate.ts`: min $10, max $50,000, fee reserve).
- **Jurisdiction:** the coordinator's IP-based `/geo/check`, classified by `core/geo/classify.ts`.
- **Stale sanctions list closes the purchase — new work in `core/geo`, not an existing
  property.** Rules: staleness is computed locally from the payload's own dates
  (`updated_at`/`reviewed_at` against `max_staleness_days`); **missing or unparsable dates
  count as stale**; a server `stale: false` never overrides a locally computed age above the
  limit; the bundled fallback list always counts as stale; **an unknown or empty country code
  closes the purchase** (today `classify.ts` allows anything not on the list). Consequence,
  accepted by the owner: when the coordinator is unreachable, the presale in the extension is
  closed; the wallet keeps working.
- Referral: link and bonus shown; a captured referrer applied.
- Presale is a **separate module behind one flag**, switchable off if a store review objects.

**Moves into `core/`:** key derivation; SOL/SPL transfer building with holding-account
selection; balance reads; history decoding; the stale-list gate.

**RPC — reads.** Path `https://api.noc-tura.io/api/v1/rpc` (the same endpoint
`app.noc-tura.io/rpc` proxies to). Recorded allowed (S0 spec, and measured 2026-09-27):
`getBalance`, `getAccountInfo`, `getMultipleAccounts`, `getLatestBlockhash`,
`simulateTransaction`, `getSignaturesForAddress`, `getTransaction`, `getSignatureStatuses`,
`getRecentPrioritizationFees`, `getTokenAccountsByOwner`, and `getBlockHeight` (used by
`web/src/presale/useBuy.ts`; re-confirmed in B1a). Refused: `sendTransaction`,
`getFeeForMessage`, `getMinimumBalanceForRentExemption`, `getSlot`, `getEpochInfo`,
`isBlockhashValid`, `getTokenAccountBalance`, `getProgramAccounts`, `getHealth`, `getVersion`.
- **A refused method is not just an error**: the proxy answers HTTP 403, and a few 403s in a
  burst make the host's CrowdSec bouncer ban the user's IP from the whole domain for hours
  (it happened during review round 1). So the methods are a **compile-time list with a test**
  that every call maps to an allowed one; a 403 is **terminal, never retried**; confirmation
  polling is no faster than every 2 s; if `getBlockHeight` hiccups, that iteration skips the
  expiry check (the app's rule).
- Fee computed locally (5 000 lamports per signature plus `core/solana/priorityFee.ts`); rent
  for a new token account is the fixed minimum for a 165-byte account — or the coordinator adds
  those two read-only methods (§5).

**Broadcast — through the coordinator.** ⚠️ **Correction.** Revision 2 said the extension
would send to `api.mainnet.solana.com` / `api.mainnet-beta.solana.com` and that both "answer
CORS for extension origins (measured)". Only the preflight was measured. The actual POST,
measured 2026-09-28 for both hosts: **no `Origin` → 200; `Origin: chrome-extension://…` or
`moz-extension://…` → 403.** An extension always sends an `Origin`, so no transaction would
ever have reached the chain. Owner's decision: a **broadcast-only route on the coordinator**.
- The route accepts **only a fully signed transaction** (base64), checks that it deserializes
  and carries all required signatures, forwards it to the coordinator's RPC (the Helius key
  stays on the server), and returns the signature. It cannot build, alter or sign anything.
- What it *can* do is drop or delay a transaction. The extension notices: the transaction
  stays pending until its blockhash expires, then shows "not confirmed — no funds moved" and
  offers a new attempt (§4 Send). A second, independent path — a `declarativeNetRequest`
  rule stripping `Origin` on the extension's own requests to public RPC — is **not known to
  work** (Firefox does not apply DNR to extension-initiated requests) and is a spike in B1e,
  not a promise.
- The proxy's reads keep their property that they cannot put anything on chain; the new
  property of the broadcast route is "cannot author or sign anything".

**Permissions and hosts, one list.** `storage`, `alarms`; **host permissions** for
`https://api.noc-tura.io/*` (reads, broadcast, prices, geo, presale — readable without CORS)
and `https://wallet.noc-tura.io/*` (the passkey RP ID); a content script on `<all_urls>`
(Wallet Standard must be present on every page — the one broad grant, which shows the "read
and change all your data on all websites" warning and is justified in the manifest and the
listing). No `tabs`, no history, no page reading, no clipboard permission. **Firefox does not
show host permissions added in an update**, so a host added after the first release must be
requested at run time (`permissions.request`) rather than silently breaking Firefox users.

## 5. Build, gates, release

**Build.** `extension/` beside `web/`: Vite, and one manifest source rendered for Chrome (MV3,
`background.service_worker`) and Firefox (MV3, `background.scripts` event page). Chrome: a
`key` field keeps the ID stable between development and store builds (store handling of it is
checked before the first submission). Firefox: **`browser_specific_settings.gecko.id`**
(mandatory for signing MV3) and **`data_collection_permissions`** (required for new AMO
submissions; it cannot honestly be `none` — see the privacy list below). Two packages;
**reproducible** — two builds, one sha256, published; AMO signs the XPI, so the published hash
is of the unsigned contents. Minimum versions: **Chrome 122, Firefox 150**.

**Gates in `npm run verify`**, the `web/` pattern:
- tsc, tests, secret scan;
- **extension CSP**: `script-src 'self'` (plus `'wasm-unsafe-eval'` only if a WASM module is
  ever added), no external script;
- **host allowlist over the package**: exactly the hosts in §4, each with a reason;
- **permissions**: the manifest's permissions equal the list in §4, each justified;
- **vault isolation**: checked in the sources (every file under the package, not just `src/` —
  a file anywhere can be bundled once an HTML entry loads it — plus the HTML entries at the
  package root, each of which may load only its own page's entry), in the built output (a
  shared chunk cannot carry vault code into another bundle, backstopped by 5 markers: envelope,
  derivation, bip39, passkey, kdf) and in both built manifests (`web_accessible_resources`
  cannot expose the vault page to being framed); `storage.session` only by the background,
  **pinned to `TRUSTED_CONTEXTS`** the moment the service worker starts (a no-op on Firefox,
  which has no `setAccessLevel`); the privileged message types are sent only from extension
  pages;
- **RPC method list**: every call maps to an allowed method;
- **`npm ci --ignore-scripts`**: the extension's own install runs no `postinstall`/`prepare`
  scripts from a dependency, in CI and locally;
- reproducibility and a manifest check (both browsers' required fields).

**Tests.**
- Crypto: vectors for Argon2id, AES-GCM, AES-KW, HKDF and the envelope format; derivation must
  produce the **Android app's addresses** from its pinned vectors (`transparent.test.ts`).
- **Where moved code is tested.** The root jest ignores `core/` (`jest.config.js`); `core/`
  tests run under vitest in Node. Code moved to `core/` therefore gets an **app-side jest test**
  that imports it from `core/` (this already works — `presaleBuyModule.test.ts` does it). Note
  that the app's jest maps `@solana/web3.js` to its manual mock, so byte-level encoders get
  their real check under vitest, and the on-device check stays part of any app release that
  uses them (the Hermes `Buffer` trap passes on Node and fails on device).
- Protocol: both message partitions, origin checks, request queue, lock, every red-flag row,
  the `signMessage` rules, the no-double-spend flow — each with a mutation that proves the
  test can fail.
- End to end: Playwright loads the extension into Chromium; a test page connects and asks for a
  signature against a simulated RPC and broadcast route; no real funds move. Runs **in CI**, not
  only locally.

**Needed from the coordinator (ICO Claude), before the work that depends on each:**
1. **The broadcast-only route** described in §4.
2. **Never 403 on an unknown `Origin`.** With host permissions the extension needs no CORS
   headers, but it sends `chrome-extension://<id>` or a random per-install
   `moz-extension://<uuid>`; if an unrecognised `Origin` produced a 403, CrowdSec would ban
   every extension user.
3. Refused JSON-RPC methods answered with **HTTP 200 and a JSON-RPC error**, not 403.
4. `getBlockHeight` re-confirmed allowed; a decision on `getFeeForMessage` and
   `getMinimumBalanceForRentExemption`.
5. What `/geo/check` returns when it cannot geolocate (the gate closes on unknown either way).

**S2 security spec — kept, adapted, deferred, rejected.**

| S2 requirement | B1 |
|---|---|
| auto-lock 5 min | **kept** |
| re-auth for new recipients, large amounts, approvals/delegations, settings changes | **kept** (§3) |
| SetAuthority blocked; unlimited Approve blocked; durable-nonce warning; whole balance to first-time address; origin mismatch blocked | **kept** (§3 table) |
| Token-2022 transfer hooks, permanent delegate, freeze authority → warning | **kept** (§3 table) |
| Confirm disabled 1–2 s on red flags, no default focus, Enter does not confirm | **kept** |
| re-simulate after ~30 s, signature bound to the shown blockhash | **kept** |
| unknown program: blind signing off by default | **adapted**: a warning, not a block — most real dApps use programs B1 does not decode |
| known drainer / phishing list → block | **deferred** to B1e (needs a maintained list and its source) |
| simulation from more than one party | **deferred** (one source, mitigated by decoded instructions beside it) |
| anti-phishing phrase after unlock | **deferred** to B1e |
| hardware wallet above $1 000; Ledger | **deferred** (no hardware wallets in B1) |
| lockfile, `ignore-scripts`, audit on every PR | **kept** as CI gates |
| sandboxed vault origin + non-extractable WebCrypto key | **replaced**: the extension's own origin is the vault; a non-extractable `CryptoKey` cannot live in `storage.session` (Chrome serialises it as JSON) and a service worker is stopped at will, so session keys are raw bytes, bounded by §1 |
| AI Guard | **rejected for B1** |

**Release gates.**
1. **Internal adversarial review**, at least two rounds, of this spec and of the code. Two
   rounds of the spec are done (Fable 5.1, 2026-09-27 and 2026-09-28); this is revision 3.
2. **An independent external security review before either store listing.** Cost and vendor
   are the owner's.
3. Developer accounts for both stores are opened by the owner. The privacy policy and both
   stores' disclosures say **truthfully** what leaves the device:
   - to the coordinator: the user's IP address (jurisdiction, reads, broadcast), public
     addresses (balances, history, presale, referral), the **contents of every transaction
     before signing** (simulation) and every signed transaction (broadcast), and on Firefox a
     **per-install identifier** (the `moz-extension://<uuid>` origin, sent with each request);
   - to the passkey provider, if the user syncs passkeys: the passkey itself;
   - no seed, no private key, no browsing data, no analytics.

**Phases, each its own PR.**
- **B1a** — `core/` moves (derivation, transfers, balances, stale-list gate) and the vault
  (envelope, Argon2id worker, passkey, session keys, auto-lock, message partitions).
- **B1b** — the wallet: onboarding, send (with the pending/expiry flow), receive, history,
  accounts.
- **B1c** — connection to sites (provider, origin checks, grants, confirmations, red flags).
- **B1d** — presale with the jurisdiction gate.
- **B1e** — hardening (drainer list, anti-phishing phrase, the DNR spike), Firefox, packaging,
  release.
