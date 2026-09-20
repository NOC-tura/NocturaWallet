# Noctura Web — S0 design (`wallet.noc-tura.io`)

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

Served from `wallet.noc-tura.io`, not a path under the marketing site. A separate origin means
separate storage, separate cookies and a CSP that does not have to accommodate the website's
needs. The DAO app is already its own origin; follow the same rule.

### 6.6 The RPC key problem

The mobile app embeds a Helius key. **A web bundle cannot**: everything in it is public, and a
key in the JavaScript is a key published. Two options, and only one survives review:

1. **Route RPC through the coordinator** (`/rpc`, method-allowlisted, rate-limited per IP).
   Probed 2026-09-20: `/rpc`, `/wallet/rpc` and `/solana/rpc` all return 404, so this endpoint
   does not exist yet. It is new backend work — a dependency on the coordinator side, and the
   only blocking one in S0.
2. A browser-exposed key, rotated when abused. Rejected: it is abuse-by-design, and the abuse
   lands on the same account the wallet and the backend depend on.

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

### 6.9 Anti-phishing posture

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

## 8. Network stance — decide before launch

`api.noc-tura.io` sits behind CrowdSec, which has previously returned 403 to a large number of
real requests, including users on CGNAT, VPNs and Tor. For a privacy-branded product this is a
contradiction that must be decided deliberately rather than inherited: either those users are
served, or the product's own audience is being blocked by its own infrastructure.

Single-host risk applies equally: today one host fronts everything.

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

1. **RPC proxy** — will the coordinator expose a method-allowlisted `/rpc`? S0 cannot ship
   without it (§6.6). This is the one external dependency.
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
