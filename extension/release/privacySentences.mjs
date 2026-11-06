// B1e §6.1, §6.2, §6.5: the privacy policy's required sentences — the one list the offline test
// (scripts/__tests__/privacy.test.mjs: each verbatim in release/privacy.md) and the release script's live check
// (scripts/live-check.mjs: each on https://noc-tura.io/extension/privacy) both read. Every sentence is published to
// users as a fact: each names its source, and a sentence that stops being true is a finding to fix here and in
// privacy.md together — never an edit to the page alone.
//
// P1–P16: spec §6.1's sentences, re-derived from the --no-presale build's real network calls; P3, P5 and P8 as
// corrected by B1e-2's dry run (spec rev 2.7). L1 (after P9, the controller's ruling): the noc-tura.io pages the
// extension links to. R1–R21: ICO's §6.2 answer (release/ico-retention.md, received
// 2026-11-01), each sentence saying only what that answer states — except R2 and R8, which are the extension's own
// measured request headers (e2e/requestHeaders.spec.ts), and say so in `source`.

/** @typedef {{id: string, text: string, source: string}} PrivacySentence */

/** @type {readonly PrivacySentence[]} */
export const PRIVACY_SENTENCES = Object.freeze([
  {
    id: 'P1',
    text: 'The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator.',
    source: 'manifest/source.mjs EXTENSION_CSP connect-src (:49–51); src/background/deps.ts browserDeps (:169), the one global network call (timedFetch, :132)',
  },
  {
    id: 'P2',
    text: 'Every request to the coordinator carries your IP address and the standard headers your browser sends.',
    source: 'every route through src/background/deps.ts (credentials: omit — no cookies); measured in e2e/requestHeaders.spec.ts',
  },
  {
    id: 'P3',
    text: 'The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing.',
    source: 'wallet.balances (src/background/walletApi.ts:341) from WalletContext.tsx:204 (the account viewed) and useAccountBalances.ts:6,67 (FRESH_ROWS = 10: switcher, accounts manager, #37); history.ts:65 getSignaturesForAddress (Activity.tsx:118)',
  },
  {
    id: 'P4',
    text: 'When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds.',
    source: 'wallet.probeBalances, MAX_PROBE = 6 (src/background/walletApi.ts:56, :139); importCandidates SLIP10_ACCOUNTS_TO_SCAN = 5 + the CLI account (src/unlock/onboarding.ts:16, :48–49), probeCandidates (:65)',
  },
  {
    id: 'P5',
    text: 'Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it, and every 5 seconds after a simulation that fails. When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token.',
    source: 'src/background/prepare.ts:370; src/background/dapp/simulate.ts:304; SIM_REFRESH_MS = 30 000 and SIM_RETRY_MS = 5 000 (src/background/dapp/signTx.ts:39, :43, needsSimulation :79), the window polling every POLL_MS = 1 000 (src/approve/Approve.tsx:10, :77); the recipient asked about first: getAccountKind of the address sent to (src/background/prepare.ts:311 SOL, :332 token) and getAccountExists of its associated token address (:333), both before simulateTransaction (:370), on each prepare (Review.tsx:110, Confirm.tsx:162 when the quote expired) — pinned in scripts/__tests__/privacy.test.mjs',
  },
  {
    id: 'P6',
    text: 'Every transaction the wallet submits is sent to the coordinator, which broadcasts it to Solana: your own sends, and the transactions a site asks the wallet to sign and send. A transaction a site asks only to sign is returned to that site.',
    source: '/tx/broadcast (core/solana/broadcast.ts:12, :81) from src/background/pending.ts:48; finishSend vs finishSignTx (src/background/dapp/signTx.ts:462, :409 — Pick<WalletDeps, now>, no network)',
  },
  {
    id: 'P7',
    text: 'The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data.',
    source: 'PRICE_PATH (core/portfolio/prices.ts:8); /stats (src/background/deps.ts stagePrice :189–195; callers prepare.ts:180, walletApi.ts:176, dapp/simulate.ts:226) — GET, no body',
  },
  {
    id: 'P8',
    text: 'Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes.',
    source: 'carriesPurchase / runSimulation (src/background/dapp/signTx.ts:68, :106), decide.ts:340–341; GEO_LIST_CACHE_MS (src/background/geo/gate.ts:24, :53 — in memory, a failed read not kept); presale/buy.ts not in the store build (check-no-presale.mjs OFF_FORBIDDEN)',
  },
  {
    id: 'P9',
    text: "When you open a transaction in the Solscan explorer, Solscan receives that transaction's signature, your IP address and your browser's standard headers; no referrer is sent.",
    source: 'src/app/explorer.ts:4; rel="noopener noreferrer" (src/app/screens/TxDetail.tsx:65); measured: no Referer on the navigation (B1e-2 dry run, Task 3 Notes)',
  },
  {
    id: 'L1',
    text: "When you open the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives your IP address and your browser's standard headers, as any website you open does; no referrer is sent.",
    source: 'NOCTURA_PAGES (src/shared/links.ts:6–10), opened by <a target="_blank" rel="noopener noreferrer"> on #1 (unlock.html:49) and #38 (src/app/screens/About.tsx:23); measured: no Referer on the navigation (e2e/requestHeaders.spec.ts, and on the wire in the B1e-2 dry run, Task 3 Notes)',
  },
  {
    id: 'P10',
    text: 'Messages a site asks you to sign are signed on this device and are not sent anywhere by the wallet.',
    source: 'src/background/dapp/signMessage.ts finishSign (:139 — Pick<WalletDeps, now>, no network dependency)',
  },
  {
    id: 'P11',
    text: 'Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.',
    source: 'the vault isolation gate (scripts/check-vault-isolation.mjs); the routes above',
  },
  {
    id: 'P12',
    text: 'If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it. In your passkey manager the passkey is listed under the name wallet.noc-tura.io.',
    source: "the WebAuthn ceremony is the browser's; no route carries it; RP_ID (src/vault/passkey.ts:8)",
  },
  {
    id: 'P13',
    text: 'The sites you connected, your address book and your anti-phishing phrase are stored only in this browser. Nothing is served at wallet.noc-tura.io and the extension never connects to it; the name exists only so that passkeys are bound to a name no website can use.',
    source: 'GRANTS_KEY (src/background/dapp/grants.ts:8), CONTACTS_KEY (contacts.ts:18), PHRASE_KEY (phraseKey.ts:6), in storage.local, no storage.sync anywhere; no route carries them; connect-src (spec §5.6)',
  },
  {
    id: 'P14',
    text: "The extension reads nothing from the pages you visit; a site's own requests to the wallet are the only page data it handles.",
    source: "CONTENT_SCRIPTS.reason (manifest/source.mjs:20–23); src/relay/relay.ts (the port opened on the page's first request only, :9, :171), src/provider",
  },
  {
    id: 'P15',
    text: 'The extension sends no analytics, telemetry or crash reports.',
    source: 'spec §4.3 route list; the one global network call is deps.ts timedFetch, to API_BASE',
  },
  {
    id: 'P16',
    text: 'Questions about privacy: privacy@noc-tura.io.',
    source: 'owner decision E8',
  },
  {
    id: 'R1',
    text: "The coordinator's web server writes every request to its access log: your IP address, the time, the method, the path including its query string (for example the token identifiers in a price request), the response status and size, and the Referer and User-Agent headers. It does not log request bodies, the Origin header or any other header.",
    source: 'ICO §6.2 answer 1–2, nginx access log',
  },
  {
    id: 'R2',
    text: "The extension's requests carry no Referer header; their User-Agent is your browser's.",
    source: 'measured, not ICO: e2e/requestHeaders.spec.ts (the store build, a service-worker fetch has no Referer; B1e-2 dry run on the wire, Task 3 Notes)',
  },
  {
    id: 'R3',
    text: 'The access logs are rotated daily and deleted automatically: 14 rotated files are kept, so a request stays in them for about 15 days at most.',
    source: 'ICO §6.2 answer 3, nginx',
  },
  {
    id: 'R4',
    text: "The coordinator's application log records nothing about an RPC request it answers, except an Origin header that is not on its allow list (below). When it refuses one, it records the reason and the name of the RPC method; when the Solana network provider cannot be reached, the method name. It never records the request's parameters, your IP address or any other header.",
    source: 'ICO §6.2 answer 1–2, app log, /rpc; the Origin exception is R7 ("any route", the final review\'s I1: the extension\'s Origin may not be on the allow list)',
  },
  {
    id: 'R5',
    text: "For each transaction submitted for broadcast, the application log records the transaction's signature and the HTTP status of the outcome, and an Origin header that is not on its allow list (below); not the transaction itself, your IP address or any other header.",
    source: 'ICO §6.2 answer 1–2, app log, /tx/broadcast; the Origin exception is R7, as for R4',
  },
  {
    id: 'R6',
    text: 'Price, presale statistics, region and restricted-country list requests are not recorded in the application log; only server errors are, with no data from the request.',
    source: 'ICO §6.2 answer 1–2, app log, /wallet/prices, /stats, /geo/check, /geo/restricted-list',
  },
  {
    id: 'R7',
    text: "On any route, an Origin header that is not on the coordinator's allow list is logged with its value, without your IP address.",
    source: 'ICO §6.2 answer 1–2, app log, any route',
  },
  {
    id: 'R8',
    text: 'The extension sends an Origin header only with its RPC and broadcast requests, and that Origin is the same for every user of the extension.',
    source: "measured, not ICO: e2e/requestHeaders.spec.ts (POST carries chrome-extension://<id>, GET none); the store build's ID is the store's, one for every install (spec §6.1)",
  },
  {
    id: 'R9',
    text: 'Application logs are rotated daily, and a daily job deletes those older than 14 days.',
    source: 'ICO §6.2 answer 3, app logs',
  },
  {
    id: 'R10',
    text: "None of the extension's requests writes anything to the coordinator's database.",
    source: 'ICO §6.2 answer 1–2, PostgreSQL',
  },
  {
    id: 'R11',
    text: 'To enforce rate limits, the coordinator keeps your IP address in memory for a one-minute window; it is never written to disk.',
    source: 'ICO §6.2 answer 1–2, memory only',
  },
  {
    id: 'R12',
    text: "The country of your IP address is looked up in a MaxMind GeoLite2 database file on the coordinator itself: the lookup never leaves the server, neither your IP address nor the result is stored, and the file's daily update sends no data about you.",
    source: 'ICO §6.2 answer 1–2 (/geo/check) and 4 (GeoLite2)',
  },
  {
    id: 'R13',
    text: 'The coordinator runs CrowdSec, which reads the access log to detect abuse. When requests match one of its scenarios, it stores an alert with the IP address, the scenario, the time, and the path, method, status and User-Agent of those requests, and the IP address may be blocked. Requests that match no scenario create no alert.',
    source: 'ICO §6.2 answer 1–2, CrowdSec local ("on a scenario match": ICO\'s word, scenario)',
  },
  {
    id: 'R14',
    text: "CrowdSec's local alerts are deleted after 7 days, or once more than 5,000 are stored.",
    source: 'ICO §6.2 answer 3, CrowdSec local',
  },
  {
    id: 'R15',
    text: "For an IP address that triggered an alert, CrowdSec's central service receives the IP address, the scenario and the time, but no paths, methods, statuses or User-Agents; that data is held under CrowdSec's own privacy policy.",
    source: 'ICO §6.2 answer 1–2 and 3, CrowdSec central',
  },
  {
    id: 'R16',
    text: 'To decide whether to block a request, the coordinator asks only its own local CrowdSec.',
    source: 'ICO §6.2 answer 1–2: the bouncer only queries the local API',
  },
  {
    id: 'R17',
    text: 'The coordinator forwards RPC requests to its Solana network provider, Helius: Helius receives the body of each RPC request (the method and its parameters, which can include wallet addresses) and each signed transaction submitted for broadcast.',
    source: 'ICO §6.2 answer 4, Helius',
  },
  {
    id: 'R18',
    text: "Helius receives these from the coordinator's own IP address; your IP address, Origin, User-Agent and other headers are not forwarded.",
    source: 'ICO §6.2 answer 4, Helius',
  },
  {
    id: 'R19',
    text: 'Prices for SOL, USDC and USDT come from CoinGecko: the coordinator asks for them at most once a minute and answers the wallet from its own copy, so CoinGecko receives no data about you.',
    source: 'ICO §6.2 answer 4, CoinGecko',
  },
  {
    id: 'R20',
    text: 'The coordinator uses this data only to answer requests, to protect the service from abuse (rate limits and CrowdSec) and to diagnose faults. It is not sold or shared for any other purpose.',
    source: 'ICO §6.2 answer 5',
  },
  {
    id: 'R21',
    text: 'To ask for data about you to be deleted, write to privacy@noc-tura.io.',
    source: 'ICO §6.2 answer 6',
  },
].map(s => Object.freeze(s)));
