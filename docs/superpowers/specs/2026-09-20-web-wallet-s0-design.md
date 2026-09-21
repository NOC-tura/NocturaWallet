# Noctura Web — S0 design (`app.noc-tura.io`)

Date: 2026-09-20 · Status: proposed, awaiting review

## 1. Why this exists

Three goals, in the order they matter:

1. **A presale channel no store can close.** The Android app is functionally complete but
   sideload-only, and a token-sale surface is the single most likely reason a store review
   refuses it. The web is outside that jurisdiction entirely.
2. **Visible proof the project moves.** Buyers currently have no way to see their own
   allocation, their referral standing, or the countdown to TGE without asking.
3. **A shared core before iOS arrives.** Extracting the platform-independent logic once,
   for the web, is what stops a third platform from becoming a third copy of the spec.

## 2. Scope

**In S0**

- Connect an existing Solana wallet (Phantom / Solflare / Backpack / Ledger via wallet-adapter)
- Portfolio view: SOL and NOC balances, price and chart
- Presale: current stage, price, progress, **your allocation read from chain**, buy with SOL
- Referral: your link, your stats
- TGE countdown
- Geo/compliance gate in front of the buy path

**Explicitly not in S0**

- **No key custody of any kind.** No seed generation, no seed import, no encrypted seed at
  rest, no passkey envelope. The browser holds no authority — see §4.
- **No shielded.** Two preconditions are open; see §9.
- **No transparent send/receive.** The connected wallet already does this well, and
  duplicating it buys nothing while doubling the signing surface. Reconsider in S1.
- **No claim transaction.** Deferred to TGE; the countdown is the S0 surface.
- No push notifications, no analytics of any kind (see §6.2).

## 3. Audience, and what it implies

The first audience is **existing presale buyers**. By definition they already hold a Solana
wallet — they bought NOC with one. The "user with no wallet" case, which is what would force
key custody into the browser, is therefore not the first audience's problem. It can be solved
later, by the mobile app reaching a store, not by weakening the web.

## 4. The one architectural decision

**The browser holds no authority.** Every transaction is signed by the connected wallet;
the page never sees a secret key, a seed, or a note secret.

This is not convenience. `CLAUDE.md` cardinal rule 4 forbids `sk_spend` from touching JS, and
on mobile that is enforced by hardware — Android Keystore, iOS Secure Enclave. **A browser has
no equivalent.** Implementing key custody on the web would break, on the weakest platform, a
rule the project enforces on the strongest.

Consequences that follow and are not negotiable inside S0:

- no `generateMnemonic`, no import screen, no seed in memory, ever
- no long-lived secret in `localStorage` / IndexedDB; storage holds UI preferences only
- the app asks for a signature only in response to an explicit user action, never on load

## 5. Architecture

### 5.1 Repository shape

Work happens in this repository. **The React Native app does not move** — relocating it would
churn Gradle paths, Metro config and CI for no benefit today.

```
/ (existing RN app stays at the root)
/core/     platform-independent TypeScript, consumed by both
/web/      the new Vite + React application
```

`core/` starts empty and grows **only as the web needs a module**, each one moved rather than
copied. Copying is what produces two specifications that drift — and in this project the
client code *is* the specification for the circuits and for the on-chain encoding.

First candidates, in order: presale PDA derivation and instruction building
(`presaleBuyModule`), allocation decoding, referral resolution, the coordinator API client,
amount parsing and formatting.

### 5.2 Web stack

Vite + React + TypeScript (strict, no `any`), `@solana/wallet-adapter-react`,
`@solana/web3.js` at the version the app already pins, TanStack Query for server state.
No CSS framework beyond what the design needs; no component library that pulls a large
transitive tree (§6.3).

### 5.3 Data sources, and which one is authoritative

| datum | source | note |
|---|---|---|
| your allocation | **on chain**, `fetchOnChainAllocation` | authoritative; the coordinator's recorded sum is approximate |
| TGE timestamp | **on chain** | same |
| stage, price, progress, buyers | `GET /stats` | live, verified 2026-09-20 |
| SOL / NOC price, chart | `GET /wallet/prices`, `/wallet/chart` | live |
| token metadata | `POST /wallet/tokens/metadata` | live |
| referral stats | `GET /referral-stats/:address` | live |
| geo decision | `GET /geo/check`, `/geo/restricted-list` | live |
| purchase record | `POST /solana/purchase` | after the transaction confirms |

`API_BASE` already ends in `/api/v1`; append bare paths. (The shielded paths still carry a
double `/v1` — not S0's problem, but do not copy the pattern.)

## 6. Security requirements

Each is a requirement with a stated way to check it. A requirement nobody can check is a
comment.

### 6.1 No authority in the page

- No code path produces or accepts a private key, seed or mnemonic.
- **Check:** a CI grep gate over `web/` for `mnemonic|generateMnemonic|secretKey|privateKey|
  Keypair.fromSecretKey`, failing the build on a match, with the allowlist empty.

### 6.2 No third-party code, no third-party telemetry

No analytics, no tag managers, no hosted fonts, no CDN-loaded libraries. Everything is built
into the bundle and served from our origin.

- A privacy product that ships someone else's script is not a privacy product; and every
  such script is an unreviewed path to the signing surface.
- **Check:** CSP has no third-party origins; a test asserts the built `index.html` references
  no external host.

### 6.3 Dependency and supply chain

- Lockfile committed, exact versions, `npm audit` in CI (the gate already exists in this repo).
- No package with an install script unless justified in writing in the PR.
- Build produced by CI, not from a laptop; the artifact hash published with each release so a
  served bundle can be compared against it.
- **Check:** a reproducible-build step that builds twice and compares hashes.

### 6.4 Content Security Policy and transport

- `default-src 'none'`; explicit `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`,
  `connect-src` an allowlist of exactly the coordinator origin and the RPC proxy origin.
- No `unsafe-inline`, no `unsafe-eval`. Vite must be configured so the production build needs
  neither. (If WASM proving ever arrives, `wasm-unsafe-eval` is a deliberate, separate decision.)
- HSTS with preload, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` denying everything unused.
- **Browser pinning does not exist.** The mobile app's `SSL_PINS` have no web equivalent; the
  web relies on the public PKI, so HSTS preload and a CAA record are the available controls.
  Do not claim pinning-equivalent security on the web.

### 6.5 Separate origin

Served from `app.noc-tura.io`, not a path under the marketing site. A separate origin means
separate storage, separate cookies and a CSP that does not have to accommodate the website's
needs. The DAO app is already its own origin; follow the same rule.

**`app.` and not `wallet.`, revised 2026-09-21.** This section first said `wallet.`, and that
was wrong for two reasons that only became visible once the page existed. The page is not a
wallet: it holds no key and creates none, so the hostname would promise custody before the
page had loaded. And `walletapp.noc-tura.io` already exists on this domain — a devnet sandbox
— so `wallet.` would sit beside `walletapp.` as a pair no user can be expected to tell apart,
which on a wallet brand is a gift to whoever clones one of them. The name stays reserved for
the thing that will genuinely be a wallet: the browser extension, or the S2 vault origin.
`wallet.noc-tura.io` is not to be created even as a redirect — that restores the pair.

### 6.6 The RPC key problem, and the exact method list

The mobile app embeds a Helius key. **A web bundle cannot**: everything in it is public, and a
key in the JavaScript is a key published. So RPC is routed through the coordinator
(`POST /api/v1/rpc`), method-allowlisted and rate-limited. Probed 2026-09-20: `/rpc`,
`/wallet/rpc` and `/solana/rpc` all returned 404. Agreed with the coordinator side on
2026-09-20 and now in progress; rate limiting lands first, because nginx has none today.

**The allowlist, counted out of the wallet's code rather than estimated.** Every
`connection.*` call in `src/` was enumerated and mapped to its JSON-RPC method name:

| method | why S0 needs it |
|---|---|
| `getAccountInfo` | allocation PDA, TGE timestamp, referrer PDA |
| `getMultipleAccounts` | batched balance reads |
| `getBalance` | SOL |
| `getTokenAccountsByOwner` | NOC balance (jsonParsed) |
| `getLatestBlockhash` | building the purchase transaction |
| `getBlockHeight` | blockhash expiry while confirming |
| `getRecentPrioritizationFees` | priority fee estimate |
| `simulateTransaction` | the mandatory pre-signature simulation (§6.7) |
| `getSignatureStatuses` | confirmation |
| `getTransaction` | rendering the result (jsonParsed) |
| `getSignaturesForAddress` | history, if S0 shows it |

`sendTransaction` is **deliberately absent**: the connected wallet broadcasts through its own
RPC, so the proxy never sends anything and never needs write quota. `getTokenAccountBalance`
and `getFeeForMessage` are not used today; the list is default-deny, so if either is ever
introduced it fails visibly in the browser rather than degrading quietly.

**WebSocket: not in S0.** The app uses `onAccountChange` (`accountSubscribe`) for live balance
updates. A `wss://` endpoint would expose the key exactly as the HTTP one would, so the web
polls instead. Reconsider only if a WS proxy is built for other reasons.

**CORS is not the boundary.** The coordinator's `cors()` allows requests with no `Origin` at
all, so CORS constrains browsers on other sites and nothing else — `curl` is unaffected. A
browser always sends `Origin` on a cross-origin POST, so the web app will always carry one, but
that is a property of the client, not a control. The boundaries are **the method list and the
rate limit**; the Origin pin to `https://app.noc-tura.io` (see §6.5) stays as cheap defence
in depth.
If this app is ever packaged (Capacitor, Tauri, a WebView), its Origin becomes
`capacitor://`, `file://` or nothing — tell the coordinator before that ships, not after.

**A second proxy already exists and is open.** `https://noc-tura.io/api/rpc/solana` forwards any
JSON-RPC method to Helius on the paid key, with no allowlist and no limit; verified from
outside. It cannot take the list above — the website's presale sends transactions through it
and Anchor's `program.account.all()` needs `getProgramAccounts` — so it gets its own list, built
from 48 hours of method-name-only logging. Two endpoints, two lists, one shared default-deny
module.

▎ That open path spends the quota of **the same Helius account this wallet depends on**. If a
stranger exhausts it, the phone goes blind with it. Hence the proposal to issue **a key per
surface** — website, `/api/v1/rpc`, mobile — so abuse of one cannot blind the others. The
wallet's key was already replaced once this week because it had stopped working; it should not
be replaced a second time because someone else spent it.

### 6.7 Signing safety

- Every transaction is simulated and rendered in human terms before the signature request:
  recipient, amount, program, and the fee.
- The instruction set is allowlisted — the presale program and the system/token programs. An
  unrecognised program in a transaction the page built is a bug, and the page refuses it.
- Buttons that sign debounce ≥ 500 ms and disable on tap (cardinal rule 6).
- No batch signing, no `signAllTransactions` in S0.

### 6.8 Fail closed

Follow the pattern already in the wallet: a failed geo check, a failed simulation, an
unreachable backend or an unparseable response blocks the action and says so. No silent
fallback, no degraded "probably fine" path.

### 6.9 Domain hardening — pulled forward from the S2 spec

The mobile app pins certificates; a browser cannot. What a browser wallet has instead is
the domain itself, so it is hardened before launch, not after: **CAA** records restricting
which CAs may issue for `noc-tura.io`, **DNSSEC** on, **registry lock** at the registrar
with out-of-band verification for changes, hardware security keys (no SMS) on the registrar
and DNS accounts, and **Certificate Transparency monitoring** for any unexpected
certificate on `*.noc-tura.io`.

A frontend served from a hijacked domain is indistinguishable from the real one to every
control in §6 — this is the layer that makes that hijack hard rather than detectable
afterwards.

### 6.10 Anti-phishing posture

- The site never asks the user to enter a seed phrase. There is no field to type one into, so
  a phishing clone cannot claim the real site does it.
- A visible statement on the connect screen: *Noctura will never ask for your recovery phrase.*
- Connecting requests no signature; a signature is requested only for a purchase.

## 7. Compliance

The same geo gate the app enforces (MiCA / OFAC) runs in front of the buy path, from the same
backend source, with the same restricted-region screen. The web is reachable by anyone without
installing anything, so its exposure is larger than the app's, not smaller.

Whether the EU offer itself needs more than a gate is a legal question, not an engineering one,
and it should be answered before the presale has a second channel.

## 8. Network stance — settled 2026-09-20

`api.noc-tura.io` sits behind CrowdSec. Two corrections to what this section first assumed,
both from the server side:

- **The rejection is not silent.** The bouncer renders `ban.html`. It is CrowdSec's page,
  though: it does not say why, and offers no way back. Replacing it with ours is part of this.
- **Tor exit ranges are banned right now, and not by our rules.** `185.220.101.0` and
  `185.220.101.100` carry live CAPI bans of 164 hours. No amount of local tuning would have
  changed that, so this is a decision about whether we want that traffic, not a setting.

Resolution: keep CAPI, make the remedy proportional **per path** rather than global, using the
bouncer's `EXCLUDE_LOCATION`. Read paths come out from under bouncing, so someone on Tor can
read state, see their allocation and verify a vote. Writes stay bounced — purchase recording,
ballot submission, admin — and so does `/api/v1/rpc`, where every request spends real money.

▎ The audience most likely to arrive over a VPN or Tor is the audience a privacy wallet is for.
Blocking them by inheritance rather than by decision is the one outcome this section exists to
prevent.

Single-host risk still applies: one host fronts everything.

## 8b. Where this leads — the S2 security spec

`2026-09-21-wallet-ai-guard-security-spec.md` describes the product two stages on: a web
wallet that **does** hold keys, isolated in a separately audited vault origin, plus a
layered AI Guard. It answers the objection that shaped S0 — that a browser has no
equivalent of the Android Keystore — with the two boundaries a browser does have: a
sandboxed second origin the UI cannot read, and a non-extractable WebCrypto key, unlocked
by a WebAuthn PRF passkey.

S0 does not become that by growing. That design is its own repo folder, its own reviewers,
an external pentest and a vault audit as launch gates. S0 stays key-free, and the three
cheap-now items from that document — domain hardening (CAA, DNSSEC, registry lock, CT
monitoring), a reproducible build with a signed manifest, and no third-party requests —
are pulled forward into §6 rather than deferred with the rest.

Read its correction header before quoting it: five of its statements about Noctura's own
circuits, keys and programs were inferred rather than read, and are wrong.

## 9. Shielded — why it is out, and what would let it in

Two preconditions, both open, neither a scheduling matter:

1. **A0 (safety).** Today `noteSecret` is the sole spend authority. On the web that secret
   would have to exist in the page — the easiest place to steal from. A0 replaces the key model
   (`nk` / `rho` / `addrField`). Until it lands, shielded on the web means placing full spend
   authority in the weakest container available.
2. **Browser proving (feasibility).** A deposit or withdrawal needs a proof. In the browser
   (WASM in a worker) the witness never leaves the device, but nobody has measured whether a
   depth-20 Groth16 proof takes 10 seconds or 3 minutes in a phone browser, nor what the zkey
   download costs. The hosted prover receives the full witness — under today's key model, the
   spend authority itself — which the whitepaper forbids ("zero private data to cloud, enforced
   at SDK level") and which the mobile app already fails closed on.

The measurement is a spike, and it is cheap: run the existing circuit in a browser worker on a
mid-range phone and record time and transfer size. Do it before anything is promised.

Shielded screens may exist behind a flag, exactly as they do in the app — off until both
conditions are met.

## 10. Testing

- `core/` keeps the existing test discipline: unit tests with positive **and** negative
  controls, and the mutation sweep continues to cover it.
- `web/` gets component tests for the buy flow's states and an end-to-end test against a mock
  wallet adapter, asserting that a rejected geo check, a failed simulation and a user-cancelled
  signature all leave no transaction sent.
- The security checks in §6 are CI gates, not review habits.

## 11. Open questions

1. ~~RPC proxy~~ — **answered 2026-09-20**: yes, being built, rate limiting first. The method
   list in §6.6 is the measured one. Remaining: confirm a key per surface, and the lower quota
   for requests without an `Origin` header.
2. **Design source** — the app is built to `index.html` + `screen.md`. Does the web reuse those
   screens, or does it get its own layouts for desktop widths?
3. **Buy in S0** — confirmed as in scope. If it should be read-only for a first release, say so
   now: it removes §6.7 and the geo gate from the critical path and halves the work.
4. **VPN/Tor stance** (§8).

## 12. Success criteria

- A presale buyer connects an existing wallet and sees their own on-chain allocation,
  their referral standing, and the countdown — without contacting anyone.
- A purchase completes end-to-end on mainnet, recorded by the coordinator, indistinguishable
  in its on-chain result from one made through the Android app.
- The CI security gates in §6 pass, and the served bundle's hash matches the published one.
- Nothing in the shipped bundle can produce, hold or request a private key.
