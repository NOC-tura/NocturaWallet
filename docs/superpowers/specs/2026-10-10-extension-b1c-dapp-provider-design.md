# Noctura Extension B1c — the dApp provider (connect, sign, approve)

**Status:** draft rev 1, 2026-10-10. The owner approved the design in conversation (sections 1–3) and took decisions
D1–D9 below. Next: Fable 5.1 review of this spec → owner review → one plan per part, each with its own Fable review.

**What this is.** The extension becomes a wallet any Solana site can use through Wallet Standard: connect, disconnect,
events, `signMessage`, `signTransaction`, `signAndSendTransaction`, on `solana:mainnet` only. It builds the design's
#46 sign-message, #47 dapp-connect, #48 dapp-tx-approval and #49 connected-apps (`/home/user/Downloads/index.html`
ix:17442-19100, `screen.md` 46–49), #31's "Connected dApps" row and #37's "dApp connections" bullet, which B1b
deferred (B1b-2b §9, D22). It realises B1 spec §3 (`2026-09-27-extension-b1-design.md`, owner-approved 2026-09-27),
which stays binding where this spec does not refine it; where the design and B1 §3 disagree, the ruling is recorded
here (§9).

**Built on** `main` at c8b02a6 (B1b complete: PRs #101–#109). Transparent mode only; shielded variants are B2.

**One spec, three plans** (owner, 2026-10-10):

| plan | content |
|---|---|
| **B1c-1 — connection** | provider + relay content scripts; the `PAGE` message partition and its origin rule; grants, request queue, approval window; #47 (verified / unknown / lookalike) with the local block; #49 + #31 row + #37 bullet; #46 `signMessage`; manifest `<all_urls>`; E2E with a real test dApp page; visual pass |
| **B1c-2 — transactions** | decoder (System, SPL Token, Token-2022, ATA, Compute Budget, presale), lookup-table resolution, simulation and balance changes, #48 without blocks; `signTransaction` (batches ≤ 5) and `signAndSendTransaction` through the existing broadcast route; B1b's re-authentication rules |
| **B1c-3 — red flags** | B1 §3's full red-flag table: blocks with a one-transaction override (typed word + re-authentication), Confirm held 1.5 s, no default focus, Enter does not confirm; Token-2022 extension warnings |

B1c-2 never ships to a store without B1c-3: B1c-3 must be on `main` before the first release build that contains
B1c-2 (a release gate, §8.5). Plan 1 advertises only the features it implements (`standard:connect`,
`standard:disconnect`, `standard:events`, `solana:signMessage`); plan 2 adds the two transaction features.

---

## Decisions

### Owner decisions (2026-10-10)

| # | decision | applied here |
|---|---|---|
| D1 | **#34 dApps (browse grid + Connections tab) is out of B1c.** #49 is reached from #31. The grid comes later, with a coordinator source for the list | §9 |
| D2 | **Known domains** = `noc-tura.io` and its subdomains + a short baked list of large Solana dApps (§2.4). The same list drives the "Verified" badge and the lookalike check | §2.4 |
| D3 | **"Reject and report" reports nothing to a server in B1c.** It rejects and blocks the origin locally (`v1_dapp_blocked`); later requests from it are refused silently; the user unblocks on #49. A coordinator report endpoint is a later plan | §2.5, §4.4 |
| D4 | **"This session only" ends when the wallet locks** (auto-lock, manual lock) **or the browser closes**: session grants live in `storage.session`, wiped with the signing keys | §2.2 |
| D5 | **While locked, a site reveals nothing.** A silent connect returns no accounts even for an "Until revoked" grant; an explicit connect opens unlock, then restores the grant without #47 | §2.2, §3.1 |
| D6 | **Approach A:** a thin own provider (`@wallet-standard/wallet` only) + relay + background as the only decider + an extension window for every approval; own decoders, no new third-party code in the signing path | §1 |
| D7 | **The split into three plans** (table above) | header |
| D8 | **47c "permission overreach" is not built:** Wallet Standard cannot express `skipPrompt` at connect. Its batch rule moves to signing: a batch of more than **5** transactions is refused in the background, no window | §3.3, §9 |
| D9 | **Binary `signMessage` is refused** (B1 §3), not shown as hex as the design draws it; **"Disconnect all" on #49 is the design's hold** (as #37's), not B1 §3's typed confirmation | §3.2, §4.4, §9 |

### Controller rulings (most secure default, stated; C1–C12)

| # | ruling | why |
|---|---|---|
| C1 | **The dApp's account is the one granted**, not the extension's active account. Switching accounts in the popup changes nothing for a site. `change` fires only when the granted account is removed, the wallet locks or unlocks, or the grant ends | a site never learns about other accounts by the user browsing their own wallet |
| C2 | **A dApp-initiated `disconnect` removes the grant, whichever its scope.** The next connect shows #47 again | a dApp's "Disconnect" button must leave it disconnected; otherwise a silent connect would undo it on the next load |
| C3 | **One approval window at a time**; requests wait in one FIFO queue across origins. At most **1 pending request per origin** (a second one is refused `request-pending`) and **5 queued in total** (the sixth is refused `busy`) | no stacked windows a drainer can click through; a site cannot flood the queue |
| C4 | **A request expires 5 minutes after it arrived**, whether queued or shown; the window then closes and the dApp gets `timeout`. Closing the window is a rejection | nothing waits forever behind a forgotten window |
| C5 | **No request data travels in a URL.** The window asks the background (`dapp.pending`) | a URL is visible to history and to other extensions |
| C6 | **No favicon, no whois, no remote list** (the design's "Domain age (whois)" line and "The verified list comes from github.com/solana-labs/dapp-list" are dropped): a fetch to the site or a third party would leak what the user visits and would need CSP relaxed. Rows use the domain's initials | CSP stays exactly as it is (§1.6) |
| C7 | **The dApp name** shown on #46/#47/#49 is the known list's name for a known domain, otherwise the hostname. A name the page supplies (Wallet Standard has none at connect; SIWS text carries a domain) is never shown as the app's name | a page cannot pick its own label |
| C8 | **Origins are compared as the browser reports them** (`sender.origin`, ASCII/punycode, scheme + host + port). A grant is per exact origin: `https://jup.ag` and `https://www.jup.ag` are two grants | no suffix or registrable-domain matching anywhere a grant is checked |
| C9 | **Events go through a port** the relay opens; best effort. A lost event is harmless: every request re-checks the grant | the background never trusts the page's view of the connection |
| C10 | **Pages get stable error codes** (§1.5), never internal error text | nothing internal reaches a page |
| C11 | **The blocked list and the grants are wiped by a wallet delete and kept by a restore** (plan 1 of B1b's `WALLET_DATA_KEYS`) | as the address book |
| C12 | **An unknown origin can only get "This session only"**; "Until I revoke" is shown and disabled, as the design draws it (47b) | the design's rule |

---

## 1. Architecture

```
dApp page ──┐
            │ window.postMessage (same tab only)
[1] provider  (MAIN world)      no state, no keys, no trust
            │
[2] relay     (ISOLATED world)  adds a request id, decides nothing
            │ runtime.sendMessage / runtime.connect (events)
[3] background                  the only decider: origin, frame, grant, queue, signing
            │ windows.create
[4] approve.html (extension window, 412 px)  #47 / #46 / #48 → dapp.decide → [3]
```

### 1.1 Provider (`src/provider/`, own bundle `provider.js`)

- A content script with `world: "MAIN"`, `run_at: "document_start"`, `all_frames: false`, matches `<all_urls>`.
- Registers one Wallet Standard wallet "Noctura" (name, icon as a `data:image/svg+xml` URL, `chains:
  ['solana:mainnet']`, the features of §3) with `@wallet-standard/wallet`'s `registerWallet`. No other dependency.
- Holds no state beyond the last accounts the background returned (so `wallet.accounts` can be read synchronously, as
  the standard requires). Every method posts `{source: 'noctura-provider', id, type, payload}` to the window and
  awaits the matching `{source: 'noctura-relay', id, result | error}`.
- The page can rewrite every line of it. Nothing it sends is trusted (§1.3).

### 1.2 Relay (`src/relay/`, own bundle `relay.js`)

- A content script in the isolated world, `run_at: "document_start"`, top frame only, `<all_urls>`.
- Accepts a window message only when `event.source === window` and `data.source === 'noctura-provider'`, and the
  type is one of the page types (§1.4). Forwards it with `runtime.sendMessage`; posts the answer back with
  `window.postMessage(…, location.origin)`.
- Opens one `runtime.connect({name: 'noctura-page'})` port on the first request and forwards its events to the page.
  If the port disconnects (service worker stopped), it reconnects on the next request.
- Decides nothing and adds nothing except the request id it already received.

### 1.3 Background — the `PAGE` partition (`src/background/dapp/`)

A third partition beside the existing privileged ones (`messages.ts`):

- **Origin rule** (B1 §3, unchanged): accepted only if `sender.id === runtime.id`, `sender.tab` present,
  `sender.frameId === 0`, `sender.origin` an `https:` origin. Opaque / `null` origins refused; **no fallback to
  `sender.url`**. A development build (`NOCTURA_DEV`) may accept `http://localhost` and `http://127.0.0.1`; a store
  build never (gated, §8.3).
- A page type from an extension page is refused; a privileged type from a page is refused (both partitions stay
  disjoint, a test per direction).
- Modules: `grants.ts` (grant store + session grants), `queue.ts` (the queue, C3/C4), `known.ts` (the known list and
  the lookalike check, §2.4), `blocked.ts` (`v1_dapp_blocked`), `pageApi.ts` (handlers), `window.ts` (the approval
  window), `signMessage.ts` (§3.2). B1c-2 adds `decode/`, `simulate.ts`, `signTx.ts`; B1c-3 `redFlags.ts`.

### 1.4 Messages

**Page types** (from the relay):

| type | payload | answer |
|---|---|---|
| `page.connect` | `{silent: boolean}` | `{accounts: [publicKey] }` (zero or one) |
| `page.disconnect` | — | `{}` |
| `page.signMessage` | `{account, message: base64}` | `{signature: base64, signedMessage: base64}` |
| `page.signTransaction` (B1c-2) | `{account, transactions: base64[]}` (1–5) | `{signed: base64[]}` |
| `page.signAndSendTransaction` (B1c-2) | `{account, transaction: base64, options?}` | `{signature: base58}` |

**Events** (background → port → relay → provider): `change {accounts}` only.

**Privileged types** (only from `approve.html`: `sender.origin` = the extension's origin and the path of
`sender.url` = `/approve.html` — for an extension's own page the browser sets both, unlike a web page's claim): `dapp.pending` → the request the window shows (§2.3), `dapp.decide {requestId, decision, …}`.
**Privileged types from the popup/tab:** `dapp.grants.list`, `dapp.grants.revoke {origin}`, `dapp.grants.revokeAll`,
`dapp.grants.restore {grant}` (the undo, §4.4), `dapp.blocked.list`, `dapp.blocked.remove {origin}`.

### 1.5 Errors returned to a page (C10)

| code | when |
|---|---|
| `rejected` (4001) | the user rejected, closed the window, or chose "Reject and report" |
| `unauthorized` (4100) | no grant for this origin, or the account is not the granted one |
| `request-pending` | this origin already has a request open |
| `busy` | the queue holds 5 requests |
| `timeout` | 5 minutes passed (C4) |
| `invalid-request` | malformed payload, wrong chain, batch > 5, message refused (§3.2) |
| `blocked` | — never sent: a blocked origin's requests get `rejected`, indistinguishable from a user rejection (so a site cannot probe the block) |

The provider turns them into `Error` objects with `code` and a fixed English message.

### 1.6 Manifest, CSP, bundles

- `content_scripts`: two entries (`provider.js` MAIN, `relay.js` ISOLATED), `matches: ["<all_urls>"]`,
  `run_at: "document_start"`, `all_frames: false`. Firefox: `world: "MAIN"` from 128 (our floor is 150).
- The reason recorded in `manifest/source.mjs`: *"Sites find the wallet through Wallet Standard, which must be present
  on every page; the scripts read nothing from the page and send nothing unless the site asks the wallet."* The
  permissions gate pins both entries.
- **No new permission** (`windows.create` and `runtime.connect` need none; no `tabs`).
- **CSP unchanged** (C6). The approval window is an extension page under the same policy.
- New entry `approve.html` (Vite input), built from the popup's React shell and styles.

---

## 2. State

### 2.1 Grants

```ts
interface Grant {
  origin: string;          // exactly sender.origin
  account: string;         // base58 publicKey of the granted account
  scope: 'session' | 'persistent';
  connectedAt: number;     // UTC ms
  lastUsedAt: number;      // UTC ms; updated by every accepted request
}
```

- `persistent` grants: `v1_dapp_grants` in `storage.local` (background-owned key, own mutex, at most **200**; a 201st
  connect is refused `invalid-request` with #47 showing "You have 200 connected apps. Revoke one in Settings first.").
- `session` grants: `dapp_session_grants` in `storage.session`; wiped with the signing keys on lock and by the browser
  on close (D4).
- Removing an account (B1b E13) deletes its grants and emits `change {accounts: []}` to those origins.

### 2.2 Lock (D4, D5)

| situation | silent connect | explicit connect | sign request |
|---|---|---|---|
| locked, no grant | `{accounts: []}` | window: unlock → #47 | `unauthorized` |
| locked, persistent grant | `{accounts: []}` | window: unlock → grant restored, no #47 | `unauthorized` (the dApp must connect first) |
| unlocked, grant | `{accounts: [granted]}` | `{accounts: [granted]}`, no window | queued (§2.3) |
| unlocked, no grant | `{accounts: []}` | window: #47 | `unauthorized` |

A silent connect never opens a window and never distinguishes "locked" from "not granted". On lock, every origin with
an open port gets `change {accounts: []}`. On unlock, open ports of origins with a persistent grant get
`change {accounts: [granted]}`.

### 2.3 Queue and window (C3, C4, C5)

- `queue.ts` holds `{requestId, origin, tabId, type, payload, arrivedAt}`, in `storage.session` (survives a service
  worker restart; dies with the browser).
- When the queue head changes and no window is open, the background opens one: `windows.create({type: 'popup',
  url: 'approve.html' | 'unlock.html?mode=unlock&next=approve', width: 412, height: 640, focused: true})`, and keeps
  its window id. Locked → the vault page unlocks first, then navigates the same window to `approve.html` (a new
  `next=approve` exit of the vault page's unlock mode).
- The window reads its request with `dapp.pending` and answers with `dapp.decide`. `windows.onRemoved` for that id
  rejects the shown request (C4). Expiry is checked by an alarm every 30 s and on every queue access.
- **A tab that closes or navigates away** does not cancel its request: it stays valid until answered or expired, and
  its answer then goes nowhere. Detecting it would need `webNavigation` or tab events, which this spec does not spend a
  permission on — an accepted limit (§7). The window shows the origin, so the user sees whose request it is.
- The window shows "1 more request waiting" (Q12) when the queue holds more.

### 2.4 Known domains and lookalikes (D2)

**The list** (`src/background/dapp/knownList.ts`, baked, owner-curated; the first version for owner confirmation):

| name | domain |
|---|---|
| Noctura | noc-tura.io |
| Jupiter | jup.ag |
| Raydium | raydium.io |
| Orca | orca.so |
| Meteora | meteora.ag |
| Magic Eden | magiceden.io |
| Tensor | tensor.trade |
| Drift | drift.trade |
| Marinade | marinade.finance |
| Kamino | kamino.finance |
| Jito | jito.network |
| Phantom | phantom.app |
| Solflare | solflare.com |
| Solscan | solscan.io |
| pump.fun | pump.fun |

**Classification** of an `https:` origin's host `h` (lower-case ASCII as the browser reports it):

1. **Verified:** `h` equals a listed domain `d` or ends with `.` + `d`.
2. **Lookalike** (checked in order; the first hit names the listed domain it imitates):
   - a. any label of `h` starts with `xn--`: decode it (own RFC 3492 decoder, tested against the RFC's vectors), map each
     character through a fixed confusables table (Cyrillic, Greek and Latin-extended letters that render as Latin;
     a table in `confusables.ts`, from Unicode `confusables.txt`, Latin targets only), and if the skeleton of `h`'s
     last two labels equals a listed domain → lookalike;
   - b. the label left of `h`'s TLD is within **Damerau–Levenshtein distance 1** of a listed domain's same label and
     `h` is not verified (`jup.ag` vs `jupp.ag`, `noc-tura.io` vs `noc-tora.io`, `orca.so` vs `orca.io` — same label,
     other TLD, distance 0, counts);
   - c. `h` contains a listed domain as a label sequence or with its dots turned to hyphens, and is not verified
     (`jup.ag.evil.com`, `jup-ag.io`, `app-noc-tura.io`);
   - d. digit/letter swaps `0→o`, `1→l`, `rn→m`, `vv→w` applied to `h`'s second-level label give a listed label.
3. **Unknown:** everything else.

Rule b applies only to listed labels of 4 or more characters (so not to `jup`; rules a, c and d still cover it). The whole classifier is a pure function with a table test (§8.1).

### 2.5 Blocked origins (D3)

- `v1_dapp_blocked`: `{origin, blockedAt, imitates: string | null}[]`, at most 200, `storage.local`, background-owned.
- Written by "Reject and report" on #46/#47. A blocked origin's page requests are answered `rejected` at once, no
  window, no queue entry (§1.5).
- Listed under #49 (§4.4) with "Unblock".

---

## 3. Features

### 3.1 Connect (#47)

- `page.connect {silent}` per §2.2. A non-silent connect for an unlocked origin with no grant queues a `connect`
  request; the window shows #47 for the origin's class:

**47a — verified** (ix:17686-17900): overline "Connection request"; title "Connect to <name>?"; lede *"Connecting
lets the dApp see your public address. It does not move funds. Every transaction will still ask for your approval."*;
origin card (initials, name, domain in mono, "Verified" badge); permissions card "<name> will be able to": "See your
public address" (the account's short form + "— never your seed or private key", AUTOMATIC) · "Request transaction
signatures" ("You will approve each transaction individually", WITH PROMPT) · "Request message signatures" ("You will
approve each signature individually", WITH PROMPT); the ack row "I've read these permissions" / "Tap to acknowledge ·
gates the Connect button"; **the account picker** (Q01, not drawn: a select row "Account" with the wallet's accounts,
default the active one); "Stay connected": "For this session only" (default; "Disconnects when you close the dApp or
the wallet" → adapted Q02: "Disconnects when the wallet locks or the browser closes") / "Until I revoke" ("Saved in
Settings → dApp Connections (#34) · revoke any time" → adapted Q03: "Saved in Settings → Connected dApps · revoke any
time"); counter "0 of 1 acknowledgments"; sticky bar [Reject] + [Connect] (`.btn-secondary` until the ack, then
`.btn-primary` — the design's graduated unlock).

**47b — unknown** (ix:17900-18060): overline "Unknown origin" (`--warning`); title "Connect to this app?"; lede "We
don't recognize this domain. That doesn't always mean it's bad — but proceed with care."; origin card with "Unknown";
the banner "This domain isn't on the verified list" (the design's source line and whois line are dropped, C6); ack
1 "I understand this is a new domain" (→ adapted Q04: "I understand this domain is not on the verified list" — we
cannot know its age); ack 2 "I've read these permissions" / "Tap to acknowledge · second gate for unknown domain";
"Until I revoke" disabled with "Discouraged for unknown domains — re-grant per session instead" (C12); "For this
session only" with "Recommended for unknown"; counter "0 of 2 acknowledgments"; CTA "Connect for this session".

**47-lookalike** (not drawn on #47; the design's #46 IDN state, ix:17442-17560, applied to #47): overline "Suspicious
origin" (`--danger`); origin card "Lookalike" badge, the domain in mono with the differing characters in `--danger`;
banner "This domain is not <listed domain>" + the explanation (for an IDN: *"The "а" in this URL is a Cyrillic letter
(U+0430), not a Latin "a" (U+0061). The Punycode form is <xn--…>."*; for rules b–d: Q05 *"It looks like <listed
domain> but is a different site."*); the design's closing words "— a known phishing domain." are **dropped** (we do
not know that); sticky bar flips: primary `.btn-destructive` **"Reject and report"**, tertiary "Connect anyway (not
recommended)" (Q06, after #46's "Sign anyway (not recommended)"); "Connect anyway" then shows 47b's two gates.

- **Connect** grants `{origin, account, scope}` and answers `{accounts: [account]}`. **Reject** answers `rejected`.
  **Reject and report** blocks the origin (§2.5) and answers `rejected`.
- Connect and Reject are `LockedButton`s (rule 6, 500 ms).

### 3.2 Sign message (#46)

`page.signMessage {account, message}`:

1. Refused `unauthorized` unless the origin has a grant for exactly `account`.
2. Refused `invalid-request` (no window) if the bytes: deserialize as a legacy `Transaction`, a
   `VersionedTransaction` or a `VersionedMessage`; are not valid UTF-8 (fatal `TextDecoder`); contain a control
   character other than `\n` and `\t`, or a bidi override/isolate (U+202A–U+202E, U+2066–U+2069) or U+200E/U+200F;
   start with `\xffsolana offchain`; or exceed **4 KiB**.
3. Otherwise queued; #46 shows (ix:17442-17686): overline "Signature request"; title "Sign this message?"; lede *"A
   signature proves you control this wallet. It does not move funds and does not broadcast a transaction."*; origin
   card (verified / unknown / lookalike as §2.4); "Message · UTF-8 (<n> chars)"; the message in mono, scrollable,
   rendered as text (never HTML); the footer *"This won't broadcast or move funds. <name> will use the signature only to
   verify you own this wallet."*; [Reject] + [Sign].
4. **Lookalike:** the design's IDN state — "Suspicious origin", the banner, primary "Reject and report", tertiary "Sign
   anyway (not recommended)".
5. **Structured-approval keywords:** if the message contains (case-insensitive, whole word) one of `approve`,
   `approval`, `authorize`, `authorise`, `permit`, `delegate`, `transfer`, `allowance`, `spend`, `withdraw`, the
   design's alert: "Detected keyword: <word>. Even though signing won't broadcast, the dApp may use this signature
   off-chain to authorize a future action. Read the full message before signing." with the word in mono `--warning`.
   First hit only.
6. **SIWS domain check:** if the message's first line matches the SIWS header `<domain> wants you to sign in with your
   Solana account:` and `<domain>` is not the request's host → refused `invalid-request` (no window). A SIWS message
   whose domain matches is shown as above.
7. **Sign** signs with the granted account's session key (ed25519 over the exact bytes) and answers `{signature,
   signedMessage}`. While signing: the design's "signing-in-progress" state (CTAs disabled, ring spinner, close
   disabled).

### 3.3 Transactions (B1c-2, B1c-3) — B1 §3, refined

- `page.signTransaction`: 1–5 transactions (D8); more → `invalid-request`, no window. All must be for `account` as fee
  payer or signer; otherwise `invalid-request`.
- Lookup tables resolved with `getMultipleAccounts` through the proxy before decoding; unresolvable → that
  instruction is "unknown program".
- **Decoder** for System (transfer, createAccount, assign, allocate, advanceNonceAccount), SPL Token and Token-2022
  (transfer, transferChecked, approve, approveChecked, revoke, setAuthority, closeAccount, burn, burnChecked,
  initializeAccount*, syncNative) and the Token-2022 extensions B1 §3 names, ATA (create, createIdempotent), Compute
  Budget (limit, price), the presale program (its instructions by Anchor discriminator from the IDL already in the
  repo).
- **Simulation** through the proxy with `accounts` = the signer's wallet account and its token accounts touched by the
  transaction; balance changes = post − pre per mint, in base units (`bigint`), shown with the token's decimals. #48's
  "simulating" state holds Approve disabled until it answers (no minimum wait). Re-simulated after 30 s unconfirmed;
  the signature is bound to the blockhash of the simulation shown.
- **#48** (ix:18261-18705): "simulating-blocking", balance changes, decoded instructions beside them, fee; red flags
  (B1c-3); "origin-mismatch · auto-reject" (no Approve path); "unlimited-spend · typed-confirm" (B1c-3).
- **Re-authentication** (B1b's rules through #10): first send to a new address, above 5 % of balance or the dollar
  threshold, whole balance to a first-time address, bounded approvals, overrides.
- `page.signAndSendTransaction`: sign, broadcast through the existing coordinator route, answer the signature as soon
  as the route accepts it; the dApp confirms. A second identical request while the first is unresolved → `rejected`.
  The sent transaction appears in #26 history with the design's "Dapp · simulated" origin badge.
- **B1c-3** builds B1 §3's red-flag table exactly, with its override rule (typed symbol or word + re-authentication,
  one transaction, no setting disables a block), Confirm disabled 1.5 s on any red-flag screen, no default focus,
  Enter does not confirm.

The plans for B1c-2 and B1c-3 refine this section into engine items; they may not loosen it.

---

## 4. Screens in the popup and settings

### 4.1 #31 Settings — "Connected dApps" row

In the Connections group above "Address book" (ix:13552, 13621): label "Connected dApps", meta "<n> connected" (Q07)
or empty when none; → #49.

### 4.2 #37 Delete wallet — the bullet

The list of what is wiped gains "dApp connections and blocked sites" (Q08), in the place the design reserves
(ix:14981).

### 4.3 The approval window

`approve.html` renders #47 / #46 / #48 at 412 × 640, no tab bar, no back. It holds no state of its own: on mount it asks
`dapp.pending`; after `dapp.decide` it asks again and shows the next request or closes itself (`window.close()`).
Empty (a request that expired meanwhile): "This request expired." (Q09) + [Close].

### 4.4 #49 Connected apps (ix:18705-19100)

- Top bar "Connected apps" (`.noc-h1-compact`), back → #31.
- Header "<n> active sessions" · "Sorted by last used".
- Rows (session and persistent grants together, by `lastUsedAt` desc): initials avatar (C6), name (C7), domain in mono,
  "Connected <YYYY-MM-DD> · last used <relative>" (B1b's `whenText` rules), a "This session" pill on session grants
  (Q10, not drawn), [Revoke].
- **Revoke:** no confirmation (the design's "safe direction"); the row leaves; the design's **undo toast** for 5 s
  ("Disconnected <name>" + [Undo], Q11); Undo restores the grant exactly (`dapp.grants.restore`); after 5 s it is final
  and the origin gets `change {accounts: []}`. A revoke takes effect at once in the background (the undo re-grants), so
  no request is accepted during the 5 s.
- **Row tap → detail sheet:** Permissions ("Read public keys · Granted at connect — view-only", "Sign transactions (with
  prompt) · Each request asks before signing", "Sign messages (with prompt)"), Session (Connected <date>, Last used
  <relative>, "Until revoked" / "This session only"), [Revoke].
- **Disconnect all:** the design's sticky "Hold to disconnect all · <n> sessions", the `.s7-longpress` hold of #37
  (1 s, D9). Revokes every grant; no undo.
- **Blocked sites** (not drawn; our addition, D3): a section below the list, "Blocked sites" (Q13), rows with the
  domain in mono, "Blocked <date>" and "Looked like <listed domain>" when known, [Unblock] (no confirmation).
- **Empty:** "No connected apps" + *"Connect a dApp from the dApps tab to see it here. You'll be asked once per session
  before signing."* → adapted Q14: "When you connect a site, it appears here." The design's [Browse dApps] button is
  dropped (D1).
- Skeleton while loading; "Could not load your connections. Try again." (Q15) on failure.
- Dropped from the design, declared: the SHIELDED badge (B2), "Permissions reduced 2 d ago" (no partial permissions in
  B1c), pull-to-refresh (a popup has no pull gesture; the list re-reads on focus).

---

## 5. Errors and edge cases

| case | behaviour |
|---|---|
| service worker restarts with a request shown | the queue is in `storage.session`; the window re-asks `dapp.pending` on `visibilitychange`; the request survives |
| the browser closes with a window open | session storage dies; the page's promise never resolves (the page died too) |
| the user locks the wallet while #46/#47/#48 is shown | the window's request is rejected `rejected`; the queue is cleared with `rejected`; the window closes |
| the wallet is deleted | every grant, session grant and block wiped; open ports get `change {accounts: []}`; queue rejected |
| two windows race (`windows.create` twice) | the background records the window id under the queue mutex before opening; a second open is refused by the mutex |
| a page sends 1 000 requests | the first is queued, the rest `request-pending`; no window storm |
| a page calls `connect` from an iframe | refused by the origin rule (`frameId ≠ 0`) — stated consequence (B1 §3) |
| `http://` page | refused; store build only `https:` |
| the granted account is removed | its grants deleted, `change {accounts: []}` |
| the popup's active account changes | nothing (C1) |

---

## 6. Testing

### 6.1 Unit and component (vitest, against the real background)

Each item has a **named mutation** that must turn a test red, and a positive control where a negative is asserted.

- **Origin rule:** iframe, `http:`, `null`, opaque, foreign `sender.id`, no `sender.tab`, a forged `sender.url` → all
  refused; the same request from a valid top frame → accepted (positive control).
- **Partitions:** a page type from an extension page refused; `dapp.decide` from the relay refused; from `approve.html`
  accepted.
- **Grants:** session grant gone after lock, persistent kept; silent connect while locked returns `[]` for both "no
  grant" and "persistent grant" (indistinguishable); explicit connect after unlock restores without #47; dApp
  disconnect removes a persistent grant (C2); account switch changes nothing (C1); removed account → `change []`;
  wiped by delete, kept by restore (C11); cap 200.
- **Queue:** one per origin, five total, FIFO across origins, expiry at 5 min (fake clock), window close = rejection,
  lock rejects all, a blocked origin answered `rejected` with no queue entry.
- **Classifier** (§2.4): a table — verified (`app.noc-tura.io`, `www.jup.ag`), lookalike by each rule a–d
  (`xn--phntom-ezv.app`, `jupp.ag`, `orca.io`, `jup.ag.evil.com`, `jup-ag.io`, `n0c-tura.io`, `rnagiceden.io`),
  unknown (`example.com`, `solana-mint-hub.xyz`), and near-misses that must stay unknown (`jupiter.com` — no listed
  label within distance 1, `orchard.so`, `notcoin.io`); the punycode decoder against RFC 3492's sample strings.
- **signMessage:** refused — a legacy transaction's bytes, a versioned transaction, a versioned message, **a UTF-8-valid
  legacy message that deserializes**, invalid UTF-8, a control char, each bidi char, the off-chain prefix, 4 KiB + 1,
  a SIWS header for another domain; accepted — a canonical SIWS message for the request's domain, a plain sentence
  (positive controls); the keyword alert fires on "approve" and "Permit", and not on "approved" or "transference" (whole words
  only — stated); the signature verifies with `ed25519.verify` against the granted key.
- **#47 / #46 / #49 components:** every state of §3–§4 with its copy (verbatim strings), the graduated unlock (Connect
  `.btn-secondary` until each ack), "Until I revoke" disabled for unknown, lookalike CTA order, undo restores exactly,
  hold-to-disconnect, rule 6 on every CTA.

### 6.2 Gates

- **Permissions gate:** both `content_scripts` entries pinned (matches, world, run_at, all_frames); no new permission.
- **Page-bundle gate** (new, after the vault-isolation gate): the built `provider.js` and `relay.js` module maps may
  contain only their own source files and `@wallet-standard/*`; any module from `src/background`, `src/vault`,
  `src/unlock`, `src/app` or `session` fails.
- **Dev-origin gate:** a store build's background contains no `http://localhost` acceptance (the `NOCTURA_DEV` branch
  is dead-code-eliminated; the gate greps the built `background.js`).
- **CSP gate:** unchanged policy.

### 6.3 E2E (Playwright, contained)

A test dApp page served through `ctx.route` at `https://dapp.test` (and a lookalike `https://xn--jp-…`/`https://jupp.ag`
fixture), using the real `@wallet-standard/app` `getWallets()`:

- **19 · connect:** the page finds "Noctura" → connect → #47b → both gates → Connect → the page shows the account;
  reload → silent connect returns it; lock → `change []`; unlock → the page gets it back (persistent) / not (session).
- **20 · signMessage:** sign a SIWS message → verify with ed25519 in the test; a transaction's bytes as a message →
  refused, no window.
- **21 · lookalike:** `jupp.ag` → "Reject and report" → the next connect is rejected with no window → #49 Unblock → a
  connect opens #47 again.
- **22 · revoke:** #49 Revoke → Undo → still connected; Revoke → wait 5 s → the page gets `change []`.
- **23 · iframe (negative control):** the same page in an iframe cannot connect; the top frame can.
- **B1c-2:** sign-and-send against the fake coordinator (as `send.spec.ts`), a batch of 5 signs, a batch of 6 is
  refused.

### 6.4 Visual

`e2e/visual-dapp.spec.ts` shoots every state of #46, #47 (47a ×2, 47b ×3, lookalike), #49 (populated, empty, detail,
hold, undo toast, blocked section) and the window's expired state at 412 px; the opus-tier review against
`index.html`, as B1b.

### 6.5 Release gates (B1e)

- Firefox: a manual run of E2E 19–23 on Firefox ≥ 150 (MAIN world, ports).
- B1c-3 on `main` before any release containing B1c-2.

---

## 7. Out of scope

- #34 dApps (D1); a coordinator report endpoint (D3); favicons, whois, remote lists (C6); 47c (D8); hex message
  preview (D9); partial permissions; the SHIELDED badge and every shielded variant (B2); WalletConnect; Ledger;
  `signIn` (Wallet Standard `solana:signIn`) — B1c offers `signMessage` only, SIWS text is signed through it.
- **Accepted limits:** a request whose tab closed stays valid until answered or expired (§2.3); events are best effort
  (C9); simulation has one source, the coordinator (B1 §3).

---

## 8. Where things live

| path | what |
|---|---|
| `extension/src/provider/` | the MAIN-world provider (bundle `provider.js`) |
| `extension/src/relay/` | the ISOLATED relay (bundle `relay.js`) |
| `extension/src/background/dapp/` | grants, queue, known list + classifier + confusables + punycode, blocked, pageApi, window, signMessage; B1c-2 decode/simulate/signTx; B1c-3 redFlags |
| `extension/src/approve/` + `approve.html` | the approval window (#46, #47, #48) |
| `extension/src/app/screens/ConnectedApps.tsx` | #49 |
| `extension/manifest/source.mjs` | content scripts + reasons |
| `extension/scripts/check-page-bundles.mjs` | the page-bundle gate |
| `extension/e2e/dapp*.spec.ts`, `e2e/fixtures/dapp/` | E2E + the test dApp page |

---

## 9. Design ↔ B1 §3 rulings (recorded, not silent)

| design | B1 §3 | ruling |
|---|---|---|
| #46 non-UTF-8 → hex preview | refuse non-UTF-8 | **refuse** (D9) |
| #49 Disconnect all: hold (60 %) | typed confirmation | **hold**, #37's 1 s primitive (D9) |
| #47c permission overreach | — | **not built** (D8) |
| #47 "Until I revoke" saved under "dApp Connections (#34)" | — | #34 out (D1); the copy points to Settings → Connected dApps (Q03) |
| #47b whois domain age, verified-list source line | — | dropped (C6) |
| #46 "— a known phishing domain." | — | dropped; we know it is a lookalike, not that it phishes |
| #48 ~900 ms honest skeleton | simulation mandatory | Approve waits for the real answer; no artificial minimum |
| #49 SHIELDED badge, "Permissions reduced" | — | dropped (B2; no partial permissions) |
| #49 empty [Browse dApps] | — | dropped (D1) |
| first six / last six highlighted | labels + first-send warning | B1 §3 (owner), unchanged |

---

## 10. Owner copy to confirm (strings the design does not draw)

| # | where | string |
|---|---|---|
| Q01 | #47 account picker label | "Account" |
| Q02 | #47 session option | "Disconnects when the wallet locks or the browser closes" |
| Q03 | #47 persistent option | "Saved in Settings → Connected dApps · revoke any time" |
| Q04 | #47b ack 1 | "I understand this domain is not on the verified list" |
| Q05 | lookalike, rules b–d | "It looks like <listed domain> but is a different site." |
| Q06 | #47 lookalike tertiary | "Connect anyway (not recommended)" |
| Q07 | #31 row meta | "<n> connected" |
| Q08 | #37 bullet | "dApp connections and blocked sites" |
| Q09 | window, expired | "This request expired." |
| Q10 | #49 session pill | "This session" |
| Q11 | #49 undo toast | "Disconnected <name>" · "Undo" |
| Q12 | window, queue | "1 more request waiting" / "<n> more requests waiting" |
| Q13 | #49 section | "Blocked sites" · "Blocked <date>" · "Looked like <listed domain>" · "Unblock" |
| Q14 | #49 empty | "When you connect a site, it appears here." |
| Q15 | #49 failure | "Could not load your connections. Try again." |
| Q16 | #47 full | "You have 200 connected apps. Revoke one in Settings first." |
