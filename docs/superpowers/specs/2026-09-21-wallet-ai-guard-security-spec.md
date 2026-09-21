# Noctura Wallet & AI Guard — Security Spec (imported, with corrections)

> **Provenance.** Written outside this repository and handed over as
> `Noctura Desktop Wallet & AI Guard — Security Spec.pdf` (20 pages, 2026-09-21).
> Imported verbatim below, with page furniture stripped. It was **not** written against
> this codebase, so its claims about Noctura's own circuits, keys and programs are
> inferred rather than read. Five of them are wrong; they are listed here rather than
> edited into the body, so that what was received stays legible next to what was checked.

> **Scope.** This describes **S2** — a web wallet that holds keys, plus the AI Guard. It is
> not the specification for S0 (`2026-09-20-web-wallet-s0-design.md`), which deliberately
> holds no key material and asks the connected wallet to sign. Do not merge the two: S0 is
> weeks of work on an existing backend, this is a separately audited subsystem with its own
> repo folder, its own reviewers and an external pentest as a launch gate.

## Corrections — checked against this repository on 2026-09-21

**1. The circuit rule restates the broken key model.** §"Circuit rules" requires
*"nullifier = deterministic function of note secret (one note → exactly one nullifier)"*.
That is precisely the design this project has already found unsafe: the sender generates
the recipient's `noteSecret`, so both parties hold the same spend witness and the same
nullifier, and whoever proves first spends the note. It is fund loss, not a privacy
weakness, and `FEATURES.shieldedTransfer` is off because of it
(`src/constants/features.ts:36-57`). The A0 freeze replaces the model with `nk`/`rho`/
`addrField`. **The rule must be inverted: the nullifier must key off a secret the sender
never learns.**

**2. It recommends a proof system this project does not use.** §"Circuit rules" specifies
PLONK with a universal SRS (Perpetual Powers of Tau). Noctura's circuits are Groth16 with
per-circuit proving keys, and a trusted-setup ceremony is already recorded as a mainnet
blocker. Either this is a migration proposal — a large one, with its own costs — or the
author did not know what is built. It cannot be adopted as written.

**3. "Rescan from seed" assumes something that is not true today.** §"Browser proving and
note storage" treats a full rescan as the recovery path for wiped browser storage. In this
wallet `noteSecret` is `randomFieldElement()` held in `mmkvSecure` and is **not** derivable
from the seed — which is why "seed-recoverable noteSecret" is on the shielded mainnet
blocker list. The requirement is right; the document states it as an existing property
rather than as missing work.

**4. The title says Desktop, the content is a web application.** Every mechanism it relies
on — same-origin policy, sandboxed iframe, CSP, COOP/COEP, WebAuthn PRF — is a browser
boundary. A real desktop build (Tauri/Electron) replaces all of it with process isolation,
a signed auto-update channel and binary signing, and roughly half of §2–§4 would have to be
rewritten. **Decide which product this is before building from it.**

**5. Compliance is absent.** Geo-fencing and the sanctions list appear nowhere, although
they gate the presale in the shipping app. On 2026-09-21 that control was found running on
the bundled fallback list, five months past its own 30-day staleness limit, because
`/geo/restricted-list` returned 404 silently. A security spec for this product has to carry
the jurisdiction gate and the freshness of the list it depends on.

**Also worth noting, not an error:** the on-chain limits it asks for — per-epoch withdrawal
cap, per-transaction max, TVL cap, pause-only multisig circuit breaker — are not in the
current program. They are good requirements and belong on the shielded mainnet list.

**And a note on sources.** Twenty pages carry two citations, both about the same Zcash
incident. The security practice in it is standard and sound; the statements about
*Noctura's* internals are the part that was inferred, and those are the five above.

## What is being pulled forward into S0

Three items are cheap now and expensive later, so they do not wait for S2:

- **Domain hardening** — CAA records, DNSSEC, registry lock, and Certificate Transparency
  monitoring for `*.noc-tura.io`. Hours of work, and the only defence a browser wallet has
  in place of the certificate pinning the mobile app uses.
- **Reproducible build with a published hash**, in the signed-manifest form described here,
  which is stronger than what the S0 plan currently specifies.
- **No third-party requests at all** — already an S0 gate; this document's reasoning for it
  is the better one to quote.

---

Noctura Web Wallet & AI Guard — Security
Spec
  ​2026-09-21        · ​@Someone

1. Scope and threat model
No system reaches a proven 99.99%. We get close by cutting the probability of a bug and
capping the damage when one gets through. Zcash's 2026 Orchard bug (an under-
constrained circuit, live 4 years, found by AI-assisted review) shows what happens
without the damage cap.

This spec covers the web wallet: a non-custodial wallet served as a web app from noc-
tura.io and running entirely in the user's browser, plus the AI Guard. The desktop and
mobile apps follow later; the protocol sections (6) apply to all of them.

The one fact that shapes this whole spec: in a web wallet, the JavaScript our server
sends is the wallet, and it is re-downloaded on every visit. Whoever controls our domain,
DNS, hosting, CDN, or a single npm dependency can ship code that steals every user's
keys on their next visit. Native apps have signed binaries and store review; a web app has
none of that by default. Most of this spec exists to close that gap.

Design rule: assume the component next to you is compromised. The page can be
injected. The RPC can lie. The AI can be wrong. A browser extension can read the page.
Security must hold anyway.

Who we defend against

  Adversary                                  What they want                Main entry points (web-specific)

  Frontend hijacker                          Serve malicious JS to all     DNS/registrar takeover,
                                             users                         hosting/CDN account, CI secrets,
                                                                           compromised npm package

  XSS attacker                               Run script in our origin,     Unescaped token
                                             read keys                     names/memos/NFT metadata,
                                                                           dApp strings, third-party scripts

  Phishing sites                             User types seed into a fake   Lookalike domains, search ads,
                                             noc-tura site                 fake support DMs

  Malicious browser                          Read DOM, swap                Extensions with "read all sites"
  extension                                  addresses, capture seed       permission

  Adversary                                  What they want             Main entry points (web-specific)

  Targeted attacker /                        Trick user into signing    Malicious connection requests,
  drainer dApp                                                          fake airdrops, address poisoning

  Malicious /                                Lie about state,           Simulation spoofing, IP + address
  compromised RPC                            deanonymize users          linking

  Protocol attacker                          Mint from nothing, drain   ZK circuit bugs, verifier program
                                             pool                       bugs, admin keys

  Insider / compromised                      Push bad deploy, upgrade   Deploy access, upgrade authority
  team key                                   program

  AI-targeted attacker                       Make the Guard approve a   Prompt injection in on-chain
                                             bad tx                     strings; tampered model download

Security invariants (must never break)
 1. The seed and private keys never leave the user's browser in plaintext, and never touch
     our servers in any form except client-side-encrypted.
 2. Key material lives in an isolated context the main UI cannot read (section 3).
 3. The user signs exactly what the wallet displays (What You See Is What You Sign).
 4. The AI Guard can warn and block. It can never approve, sign, or move funds.
 5. Shielded withdrawals can never exceed what the on-chain vault actually holds.
 6. Every deployed JS/WASM file is built reproducibly from tagged source and its hash is
     publicly verifiable.

Honest positioning
A web wallet is the most convenient and the least safe form factor. Recommend it for
everyday amounts; push users to a hardware wallet (Ledger via WebHID) or the mobile
app for large balances. Put this in the UI, not only in docs.

2. Web app architecture
Recommendation: split the wallet across two origins. The UI runs on app.noc-tura.io .
Keys, signing, and proving run in a small, separately audited vault served from
 vault.noc-tura.io inside a sandboxed iframe, talking to the UI only through validated
 postMessage . An XSS in the big UI codebase then cannot read keys: the browser's same-
origin policy is the isolation boundary, the way separate processes are on desktop.

  flowchart LR
    UI[app.noc-tura.io<br/>UI, untrusted display] -->|postMessage<br/>typed,
  origin-checked| V[vault.noc-tura.io<br/>sandboxed iframe]
      V --> K[Keys: WebCrypto<br/>non-extractable + IndexedDB]
      V --> P[ZK prover<br/>Web Worker + WASM]
      UI --> G[AI Guard<br/>Web Worker, no keys]
      V --> R[RPC / relayer<br/>allowlisted hosts]
      G -.->|verdict only| V

The vault renders its own approval screen and signs only what it displayed. The UI can
request, never sign.

Origin and messaging rules
     Vault code is tiny (target < 5,000 lines incl. deps), has its own repo folder, its own
     reviewers, and its own audit. Minimal dependencies: @noble/curves , @noble/hashes ,
      @scure/bip39 , the Solana tx serializer, the prover WASM. No UI framework in the
     vault.
     Every postMessage handler checks event.origin against an exact allowlist and
      event.source against the expected window. Never targetOrigin: '*' .
     Messages follow a typed schema (e.g. zod-validated): build_transfer ,
      request_signature , get_public_keys . The vault re-validates amounts, addresses,
     and mints; it never trusts the UI's values.
     The vault never returns secrets, seed words, or decrypted notes to the UI. Only public
     keys, signed transactions, and proofs.
     Password / passkey entry happens inside the vault iframe, never in the UI page.

HTTP security headers (both origins)

  Header                                            Value / rule

  Content-Security-Policy                           default-src 'none' ; script-src 'self' 'wasm-
                                                    unsafe-eval' (no unsafe-inline , no unsafe-
                                                    eval ); connect-src exact RPC/relayer hosts;
                                                    frame-ancestors 'none' on app, only app.noc-
                                                    tura.io on vault; require-trusted-types-for
                                                    'script'

  Trusted Types                                     Enforced; blocks DOM XSS sinks ( innerHTML , etc.)
                                                    at the browser level

  Strict-Transport-Security                         max-age=63072000; includeSubDomains;
                                                    preload , and submit to the HSTS preload list

  Header                                            Value / rule

  Cross-Origin-Opener-Policy                        same-origin (also needed for multithreaded
                                                    WASM proving)

  Cross-Origin-Embedder-Policy                      require-corp

  X-Content-Type-Options                            nosniff

  Referrer-Policy                                   no-referrer (stops leaking wallet URLs/paths)

  Permissions-Policy                                Disable everything unused (camera, mic,
                                                    geolocation, payment); allow hid only for Ledger

UI hardening
     Zero third-party scripts on either origin: no analytics, chat widgets, tag managers,
     remote fonts, or CDN libraries. Each one is a script with full access to the page. Self-
     host everything.
     Render all untrusted strings (token names, symbols, memos, dApp names, NFT
     metadata) as plain text via the framework's escaping. No dangerouslySetInnerHTML ,
     no Markdown rendering of on-chain data. Strip bidi overrides and zero-width
     characters.
     Never load NFT images directly from arbitrary URLs (IP leak + exploit surface). Proxy
     through a sanitizing image service or show placeholders.
     Session: auto-lock after inactivity (default 5 min) and when the tab is hidden for a set
     time; one unlocked session across tabs coordinated via BroadcastChannel , lock
     propagates to all tabs.
     Detect and warn: page opened in an iframe (clickjacking), running on a non-official
     origin, private/incognito mode (storage will be wiped), outdated browser.

dApp connectivity
A web wallet cannot inject window.solana into other sites. Use a popup-based connect
flow (Wallet Standard / Solana Mobile-style protocol): the dApp opens a Noctura popup,
the vault shows the full approval screen, and the result returns via origin-checked
 postMessage . Record and display the requesting dApp's verified origin on every request.
No embedded dApp browser in v1.

3. Keys, seed and signing in the browser
Browsers have no secure key chip the web page can use for Solana's ed25519 keys
directly, JavaScript cannot reliably wipe memory, and anything in the page can in principle
be read by an injected script. So the design relies on origin isolation (section 2), non-
extractable WebCrypto keys, passkey-backed unlock, and hardware-wallet support for
large balances.

Key storage
     Unlock key from a passkey (recommended default): use WebAuthn with the PRF
     extension to derive a 32-byte secret from the user's passkey (Touch ID, Windows
     Hello, Android, YubiKey). The secret never exists on disk; it is produced by the device's
     hardware authenticator at each unlock. Fallback for browsers without PRF: password
     → Argon2id in WASM (memory ≥ 64 MB in browser, iterations ≥ 3; tune for ~1 s).
     Encrypt the seed with AES-256-GCM (WebCrypto) under that unlock key; store the
     ciphertext in the vault origin's IndexedDB.
     Once unlocked, import the derived ed25519 signing key into WebCrypto as non-
     extractable ( extractable: false ; Ed25519 is supported in current Chrome, Firefox
     and Safari; fall back to @noble/curves only where not). A non-extractable key can sign
     but its bytes cannot be read out by any script, including an XSS in the vault.
     Call navigator.storage.persist() so the browser does not evict wallet data. Warn
     clearly: clearing site data or using incognito deletes the wallet on this browser; the
     seed backup is the only recovery.
     Never store: seed or keys in localStorage / sessionStorage , cookies, URL, server
     logs, or any server-side backup. If you offer cloud backup, it must be encrypted client-
     side with a key the server never sees.

Memory hygiene (what's possible in JS)
     Hold seed bytes in Uint8Array , never strings (strings are immutable and can't be
     wiped). Overwrite with .fill(0) right after use.
     Decrypt the seed only for key derivation or backup display; keep only the non-
     extractable CryptoKey in memory while unlocked.
     Run sensitive work inside a dedicated Web Worker in the vault origin; terminate the
     worker on lock (drops its whole heap).
     No console.log of anything secret; strip logs in production builds; error reporting (if
     any) is self-hosted, opt-in, and scrubs payloads.

Seed generation and backup
     Entropy only from crypto.getRandomValues (via @scure/bip39 ). No Math.random ,
     no custom RNG, no mouse-movement "entropy" mixed in naively. (Your rng_scan
     work on weak-entropy Bitcoin wallets is exactly the failure this prevents.)
     Standard BIP-39 + SLIP-0010 ed25519 ( m/44'/501'/n'/0' ) for recovery in other
     wallets; document and test shielded-key derivation and recovery end-to-end.
     Seed display inside the vault iframe only: shown as a word grid, no copy button, blurred
     until the user holds a reveal button, verification quiz after. Warn that browser
     extensions and screen recorders can capture the screen.
     Anti-phishing rule, stated everywhere: the web wallet only asks for the seed on the
     explicit "Restore wallet" screen. Noctura staff, support, and pop-ups never ask. Show
     the user's personal anti-phishing phrase (chosen at setup, stored encrypted) after
     every unlock, so a fake site cannot reproduce it.

Hardware wallet
     Support Ledger via WebHID/WebUSB (Chromium browsers) for transparent mode.
     Keys stay on the device; the web page's compromise cannot extract them.
     Recommend it in-app above a balance threshold (e.g. > $1,000 equivalent).
     Shielded mode needs the spending key where the proof is generated, so it cannot use
     Ledger in v1. Document the limitation.

Signing
     One signing path, inside the vault, after the vault's own approval screen returns an
     explicit user confirmation bound to the hash of the exact transaction message.
     Re-authenticate (passkey/password) for: sends above a user-set threshold, new
     recipients, token approvals/delegations, seed reveal, changing security settings.
      signMessage must reject payloads that deserialize as a Solana transaction and must
     show the full text; login messages (Sign-In With Solana) show the requesting domain
     and flag domain mismatches.
     Blind signing of unparseable instructions: disabled by default; if enabled, red warning
     plus second confirmation.

4. Supply chain, hosting, domain and deploy
For a web wallet, every deploy is an auto-update pushed instantly to 100% of users,
with no signature check on their side. DNS hijacks and poisoned frontends have drained
users of several major DeFi web apps. Treat the domain, hosting, and CI as part of the
wallet's key custody.

Domain and DNS
     Registrar with registry lock (server + registrar lock on noc-tura.io); changes require
     out-of-band verification.
     DNS provider and registrar accounts: hardware security keys (FIDO2) for every admin,
     no SMS 2FA, minimum two people with access, alerts on any record change.
     DNSSEC on; CAA records restricting which certificate authorities can issue for the
     domain; monitor Certificate Transparency logs for any unexpected cert on *.noc-
     tura.io .
     HSTS preload (section 2) so browsers refuse plain HTTP even on first visit.
     Register obvious lookalike domains; use a brand-monitoring/takedown service for
     phishing clones and fake search ads.

Dependencies
     Lockfile committed; CI installs with --frozen-lockfile ; ignore-scripts=true (no
      postinstall code runs).
     Keep the vault's dependency tree tiny and pinned (section 2). The UI can use more, but
     every package is still code that runs in the page.
      npm audit / Socket.dev / OSV-Scanner on every PR; block merges on critical findings.
     Manual diff review on upgrades of crypto packages ( @noble/* , @scure/* ,
      @solana/* , prover WASM).
     Pin GitHub Actions by commit SHA. Branch protection, signed commits, hardware-key
     2FA for all maintainers, secret scanning.

Build and deploy
     Reproducible builds: the same git tag always produces byte-identical JS/WASM
     bundles. Publish a signed release manifest (file path + SHA-384 hash for every file) on
     GitHub and noc-tura.io for each version.
     Subresource Integrity ( integrity="sha384-…" ) on every script and WASM file
     referenced by index.html .
     Deploy only from CI on a protected tag with two-person approval. No developer can
     deploy from a laptop. Hosting/CDN tokens live only in CI, scoped to deploy, rotated
     regularly.
     Deploy immutable, content-hashed file names; index.html served with Cache-
     Control: no-cache , everything else immutable .
     Independent watchdog: an external job (different cloud account) fetches the live site
     every few minutes and compares every file hash to the signed manifest. Mismatch =
     page the team and trigger the incident playbook.

Letting users verify what they run
     Show the running version + build hash in Settings, linked to the public manifest.
     Service-worker pinning (recommended): after first load, a service worker serves the
     wallet from cache and only accepts a new version if its manifest is signed by Noctura's
     offline release key (verified in the SW with a pinned public key). This turns the web app
     into something close to a signed, auto-updating app: a hijacked server alone can no
     longer push new code to returning users. Limitation: the very first visit, and a user who
     clears site data, still trust the server.
     Also publish the build to IPFS with a content hash, so advanced users can load a
     pinned, immutable version.
     Optional later: a small companion browser extension that verifies the manifest
     signature on every load (the approach used by some high-security web apps).

Backend
     Backend only serves static files, relays, and public data. It must never receive seeds,
     keys, passwords, decrypted notes, or unlock secrets.
     Rate-limit and authenticate relayer endpoints; the relayer can censor or delay but must
     never be able to steal (it only pays fees for proofs the user already signed).

5. Transaction pipeline (where users actually lose funds)
Most user losses are not cryptographic: they come from signing the wrong thing. The
pipeline is deterministic and runs in the vault before the AI Guard. The Guard adds a
second opinion; it never replaces these checks.

  flowchart LR
      A[UI / dApp popup<br/>request] --> B[Vault: parse +<br/>decode every ix]
      B --> C[Simulate on<br/>2 independent RPCs]
      C --> D[Deterministic<br/>policy rules]
      D --> E[AI Guard<br/>risk verdict]
      E --> F[Vault approval<br/>screen WYSIWYS]
      F --> G[Re-auth + sign<br/>in vault]
      G --> H[Broadcast +<br/>confirm]

Any step can block. Only the user, at step F inside the vault, can approve.

Parse and simulate
     Decode every instruction with known program IDLs (System, SPL Token, Token-2022,
     ATA, Noctura programs, major DEXes). Unknown program = flagged.

     Simulate on two independent RPC providers and compare; disagreement = block. A
     single malicious RPC cannot fake a "safe" simulation. Both hosts are in the vault's CSP
      connect-src allowlist.
     Show balance changes computed from simulation ("You send 100 NOC, you receive
     0.42 SOL"), never from what the dApp claims.
     Re-simulate if more than ~30 s passed before signing; bind the signature to the
     blockhash shown.

Deterministic red flags (hard rules, not AI)

  Pattern                                           Action

   SetAuthority / change of token account           Block by default; expert override + re-auth
  owner

  Token Approve / delegate to unknown               Red warning with amount; unlimited
  address                                           approvals blocked

  Durable nonce transaction from a dApp             Red warning (can be replayed later)

  Whole balance to a first-time address             Warning + re-auth

  Token-2022 with transfer hook, permanent          Warning on receive and on swap
  delegate, or freeze authority

  Address or dApp origin on known                   Block
  drainer/phishing list

  Instructions to unknown programs                  Warning; blind signing off by default

   signMessage payload that decodes as a            Block
  transaction

  Request from an origin different from the         Block
  one that connected

Address safety (browser-specific)
     Address poisoning: never auto-fill from history; show the full address; highlight
     differences from known contacts; hide dust/zero-value transfers from history by
     default.
     Clipboard and DOM tampering by extensions: malicious extensions can swap a
     pasted or displayed address. The vault re-displays the final recipient in its own iframe
     (which extensions without host permission for vault.noc-tura.io cannot alter) and
     asks the user to confirm the first and last 6 characters for new recipients.

     Address book with user labels, stored encrypted in the vault; "new recipient" badge on
     first send.
     Solana Name Service resolution allowed, but always show the resolved raw address.

Approval screen (WYSIWYS)
     Rendered by the vault from the parsed transaction, not from UI- or dApp-supplied text.
     For dApp requests it opens as a separate popup window on the vault origin (cannot be
     overlaid or clickjacked, frame-ancestors enforced).
     Shows: verified requesting origin, every instruction in plain language, all balance
     changes, fees, recipient full address, network (mainnet/devnet large coloured badge),
     and warnings.
     Confirm disabled for 1–2 s on red warnings; no default focus on Confirm; Enter key
     does not confirm.
     The vault signs the exact message hash shown; any change after display = refused.

6. Shielded mode in the browser (protocol + privacy)
Shielded mode stays off on mainnet until the redesigned circuits pass an independent ZK
audit. That gate does not change for the web wallet. The Zcash Orchard bug and our own
earlier findings (mint-from-nothing in swap.circom , Keccak/Poseidon tree mismatch,
missing admin controls) are the same bug class: something the circuit or program
assumes but does not enforce.

Circuit rules
     Every signal is constrained. Ban <-- without a matching === , or require a written
     justification per use. Run Circomspect, Picus (under-constraint detection), and zkFuzz
     in CI on every circuit change.
     Enforce in-circuit: value conservation (inputs = outputs + fee), range checks on every
     amount (≤ 64 bits, no field wrap-around), canonical encodings for points and field
     elements, nullifier = deterministic function of note secret (one note → exactly one
     nullifier), Merkle membership with the same hash (Poseidon) on-chain and in-circuit.
     Negative test suite: for each constraint, a test with a malicious witness that must fail. If
     deleting a constraint makes no test fail, the test suite is incomplete.
     Formal verification of the core transfer circuit before the pool cap is raised (Zcash is
     doing this only after its incident).
     PLONK with universal SRS: use a well-known public SRS (e.g. Perpetual Powers of Tau)
     and publish the verifying keys; lock verifying keys on-chain behind the upgrade
     timelock.

On-chain program rules
     Vault-backed pool: shielded balances are backed 1:1 by real tokens held in a program-
     owned vault. Total withdrawals can never exceed the vault. This gives a public supply
     check that Zcash lacked.
     Because a bug would then drain honest users instead of inflating supply, cap the blast
     radius: per-epoch withdrawal limit (e.g. ≤ 5% of vault per 24 h), per-tx max, pool TVL
     cap at launch, raised step by step after clean months.
     Automatic circuit breaker: pause deposits/withdrawals when outflow crosses the
     threshold. Pause key = multisig, can only pause (cannot move funds or upgrade).
     Verifier checks every public input: root is in the recent-root history, nullifier not
     already spent (PDA-per-nullifier, created atomically), recipient, amount, and fee bound
     into the proof (prevents front-running/redirect).
     Admin functions: every privileged instruction checks the signer against the multisig;
     upgrade authority behind multisig + 48–72 h timelock.

Browser proving and note storage
     Prover runs as WASM in a dedicated Web Worker on the vault origin. Multithreaded
     proving needs SharedArrayBuffer , which requires the COOP/COEP headers in
     section 2.
     Budget for browser limits: WASM memory (keep peak < 2 GB so low-end laptops and
     Safari work), proving time (show progress, allow cancel), and mobile browsers (test on
     mid-range Android Chrome and iOS Safari; if too slow, route mobile users to the native
     app for shielded ops).
     Proving keys and circuit WASM: downloaded content-hashed, verified against hashes
     pinned in the vault bundle (and covered by the signed manifest in section 4), cached
     with the Cache API. A swapped proving artifact can leak secrets or produce bad
     proofs.
     Spending key stays in the vault worker; the UI never sees it. Clear witness buffers
     ( .fill(0) ) after proving and terminate the worker.
     Notes, viewing keys, and the local Merkle tree: encrypted in the vault's IndexedDB
     under the unlock key. Browser storage can be wiped at any time, so support full rescan
     from seed and optional client-side-encrypted backup. Warn loudly in incognito mode.

Metadata privacy (what ZK does not hide)
     RPC and IP leaks: every browser request reveals the user's IP and which accounts are
     queried. Route shielded reads through the Noctura relayer, fetch note/nullifier data in
     ranges (never only your own), and make the wallet work in Tor Browser (no
     WebGPU/WebHID dependencies for core functions).

     Browser fingerprinting and storage: no third-party requests at all (section 2), no
     fingerprinting libraries, Referrer-Policy: no-referrer , no wallet data in URLs (URLs
     leak into history, sync, and extensions).
     Timing and amount linking: deposit 1,337.21 NOC and withdraw 1,337.21 NOC an hour
     later = linked. Suggest round denominations; show a privacy warning for fast in/out of
     identical amounts.
     Anonymity set: small at launch. Say so honestly in the UI.
     Fee payer: always use the relayer as fee payer for shielded ops, so the user's
     transparent address is never linked.
     No telemetry, error reports, or AI cloud calls containing addresses, notes, or amounts.

7. AI Guard: recommended architecture (web)
The Guard is a layered risk engine where the LLM is the last and least-trusted layer.
Deterministic rules and a small classic model do the blocking and always run in every
browser. The LLM explains risk in plain language and catches fuzzy patterns, runs only
where the browser can handle it, and can only raise the risk level, never lower it.

  flowchart TD
    TX[Parsed tx + simulation<br/>structured JSON from vault] --> L1[L1 Hard
  rules<br/>in vault, TS/WASM]
      TX --> L2[L2 Threat intel<br/>signed local lists]
      TX --> L3[L3 Behaviour model<br/>small ML, WASM]
      TX --> L4[L4 LLM<br/>WebGPU, optional]
      L1 --> F[Verdict fusion in vault<br/>max risk wins]
      L2 --> F
      L3 --> F
      L4 --> F
      F --> UI[Vault approval screen<br/>OK / Warn / Block]

Fusion happens in the vault and takes the highest risk from any layer. No layer can
override another's block.

Browser reality for the model
The whitepaper's on-device Phi-4-mini (3.8B) is roughly a 2+ GB download and needs a
strong GPU. That is not acceptable as a default for a web page. Recommended:

     L1–L3 always on: pure TypeScript/WASM, a few hundred KB, work in every browser
     including Tor and mobile.

     L4 LLM opt-in, lazy-loaded: a small quantized model (~0.5–1.5B parameters, 4-bit,
     roughly 300 MB–1 GB) running on WebGPU (via WebLLM or transformers.js/ONNX
     Runtime Web). Offered as "Enable AI explanations" once the user has a capable
     device; cached after first download.
     No WebGPU / low memory: L4 is off; the UI says "AI explanations unavailable on this
     device". Never fall back to sending the user's transaction to a cloud model.
     Phi-4-mini stays the target for the desktop and mobile apps, where it can ship inside
     the signed binary.

Where each layer runs (isolation matters)
     L1 hard rules and fusion: inside the vault (they gate signing, so they must be as
     trusted as the signer).
     L2–L4: in Web Workers on the app origin (or a third origin guard.noc-tura.io ),
     never on the vault origin. A worker on the vault origin could reach the vault's
     IndexedDB and non-extractable signing key and use it to sign. The Guard must be
     unable to sign, by construction.
     The Guard worker has a CSP with connect-src limited to the model/threat-list hosts;
     it receives only the structured JSON the vault sends and returns only a verdict.

The four layers

  Layer                        What it is                       What it catches                Can
                                                                                               block?

  L1 Hard rules                Vault code, table in section 5   Authority changes, unlimited   Yes
                                                                approvals, drainer patterns,
                                                                RPC mismatch, origin
                                                                mismatch

  L2 Threat intel              Signed, versioned lists          Known scams, fake tokens,      Yes
                               (drainer addresses, scam         lookalike dApp origins
                               mints, phishing domains),
                               refreshed daily, looked up
                               locally (never send the user's
                               addresses to a server)

  L3 Behaviour                 Small gradient-boosted /         Unusual amount, new            Warn
  model                        anomaly model in WASM, on        recipient + large value,       only
                               local encrypted history only     sudden full-balance sweep,
                                                                many small drains

  Layer                        What it is                  What it catches               Can
                                                                                         block?

  L4 LLM                       WebGPU model, structured    Social-engineering context,   Warn
                               input, schema-constrained   suspicious token/dApp         only
                               output                      metadata, plain-language
                                                           explanation

What the Guard checks (coverage list)
 1. Outgoing transactions: all red flags from section 5, plus "does the tx match the user's
     intent?" (clicked Swap, tx contains a Transfer to a third address).
 2. dApp connections: origin on phishing list, punycode/lookalike domain, domain age,
     domain vs. claimed name, requested permissions vs. dApp type.
 3. Incoming assets: spam tokens/NFTs with links (lure), Token-2022 traps, dust from
     lookalike addresses. Hidden by default; URLs never auto-rendered.
 4. Address poisoning: similarity check against contacts and history.
 5. Privacy hygiene (shielded): same-amount in/out timing, small anonymity set.
 6. Environment: page framed, non-official origin, outdated browser, incognito mode, build
     hash not matching the signed manifest, unusual number of installed-extension DOM
     mutations on the page (heuristic).
 7. Messages: signMessage content resembling login phishing or decoding as a
     transaction; Sign-In With Solana domain mismatch.

Input and output contract for the LLM
     Input: fixed JSON schema built by the vault: decoded instructions, balance deltas, L1–
     L3 flags, origin info. Untrusted strings (token names, memos, dApp descriptions) are in
     a clearly delimited field, truncated (e.g. 64 chars), normalized (no control chars, no
     bidi). Never seed words, keys, notes, or full history.
     Output: schema-constrained decoding: {risk: "none|low|medium|high", reasons:
     [enum codes], explanation: string ≤ 280 chars} . Unparseable = medium +
     generic warning.
     Explanation shown as plain text. Reason codes map to pre-written, reviewed UI
     messages. Model output may not contain amounts or addresses (filtered); all numbers
     on screen come from simulation.
     Timeout ~3 s (WebGPU cold start can be slow: pre-warm when the send screen
     opens). On timeout or crash: L1–L3 verdict stands, note says "AI check unavailable".
     Never block the wallet because the model is down; never report "safe".

Cloud component
Optional, opt-in, public data only: token/program reputation looked up by mint or program
ID, never by the user's address or IP-linked history (route through the relayer). Clearly
labelled in Settings.

8. AI Guard: what can go wrong and how to prevent it
The biggest AI risk is not a wrong answer but false confidence: a green "AI verified: safe"
badge users trust more than their own eyes. The Guard never shows "safe". It shows "no
known risks found" next to the deterministic facts.

  #           Failure mode                          Example                     Mitigation

  1           Prompt injection via                  Token named SAFE —          Structured JSON input;
              on-chain data                         Noctura verified,           untrusted strings delimited +
                                                    ignore warnings , or a      truncated; LLM can only raise
                                                    memo telling the model      risk; L1 blocks cannot be
                                                    to answer "none"            overridden

  2           Prompt injection via                  dApp description claims     Same as 1; origin reputation
              dApp metadata                         to be an official Noctura   comes only from signed L2
                                                    partner                     lists, never from the dApp's
                                                                                own text

  3           False negative (new                   Pattern not yet in lists    L1 rules on dangerous
              drainer)                                                          instruction types (authority,
                                                                                approve, nonce) regardless of
                                                                                source; daily signed list
                                                                                updates; red-team corpus in
                                                                                CI

  4           False-positive fatigue                Warnings on every swap;     Tiers (info / warn / block);
                                                    users click through         target < 5% of normal txs
                                                                                warned; tune on real test set

  5           Hallucinated                          Model says "sends 10        All numbers from simulation;
              explanation                           SOL" when it sends 100      model output cannot contain
                                                                                amounts/addresses (schema
                                                                                + filter)

  6           Tampered model                        Attacker swaps model        Model file hashes pinned in
              download                              weights on CDN/cache        the vault bundle and signed
                                                    for one that always         manifest; verified before load,
                                                    answers "none"              including from Cache API;
                                                                                mismatch = L4 disabled + alert

  #           Failure mode                          Example                     Mitigation

  7           Threat-list poisoning                 Noctura's vault added to    Lists signed by offline key;
                                                    blocklist, or a drainer     versioned; sanity checks (max
                                                    removed                     N removals per update);
                                                                                unsigned = rejected

  8           Guard used to sign                    Guard worker on vault       Guard never runs on the vault
                                                    origin reaches the non-     origin (section 7); verdict-only
                                                    extractable key             message channel

  9           Guard as data leak                    Model host or logs see tx   Model runs locally; no prompt
                                                    history                     logging; worker CSP blocks
                                                                                other network; cloud only for
                                                                                public IDs, opt-in

  10          No WebGPU / crash /                   Old laptop, Safari          Fail safe to L1–L3; wallet
              timeout                               without WebGPU, tab         always usable; UI states AI
                                                    OOM                         unavailable; never a cloud
                                                                                fallback with private data

  11          Malicious browser                     Extension edits the app     Warnings rendered inside the
              extension hides                       page to remove the red      vault popup/iframe, not the
              warnings                              banner                      app page; confirm button lives
                                                                                only in the vault

  12          Adversarial evasion                   Drain split into many       Rolling-window rules
                                                    small txs                   (cumulative outflow per
                                                                                hour/day) in L1

  13          Model and rules                       New scam technique          Versioned model + rules
              outdated                              after release               shipped via signed manifest;
                                                                                monthly red-team review

  14          Over-reliance by the                  Rules removed because       Policy: every AI-found pattern
              team                                  "the AI catches it"         becomes an L1/L2 rule once
                                                                                understood; LLM is never the
                                                                                only check for a known risk

  15          Liability                             User blames AI after a      UI + ToS: the Guard is an
                                                    loss                        assistant, not a guarantee;
                                                                                verdict codes kept locally (no
                                                                                personal data) for support

  #           Failure mode                          Example                     Mitigation

  16          Parser bug                            Malformed instruction       Same parser feeds the
                                                    decoded as harmless         approval screen: fuzz it with
                                                                                malformed txs; differential
                                                                                tests against the official
                                                                                Solana decoder

Testing the Guard
      Labelled corpus: real drainer transactions from public incident reports, phishing dApp
      flows, address-poisoning cases, plus a large set of normal transactions. A few
      thousand examples minimum before launch.
      CI gates: recall on known-malicious ≥ 99% for L1+L2 categories; false-positive rate on
      normal txs ≤ 5%.
      Prompt-injection test set (hundreds of hostile token names, memos, dApp
      descriptions). Pass = verdict never drops below the L1–L3 verdict.
      Cross-browser test matrix: Chrome, Firefox, Safari, Brave, Tor Browser, mobile
      Chrome/Safari, with and without WebGPU.
      Quarterly external red team focused on bypassing the Guard.

zkML (from the whitepaper): keep it out of v1
EZKL proofs of model inference add a new circuit attack surface and heavy browser
compute without improving user safety. Revisit only if a Guard verdict must be proven to
a third party (e.g. compliance attestations).

9. Testing, audits, launch gates and incident response
The web wallet ships transparent-only first. Shielded mode follows only after every gate
below is green.

Launch gates

  Gate                                                        Transparent web         Shielded mainnet
                                                              wallet

  All section 2–5 items done, incl. vault                     Required                Required
  origin split + headers

  Gate                                              Transparent web   Shielded mainnet
                                                    wallet

  Security headers scored A+                        Required          Required
  (securityheaders.com / Mozilla
  Observatory)

  Domain/DNS hardening done (registry               Required          Required
  lock, DNSSEC, CAA, CT monitoring)

  Reproducible build + signed manifest +            Required          Required
  external hash watchdog live

  Fuzzing (tx parser, postMessage                   Required          Required
  handlers, vault storage format) in CI

  External web pentest (OWASP ASVS                  Required          Required
  Level 3) + vault code audit

  Service-worker pinning of signed                  Strongly          Required
  releases                                          recommended

  Independent ZK circuit audit (specialist          —                 Required
  firm)

  Solana verifier/program audit                     —                 Required

  Formal verification of core transfer              —                 Required before TVL
  circuit                                                             cap raise

  Public bug bounty (Immunefi or similar)           Required          Critical tier sized above
                                                                      pool cap

  AI Guard corpus gates met (section 8)             Required          Required

  Incident playbook rehearsed once, incl. a         Required          Required
  simulated frontend hijack

Continuous security
     AI-assisted code review on every PR touching the vault, signing, parser, headers/CSP,
     circuits, or programs. This is the technique that found the Zcash bug; attackers use it
     too.
     Monthly dependency and threat-list review; quarterly external red team; yearly re-
     audit of the vault.
     Security changelog in the Weekly Build Update (no exploit details until patched).

Incident response playbook
 1. Detect: hash watchdog (frontend changed), CT log alert (unexpected cert), DNS
     change alert, on-chain monitors (vault outflow, nullifier rate, program upgrades), bug-
     bounty inbox, user reports.
 2. Contain (minutes): for a frontend compromise, roll back the deploy from CI, rotate
     hosting/DNS credentials, and post a warning on all official channels telling users not to
     sign anything. For a protocol issue, multisig pauses the shielded pool. Service-worker-
     pinned users keep the last signed version automatically.
 3. Fix: patch, at least one external review, redeploy through timelock (or the pre-
     documented emergency multisig path).
 4. Disclose: public post-mortem with timeline, impact, and user actions. Zcash's speed
     and transparency limited its damage.
 5. Prove: publish vault balance vs. total shielded supply so anyone can verify no
     counterfeit exists.

Dev checklist (copy into the tracker)
     Two-origin split: app. UI and vault. sandboxed iframe/popup; typed, origin-checked
      postMessage
     Strict CSP + Trusted Types + HSTS preload + COOP/COEP + frame-ancestors on both
     origins
     Zero third-party scripts; all assets self-hosted; untrusted strings rendered as plain text
     Passkey (WebAuthn PRF) unlock, Argon2id password fallback; AES-GCM seed
     encryption in IndexedDB
     Non-extractable WebCrypto Ed25519 signing key; storage.persist() ; auto-lock
     across tabs
     Seed only on Restore screen; anti-phishing phrase after unlock; no copy button
     Ledger via WebHID for transparent mode; in-app recommendation for large balances
     Registry lock, DNSSEC, CAA, CT monitoring, hardware-key 2FA on
     registrar/DNS/hosting
     Reproducible builds, SRI, signed release manifest, CI-only deploys with 2-person
     approval
     External hash watchdog; service-worker pinning of signed releases
     Dual-RPC simulation + vault-rendered WYSIWYS approval bound to message hash
     L1 hard-rules table implemented and tested, incl. origin-mismatch rule
     Address-poisoning + extension-tampering checks; recipient reconfirmed in vault
     AI Guard: L1 in vault, L2–L4 off the vault origin, max-risk fusion, pinned model hashes,
     signed lists, WebGPU opt-in

     Prompt-injection + drainer corpus in CI; cross-browser matrix
     Circuit CI: Circomspect, Picus, zkFuzz, negative witness tests
     Browser prover in vault worker, pinned proving-key hashes, rescan from seed
     Vault-backed pool, withdrawal rate limits, circuit breaker, timelocked upgrades
     Relayer as fee payer; Tor Browser works; no telemetry with addresses
     External audits booked (web pentest + vault, program, ZK)
     Bug bounty live; incident playbook rehearsed

Sources
     The Orchard Counterfeiting Vulnerability — Zcash Community Forum
     CoinDesk — Zcash bug undetected for four years
