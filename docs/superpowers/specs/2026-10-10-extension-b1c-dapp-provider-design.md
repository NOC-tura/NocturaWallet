# Noctura Extension B1c — the dApp provider (connect, sign, approve)

**Status:** draft **rev 2**, 2026-10-10. The owner approved the design in conversation (sections 1–3) and took
decisions D1–D11. Rev 2 applies every finding of Fable 5.1 review 1 (`.superpowers/sdd/b1c-spec-review-1.md`: H1–H3,
M1–M12, L1–L13; verdict "approve after fixes"); M1 and M2 were the owner's decisions D10 and D11. Where each finding
landed: §11. Next: owner review of this spec → one plan per part, each with its own Fable review.

**What this is.** The extension becomes a wallet any Solana site can use through Wallet Standard: connect, disconnect,
events, `signMessage`, `signTransaction`, `signAndSendTransaction`, on `solana:mainnet` only. It builds the design's
#46 sign-message, #47 dapp-connect, #48 dapp-tx-approval and #49 connected-apps (`/home/user/Downloads/index.html`
ix:17442-19100, `screen.md` 46–49), #31's "Connected dApps" row and #37's "dApp connections" bullet, which B1b
deferred (B1b-2b §9, D22). It realises B1 spec §3 (`2026-09-27-extension-b1-design.md`, owner-approved 2026-09-27),
which stays binding where this spec does not refine it; every refinement and every place the design and B1 §3
disagree is a row in §9.

**Built on** `main` at c8b02a6 (B1b complete: PRs #101–#109). Transparent mode only; shielded variants are B2.

**One spec, three plans** (owner, D7):

| plan | content |
|---|---|
| **B1c-1 — connection** | provider + relay content scripts; the `PAGE` partition with its origin rule for messages and ports; the request lifecycle (queue, port delivery, resume, keepalive, the lock hook); grants; the approval window; #47 (verified / unknown / lookalike) with the local block and the cooldown; #49 + #31 row + #37 bullet; #46 `signMessage`; manifest `<all_urls>`; gates; E2E with a real test dApp page; visual pass |
| **B1c-2 — transactions** | decoder (System, SPL Token, Token-2022, ATA, Compute Budget, presale), lookup-table resolution, simulation and balance changes, #48 without blocks; `signTransaction` (batches ≤ 5) and `signAndSendTransaction` through the existing broadcast route; B1b's re-authentication rules; E2E through `StandardWalletAdapter` |
| **B1c-3 — red flags** | B1 §3's full red-flag table: blocks with a one-transaction override (typed word + re-authentication); Token-2022 extension warnings |

**B1c-1 and B1c-2 are merge-to-`main` milestones, not releases (D10).** No store build contains B1c until B1c-1, -2 and
-3 are all on `main`: plan 1 alone is invisible to wallet-adapter dApps (`isWalletAdapterCompatibleStandardWallet`
requires a transaction feature), and plan 2 without plan 3 signs without the red-flag blocks. Plan 1 advertises only the
features it implements (`standard:connect`, `standard:disconnect`, `standard:events`, `solana:signMessage`); plan 2 adds
`solana:signTransaction` and `solana:signAndSendTransaction`.

---

## Decisions

### Owner decisions (2026-10-10)

| # | decision | applied here |
|---|---|---|
| D1 | **#34 dApps (browse grid + Connections tab) is out of B1c.** #49 is reached from #31. The grid comes later, with a coordinator source for the list | §9 |
| D2 | **Known domains** = `noc-tura.io` and its subdomains + a short baked list of large Solana dApps (§2.5). The same list drives the "Verified" badge and the lookalike check | §2.5 |
| D3 | **"Reject and report" reports nothing to a server in B1c.** It rejects, revokes any grant and blocks the origin locally (`v1_dapp_blocked`); later requests from it are refused with no window; the user unblocks on #49. A coordinator report endpoint is a later plan | §2.6, §4.4 |
| D4 | **"This session only" ends when the wallet locks** (auto-lock, manual lock) **or the browser closes**: session grants live in `storage.session`, wiped with the signing keys | §2.2, §2.4 |
| D5 | **While locked, a site reveals nothing.** A silent connect returns no accounts even for an "Until revoked" grant; an explicit connect waits for the unlock, then restores the grant without #47 | §2.2 |
| D6 | **Approach A:** a thin own provider (`@wallet-standard/wallet` only) + relay + background as the only decider + an extension window for every approval; own decoders, no new third-party code in the signing path | §1 |
| D7 | **The split into three plans** (table above) | header |
| D8 | **47c "permission overreach" is not built:** Wallet Standard cannot express `skipPrompt` at connect. Its batch rule moves to signing: a batch of more than **5** transactions is refused in the background, no window | §3.3, §9 |
| D9 | **Binary `signMessage` is refused** (B1 §3), not shown as hex as the design draws it; **"Disconnect all" on #49 is the design's hold**, not B1 §3's typed confirmation | §3.2, §4.4, §9 |
| D10 | **B1c-1 is a merge-to-main milestone, not a release** (review M1). B1c reaches a store only with all three plans; the `<all_urls>` update consequences are B1e release gates (§6.5) | header, §6.5 |
| D11 | **No password field in a window a site triggered** (review M2). When locked, the approval window says so and points to the toolbar icon; the request waits in the queue and the window switches to it when the unlock lands. The user learns one rule: *the password is typed only after clicking the Noctura icon* | §2.4, §4.3 |

### Controller rulings (most secure default, stated; C1–C16)

| # | ruling | why |
|---|---|---|
| C1 | **The dApp's account is the one granted**, not the extension's active account. Switching accounts in the popup changes nothing for a site. `change` fires only when the granted account is removed, the wallet locks or unlocks, or the grant ends | a site never learns about other accounts by the user browsing their own wallet |
| C2 | **A dApp-initiated `disconnect` removes the grant, whichever its scope.** The next connect shows #47 again | a dApp's "Disconnect" button must leave it disconnected |
| C3 | **One approval window at a time**; requests wait in one FIFO queue across origins. At most **1 open request per origin** (a second gets `request-pending`) and **5 queued in total** (the sixth gets `busy`) | no stacked windows; a site cannot flood the queue |
| C4 | **A request expires 5 minutes after it arrived**, queued or shown; the page gets `timeout`. Closing the window, its ✕, or Reject is a rejection | nothing waits forever behind a forgotten window |
| C5 | **No request data travels in a URL.** The window asks the background (`dapp.pending`) | a URL is visible to history and to other extensions |
| C6 | **No favicon, no whois, no remote list**: a fetch to the site or a third party would leak what the user visits and would need CSP relaxed. Rows use the domain's initials | CSP stays exactly as it is (§1.7) |
| C7 | **The dApp name** shown is the known list's name for a verified domain, otherwise the hostname. A page never names itself | a page cannot pick its own label |
| C8 | **Origins are compared exactly as the browser reports them** (`sender.origin`: scheme + ASCII/punycode host + port). A grant is per exact origin: `https://jup.ag` and `https://www.jup.ag` are two grants | no suffix matching where a grant is checked |
| C9 | **Results and events go over a port; requests are idempotent by id** (§1.5): a lost connection is resumed, never re-run | a service worker may stop at any time (review H1) |
| C10 | **Pages get stable error codes** (§1.6), never internal error text | nothing internal reaches a page |
| C11 | **Grants and blocks are wiped by a wallet delete and kept by a restore** (`WALLET_DATA_KEYS`, B1b) | as the address book |
| C12 | **An unknown or lookalike origin can only get "This session only"**, enforced in the background (§2.3), and drawn disabled (47b) | the design's rule |
| C13 | **The window decides nothing.** Every `dapp.decide` is validated by the background as if it were untrusted (§2.3) | as `vault.setKeys` |
| C14 | **Rejection cooldown:** 3 rejections from one origin within 10 minutes → its requests are rejected with no window for 10 minutes; the third #47/#46 for it offers "Block this site" (review M8) | no window storm, no approval fatigue |
| C15 | **Every approval screen opens with no CTA focused, its CTAs disabled for 500 ms after the window gains focus and after each state change, and Enter never confirms** (review M12) | a page cannot time a keypress or a click onto a window it caused |
| C16 | **Only `active` documents may ask** (`sender.documentLifecycle === 'active'` where the browser reports it; the relay also waits until `document.prerendering` is false) (review M11) | a prerendered page the user never saw cannot open a window |

---

## 1. Architecture

```
dApp page ──┐
            │ window.postMessage (targetOrigin = location.origin)
[1] provider  (MAIN world)      no state of its own, no keys, no trust
            │
[2] relay     (ISOLATED world)  holds the port; forwards, resumes, keeps alive; decides nothing
            │ runtime.connect port 'noctura-page' (requests, results, events)
[3] background                  the only decider: origin, frame, lifecycle, grant, queue, signing
            │ windows.create
[4] approve.html (extension window, 412 px)  #47 / #46 / #48 / locked → dapp.decide → [3]
```

### 1.1 Provider (`src/provider/`, bundle `provider.js`)

- A content script with `world: "MAIN"`, `run_at: "document_start"`, `all_frames: false`, matches `<all_urls>`.
- Registers one Wallet Standard wallet "Noctura" (name, icon as a `data:image/svg+xml` URL, `chains:
  ['solana:mainnet']`, the features of §3) with `@wallet-standard/wallet`'s `registerWallet`. No other dependency.
- Keeps only the accounts the background last sent (Wallet Standard needs `wallet.accounts` synchronously). Each method
  posts `{source: 'noctura-provider', id, type, payload}` with `targetOrigin = location.origin` and awaits the matching
  `{source: 'noctura-relay', id, result | error}`.
- **Stated limits (review L5):** every script on the page — the page's own, third-party includes, another extension's
  MAIN-world script — has the page's authority over the provider. The approval window is the only boundary. Another
  extension can register a wallet also named "Noctura"; that is not fixable from here.

### 1.2 Relay (`src/relay/`, bundle `relay.js`)

- A content script in the isolated world, `run_at: "document_start"`, top frame only, `<all_urls>`.
- Accepts a window message only when `event.source === window`, `data.source === 'noctura-provider'` and the type is a
  page type (§1.4). Waits for `document.prerendering === false` before its first forward (C16).
- Holds one `runtime.connect({name: 'noctura-page'})` port. It sends requests over it, receives `{accepted, requestId}`,
  results and events, and posts them to the page. On `onDisconnect` it reconnects (backoff 0.5 s, 1 s, 2 s, then on
  `visibilitychange`) and sends `page.resume {requestIds}` for every request it still awaits (review H1, L7).
- **Keepalive:** while it awaits at least one result it sends `page.ping` on the port every 20 s, so the service worker
  is not stopped mid-request (Chrome's 30 s idle rule). It stops pinging when nothing is open.
- Decides nothing and adds nothing except the request id it received.

### 1.3 Background — the `PAGE` partition (`src/background/dapp/`)

A third partition beside the existing privileged ones (`messages.ts`).

- **The origin rule, for messages and for ports** (B1 §3 + review M3): accepted only if `sender.id === runtime.id`,
  `sender.tab` present, `sender.frameId === 0`, `sender.origin` an `https:` origin, and `sender.documentLifecycle`
  absent or `'active'` (C16). Opaque / `null` origins refused; **no fallback to `sender.url`**. `onConnect` applies the
  same rule to `port.sender`; a port that fails it is disconnected at once. Each port is keyed `(tabId, origin)` from
  `port.sender` — never from anything the page sends.
- A development build (`NOCTURA_DEV`) may accept `http://localhost` and `http://127.0.0.1`; a store build never (gated,
  §6.2).
- A page type from an extension page is refused; a privileged type from a page is refused (a test per direction).
- Modules: `ports.ts` (port registry, delivery, resume), `queue.ts` (requests, C3/C4/C14), `grants.ts`, `known.ts`
  (list + classifier) with `confusables.ts` and `punycode.ts`, `blocked.ts`, `pageApi.ts` (handlers), `window.ts` (the
  approval window), `decide.ts` (validation, §2.3), `lockHook.ts` (§2.4), `signMessage.ts` (§3.2). B1c-2 adds `decode/`,
  `simulate.ts`, `signTx.ts`; B1c-3 `redFlags.ts`.

### 1.4 Messages

**Page messages** (relay → background, on the port):

| type | payload | immediate answer | result (later, on the port) |
|---|---|---|---|
| `page.connect` | `{id, silent}` | silent: `{result: {accounts}}` at once; else `{accepted, requestId}` or an error | `{accounts: [publicKey]}` (zero or one) |
| `page.disconnect` | `{id}` | `{result: {}}` | — |
| `page.signMessage` | `{id, account, message: base64}` | `{accepted, requestId}` or an error | `{signature, signedMessage}` (base64) |
| `page.signTransaction` (B1c-2) | `{id, account, transactions: base64[]}` (1–5) | idem | `{signed: base64[]}` |
| `page.signAndSendTransaction` (B1c-2) | `{id, account, transaction: base64, options?}` | idem | `{signature: base58}` |
| `page.resume` | `{requestIds}` | the stored result or error of each, or `{pending}` | — |
| `page.ack` | `{requestId}` | — (the stored result may be dropped) | — |
| `page.ping` | — | — | — |

**Events** (background → port): `change {accounts}` — only to ports whose origin holds a grant at that moment (review
M3), so an ungranted page learns nothing about lock timing.

**Privileged, from `approve.html` only** (`sender.origin` = the extension's origin and the path of `sender.url` =
`/approve.html`; for an extension's own page the browser sets both): `dapp.pending` → the head request as the window
shows it, or `{locked: true}`, or `{none: true}`; `dapp.decide {requestId, decision, account?, scope?}`.
**Privileged, from the popup/tab:** `dapp.grants.list`, `dapp.grants.revoke {origin}` → `{undoToken}`,
`dapp.grants.undo {undoToken}`, `dapp.grants.revokeAll`, `dapp.blocked.list`, `dapp.blocked.remove {origin}`.

### 1.5 The request lifecycle (review H1)

1. The relay sends a page message with its own `id`. The background validates the sender (§1.3), the payload and the
   grant; if the request needs the user it creates a queue entry `{requestId, origin, tabId, type, payload, arrivedAt,
   state: 'queued'}` in `storage.session` and answers `{accepted, requestId}`.
2. A decision (or an expiry, a lock, a cooldown) writes `state: 'answered', result | error` into the entry. The
   background then delivers it on every live port keyed to that `(tabId, origin)`.
3. The relay posts it to the page and sends `page.ack`; the entry is then deleted. An answered entry that is never acked
   is deleted 10 minutes after it was answered.
4. If the port was down, the relay's `page.resume` after reconnecting returns the stored answer. **An answered request is
   never re-run**: a signature or broadcast happens once, however often it is delivered (test: worker restart between
   "shown" and "decided" → the page gets the one answer; mutation: drop the re-delivery → red).
5. C4's 5 minutes are counted from `arrivedAt` by the background's own clock, independent of Chrome's 5-minute limit on a
   single event (the keepalive ping makes each event short).

### 1.6 Errors returned to a page (C10)

| code | when |
|---|---|
| `rejected` (4001) | the user rejected, closed the window, chose "Reject and report", the wallet locked or was deleted while it waited, the origin is blocked or in cooldown |
| `unauthorized` (4100) | no grant for this origin, or the account is not the granted one |
| `request-pending` | this origin already has a request open |
| `busy` | the queue holds 5 requests (a site can infer that others are queued; accepted, review L9) |
| `timeout` | 5 minutes passed (C4) |
| `invalid-request` | malformed payload, wrong chain, batch > 5, a message refused by §3.2 rules 2 and 6 |

A blocked or cooling-down origin cannot tell from the error that it is blocked; it can by timing (answered in
milliseconds, not seconds) — accepted (review L1). The provider turns codes into `Error` objects with `code` and a fixed
English message.

### 1.7 Manifest, CSP, bundles

- `content_scripts`: two entries (`provider.js` MAIN, `relay.js` ISOLATED), `matches: ["<all_urls>"]`,
  `run_at: "document_start"`, `all_frames: false`. Firefox: `world: "MAIN"` from 128 (our floor is 150).
- The reason recorded in `manifest/source.mjs`: *"Sites find the wallet through Wallet Standard, which must be present
  on every page; the scripts read nothing from the page and send nothing unless the site asks the wallet."*
  `check-permissions.mjs` today fails any `content_scripts` ("not before B1c"); that line becomes the pin of exactly
  these two entries (review L4).
- **No new permission** (`windows.create` and `runtime.connect` need none; no `tabs`, no `webNavigation`).
- **CSP unchanged** (C6). The approval window is an extension page under the same policy.
- New entry `approve.html` (Vite input), built from the popup's React shell and styles; `src/approve` is added to the
  vault-isolation gate's fixtures like `src/app` (no `storage`, no runtime listener outside `src/background`; review L13).

---

## 2. State

### 2.1 Grants

```ts
interface Grant {
  origin: string;          // exactly sender.origin
  account: string;         // base58 publicKey of the granted account
  scope: 'session' | 'persistent';
  connectedAt: number;     // UTC ms
  lastUsedAt: number;      // UTC ms; every accepted request
  recent: {type: 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction'; at: number; outcome: 'approved' | 'rejected'}[]; // last 3, for #49's detail
}
```

- `persistent`: `v1_dapp_grants` in `storage.local` (background-owned key, own mutex). `session`: in
  `storage.session`, wiped by the lock hook (§2.4) and by the browser on close (D4).
- **Cap 200** persistent grants. A connect beyond it opens #47 with Q16 and only [Reject]; the request is then answered
  `rejected` (review L2).
- Removing an account (B1b E13) deletes its grants and sends `change {accounts: []}` to those origins.
- `BACKGROUND_OWNED_KEYS` gains `v1_dapp_grants` and `v1_dapp_blocked`, with a fixture (review L4).

### 2.2 Lock and requests (D4, D5)

| situation | silent connect | explicit connect | sign request |
|---|---|---|---|
| locked, no grant | `{accounts: []}` | queued; the window shows "locked" (§4.3); after the unlock → #47 | `unauthorized` |
| locked, persistent grant | `{accounts: []}` | queued; the window shows "locked"; after the unlock → answered `{accounts: [granted]}`, the window closes | `unauthorized` (connect first) |
| unlocked, grant | `{accounts: [granted]}` | `{accounts: [granted]}`, no window | queued |
| unlocked, no grant | `{accounts: []}` | queued → #47 | `unauthorized` |

A silent connect never opens a window and never distinguishes "locked" from "not granted". Page requests never arm the
auto-lock timer; a decision in the window does (a user action).

### 2.3 Queue, window and `dapp.decide` (C3, C4, C13, C14)

- **Opening the window (review M7):** under the queue mutex, if the head is new and no window is recorded, write
  `{opening: true}` to `storage.session`, call `windows.create({type: 'popup', url: 'approve.html', width: 412, height:
  720, focused: true})`, then record its id. Before concluding "a window is open", check the recorded id with
  `windows.get` (it throws → treat as closed, clear it). The window is always `approve.html`; locked or not, it asks
  `dapp.pending` (D11).
- `windows.onRemoved(id)` rejects only the request the window was showing, and only if it is still `queued`.
- After a decision the window asks `dapp.pending` again: the next head, or `{none}` → the window closes itself. It never
  shows "expired" for a request it was not showing (review L3).
- The window shows "1 more request waiting" / "<n> more requests waiting" (Q12) when the queue holds more.
- Expiry: checked by an alarm every 30 s and on every queue access.
- **A tab that closes or navigates away** does not cancel its request: it stays valid until answered or expired, and its
  answer then goes nowhere. Detecting it would need `webNavigation` or tab events — not spent. Accepted (§7).

**`dapp.decide` validations** (each a refusal with a named mutation test, review M6):

| check | refused when |
|---|---|
| head | `requestId` is not the queue head, or not `queued` |
| expiry | the request has expired |
| unlocked | the session is locked — checked **inside `sessionMutex` at the write** (`setSessionIf`'s pattern), so a grant is never written after a concurrent lock |
| account | `account` is not one of the session's accounts |
| scope | `scope === 'persistent'` for an origin classified unknown or lookalike (C12) |
| blocked | the origin is blocked or in cooldown |
| signMessage | `account` differs from the request's (the grant's) account |

**Cooldown (C14):** each rejection is recorded per origin (`storage.session`); the third within 10 minutes starts a
10-minute cooldown in which its requests are answered `rejected` with no window. The screen for the third request shows
[Block this site] (Q17) above the sticky bar.

### 2.4 The lock hook (review H3)

`clearSession` wipes the whole `storage.session` area. Every lock — the auto-lock alarm, `vault.lock`, `onStartup`,
`onWindowRemoved`, `forgetWallet`, `lockOnMismatch` — goes through **one** lock path that, under `sessionMutex`:

1. reads the queue, the recorded window id and the ports' grants;
2. clears the session (keys, session grants, queue, cooldowns, undo buffer);
3. answers every queued request `rejected` through §1.5 (answered entries are written back after the clear, so resume
   still finds them);
4. closes the approval window (`windows.remove`, errors ignored);
5. sends `change {accounts: []}` to the ports of origins that held a grant.

A test per caller (mutation: one caller bypasses the hook → red). D11 follows: the window never holds an unlock form, so
a lock while it is open simply closes it.

### 2.5 Known domains and lookalikes (D2)

**The list** (`src/background/dapp/knownList.ts`, baked, owner-curated; this first version for owner confirmation).
**Rule:** never list a domain whose subdomains users can register or control (review M4.6).

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

**Classification** of an `https:` origin's host `h` (lower-case ASCII as the browser reports it). `skel(x)`: decode
every `xn--` label (own RFC 3492 decoder; an invalid label is kept as-is), NFD-normalise, strip combining marks, map
each character through `confusables.ts` (Unicode `confusables.txt`, entries whose target is Latin a–z/0–9), lower-case.

1. **Verified:** `h` equals a listed domain `d` or ends with `.` + `d`.
2. **Lookalike** (in order; the first hit names the listed domain it imitates):
   - a. **IDN:** some label of `h` starts with `xn--`, and `skel` of **any two consecutive labels** of `h` equals a listed
     domain (catches `xn--phntom-ezv.app` and `xn--phntom-ezv.app.evil.com`, review M4.3);
   - b. **Edit distance:** the label left of `h`'s TLD is within Damerau–Levenshtein distance 1 of a listed domain's
     second-level label of 4+ characters, `h` not verified. Distance 0 with another TLD counts: `orca.io`,
     `magiceden.us`, `jito.wtf` are lookalikes even where the brand owns them — stated, accepted (review M4.4): the
     screen says "looks like … but is a different site", which is true, and still offers "Connect anyway";
   - c. **Embedded:** `h` (the whole host string) contains a listed domain `d`, or `d` with its dots turned to hyphens,
     as a substring, and is not verified (`jup.ag.evil.com`, `jup-ag.io`, `app-noc-tura-io.com`; also
     `jup.agency.com` — stated, accepted: a false positive costs a click on "Connect anyway");
   - d. **Swaps:** `0→o`, `1→l`, `rn→m`, `vv→w` applied to the second-level label give a listed label (`n0c-tura.io`,
     `rnagiceden.io`).
3. **Unknown:** everything else. **An unknown `h` with any `xn--` label** gets 47b's extra line *"This address uses
   international characters: <h>"* (Q18), keeping B1 §3's IDN warning (review M4.2).

**Display (review L10):** the origin card's primary string is always `h` as the browser reports it (ASCII/punycode).
The decoded Unicode appears only in the lookalike banner, with every bidi and format control (`\p{Cf}`, U+202A–U+202E,
U+2066–U+2069) removed and each character outside ASCII shown with its code point. The classifier is a pure function
with a table test (§6.1).

### 2.6 Blocked origins (D3, review M9)

- `v1_dapp_blocked`: `{origin, blockedAt, imitates: string | null}[]`, at most 200 (the oldest falls out), `storage.local`,
  background-owned.
- Written by "Reject and report" (#46, #47) and "Block this site" (C14). **Blocking also revokes the origin's grant**
  (both scopes) and sends it `change {accounts: []}`.
- A blocked origin's requests are answered `rejected` at once, with no window and no queue entry.
- **Unblock** (#49) removes the block only; the next connect shows #47 (test: mutation "keep the grant" → red).

### 2.7 Revoke and undo (review H2)

- `dapp.grants.revoke {origin}` deletes the grant at once (requests are refused from that moment), sends
  `change {accounts: []}`, and moves the record into an undo buffer in `storage.session`:
  `{undoToken (128-bit random, base64url), grant, expiresAt: now + 5 s}`. It answers `{undoToken}`.
- `dapp.grants.undo {undoToken}` restores **that** record, single-shot. Refused when: the token is unknown or expired;
  the wallet is locked; the origin is now blocked; the account is no longer in the wallet; the persistent cap is
  reached; the grant was `persistent` but the origin now classifies unknown or lookalike (C12 holds on restore too). The
  popup holds only the token. A mutation per refusal and one for single-shot.

---

## 3. Features

### 3.1 Connect (#47) — every state of ix:17686-18261

All of #47's CTAs are `LockedButton`s (rule 6) and follow C15. The top-bar ✕ is Reject (C4).

**Account picker (Q01, not drawn):** a select row "Account" with the wallet's accounts (name + short address), default the
active one; placed above "Stay connected".

**47a — verified.**
- Overline "Connection request"; title "Connect to <name>?"; lede *"Connecting lets the dApp see your public address. It
  does not move funds. Every transaction will still ask for your approval."*
- Origin card: initials, name, domain in mono, "Verified" badge.
- Permissions card "<name> will be able to": "See your public address" — "<short address> — never your seed or private
  key" · AUTOMATIC; "Request transaction signatures" — "You will approve each transaction individually" · WITH PROMPT;
  "Request message signatures" — "You will approve each signature individually" · WITH PROMPT. (Plan 1 offers no
  transactions, but the grant covers them when plan 2 lands; the card shows all three in every plan.)
- Ack row "I've read these permissions" / "Tap to acknowledge · gates the Connect button"; acked: "Permissions
  acknowledged" / "Connect is now enabled".
- "Stay connected": "For this session only" (default) — Q02 "Disconnects when the wallet locks or the browser closes";
  "Until I revoke" — Q03 "Saved in Settings → Connected dApps · revoke any time".
- Counter "0 of 1 acknowledgments" → "Ready to connect" (with the design's halo).
- Sticky bar [Reject] + [Connect]: Connect `.btn-secondary` until the ack, then `.btn-primary`. A tap on the locked
  Connect does nothing, shakes the unmet gate and shows "Read the permissions above before connecting".

**47b — unknown.**
- Overline "Unknown origin" (`--warning`); title "Connect to this app?"; lede *"We don't recognize this domain. That
  doesn't always mean it's bad — but proceed with care."*; origin card "Unknown"; banner "This domain isn't on the
  verified list"; for an `xn--` host, Q18.
- Ack 1: Q04 "I understand this domain is not on the verified list"; acked: "Acknowledged — new domain" / "Final gate —
  tap to enable Connect".
- Permissions card overline "If you connect, the dApp can"; the address line "<short address> · cannot see your seed or
  private key"; **three rows** (the design draws two — no "Request message signatures" — but B1c offers `signMessage`
  to an unknown origin, so the card must say so; §9).
- Ack 2: "I've read these permissions" / "Tap to acknowledge · second gate for unknown domain".
- "For this session only" with "Recommended for unknown" and "Connection ends when you close the dApp · safest option
  for unknown domains" → adapted Q19 "Connection ends when the wallet locks · safest option for unknown domains";
  "Until I revoke" disabled with "Discouraged for unknown domains — re-grant per session instead".
- Counter "0 of 2 acknowledgments" → "1 of 2 acknowledgments" (amber dot) → "Ready to connect · for this session"; the
  fully-acked lede "Both gates cleared. Connect is enabled for this session only — the persisted-scope path stays locked
  out for unknown domains."
- CTA "Connect for this session"; the locked tap's hint "Acknowledge both gates to connect".

**47-lookalike** (not drawn on #47; #46's IDN state applied to #47):
- Overline "Suspicious origin" (`--danger`); origin card "Lookalike" badge with `h` in mono.
- Banner "This domain is not <listed domain>" + for rule a: *"The "<char>" in this URL is <script name> letter
  (U+XXXX), not a Latin "<latin>" (U+XXXX). The Punycode form is <h>."*; for rules b–d: Q05 *"It looks like <listed
  domain> but is a different site."* The design's "— a known phishing domain." is dropped (§9).
- Sticky bar flipped: primary `.btn-destructive` **"Reject and report"**, tertiary "Connect anyway (not recommended)"
  (Q06). "Connect anyway" leads to the same 2-second confirm as #46 (§3.2 step 5), then to 47b's two gates;
  "Until I revoke" stays disabled.

**Outcomes.** Connect → `dapp.decide` (validated, §2.3) → grant written, request answered `{accounts: [account]}`.
Reject → `rejected` (counts for C14). Reject and report → block (§2.6) + `rejected`.

### 3.2 Sign message (#46) — every state of ix:17442-17686

`page.signMessage {account, message}`, checked in this order; each refusal test asserts its **reason**, so a later rule
cannot mask an earlier one (review M5):

1. `unauthorized` unless the origin has a grant for exactly `account`.
2. Refused `invalid-request`, no window, if the bytes (in this order): exceed **4 KiB**; deserialize as a legacy
   `Message`/`Transaction`, a `VersionedTransaction` or a `VersionedMessage`; start with `\xffsolana offchain`; are not
   valid UTF-8 (fatal `TextDecoder`); contain a control character other than `\n`, `\t` and `\r` directly before `\n`;
   or contain a bidi control (U+200E, U+200F, U+202A–U+202E, U+2066–U+2069). **Required test artifact:** a printable,
   UTF-8-valid legacy message that deserializes (header bytes ≥ 0x20, printable keys and blockhash, ~2 KiB) — refused
   *because it deserializes* (mutation: drop the deserialization check → this test red, the others unchanged).
3. **SIWS** (the first line matches `<domain> wants you to sign in with your Solana account:`): the second line must be
   the base58 of `account` — otherwise refused `invalid-request`, no window (review M5c). If `<domain>` is not the
   request's host, #46 opens with a red banner Q20 *"This sign-in message names <domain>, not this site (<host>)."*
   and **no Sign button**, only [Reject] — the user sees why (review M5b).
4. Otherwise queued. #46 shows: overline "Signature request"; title "Sign this message?"; lede *"A signature proves you
   control this wallet. It does not move funds and does not broadcast a transaction."*; origin card (verified /
   unknown / lookalike, §2.5); "Message · UTF-8 (<n> chars)"; the message in mono, scrollable, as text; the footer
   *"This won't broadcast or move funds. <name> will use the signature only to verify you own this wallet."*;
   [Reject] + [Sign]. Top-bar ✕ = Reject; disabled while signing.
5. **Lookalike:** overline "Suspicious origin"; the short lede "A signature proves you control this wallet."; the banner
   (§3.1); primary "Reject and report"; tertiary "Sign anyway (not recommended)" → the design's **2-second confirm**:
   "We strongly recommend rejecting. Continue?" with [Cancel] and [I understand the risk], the latter enabled after
   2 s; only it signs (review M10.1).
6. **Structured-approval keywords:** the design's six words plus four of ours, matched case-insensitively as whole words
   on the decoded text (a word = a maximal run of ASCII letters; review L11): `approve`, `approval`, `permit`,
   `allowance`, `authorize`, `authorise`, `spending`, `spend`, `delegate`, `transfer`, `withdraw`. On the first hit,
   the design's alert: head "This message includes an authorization"; body "Detected keyword: <word>. Even though
   signing won't broadcast, the dApp may use this signature off-chain to authorize a future action. Read the full
   message before signing." — and the word marked inline in the preview (`<mark>`, `--warning`).
7. **Sign** → ed25519 over the exact bytes with the granted account's session key → `{signature, signedMessage}`.
   While signing: "signing-in-progress" (CTAs disabled, ring spinner, ✕ disabled).

### 3.3 Transactions (B1c-2, B1c-3) — B1 §3, refined

- `page.signTransaction`: 1–5 transactions (D8); more → `invalid-request`, no window. Each must name `account` as fee
  payer or signer; otherwise `invalid-request`.
- Lookup tables resolved with `getMultipleAccounts` through the proxy before decoding; unresolvable → that instruction is
  "unknown program".
- **Decoder:** System (transfer, createAccount, assign, allocate, advanceNonceAccount), SPL Token and Token-2022
  (transfer, transferChecked, approve, approveChecked, revoke, setAuthority, closeAccount, burn, burnChecked,
  initializeAccount*, syncNative) and the Token-2022 extensions B1 §3 names, ATA (create, createIdempotent), Compute
  Budget (limit, price), the presale program (by Anchor discriminator from the IDL in the repo).
- **Simulation** through the proxy with `accounts` = the signer's wallet account and its token accounts the
  transaction touches; balance changes = post − pre per mint in base units (`bigint`). #48's "simulating" state holds
  Approve disabled until it answers (no artificial minimum).
- **Blockhash (review L8):** a dApp transaction carries the dApp's blockhash; the wallet cannot rebind it. After 30 s
  on screen the transaction is re-simulated to refresh the shown effects; if the proxy reports the blockhash expired,
  #48 shows "This request has expired. Ask the site to try again." (Q21) and only [Reject].
- **#48** (ix:18261-18705): "simulating-blocking", balance changes, decoded instructions beside them, fee, red flags
  (B1c-3), "origin-mismatch · auto-reject" (no Approve path), "unlimited-spend · typed-confirm" (B1c-3). C15 applies.
- **Re-authentication** (B1b's rules through #10): first send to a new address, above 5 % of balance or the dollar
  threshold, whole balance to a first-time address, bounded approvals, overrides.
- `page.signAndSendTransaction`: sign, broadcast through the existing coordinator route, answer the signature once the
  route accepts it; the dApp confirms. Answered once (§1.5); a second identical request while the first is unanswered
  → `rejected`. The sent transaction appears in #26 with the design's "Dapp · simulated" origin badge.
- **E2E through `StandardWalletAdapter`** (`@solana/wallet-adapter-base`), so the adapter's compatibility predicate is
  exercised (review M1).
- **B1c-3** builds B1 §3's red-flag table exactly, with its override rule (typed symbol or word + re-authentication,
  one transaction, no setting disables a block) and B1 §3's Confirm hold of 1.5 s on any red-flag screen (on top of C15).

The plans for B1c-2 and B1c-3 refine this section; they may not loosen it.

---

## 4. Screens in the popup, the settings and the window

### 4.1 #31 Settings — "Connected dApps" row

In the Connections group above "Address book" (ix:13552, 13621): label "Connected dApps", meta "<n> connected" (Q07),
counting persistent grants and, while unlocked, session grants; empty when none (review L12); → #49.

### 4.2 #37 Delete wallet — the bullet

The list of what is wiped gains "dApp connections and blocked sites" (Q08), where the design reserves it (ix:14981).

### 4.3 The approval window

`approve.html` at 412 × 720 (the design frame is 916 px high; the body scrolls, the sticky bar stays; §9). No tab bar,
no back. It holds no state: on mount, on `visibilitychange` and on a `dapp.changed` broadcast from the background it
asks `dapp.pending`:

- a request → #47 / #46 / #48;
- `{locked}` → **the locked screen (D11)**: Noctura mark, title Q22 "Noctura is locked", body Q23 "Click the Noctura
  icon in your browser's toolbar and unlock. This request will wait here.", the request's origin card, [Reject]. **No
  password field and no link into the vault page.** When the unlock lands the background broadcasts `dapp.changed` and
  the window shows the request;
- `{none}` → the window closes itself.

### 4.4 #49 Connected apps — every state of ix:18705-19100

- Top bar "Connected apps" (`.noc-h1-compact`), back → #31; the **Sort** icon button (review M10.4) toggles "Sorted by
  last used" / "Sorted by name".
- Header "<n> active sessions" · the sort caption.
- Rows (persistent and session grants): initials avatar (C6), name (C7) with the design's **verified dot** for a
  verified domain, domain in mono, "Connected <YYYY-MM-DD> · last used <relative>" (B1b's `whenText`), a "This session"
  pill on session grants (Q10), [Revoke].
- **Revoke** (no confirmation, the design's safe direction): the row leaves; the design's **undo toast**: "<name>
  revoked", countdown "undo · <s> s", [UNDO], single-shot, 5 s (review M10.3); Undo → `dapp.grants.undo` (§2.7).
- **Detail sheet** (row tap): Permissions — "Read public keys · Granted at connect — view-only", "Sign transactions
  (with prompt) · Each request asks before signing", "Sign messages (with prompt)", each with the grant date; Session —
  Connected <date>, Last used <relative>, "Until revoked" / "This session only"; **Last 3 interactions** (type, time,
  approved/rejected, from `Grant.recent`); [Revoke]. The design's "Last mode" cell is B2 (§9).
- **Disconnect all (49d):** the sticky "Hold to disconnect all · <n> sessions"; while held: rows dim to .55, per-row
  Revoke disabled, the bar reads "Hold to revoke all", the helper "All <n> sessions will be wiped … release the button
  to cancel", the label counts down ("Hold to disconnect all · 0.24 s"); **600 ms**, #49's own number (§9). Revokes
  every grant; no undo. Disabled in the empty state.
- **Blocked sites** (our addition, D3): a section below the list — "Blocked sites" (Q13), rows with `h` in mono,
  "Blocked <date>", "Looked like <listed domain>" when known, [Unblock] (no confirmation).
- **Empty:** "No connected apps" + Q14 "When you connect a site, it appears here." (the design's text names the dApps
  tab and its [Browse dApps] — D1).
- Skeleton while loading; Q15 "Could not load your connections. Try again." on failure.

---

## 5. Errors and edge cases

| case | behaviour |
|---|---|
| service worker stops with a request shown | the queue is in `storage.session`; the relay's port reconnects and resumes; the window re-asks on `visibilitychange`; nothing is re-run (§1.5) |
| the browser closes with a window open | session storage dies; the page died too |
| the wallet locks while a window is open | the lock hook (§2.4): every queued request `rejected`, the window closed, `change []` to granted origins |
| the wallet is deleted | the lock hook, then grants, blocks and cooldowns wiped |
| `windows.create` races | the `opening` marker under the queue mutex; a stale id is detected with `windows.get` (§2.3) |
| a page sends 1 000 requests at once | the first is queued, the rest `request-pending` |
| a page re-asks after every rejection | the cooldown (C14) |
| a prerendered page asks | refused (C16) |
| a page calls `connect` from an iframe | refused by the origin rule (`frameId ≠ 0`); with `all_frames: false` no script runs there anyway |
| `http://` page | refused; store build only `https:` |
| the granted account is removed | its grants deleted, `change {accounts: []}` |
| the popup's active account changes | nothing (C1) |

---

## 6. Testing

### 6.1 Unit and component (vitest, against the real background)

Each item has a **named mutation** that must turn a test red, and a positive control wherever a negative is asserted.

- **Origin rule, messages and ports:** iframe, `http:`, `null`, opaque, foreign `sender.id`, no `sender.tab`, a forged
  `sender.url`, `documentLifecycle: 'prerender'` → refused / port disconnected; a valid top frame → accepted (positive
  control). The `frameId` rule is proven here, not by E2E 23 (review L6).
- **Partitions:** a page type from an extension page refused; `dapp.decide` from the relay refused; from `approve.html`
  accepted.
- **Lifecycle (§1.5):** answer delivered on the port; worker restart between shown and decided → resumed once; an
  acked answer deleted; an unacked one deleted at 10 min; a signature produced once however often resumed.
- **Lock hook (§2.4):** one test per caller; queue answered `rejected`, window closed, `change []` only to granted ports.
- **Grants:** session gone after lock, persistent kept; silent connect while locked returns `[]` for "no grant" and
  "persistent grant" alike; explicit connect after unlock restores without #47; dApp disconnect removes a persistent
  grant (C2); account switch changes nothing (C1); removed account → `change []`; delete wipes, restore keeps (C11);
  cap 200 (#47 with Q16 and only Reject).
- **Decide (§2.3):** one refusal per row of the table, each with its mutation.
- **Undo (§2.7):** single-shot; each refusal.
- **Queue:** one per origin, five total, FIFO across origins, expiry (fake clock), window close = rejection of only its
  request, cooldown after 3 rejections, a blocked origin answered with no entry.
- **Classifier (§2.5):** a table — verified (`app.noc-tura.io`, `www.jup.ag`); lookalike by each rule
  (`xn--phntom-ezv.app`, `xn--phntom-ezv.app.evil.com`, a combining-mark `xn--` form of `jup.ag`, `jupp.ag`,
  `orca.io`, `jup.ag.evil.com`, `jup-ag.io`, `app-noc-tura-io.com`, `n0c-tura.io`, `rnagiceden.io`); unknown
  (`example.com`, `solana-mint-hub.xyz`, `jupiter.com`, `orchard.so`, `notcoin.io`); an unknown `xn--` host gets Q18;
  an invalid punycode label → unknown, no throw; the decoder against RFC 3492's sample strings; display strips bidi
  controls.
- **signMessage (§3.2):** each refusal asserts its reason; the printable legacy-message artifact; CRLF SIWS accepted, a
  lone `\r` refused; SIWS with another address refused; SIWS for another domain → #46 with Q20 and no Sign; a canonical
  SIWS and a plain sentence accepted (positive controls); keywords fire on "approve", "Permit", "spending" and not on
  "approved", "transference"; the signature verifies with `ed25519.verify`.
- **Screens:** every state of §3–§4 with its verbatim strings; the graduated unlock; "Until I revoke" disabled for
  unknown and lookalike; the lookalike CTA order and the 2-second confirm; C15 (CTA disabled at t = 0, enabled at
  500 ms, no default focus, Enter does nothing; mutation: enable at mount → red); the locked window has no input element;
  #49's sort, undo countdown, hold states, blocked section; rule 6 on every CTA.

### 6.2 Gates

- **Permissions gate:** both `content_scripts` entries pinned (matches, world, run_at, all_frames) in place of today's
  "no content_scripts" line; no new permission.
- **Page-bundle gate** (new): the built `provider.js` and `relay.js` module maps contain only their own sources and
  `@wallet-standard/*`; any module from `src/background`, `src/vault`, `src/unlock`, `src/app`, `src/approve` fails.
- **Vault-isolation gate:** `src/approve` in its fixtures; `BACKGROUND_OWNED_KEYS` + `v1_dapp_grants`, `v1_dapp_blocked`.
- **Dev-origin gate:** a store build's `background.js` contains neither `localhost` nor `127.0.0.1` acceptance.
- **CSP gate:** unchanged policy.

### 6.3 E2E (Playwright, contained)

A test dApp page served through `ctx.route` at `https://dapp.test`, plus fixtures at `https://jupp.ag` and an `xn--`
host, using the real `@wallet-standard/app` `getWallets()`:

- **19 · connect:** finds "Noctura" → connect → #47b → both gates → Connect → the account; reload → silent connect
  returns it (persistent) / not after a lock (session); lock → `change []`; locked + connect → the window's locked
  screen with no password field → unlock from the toolbar popup → the window shows #47.
- **20 · signMessage:** sign a SIWS message → verify with ed25519; a transaction's bytes as a message → refused, no
  window.
- **21 · lookalike:** `jupp.ag` → "Reject and report" → the next connect is rejected with no window → #49 Unblock → a
  connect opens #47 again.
- **22 · revoke:** Revoke → Undo → still connected; Revoke → 5 s → the page gets `change []`.
- **23 · iframe:** the page in an iframe sees no "Noctura" (no injection); the top frame does.
- **24 · restart:** #46 shown → the service worker is stopped (`chrome://serviceworker-internals` or the CDP target) →
  Sign → the page gets exactly one signature.
- **B1c-2:** sign-and-send against the fake coordinator, a batch of 5, a batch of 6 refused; the same through
  `StandardWalletAdapter`.

### 6.4 Visual

`e2e/visual-dapp.spec.ts` shoots every state of #46 (verified, unknown, lookalike, the 2-second confirm, keyword alert,
SIWS-mismatch, signing), #47 (47a ×3, 47b ×4, lookalike, cap), the locked window, #49 (populated, sorted by name,
empty, detail, hold, undo toast, blocked section) at 412 px; the opus-tier review against `index.html`, as in B1b.

### 6.5 Release gates (B1e, D10)

- B1c-1, -2 and -3 all on `main`.
- **Chrome:** an update that adds `<all_urls>` content scripts disables the extension for existing users until they accept
  the new warning — the release notes and store listing say why; tested once on an installed previous build.
- **Firefox:** MV3 host permissions are user-grantable; check on Firefox ≥ 150 whether the content scripts inject
  without a per-site grant, and if not, the onboarding asks for the grant; a manual run of E2E 19–24.
- The store listing explains `<all_urls>` with the reason in `manifest/source.mjs`.

---

## 7. Out of scope

- #34 dApps (D1); a coordinator report endpoint (D3); favicons, whois, remote lists (C6); 47c (D8); hex message preview
  (D9); partial permissions; every shielded variant (B2); WalletConnect; Ledger; Wallet Standard `solana:signIn`
  (SIWS text is signed through `signMessage`).
- **Accepted limits:** a request whose tab closed stays valid until answered or expired (§2.3); timing reveals a block
  (§1.6); `busy` reveals that others are queued (§1.6); scripts on the page share its authority over the provider and
  another extension can impersonate the wallet's name (§1.1); simulation has one source, the coordinator (B1 §3);
  rule b/c false positives on real brand domains (§2.5).

---

## 8. Where things live

| path | what |
|---|---|
| `extension/src/provider/` | the MAIN-world provider (bundle `provider.js`) |
| `extension/src/relay/` | the ISOLATED relay (bundle `relay.js`) |
| `extension/src/background/dapp/` | ports, queue, grants, known list + classifier + confusables + punycode, blocked, pageApi, window, decide, lockHook, signMessage; B1c-2 decode/simulate/signTx; B1c-3 redFlags |
| `extension/src/background/autolock.ts`, `session.ts`, `index.ts` | every lock caller routed through the lock hook |
| `extension/src/approve/` + `approve.html` | the approval window (#46, #47, #48, locked) |
| `extension/src/app/screens/ConnectedApps.tsx` | #49 |
| `extension/manifest/source.mjs` | content scripts + reasons |
| `extension/scripts/check-page-bundles.mjs` | the page-bundle gate |
| `extension/e2e/dapp*.spec.ts`, `e2e/fixtures/dapp/` | E2E + the test dApp page |

---

## 9. Design ↔ B1 §3 rulings and declared omissions

| design / B1 §3 | ruling |
|---|---|
| #46 non-UTF-8 → hex preview (design) vs refuse (B1 §3) | **refuse** (D9) |
| #49 Disconnect all: hold (design) vs typed confirmation (B1 §3) | **hold** (D9), at #49's own **600 ms** (#37's hold is 1 s; each screen keeps its drawn number) |
| #47c permission overreach | **not built** (D8) |
| B1 §3 "any `xn--` label gets an IDN warning" | kept: lookalike screens, or Q18 on 47b for an unknown `xn--` host |
| B1 §3 "`app.noc-tura.io` is marked verified" | widened to the known list (D2), as the design draws Magic Eden "Verified" |
| B1 §3 "signature bound to the blockhash of the simulation shown" | for a dApp transaction: re-simulate to refresh, refuse when expired (§3.3) |
| #47 "Until I revoke" saved under "dApp Connections (#34)" | #34 out (D1); Q03 points to Settings → Connected dApps |
| #47b whois domain age; "The verified list comes from github.com/solana-labs/dapp-list" | dropped (C6) |
| #47b permissions card: two rows | **three rows** — B1c offers `signMessage` to unknown origins |
| #47b "Connection ends when you close the dApp" | Q19 — it ends at lock (D4) |
| #46 / lookalike "— a known phishing domain." | dropped: we know it is a lookalike, not that it phishes |
| #46 "Reject and report" TIP banner on next launch | dropped (D3: nothing is reported) |
| #46 keyword list (6 words) | kept, plus `approval`, `authorise`, `spend`, `transfer`, `withdraw` |
| #48 ~900 ms honest skeleton | Approve waits for the real answer; no artificial minimum |
| #48 "approving · shielded" | B2 |
| #49 SHIELDED badge, "Last mode" cell, "Permissions reduced" | dropped (B2; no partial permissions) |
| #49 footer caption naming `v1_dapp_sessions` | dropped (an internal key; ours is `v1_dapp_grants`) |
| #49 empty-state text and [Browse dApps] | Q14; the button dropped (D1) |
| #49 pull-to-refresh | dropped: a popup has no pull gesture; the list re-reads on focus |
| design frame 916 px high | the window is 720 px; the body scrolls, the sticky bar stays |
| unlock inside the flow (implied by the design's modal stack) | the locked window points to the toolbar (D11) |
| first six / last six highlighted on review screens | B1 §3 (owner): labels + first-send warning, unchanged |

---

## 10. Owner copy to confirm (strings the design does not draw, or adapts)

| # | where | string |
|---|---|---|
| Q01 | #47 account picker | "Account" |
| Q02 | #47 session option | "Disconnects when the wallet locks or the browser closes" |
| Q03 | #47 persistent option | "Saved in Settings → Connected dApps · revoke any time" |
| Q04 | #47b ack 1 | "I understand this domain is not on the verified list" |
| Q05 | lookalike, rules b–d | "It looks like <listed domain> but is a different site." |
| Q06 | #47 lookalike tertiary | "Connect anyway (not recommended)" |
| Q07 | #31 row meta | "<n> connected" |
| Q08 | #37 bullet | "dApp connections and blocked sites" |
| Q10 | #49 session pill | "This session" |
| Q12 | window, queue | "1 more request waiting" / "<n> more requests waiting" |
| Q13 | #49 section | "Blocked sites" · "Blocked <date>" · "Looked like <listed domain>" · "Unblock" |
| Q14 | #49 empty | "When you connect a site, it appears here." |
| Q15 | #49 failure | "Could not load your connections. Try again." |
| Q16 | #47 at the cap | "You have 200 connected apps. Revoke one in Settings first." |
| Q17 | #46/#47 cooldown | "Block this site" |
| Q18 | #47b, unknown `xn--` host | "This address uses international characters: <host>" |
| Q19 | #47b session option | "Connection ends when the wallet locks · safest option for unknown domains" |
| Q20 | #46 SIWS mismatch | "This sign-in message names <domain>, not this site (<host>)." |
| Q21 | #48 blockhash expired | "This request has expired. Ask the site to try again." |
| Q22 | locked window title | "Noctura is locked" |
| Q23 | locked window body | "Click the Noctura icon in your browser's toolbar and unlock. This request will wait here." |

(Q09 and Q11 of rev 1 are gone: the window no longer shows "expired" for a request it did not show, and the undo toast
uses the design's drawn strings.)

---

## 11. Review 1 → rev 2

| finding | where it landed |
|---|---|
| H1 answer path dies with the worker | C9, §1.2 (port, resume, keepalive), §1.4, §1.5, E2E 24 |
| H2 restore makes the popup a grant writer | §2.7 (undo buffer + token), §1.4 |
| H3 `lock()` wipes the queue first | §2.4 (one lock hook for every caller) |
| M1 plan 1 invisible; `<all_urls>` release consequences | D10, header, §3.3 adapter E2E, §6.5 |
| M2 password in a site-triggered window | D11, §2.2, §4.3 |
| M3 ports and lock-timing leak | §1.3, §1.4 events only to granted ports |
| M4 classifier | §2.5 (rule c on the host string, two-label IDN windows, NFD + marks, invalid punycode, Q18, false positives stated, list rule) |
| M5 signMessage tests and SIWS | §3.2 (order + reasons, printable artifact, CRLF, address line, Q20) |
| M6 decide validations | C13, §2.3 table |
| M7 window id | §2.3 (opening marker, `windows.get`) |
| M8 serial re-ask | C14, §2.3, Q17 |
| M9 block leaves the grant | §2.6 |
| M10 undeclared design omissions | §3.1, §3.2, §4.3, §4.4 built; the rest in §9 |
| M11 prerender | C16, §1.2, §1.3 |
| M12 focus/click timing | C15 |
| L1 timing reveals a block | §1.6, §7 |
| L2 cap contradiction | §2.1 |
| L3 false "expired" | §2.3, §4.3 (Q09 removed) |
| L4 gate additions | §1.7, §2.1, §6.2 |
| L5 provider targetOrigin, page authority | §1.1 |
| L6 E2E 23 | §6.1, §6.3 |
| L7 reconnect loses the lock event | §1.2 |
| L8 dApp blockhash | §3.3, Q21, §9 |
| L9 `busy` oracle | §1.6, §7 |
| L10 decoded IDN as primary string | §2.5 Display |
| L11 whole word | §3.2 step 6 |
| L12 "<n> connected" | §4.1 |
| L13 `src/approve` in the isolation fixtures | §1.7, §6.2 |
