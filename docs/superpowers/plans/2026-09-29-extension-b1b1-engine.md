# Noctura Extension B1b-1 — the wallet engine (no screens) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Noctura extension a working, tested wallet engine behind its background message API — read balances and history through the coordinator's allowlisted RPC proxy, build, simulate, sign and broadcast SOL/SPL sends with the app's fee policy, track every send as pending until confirmed or expired without ever double-spending, require re-authentication as a proof for risky sends and weakening settings, and create, import and extend wallets in the vault page — with no screens (those are B1b-2).

**Architecture:** Transfer building, balance reads, history decoding, the fee policy, a method-allowlisted JSON-RPC client and a broadcast client live in `core/`, shared with the app through re-export shims. The extension's background (service worker) composes them into a send engine whose pending records live in `storage.session`, and exposes it through new privileged message types; the vault page (`unlock.html`) gains thin `create`, `import`, `reauth` and `accounts` modes whose logic is pure, injectable functions. The coordinator's broadcast route does not exist yet: the engine is built against the contract this plan defines, tested against a simulated route, and the last task writes the ask for the coordinator's owner.

**Tech Stack:** TypeScript 5 (strict), Vite 8, Vitest 5 (node environment), `@solana/web3.js` 1.99 (added to the extension), `buffer` 6, `@noble/curves` 2 / `@noble/hashes` 2, `@scure/base` 2, `@scure/bip39` 2, `micro-key-producer` 0.8, WebCrypto, Playwright (Chromium E2E), Jest (app-side tests of moved code), Node ≥ 22.12 with npm 11.6.2.

**Spec:** `docs/superpowers/specs/2026-09-27-extension-b1-design.md` (revision 4) — read §2 (vault, re-authentication), §3 (re-authentication triggers), §4 (Send, RPC — reads, Broadcast) and §5 (gates, tests, coordinator asks) before starting. Controller's brief with the binding design decisions for this phase: `.superpowers/sdd/b1b1-plan-brief.md`. The B1a plan (`docs/superpowers/plans/2026-09-28-extension-b1a.md`) shows what already exists.

**Dry run (revision 2, 2026-09-29).** The end state of this revision was applied to a scratch copy of the repository (outside the checkout): extension `tsc`, all 517 vitest tests, `npm run build`, `csp`, `secrets`, `gates` (the RPC gate, the sixth marker, the background-owned keys) and `reproducible` passed; the three Playwright tests passed inside an offline network namespace (`unshare -rn`), so nothing could reach the host and the route demonstrably saw the service worker's requests; web's `tsc`, its vitest run over `core/` (189 tests), `npm run build` and `npm run scan` passed (and the scan fails on a `Keypair.fromSeed` put back into the broadcast test — negative control); the app's `tsc`, `eslint src/modules/solana src/modules/fees src/constants` (0 errors) and the jest suites for `src/modules/{solana,fees,shielded,backgroundSync}` and `src/screens/transparent` (463 tests) passed. Mutations run: the latch queue (H2), the `RpcForbidden` rethrow in the fee estimate, the 32-block margin and the two-round rule (H3), the persisted cool-down (M3), pending in `storage.local` (A), the history cursor (M6), the sender rent check (M4), the alarm re-arm (M5) and the reveal's key zeroing (M1) — each turned its test red. The first revision's dry run had caught the Vite resolution (Task 3) and a challenge-expiry test's call order; this one caught a margin test that was blind to its own constant and a mis-labelled test file, both fixed. The web3.js in the dry run came from `web/node_modules` rather than a fresh install into `extension/`, and `npm audit` was not run.

**Revision 2 (2026-09-29).** Folds in two owner decisions — (A) pending records live in `storage.local`, (B) NOC is valued at the presale stage price for the dollar re-auth rule — and every item of the Fable 5.1 review of revision 1 (H1–H5, M1–M7, L1–L10 and the three extra notes). Where each lands is listed in the self-review at the end.

## Scope, and where this plan departs from the spec, the brief or the app — stated

Each of these is a decision the plan takes; the controller may overrule any of them before execution.

1. **Pending sends live in `storage.local` (owner decision A, 2026-09-29).** The brief put them in `storage.session`, which a lock clears (spec §2) and a browser restart wipes — either would let a new transaction be built while the first may still land. `v1_pending` is a background-owned `storage.local` key (signed bytes, public once broadcast; at most 20 records), every change to it goes through the pendingStore mutex, and `lock()` clears `storage.session` exactly as B1a wrote it.
2. **No automatic re-send with a new blockhash.** The reliable-send design (`2026-06-13-reliable-send-design.md`) and `signAndSend.ts` resubmit automatically on expiry (up to 3 attempts, each a new signature) and poll every 0.5–1 s. Spec §4 and the brief forbid both for the extension: after expiry the record says "Not confirmed — no funds moved." and only then may a *new* transaction be built; polling is every ≥ 2 s. What is mirrored from the app: `getBlockHeight` failure skips that round's expiry check; an on-chain `err` is failed; > 90 s is `stuck` and keeps polling; and — from `landedSignature.ts` — a full-history status check before declaring "expired". Stricter than the app (review H3): `expired` needs the block height past `lastValidBlockHeight + 32` **and** a null full-history status in two rounds at least 2 s apart.
3. **`transactionBuilder.ts` cannot be a pure `export *` shim.** Its public functions read the app's Zustand fee store and a web3 `Connection`. The pure parts move to `core/solana/transfer.ts` (markup, source account and priority fee become explicit inputs); the app file becomes `export * from core` plus thin wrappers that bind the store and the `Connection`. Every existing app test keeps passing unchanged.
4. **History decoding does not exist in the app.** `queries.ts` labels transactions only "Send"/"Transaction" and the list as `'unknown'`. `core/solana/history.ts` is new code (sent / received / purchase from balance deltas); the app is not switched to it in this plan.
5. **The extension's Vite config must stop deduping `@noble/*`.** `@solana/web3.js` 1.x brings `@noble/curves@1`, whose files import `@noble/hashes` subpaths that v2 — the extension's copy — does not export; B1a's dedupe would force v2 on them and break the build (seen in a dry run of this plan). Task 3 replaces the dedupe with a small resolver plugin that makes only `core/` files resolve their bare imports from the extension package.
6. **Fee policy (brief decision 4) — finding.** The app does **not** derive `tgeStatus` from a date: `presaleStore.tgeStatus` defaults to `'pre_tge'` and `setTgeStatus` has **no caller** anywhere in `src/`; `isZeroFeeEligible` is hard-coded `false` by `usePresaleSync.ts`; `getTransferMarkupLamports()` passes no staking discount. So the app charges no markup today and has no source for any of the three inputs. The chain does hold `config.tge_timestamp` (`core/presale/allocation.ts` `fetchTgeTimestamp`), but eligibility has no source at all, so a chain-derived "post-TGE" would charge presale buyers who are meant to be free — against the user. **Ruling applied:** the extension passes `tgeStatus: 'unknown'`, `isZeroFeeEligible: 'unknown'`; the core policy charges 0 for either unknown, with the reason `'status-unknown'` carried to the fee line (disclosed, in the user's favour); Task 14 asks the coordinator for a fee-status endpoint. No date is read or written.
7. **NOC is valued at the current presale stage price for the dollar re-auth rule (owner decision B, 2026-09-29).** `/wallet/prices` refuses NOC; the stage comes from `/stats`, read strictly by the extension's own `stagePriceFrom` (Task 9): `currentStage` must be present, an integer and a known stage, and its price a positive finite number — otherwise the price is null and the NOC amount counts as above the threshold (fail closed). web's `fetchPresaleStats`, which maps a missing `currentStage` to stage 1 (right for its display, fail-open for a security threshold), is deliberately not used here and not changed.
8. **Explorer links in history** are left to B1b-2: a `solscan.io` URL would put a third host into the bundle before the host-allowlist gate (spec §5) exists. The history entries carry the signature.
9. **Accounts rename writes `v1_vault` from the background** (names are outside the AAD), while add/remove write it from the vault page. Two writers of one key: a rename racing an add in another tab can lose the rename. Accepted for B1b-1; B1b-2's screens serialise the two.
10. **The design's #54 stuck-transaction screen offers "speed up" and "cancel".** The engine gives #54 one action: re-send the same signed bytes. A higher fee means a new signature and Solana has no cancel — both would be a second transaction while the first may still land, which spec §4 forbids. B1b-2 must map "speed up" to the re-send and drop "cancel", or take it to the owner.
11. **Only classic SPL Token accounts count (review L8).** NOC, USDC and USDT are all SPL Token (`Tokenkeg…`) mints; balances are read by that program. A Token-2022 holding of any of them is out of scope for B1b-1.
12. **History of a mixed transaction reports one leg (review L10).** A transaction that moves SOL and a token for the owner is shown by its token leg; the SOL leg (rent, markup) is not a separate entry.
13. **Rent-exempt minimums are enforced before simulating (review M4).** A SOL remainder of 1–889 879 lamports on the sender, or less than 890 880 lamports of SOL to a brand-new recipient account, is refused with its own code; B1b-2's MAX math uses `SYSTEM_ACCOUNT_RENT_LAMPORTS`.

## Global Constraints

- TypeScript strict; **no `any`, no `@ts-ignore`** (CLAUDE.md). No `// TODO`, no placeholders (cardinal rule 1).
- **Money is BigInt in the smallest unit** (cardinal rule 2). Every amount crosses a message or storage as a **decimal string** (Chrome serialises messages and `storage.session` as JSON; a `bigint` cannot cross).
- UTC everywhere (cardinal rule 3): timestamps are `Date.now()` milliseconds.
- Prettier style of the surrounding code: single quotes, trailing commas, **no spaces inside braces** (`{a, b}`), no parens around a single arrow parameter.
- **No test ever contacts `*.noc-tura.io`.** Unit tests inject `fetch`/readers; the E2E routes `https://api.noc-tura.io/**` to a fake and maps every `noc-tura.io` name to `~NOTFOUND` (Chromium `--host-resolver-rules`) so an unrouted request fails locally instead of reaching the host.
- **The TGE date is never written** — not in code, tests, fixtures, comments, docs or commit messages.
- RPC reads go to **`https://api.noc-tura.io/api/v1/rpc`**. Allowed methods, exactly (spec §4): `getBalance`, `getAccountInfo`, `getMultipleAccounts`, `getLatestBlockhash`, `simulateTransaction`, `getSignaturesForAddress`, `getTransaction`, `getSignatureStatuses`, `getRecentPrioritizationFees`, `getTokenAccountsByOwner`, `getBlockHeight`. Refused: `sendTransaction`, `getFeeForMessage`, `getMinimumBalanceForRentExemption`, `getSlot`, `getEpochInfo`, `isBlockhashValid`, `getTokenAccountBalance`, `getProgramAccounts`, `getHealth`, `getVersion`.
- **CrowdSec rule (spec §4):** the methods are a compile-time list with a test; **a 403 is terminal, never retried**; coordinator requests are **serialised per latch** (one in flight; after a 403 the queued ones are refused unsent), and the latch's cool-down is persisted (`v1_forbidden_until`); confirmation polling is **no faster than every 2 s**; if `getBlockHeight` hiccups, that iteration skips the expiry check.
- **Broadcast contract (this plan defines it; the coordinator does not have it yet):** `POST https://api.noc-tura.io/api/v1/tx/broadcast`, `content-type: application/json`, body `{"transaction": "<base64 of the signed wire bytes>"}`. `200` → `{"signature": "<base58>"}`, which **must equal the first signature of the bytes sent** (the client refuses anything else). `400` → `{"error": "malformed" | "unsigned" | "rejected", "message": string}`. **Never 403 on an unknown `Origin`.** Any other status or a network failure means "not acknowledged": the transaction stays pending and "send again" re-sends the same bytes.
- Fees (spec §4): network fee = **5 000 lamports × signatures + priority fee** (`core/solana/priorityFee.ts`); a new recipient token account costs the fixed rent-exempt minimum for **165 bytes = 2 039 280 lamports**; the Noctura markup is its own line when non-zero.
- Re-authentication triggers usable by send (spec §2, §3): **first send to a new address; amount above 5 % of the account's balance; amount above the absolute threshold (default $100; a missing price counts as above); whole balance to a first-time address.** Weakening a security setting (auto-lock minutes up, dollar threshold up) needs re-authentication too. **A proof mismatch locks the vault.**
- Pending (spec §4): the same signed bytes on "send again"; **> 90 s pending → `stuck`**; `expired` (detail **"Not confirmed — no funds moved."**) only when the height is past `lastValidBlockHeight + 32` and a full-history status check is null in two rounds ≥ 2 s apart; one in-flight send per account; a 30 s alarm keeps polling while a record is open. A prepared (unsigned) send lives **30 s** (spec §3's re-simulation interval); `wallet.send` on an older one returns the typed error `'prepared-expired'` and the caller prepares again — so prepare → re-authenticate → send must fit in `PREPARED_TTL_MS`.
- Storage ownership: `storage.session` only in the background (keys, prepared sends, re-auth challenges — all cleared by a lock); `v1_settings`, `v1_known_recipients`, `v1_pending` and `v1_forbidden_until` (storage.local) written only by the background; `v1_vault` written by the vault page (`writeLocal`) and — names only — by the background. **The vault page never touches the network.**
- Permissions unchanged: `storage`, `alarms`; hosts `https://api.noc-tura.io/*`, `https://wallet.noc-tura.io/*`. No new permission, host or content script.
- Cardinal rule 6 (**500 ms lock on send/sign buttons**) belongs to the B1b-2 screens; this plan provides the engine half (single-use prepared sends, one in-flight send per account, resend no faster than every 2 s).
- npm is **11.6.2** (the CI pin); Node **22.12.0** in CI. The extension installs with `npm ci --ignore-scripts`.
- Every commit ends with the **executing model's own truthful `Co-Authored-By:` line** (standing ruling); the commit blocks below mark its place as `Co-Authored-By: <the executing model's own line>`.

## File map

| path | responsibility |
|---|---|
| `core/solana/rpc.ts` + test | allowlisted JSON-RPC client, serialising 403 latch, typed reader |
| `core/solana/priorityFee.ts` + test | lets a 403 through instead of returning the floor |
| `core/fees/transferMarkup.ts` + test | the markup policy, pure |
| `core/solana/transfer.ts` + test | SOL/SPL instruction building, holding-account selection, rent and fee arithmetic (moved) |
| `core/solana/balances.ts` + test | per-mint sums (moved), wallet balance read |
| `core/solana/history.ts` + test | decode a `getTransaction` result into sent / received / purchase |
| `core/portfolio/prices.ts` + test | `/wallet/prices` read |
| `core/solana/broadcast.ts` + test | the broadcast client and its signature check |
| `src/modules/fees/feeEngine.ts`, `src/constants/programs.ts` | app delegates to the core policy and literals |
| `src/modules/solana/transactionBuilder.ts`, `tokenBalances.ts` | app shims + bindings |
| `src/modules/{fees,solana}/__tests__/core*.test.ts` | app-side jest tests of the moved code |
| `extension/src/background/mutex.ts`, `digest.ts`, `deps.ts`, `sendTypes.ts`, `feePolicy.ts` | small shared pieces |
| `extension/src/background/settings.ts`, `knownRecipients.ts`, `accountsStore.ts` | background-owned storage |
| `extension/src/background/reauthChallenges.ts`, `reauthPolicy.ts` | re-auth challenges and triggers |
| `extension/src/background/prepare.ts`, `send.ts`, `pending.ts` | the send engine |
| `extension/src/background/history.ts` | paced, cached history |
| `extension/src/background/walletApi.ts`, `messages.ts`, `index.ts` | the message API |
| `extension/scripts/check-rpc-methods.mjs` + test | the RPC method gate |
| `extension/scripts/check-vault-isolation.mjs` + test | new rules: background-owned keys, `writeLocal`, wordlist marker |
| `extension/src/ext.ts` | `writeLocal` for `v1_vault` only |
| `extension/src/vault/envelope.ts`, `reauth.ts` | re-encryption for a changed account list; re-auth outcomes |
| `extension/src/unlock/types.ts`, `onboarding.ts`, `accountsFlow.ts`, `reauthFlow.ts`, `revealFlow.ts`, `mode.ts`, `modes.ts` | vault-page flows and thin modes (create, import, reauth, accounts, reveal) |
| `extension/unlock.html`, `src/unlock/main.ts`, `src/unlock/orchestrate.ts` | mode sections; backoff shared by re-auth |
| `extension/e2e/fakeCoordinator.ts`, `e2e/wallet.spec.ts` | E2E against a simulated coordinator |
| `docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md` | the ask for ICO Claude |

---
### Task 1: The allowlisted RPC client (`core/solana/rpc.ts`)

**Files:**
- Create: `core/solana/rpc.ts`
- Test: `core/solana/__tests__/rpc.test.ts`, `core/solana/__tests__/priorityFee.test.ts`
- Modify: `core/solana/priorityFee.ts` (a 403 is not swallowed)
- Modify: `extension/tsconfig.json` (`include`), `extension/vite.config.ts` (`test.include`)

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `core/solana/rpc.ts`; plus `core/solana/priorityFee.ts` `estimatePriorityFee` now rethrows `RpcForbidden`):
  - `API_ORIGIN = 'https://api.noc-tura.io'`, `API_BASE = 'https://api.noc-tura.io/api/v1'`, `RPC_ENDPOINT = 'https://api.noc-tura.io/api/v1/rpc'`
  - `ALLOWED_RPC_METHODS` (readonly tuple of the 11 names), `type RpcMethod`
  - `FORBIDDEN_COOLDOWN_MS = 600_000`
  - `interface FetchInit {method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string; credentials?: 'omit'}`, `type FetchLike = (url: string, init: FetchInit) => Promise<{status: number; json(): Promise<unknown>}>`
  - errors: `RpcForbidden`, `RpcMethodRefused`, `RpcHttpError` (`.status`), `RpcResponseError` (`.code`), `RpcMalformed`
  - `type FetchResponse = {status: number; json(): Promise<unknown>}`
  - `interface ForbiddenLatch {request(what: string, send: () => Promise<FetchResponse>): Promise<FetchResponse>}` — one request in flight per latch, queued in call order; a request whose turn comes after a 403 is refused unsent; a 403 trips the latch and throws `RpcForbidden`
  - `interface LatchStore {load(): Promise<number>; save(until: number): Promise<void>}`, `createForbiddenLatch(opts?: {now?: () => number; store?: LatchStore}): ForbiddenLatch` — the store persists the cool-down end (Task 9 backs it with `storage.local`)
  - `interface Rpc {call<M extends RpcMethod>(method: M, params: readonly unknown[]): Promise<unknown>}`, `createRpc(opts: {fetch: FetchLike; latch: ForbiddenLatch; endpoint?: string}): Rpc`
  - `interface SignatureStatus {err: unknown; confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null}`
  - `interface TokenAccountEntry {pubkey: string; mint: string; owner: string; amount: bigint; decimals: number}`
  - `interface SignatureInfo {signature: string; blockTime: number | null; err: unknown}`
  - `interface SimulationOutcome {err: unknown; logs: string[]; unitsConsumed: number | null}`
  - `interface SolanaReader` (methods below) and `solanaReader(rpc: Rpc): SolanaReader`:
    `getBalance(owner): Promise<bigint>`, `getAccountExists(address): Promise<boolean>`, `getMultipleLamports(addresses): Promise<bigint[]>`, `getLatestBlockhash(): Promise<{blockhash: string; lastValidBlockHeight: number}>`, `getBlockHeight(): Promise<number>`, `getSignatureStatuses(signatures, searchTransactionHistory?): Promise<(SignatureStatus | null)[]>`, `getRecentPrioritizationFees(): Promise<{prioritizationFee: number}[]>`, `simulateTransaction(transactionBase64): Promise<SimulationOutcome>`, `getTokenAccountsByOwner(owner, filter: {mint: string} | {programId: string}): Promise<TokenAccountEntry[]>`, `getSignaturesForAddress(address, opts: {limit: number; before?: string}): Promise<SignatureInfo[]>`, `getTransaction(signature): Promise<unknown>`.

Why a new client rather than web's: `web/src/lib/solana.ts` is a web3.js `Connection` pointed at the same-origin proxy. A `Connection` has every method, so nothing stops a call to a refused one — which is how a 403 burst gets an IP banned. This client can only express the eleven.

- [ ] **Step 1: Let the extension compile and test `core/solana`**

In `extension/tsconfig.json`, replace the `include` line with:
```json
  "include": ["src", "e2e", "../core/keys", "../core/util", "../core/solana"]
```
In `extension/vite.config.ts`, replace the `test.include` array with:
```ts
    include: ['src/**/*.test.ts', 'manifest/**/*.test.mjs', 'scripts/**/*.test.mjs', '../core/keys/**/*.test.ts', '../core/solana/**/*.test.ts'],
```
`web/` already type-checks and tests `../core/solana` (`web/tsconfig.json` `include`, `web/vite.config.ts` `test.include`), so every file this task adds must pass there too.

- [ ] **Step 2: Write the failing test**

`core/solana/__tests__/rpc.test.ts`:
```ts
import {
  ALLOWED_RPC_METHODS, API_BASE, FORBIDDEN_COOLDOWN_MS, RPC_ENDPOINT, RpcForbidden, RpcHttpError, RpcMalformed, RpcMethodRefused, RpcResponseError,
  createForbiddenLatch, createRpc, solanaReader, type FetchInit, type RpcMethod,
} from '../rpc';

interface Call {
  url: string;
  init: FetchInit;
  body: {jsonrpc: string; id: number; method: string; params: unknown[]};
}

/** A fake coordinator: records every request and answers from `reply`. Nothing here opens a socket. */
function fakeFetch(reply: (method: string, params: unknown[]) => {status: number; body?: unknown}) {
  const calls: Call[] = [];
  const fetch = async (url: string, init: FetchInit) => {
    const body = JSON.parse(init.body ?? '{}') as Call['body'];
    calls.push({url, init, body});
    const r = reply(body.method, body.params);
    return {status: r.status, json: async () => r.body};
  };
  return {fetch, calls};
}
const ok = (result: unknown) => ({status: 200, body: {jsonrpc: '2.0', id: 1, result}});

// The compile-time half of the allowlist: if a refused method were ever added to the list, this
// type would become `true` and the assignment would stop compiling (tsc runs in `npm run build`).
type SendTransactionAllowed = 'sendTransaction' extends RpcMethod ? true : false;
const sendTransactionAllowed: SendTransactionAllowed = false;

const SPEC_ALLOWED = [
  'getBalance', 'getAccountInfo', 'getMultipleAccounts', 'getLatestBlockhash', 'simulateTransaction', 'getSignaturesForAddress',
  'getTransaction', 'getSignatureStatuses', 'getRecentPrioritizationFees', 'getTokenAccountsByOwner', 'getBlockHeight',
];

describe('the RPC allowlist', () => {
  it('is exactly the eleven methods spec §4 records as allowed', () => {
    expect([...ALLOWED_RPC_METHODS].sort()).toEqual([...SPEC_ALLOWED].sort());
    expect(sendTransactionAllowed).toBe(false);
  });

  it('points at the coordinator proxy', () => {
    expect(API_BASE).toBe('https://api.noc-tura.io/api/v1');
    expect(RPC_ENDPOINT).toBe('https://api.noc-tura.io/api/v1/rpc');
  });
});

describe('createRpc', () => {
  it('POSTs one JSON-RPC 2.0 request without credentials and returns its result (positive control)', async () => {
    const {fetch, calls} = fakeFetch(() => ok(42));
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    expect(await rpc.call('getBlockHeight', [])).toBe(42);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(RPC_ENDPOINT);
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.credentials).toBe('omit');
    expect(calls[0]?.body).toMatchObject({jsonrpc: '2.0', method: 'getBlockHeight', params: []});
  });

  it('refuses a method outside the list at run time, before any request exists', async () => {
    const {fetch, calls} = fakeFetch(() => ok(null));
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    const loose = rpc.call as (method: string, params: readonly unknown[]) => Promise<unknown>;
    for (const m of ['sendTransaction', 'getProgramAccounts', 'getMinimumBalanceForRentExemption', 'getbalance']) {
      await expect(loose(m, [])).rejects.toBeInstanceOf(RpcMethodRefused);
    }
    expect(calls).toHaveLength(0);
  });

  it('a 403 is terminal: typed, never retried, and every later call is refused without a request until the cooldown ends', async () => {
    let t = 0;
    const {fetch, calls} = fakeFetch(() => ({status: 403}));
    const rpc = createRpc({fetch, latch: createForbiddenLatch({now: () => t})});
    await expect(rpc.call('getBalance', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
    t = FORBIDDEN_COOLDOWN_MS - 1;
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
    t = FORBIDDEN_COOLDOWN_MS;
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(2);
  });

  it('three concurrent calls into a 403 send exactly ONE request — the queue is what stops a burst', async () => {
    const {fetch, calls} = fakeFetch(() => ({status: 403}));
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    const results = await Promise.allSettled([rpc.call('getBalance', []), rpc.call('getBlockHeight', []), rpc.call('getLatestBlockhash', [])]);
    expect(results.every(r => r.status === 'rejected' && r.reason instanceof RpcForbidden)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('requests go out one at a time, in call order', async () => {
    let inFlight = 0;
    let most = 0;
    const order: string[] = [];
    const fetch = async (_url: string, init: FetchInit) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      order.push((JSON.parse(init.body ?? '{}') as {method: string}).method);
      await new Promise(r => setTimeout(r, 5));
      inFlight -= 1;
      return {status: 200, json: async () => ({jsonrpc: '2.0', id: 1, result: 1})};
    };
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    await Promise.all([rpc.call('getBalance', []), rpc.call('getBlockHeight', []), rpc.call('getLatestBlockhash', [])]);
    expect(most).toBe(1);
    expect(order).toEqual(['getBalance', 'getBlockHeight', 'getLatestBlockhash']);
  });

  it('the cool-down survives a new latch through its store', async () => {
    const saved: number[] = [];
    const store = {load: async () => saved.at(-1) ?? 0, save: async (u: number) => void saved.push(u)};
    const first = fakeFetch(() => ({status: 403}));
    await expect(createRpc({fetch: first.fetch, latch: createForbiddenLatch({now: () => 5, store})}).call('getBalance', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(saved).toEqual([5 + FORBIDDEN_COOLDOWN_MS]);
    const second = fakeFetch(() => ok(1));
    await expect(createRpc({fetch: second.fetch, latch: createForbiddenLatch({now: () => 6, store})}).call('getBalance', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(second.calls).toHaveLength(0);
  });

  it('any other HTTP status is an error, trips nothing, and is not retried', async () => {
    let status = 500;
    const {fetch, calls} = fakeFetch(() => (status === 200 ? ok(7) : {status}));
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    await expect(rpc.call('getBlockHeight', [])).rejects.toMatchObject({name: 'RpcHttpError', status: 500});
    expect(calls).toHaveLength(1);
    status = 200;
    expect(await rpc.call('getBlockHeight', [])).toBe(7);
  });

  it('a JSON-RPC error becomes RpcResponseError with its code; a body without result is malformed', async () => {
    const {fetch} = fakeFetch(m =>
      m === 'getBalance' ? {status: 200, body: {jsonrpc: '2.0', id: 1, error: {code: -32602, message: 'bad params'}}} : {status: 200, body: {jsonrpc: '2.0', id: 1}},
    );
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    await expect(rpc.call('getBalance', [])).rejects.toMatchObject({name: 'RpcResponseError', code: -32602});
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcMalformed);
    expect(new RpcHttpError('x', 502).status).toBe(502);
    expect(new RpcResponseError(-1, 'm').code).toBe(-1);
  });
});

describe('solanaReader', () => {
  const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
  const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
  const reader = (reply: (method: string, params: unknown[]) => {status: number; body?: unknown}) => {
    const f = fakeFetch(reply);
    return {r: solanaReader(createRpc({fetch: f.fetch, latch: createForbiddenLatch()})), calls: f.calls};
  };

  it('getBalance asks at confirmed commitment and returns BigInt lamports', async () => {
    const {r, calls} = reader(() => ok({context: {slot: 1}, value: 1_500_000_000}));
    expect(await r.getBalance(OWNER)).toBe(1_500_000_000n);
    expect(calls[0]?.body.params).toEqual([OWNER, {commitment: 'confirmed'}]);
  });

  it('getLatestBlockhash and getBlockHeight return typed values', async () => {
    const {r} = reader(m => (m === 'getBlockHeight' ? ok(900) : ok({context: {slot: 1}, value: {blockhash: OWNER, lastValidBlockHeight: 1000}})));
    expect(await r.getLatestBlockhash()).toEqual({blockhash: OWNER, lastValidBlockHeight: 1000});
    expect(await r.getBlockHeight()).toBe(900);
  });

  it('getSignatureStatuses keeps nulls, passes searchTransactionHistory, and refuses a wrong-length answer', async () => {
    const {r, calls} = reader(() => ok({context: {slot: 1}, value: [null, {slot: 5, err: null, confirmationStatus: 'confirmed'}]}));
    expect(await r.getSignatureStatuses(['a', 'b'], true)).toEqual([null, {err: null, confirmationStatus: 'confirmed'}]);
    expect(calls[0]?.body.params).toEqual([['a', 'b'], {searchTransactionHistory: true}]);
    await expect(r.getSignatureStatuses(['a'])).rejects.toBeInstanceOf(RpcMalformed);
  });

  it('getTokenAccountsByOwner asks for jsonParsed and returns BigInt amounts', async () => {
    const {r, calls} = reader(() =>
      ok({
        context: {slot: 1},
        value: [{pubkey: 'Acc1', account: {data: {parsed: {info: {mint: MINT, owner: OWNER, tokenAmount: {amount: '13399619', decimals: 9}}}}}}],
      }),
    );
    expect(await r.getTokenAccountsByOwner(OWNER, {mint: MINT})).toEqual([{pubkey: 'Acc1', mint: MINT, owner: OWNER, amount: 13_399_619n, decimals: 9}]);
    expect(calls[0]?.body.params).toEqual([OWNER, {mint: MINT}, {encoding: 'jsonParsed', commitment: 'confirmed'}]);
  });

  it('getMultipleLamports reads lamports only (a zero-length data slice) and maps a missing account to 0n', async () => {
    const {r, calls} = reader(() => ok({context: {slot: 1}, value: [null, {lamports: 17}]}));
    expect(await r.getMultipleLamports(['a', 'b'])).toEqual([0n, 17n]);
    expect(calls[0]?.body.params).toEqual([['a', 'b'], {encoding: 'base64', dataSlice: {offset: 0, length: 0}, commitment: 'confirmed'}]);
  });

  it('getAccountExists distinguishes null from an account', async () => {
    let value: unknown = null;
    const {r} = reader(() => ok({context: {slot: 1}, value}));
    expect(await r.getAccountExists(OWNER)).toBe(false);
    value = {lamports: 1, data: ['', 'base64']};
    expect(await r.getAccountExists(OWNER)).toBe(true);
  });

  it('simulateTransaction sends base64 without signature verification and returns err, logs and units', async () => {
    const {r, calls} = reader(() => ok({context: {slot: 1}, value: {err: {InstructionError: [0, 'Custom']}, logs: ['a', 3], unitsConsumed: 450}}));
    expect(await r.simulateTransaction('AQID')).toEqual({err: {InstructionError: [0, 'Custom']}, logs: ['a'], unitsConsumed: 450});
    expect(calls[0]?.body.params).toEqual(['AQID', {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, commitment: 'confirmed'}]);
  });

  it('getTransaction asks for jsonParsed v0 and passes null through', async () => {
    const {r, calls} = reader(() => ok(null));
    expect(await r.getTransaction('sig')).toBeNull();
    expect(calls[0]?.body.params).toEqual(['sig', {encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed'}]);
  });

  it('getSignaturesForAddress sends before only when given', async () => {
    const {r, calls} = reader(() => ok([{signature: 's1', blockTime: 10, err: null}, {signature: 's2', blockTime: null, err: {x: 1}}]));
    expect(await r.getSignaturesForAddress(OWNER, {limit: 10})).toEqual([
      {signature: 's1', blockTime: 10, err: null},
      {signature: 's2', blockTime: null, err: {x: 1}},
    ]);
    await r.getSignaturesForAddress(OWNER, {limit: 10, before: 's2'});
    expect(calls[0]?.body.params).toEqual([OWNER, {limit: 10, commitment: 'confirmed'}]);
    expect(calls[1]?.body.params).toEqual([OWNER, {limit: 10, before: 's2', commitment: 'confirmed'}]);
  });

  it('refuses a malformed value instead of guessing', async () => {
    const {r} = reader(() => ok({context: {slot: 1}, value: '12'}));
    await expect(r.getBalance(OWNER)).rejects.toBeInstanceOf(RpcMalformed);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd extension && npx vitest run rpc.test`
Expected: FAIL — `Failed to load url ../rpc` (the module does not exist).

- [ ] **Step 4: Write the implementation**

`core/solana/rpc.ts`:
```ts
/**
 * The JSON-RPC client for the coordinator's read proxy (spec §4 "RPC — reads").
 *
 * The proxy answers a method outside its allowlist with HTTP 403, and a few 403s in a burst make
 * the host's CrowdSec bouncer ban the user's IP from the whole domain for hours. So:
 *  - the methods are a compile-time list: `call` accepts only an `RpcMethod`, and refuses any
 *    other string at run time as well, before a request exists;
 *  - a 403 is terminal: typed (`RpcForbidden`), never retried, and it trips a latch that refuses
 *    every further call through the same latch for FORBIDDEN_COOLDOWN_MS without touching the
 *    network — a burst is what gets an IP banned, so the second request must not happen. The
 *    latch also serialises requests, so concurrent reads cannot all be in flight when it trips;
 *  - nothing here retries at all. Callers that poll do so no faster than every 2 s.
 * extension/scripts/check-rpc-methods.mjs proves that every method name the extension bundles is
 * on this list and that this list equals the spec's.
 */

export const API_ORIGIN = 'https://api.noc-tura.io';
/** Already ends in /api/v1: append bare paths (never another /v1). */
export const API_BASE = `${API_ORIGIN}/api/v1`;
export const RPC_ENDPOINT = `${API_BASE}/rpc`;

export const ALLOWED_RPC_METHODS = [
  'getBalance',
  'getAccountInfo',
  'getMultipleAccounts',
  'getLatestBlockhash',
  'simulateTransaction',
  'getSignaturesForAddress',
  'getTransaction',
  'getSignatureStatuses',
  'getRecentPrioritizationFees',
  'getTokenAccountsByOwner',
  'getBlockHeight',
] as const;
export type RpcMethod = (typeof ALLOWED_RPC_METHODS)[number];

/** After a 403, how long every call through the same latch is refused locally. */
export const FORBIDDEN_COOLDOWN_MS = 10 * 60_000;

export interface FetchInit {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  credentials?: 'omit';
}
/** The narrowest fetch this needs; `globalThis.fetch` satisfies it. Tests pass a fake. */
export type FetchLike = (url: string, init: FetchInit) => Promise<{status: number; json(): Promise<unknown>}>;

export class RpcForbidden extends Error {
  constructor(what: string) {
    super(`${what}: refused by the coordinator (HTTP 403); not retried`);
    this.name = 'RpcForbidden';
  }
}
export class RpcMethodRefused extends Error {
  constructor(method: string) {
    super(`${method} is not on the RPC allowlist; no request was sent`);
    this.name = 'RpcMethodRefused';
  }
}
export class RpcHttpError extends Error {
  readonly status: number;
  constructor(what: string, status: number) {
    super(`${what}: HTTP ${status}`);
    this.name = 'RpcHttpError';
    this.status = status;
  }
}
export class RpcResponseError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(`RPC error ${code}: ${message}`);
    this.name = 'RpcResponseError';
    this.code = code;
  }
}
export class RpcMalformed extends Error {
  constructor(what: string) {
    super(`malformed RPC response: ${what}`);
    this.name = 'RpcMalformed';
  }
}

export type FetchResponse = {status: number; json(): Promise<unknown>};

/** Where a latch keeps the end of its cool-down across service-worker restarts (Task 9: storage.local). */
export interface LatchStore {
  load(): Promise<number>;
  save(until: number): Promise<void>;
}

/**
 * One per coordinator: the RPC, the broadcast route and the JSON reads share it. Requests go out
 * ONE AT A TIME, in call order: concurrent reads (a Promise.all) would otherwise all be on the wire
 * before the first 403 came back — a burst of 403s, which is exactly what CrowdSec bans. When a
 * queued request's turn comes after a 403, it is refused without being sent.
 */
export interface ForbiddenLatch {
  request(what: string, send: () => Promise<FetchResponse>): Promise<FetchResponse>;
}

export function createForbiddenLatch(opts: {now?: () => number; store?: LatchStore} = {}): ForbiddenLatch {
  const now = opts.now ?? Date.now;
  let until = 0;
  let loaded: Promise<void> | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  const load = (): Promise<void> => {
    loaded ??= (opts.store?.load() ?? Promise.resolve(0)).then(
      v => {
        if (Number.isFinite(v)) until = Math.max(until, v);
      },
      () => undefined,
    );
    return loaded;
  };
  return {
    request(what, send) {
      const turn = async (): Promise<FetchResponse> => {
        await load();
        if (now() < until) throw new RpcForbidden(`${what} (cooling down after an earlier 403)`);
        const res = await send();
        if (res.status === 403) {
          until = now() + FORBIDDEN_COOLDOWN_MS;
          await opts.store?.save(until).catch(() => undefined);
          throw new RpcForbidden(what);
        }
        return res;
      };
      const result = tail.then(turn, turn);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

export interface Rpc {
  call<M extends RpcMethod>(method: M, params: readonly unknown[]): Promise<unknown>;
}

const isAllowed = (m: string): m is RpcMethod => (ALLOWED_RPC_METHODS as readonly string[]).includes(m);

export function createRpc(opts: {fetch: FetchLike; latch: ForbiddenLatch; endpoint?: string}): Rpc {
  const endpoint = opts.endpoint ?? RPC_ENDPOINT;
  let id = 0;
  return {
    async call(method, params) {
      // The type already refuses other strings; this refuses a cast or a computed name.
      if (!isAllowed(method)) throw new RpcMethodRefused(method);
      id += 1;
      const body = JSON.stringify({jsonrpc: '2.0', id, method, params});
      // Through the latch: one request at a time, and a 403 is terminal for every queued one.
      const res = await opts.latch.request(method, () =>
        opts.fetch(endpoint, {method: 'POST', headers: {'content-type': 'application/json'}, body, credentials: 'omit'}),
      );
      if (res.status !== 200) throw new RpcHttpError(method, res.status);
      const answer = await res.json();
      if (typeof answer !== 'object' || answer === null) throw new RpcMalformed(`${method}: not an object`);
      const {error} = answer as {error?: {code?: unknown; message?: unknown} | null};
      if (error !== undefined && error !== null) {
        throw new RpcResponseError(typeof error.code === 'number' ? error.code : 0, typeof error.message === 'string' ? error.message : 'unknown');
      }
      if (!('result' in answer)) throw new RpcMalformed(`${method}: no result`);
      return (answer as {result: unknown}).result;
    },
  };
}

export interface SignatureStatus {
  err: unknown;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
}
export interface TokenAccountEntry {
  pubkey: string;
  mint: string;
  owner: string;
  amount: bigint;
  decimals: number;
}
export interface SignatureInfo {
  signature: string;
  blockTime: number | null;
  err: unknown;
}
export interface SimulationOutcome {
  err: unknown;
  logs: string[];
  unitsConsumed: number | null;
}

/** Every chain read the extension makes, typed. The only way to reach the RPC above. */
export interface SolanaReader {
  getBalance(owner: string): Promise<bigint>;
  getAccountExists(address: string): Promise<boolean>;
  getMultipleLamports(addresses: readonly string[]): Promise<bigint[]>;
  getLatestBlockhash(): Promise<{blockhash: string; lastValidBlockHeight: number}>;
  getBlockHeight(): Promise<number>;
  getSignatureStatuses(signatures: readonly string[], searchTransactionHistory?: boolean): Promise<(SignatureStatus | null)[]>;
  getRecentPrioritizationFees(): Promise<{prioritizationFee: number}[]>;
  simulateTransaction(transactionBase64: string): Promise<SimulationOutcome>;
  getTokenAccountsByOwner(owner: string, filter: {mint: string} | {programId: string}): Promise<TokenAccountEntry[]>;
  getSignaturesForAddress(address: string, opts: {limit: number; before?: string}): Promise<SignatureInfo[]>;
  getTransaction(signature: string): Promise<unknown>;
}

const COMMITMENT = {commitment: 'confirmed'} as const;

type Json = Record<string, unknown>;
function obj(x: unknown, what: string): Json {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new RpcMalformed(what);
  return x as Json;
}
function list(x: unknown, what: string): unknown[] {
  if (!Array.isArray(x)) throw new RpcMalformed(what);
  return x as unknown[];
}
/** A non-negative integer. Lamports above 2^53 lose precision in JSON itself; that is the RPC's format. */
function count(x: unknown, what: string): number {
  if (typeof x !== 'number' || !Number.isInteger(x) || x < 0) throw new RpcMalformed(what);
  return x;
}
function text(x: unknown, what: string): string {
  if (typeof x !== 'string' || x.length === 0) throw new RpcMalformed(what);
  return x;
}
function valueOf(result: unknown, what: string): unknown {
  const o = obj(result, what);
  if (!('value' in o)) throw new RpcMalformed(`${what}: no value`);
  return o.value;
}

function signatureStatus(x: unknown): SignatureStatus | null {
  if (x === null) return null;
  const s = obj(x, 'getSignatureStatuses entry');
  const c = s.confirmationStatus;
  return {err: s.err ?? null, confirmationStatus: c === 'processed' || c === 'confirmed' || c === 'finalized' ? c : null};
}

function tokenAccount(x: unknown): TokenAccountEntry {
  const e = obj(x, 'token account');
  const data = obj(obj(e.account, 'token account.account').data, 'token account data');
  const info = obj(obj(data.parsed, 'token account parsed').info, 'token account info');
  const tokenAmount = obj(info.tokenAmount, 'tokenAmount');
  const amount = text(tokenAmount.amount, 'tokenAmount.amount');
  if (!/^\d+$/.test(amount)) throw new RpcMalformed('tokenAmount.amount');
  return {
    pubkey: text(e.pubkey, 'pubkey'),
    mint: text(info.mint, 'mint'),
    owner: text(info.owner, 'owner'),
    amount: BigInt(amount),
    decimals: count(tokenAmount.decimals, 'decimals'),
  };
}

export function solanaReader(rpc: Rpc): SolanaReader {
  return {
    async getBalance(owner) {
      return BigInt(count(valueOf(await rpc.call('getBalance', [owner, COMMITMENT]), 'getBalance'), 'getBalance.value'));
    },
    async getAccountExists(address) {
      return valueOf(await rpc.call('getAccountInfo', [address, {encoding: 'base64', ...COMMITMENT}]), 'getAccountInfo') !== null;
    },
    async getMultipleLamports(addresses) {
      const params = [addresses, {encoding: 'base64', dataSlice: {offset: 0, length: 0}, ...COMMITMENT}];
      const v = list(valueOf(await rpc.call('getMultipleAccounts', params), 'getMultipleAccounts'), 'getMultipleAccounts.value');
      if (v.length !== addresses.length) throw new RpcMalformed('getMultipleAccounts: wrong length');
      return v.map(a => (a === null ? 0n : BigInt(count(obj(a, 'account').lamports, 'lamports'))));
    },
    async getLatestBlockhash() {
      const v = obj(valueOf(await rpc.call('getLatestBlockhash', [COMMITMENT]), 'getLatestBlockhash'), 'getLatestBlockhash.value');
      return {blockhash: text(v.blockhash, 'blockhash'), lastValidBlockHeight: count(v.lastValidBlockHeight, 'lastValidBlockHeight')};
    },
    async getBlockHeight() {
      return count(await rpc.call('getBlockHeight', [COMMITMENT]), 'getBlockHeight');
    },
    async getSignatureStatuses(signatures, searchTransactionHistory = false) {
      const result = await rpc.call('getSignatureStatuses', [signatures, {searchTransactionHistory}]);
      const v = list(valueOf(result, 'getSignatureStatuses'), 'getSignatureStatuses.value');
      if (v.length !== signatures.length) throw new RpcMalformed('getSignatureStatuses: wrong length');
      return v.map(signatureStatus);
    },
    async getRecentPrioritizationFees() {
      // A non-number becomes NaN, which estimatePriorityFee discards — the RPC is untrusted.
      return list(await rpc.call('getRecentPrioritizationFees', []), 'getRecentPrioritizationFees').map(f => {
        const fee = obj(f, 'prioritization fee').prioritizationFee;
        return {prioritizationFee: typeof fee === 'number' ? fee : Number.NaN};
      });
    },
    async simulateTransaction(transactionBase64) {
      const params = [transactionBase64, {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, ...COMMITMENT}];
      const v = obj(valueOf(await rpc.call('simulateTransaction', params), 'simulateTransaction'), 'simulateTransaction.value');
      const logs = Array.isArray(v.logs) ? (v.logs as unknown[]).filter((l): l is string => typeof l === 'string') : [];
      return {err: v.err ?? null, logs, unitsConsumed: typeof v.unitsConsumed === 'number' ? v.unitsConsumed : null};
    },
    async getTokenAccountsByOwner(owner, filter) {
      const result = await rpc.call('getTokenAccountsByOwner', [owner, filter, {encoding: 'jsonParsed', ...COMMITMENT}]);
      return list(valueOf(result, 'getTokenAccountsByOwner'), 'getTokenAccountsByOwner.value').map(tokenAccount);
    },
    async getSignaturesForAddress(address, opts) {
      const config = opts.before === undefined ? {limit: opts.limit, ...COMMITMENT} : {limit: opts.limit, before: opts.before, ...COMMITMENT};
      return list(await rpc.call('getSignaturesForAddress', [address, config]), 'getSignaturesForAddress').map(x => {
        const s = obj(x, 'signature info');
        return {signature: text(s.signature, 'signature'), blockTime: typeof s.blockTime === 'number' ? s.blockTime : null, err: s.err ?? null};
      });
    },
    async getTransaction(signature) {
      return rpc.call('getTransaction', [signature, {encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, ...COMMITMENT}]);
    },
  };
}
```

- [ ] **Step 4b: A 403 is not swallowed by the priority-fee estimate**

`estimatePriorityFee` returns the floor on ANY failure so a send can proceed — but after a 403 it must not: the send should stop, and the caller must learn why.

`core/solana/__tests__/priorityFee.test.ts`:
```ts
import {estimatePriorityFee} from '../priorityFee';
import {RpcForbidden} from '../rpc';

describe('estimatePriorityFee and the coordinator', () => {
  it('an ordinary failure still yields the floor (positive control)', async () => {
    expect(await estimatePriorityFee({getRecentPrioritizationFees: async () => Promise.reject(new Error('timeout'))}, 'normal')).toBe(50_000);
  });

  it('a 403 is not swallowed', async () => {
    await expect(estimatePriorityFee({getRecentPrioritizationFees: async () => Promise.reject(new RpcForbidden('getRecentPrioritizationFees'))}, 'normal')).rejects.toBeInstanceOf(RpcForbidden);
  });
});
```
In `core/solana/priorityFee.ts`, add `import {RpcForbidden} from './rpc';` at the top and change the `catch` of `estimatePriorityFee` to:
```ts
  } catch (e) {
    // A 403 is terminal (spec §4): the send stops rather than proceeding on the floor.
    if (e instanceof RpcForbidden) throw e;
    return FLOOR[level];
  }
```
The app's `src/modules/solana/priorityFee.ts` wraps this function; its `priorityFee.test.ts` must still pass: `npx jest src/modules/solana/__tests__/priorityFee.test.ts`.

- [ ] **Step 5: Run the tests, in both packages that run core/solana, and web's secret scan**

Run: `cd extension && npx vitest run rpc.test priorityFee.test && npx tsc --noEmit`
Expected: PASS (all tests), tsc exits 0.
Run: `cd web && npx vitest run rpc.test priorityFee.test && npx tsc --noEmit && npm run build && npm run scan`
Expected: PASS, tsc exits 0, and the scan passes — it reads `../core/solana` in source mode, test files included (its `SOURCE_FORBIDDEN` list refuses words such as `secretKey`, `mnemonic` and `Keypair.fromSeed`).

- [ ] **Step 6: Mutation checks (each must turn a test red; revert after each)**

1. Delete the `if (!isAllowed(method)) throw …` line → "refuses a method outside the list at run time" fails (the fake records calls).
2. In `createForbiddenLatch`, delete the `until = now() + FORBIDDEN_COOLDOWN_MS;` line → "a 403 is terminal" fails at its second `calls` length check.
3. Change `now() < until` to `now() <= until` → the same test fails at `t = FORBIDDEN_COOLDOWN_MS`.
3a. Remove the queue: replace `const result = tail.then(turn, turn);` with `const result = turn();` → "three concurrent calls into a 403 send exactly ONE request" fails (3 calls) and "one at a time" fails (`most` is 3).
3b. Drop `await opts.store?.save(until)…` → "the cool-down survives a new latch" fails.
3c. In `estimatePriorityFee`, delete the `if (e instanceof RpcForbidden) throw e;` line → "a 403 is not swallowed" fails.
4. Add `'getProgramAccounts'` to `ALLOWED_RPC_METHODS` → "is exactly the eleven methods" fails.
5. Add `'sendTransaction'` to `ALLOWED_RPC_METHODS` → `npx tsc --noEmit` fails on `sendTransactionAllowed`.

- [ ] **Step 7: Commit**

```bash
git add core/solana/rpc.ts core/solana/priorityFee.ts core/solana/__tests__/rpc.test.ts core/solana/__tests__/priorityFee.test.ts extension/tsconfig.json extension/vite.config.ts
git commit -m "feat(core): an RPC client that can only call the proxy's eleven allowed methods

A 403 is terminal and trips a shared latch, so a refused call can never become the burst
that gets an IP banned by the host's CrowdSec bouncer.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 2: The fee policy in `core/fees` (the app delegates to it)

**Files:**
- Create: `core/fees/transferMarkup.ts`
- Test: `core/fees/__tests__/transferMarkup.test.ts` (vitest, extension)
- Test: `src/modules/fees/__tests__/transferMarkupCore.test.ts` (jest, app)
- Modify: `src/modules/fees/feeEngine.ts` (the `applyDiscount` function and `getEffectiveFee`)
- Modify: `src/constants/programs.ts` (import block at the top; `NOCTURA_FEE_TREASURY`; `TRANSPARENT_FEES.transferMarkup`)
- Modify: `extension/tsconfig.json`, `extension/vite.config.ts` (include `core/fees`)

**Interfaces:**
- Consumes: `MAINNET_SOL_TREASURY` from `core/presale/addresses.ts`.
- Produces (from `core/fees/transferMarkup.ts`):
  - `TRANSFER_MARKUP_LAMPORTS = 20_000n`, `MAINNET_FEE_TREASURY` (= the Squads vault `6Zia…o6Vd`)
  - `type TgeStatus = 'pre_tge' | 'claimable' | 'claimed'`
  - `interface FeePolicyInputs {tgeStatus: TgeStatus | 'unknown'; isZeroFeeEligible: boolean | 'unknown'; stakingDiscount: number}`
  - `type FeeReason = 'pre-tge' | 'zero-fee-eligible' | 'status-unknown' | 'charged'`, `interface EffectiveFee {lamports: bigint; reason: FeeReason}`
  - `applyStakingDiscount(fee: bigint, discount: number): bigint`
  - `effectiveFee(baseFee: bigint, inputs: FeePolicyInputs): EffectiveFee`

The app's rule, unchanged (`feeEngine.getEffectiveFee`): pre-TGE → 0; zero-fee eligible → 0; otherwise the base fee minus the staking discount (a fraction, converted to a whole percent, BigInt division). Two additions, both in the user's favour: an `'unknown'` input charges 0 (decision 4 — see "Scope" item 6), and a discount outside [0, 1] is clamped (the app's version turned a discount of 1.5 into a negative fee).

- [ ] **Step 1: Let the extension compile and test `core/fees`**

`extension/tsconfig.json` `include`:
```json
  "include": ["src", "e2e", "../core/keys", "../core/util", "../core/solana", "../core/fees"]
```
`extension/vite.config.ts` `test.include`:
```ts
    include: [
      'src/**/*.test.ts',
      'manifest/**/*.test.mjs',
      'scripts/**/*.test.mjs',
      '../core/keys/**/*.test.ts',
      '../core/solana/**/*.test.ts',
      '../core/fees/**/*.test.ts',
    ],
```

- [ ] **Step 2: Write the failing core test**

`core/fees/__tests__/transferMarkup.test.ts`:
```ts
import {applyStakingDiscount, effectiveFee, MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS, type FeePolicyInputs} from '../transferMarkup';

const post: FeePolicyInputs = {tgeStatus: 'claimable', isZeroFeeEligible: false, stakingDiscount: 0};

describe('the transparent-transfer markup policy', () => {
  it('is 20 000 lamports to the Squads fee vault', () => {
    expect(TRANSFER_MARKUP_LAMPORTS).toBe(20_000n);
    expect(MAINNET_FEE_TREASURY).toBe('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');
  });

  it('charges nothing before TGE', () => {
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, tgeStatus: 'pre_tge'})).toEqual({lamports: 0n, reason: 'pre-tge'});
  });

  it('charges nothing to a zero-fee-eligible user', () => {
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, isZeroFeeEligible: true})).toEqual({lamports: 0n, reason: 'zero-fee-eligible'});
  });

  it('charges nothing when either status is unknown — the extension has no source for them yet', () => {
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, tgeStatus: 'unknown'})).toEqual({lamports: 0n, reason: 'status-unknown'});
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, isZeroFeeEligible: 'unknown'})).toEqual({lamports: 0n, reason: 'status-unknown'});
  });

  it('charges the markup after TGE (positive control), minus a staking discount in whole percent', () => {
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, post)).toEqual({lamports: 20_000n, reason: 'charged'});
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, tgeStatus: 'claimed', stakingDiscount: 0.1})).toEqual({lamports: 18_000n, reason: 'charged'});
    expect(applyStakingDiscount(500_000n, 0.3)).toBe(350_000n);
  });

  it('clamps a discount outside [0, 1] and ignores NaN — never a negative fee', () => {
    expect(applyStakingDiscount(20_000n, 1.5)).toBe(0n);
    expect(applyStakingDiscount(20_000n, -0.5)).toBe(20_000n);
    expect(applyStakingDiscount(20_000n, Number.NaN)).toBe(20_000n);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd extension && npx vitest run transferMarkup.test`
Expected: FAIL — `Failed to load url ../transferMarkup`.

- [ ] **Step 4: Write the implementation**

`core/fees/transferMarkup.ts`:
```ts
import {MAINNET_SOL_TREASURY} from '../presale/addresses';

/**
 * The Noctura markup on a transparent transfer (owner decision, 2026-09-28; spec "Transparent send
 * fee"): one policy, shared by the app and the extension, so both charge — and disclose — the same
 * thing. Pure: every input is explicit; no store, no clock, no network.
 */
export const TRANSFER_MARKUP_LAMPORTS = 20_000n;

/** The Squads vault that receives the markup — the same vault as the presale SOL treasury. */
export const MAINNET_FEE_TREASURY = MAINNET_SOL_TREASURY;

export type TgeStatus = 'pre_tge' | 'claimable' | 'claimed';

export interface FeePolicyInputs {
  /** 'unknown' when no trustworthy source reports it: then nothing is charged. */
  tgeStatus: TgeStatus | 'unknown';
  /** 'unknown' when no trustworthy source reports it: then nothing is charged. */
  isZeroFeeEligible: boolean | 'unknown';
  /** A fraction in [0, 1] (0.1 = 10 %). Outside is clamped; NaN counts as no discount. */
  stakingDiscount: number;
}

/** Why the fee line reads what it reads — carried to the send screen, never hidden. */
export type FeeReason = 'pre-tge' | 'zero-fee-eligible' | 'status-unknown' | 'charged';

export interface EffectiveFee {
  lamports: bigint;
  reason: FeeReason;
}

/** fee − fee × round(discount × 100) / 100, in BigInt — never a float amount. */
export function applyStakingDiscount(fee: bigint, discount: number): bigint {
  const d = Number.isFinite(discount) ? Math.min(1, Math.max(0, discount)) : 0;
  if (d === 0) return fee;
  const percent = BigInt(Math.round(d * 100));
  return fee - (fee * percent) / 100n;
}

/**
 * 1. pre-TGE → 0. 2. TGE status unknown → 0. 3. zero-fee eligible → 0. 4. eligibility unknown → 0.
 * 5. otherwise the base fee minus the staking discount. Unknown fails in the user's favour.
 */
export function effectiveFee(baseFee: bigint, inputs: FeePolicyInputs): EffectiveFee {
  if (inputs.tgeStatus === 'pre_tge') return {lamports: 0n, reason: 'pre-tge'};
  if (inputs.tgeStatus === 'unknown') return {lamports: 0n, reason: 'status-unknown'};
  if (inputs.isZeroFeeEligible === true) return {lamports: 0n, reason: 'zero-fee-eligible'};
  if (inputs.isZeroFeeEligible === 'unknown') return {lamports: 0n, reason: 'status-unknown'};
  return {lamports: applyStakingDiscount(baseFee, inputs.stakingDiscount), reason: 'charged'};
}
```

- [ ] **Step 5: Run the core test**

Run: `cd extension && npx vitest run transferMarkup.test && npx tsc --noEmit`
Expected: PASS; tsc exits 0.

- [ ] **Step 6: Make the app delegate to it**

In `src/modules/fees/feeEngine.ts`:
- add below the existing `import {FeeDisplayInfo, FEE_DISTRIBUTION, FeeType} from './types';` line:
```ts
import {effectiveFee} from '../../../core/fees/transferMarkup';
```
- delete the whole `applyDiscount` function together with its doc comment (the block from `/**\n * Apply a staking discount to a fee.` down to its closing `}`);
- replace the body of `getEffectiveFee` with:
```ts
  getEffectiveFee(feeType: FeeType, stakingDiscount: number = 0): bigint {
    // The policy lives in core/fees/transferMarkup.ts, shared with the browser extension.
    const {tgeStatus, isZeroFeeEligible} = usePresaleStore.getState();
    return effectiveFee(this._baseFee(feeType), {tgeStatus, isZeroFeeEligible, stakingDiscount}).lamports;
  }
```

In `src/constants/programs.ts`:
- add below the existing `} from '../../core/presale/addresses';` line:
```ts
import {MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS} from '../../core/fees/transferMarkup';
```
- replace the `NOCTURA_FEE_TREASURY` definition's mainnet literal:
```ts
export const NOCTURA_FEE_TREASURY = IS_DEVNET
  ? 'TODO_DEVNET_FEE_TREASURY'
  : MAINNET_FEE_TREASURY;
```
- replace `transferMarkup: 20_000n,` with `transferMarkup: TRANSFER_MARKUP_LAMPORTS,`.

(`'TODO_DEVNET_FEE_TREASURY'` is the file's existing devnet sentinel, guarded by its start-up warning; it is not new.)

- [ ] **Step 7: Write the app-side test (spec §5 "Where moved code is tested")**

`src/modules/fees/__tests__/transferMarkupCore.test.ts`:
```ts
import {applyStakingDiscount, effectiveFee, MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS} from '../../../../core/fees/transferMarkup';
import {NOCTURA_FEE_TREASURY, TRANSPARENT_FEES} from '../../../constants/programs';

// The root jest ignores core/ tests; this imports the moved policy from core/ so the app's own
// runner (Babel, the RN preset) proves it loads and behaves the same here.
describe('core/fees/transferMarkup, as the app imports it', () => {
  it('applies the rules the app has always applied', () => {
    expect(effectiveFee(20_000n, {tgeStatus: 'pre_tge', isZeroFeeEligible: false, stakingDiscount: 0}).lamports).toBe(0n);
    expect(effectiveFee(20_000n, {tgeStatus: 'claimable', isZeroFeeEligible: true, stakingDiscount: 0}).lamports).toBe(0n);
    expect(effectiveFee(20_000n, {tgeStatus: 'claimable', isZeroFeeEligible: false, stakingDiscount: 0}).lamports).toBe(20_000n);
    expect(applyStakingDiscount(500_000n, 0.1)).toBe(450_000n);
  });

  it('the app reads the same literals as core', () => {
    expect(TRANSPARENT_FEES.transferMarkup).toBe(TRANSFER_MARKUP_LAMPORTS);
    expect(NOCTURA_FEE_TREASURY).toBe(MAINNET_FEE_TREASURY);
  });
});
```

Append to `src/modules/fees/__tests__/feeEngine.test.ts`, inside `describe('FeeEngineManager', …)` after the 30 % discount test — the clamp is a behaviour change and must be visible in the app's own suite:
```ts
  it('a discount above 1 clamps to a zero fee — never a negative one (core/fees clamp)', () => {
    mockStore({tgeStatus: 'claimable', isZeroFeeEligible: false});
    expect(engine.getEffectiveFee('privateTransfer', 1.5)).toBe(0n);
    expect(engine.getEffectiveFee('transferMarkup', 1.5)).toBe(0n);
  });
```

- [ ] **Step 8: Run the app's tests for everything that touches the fee**

Run: `npx jest src/modules/fees src/modules/solana/__tests__/transactionBuilder.test.ts src/screens/transparent && npx tsc --noEmit && npx eslint src/modules/solana src/modules/fees src/constants`
Expected: PASS — the existing `feeEngine.test.ts` (pre-TGE, eligibility, 10 %/30 % discounts) and `transactionBuilder.test.ts` markup tests pass unchanged, plus the new clamp case and the new file; tsc exits 0; eslint reports no errors.

- [ ] **Step 9: Mutation checks**

1. In `effectiveFee`, delete the `tgeStatus === 'unknown'` line → "charges nothing when either status is unknown" fails (20 000 charged).
2. In `applyStakingDiscount`, replace the clamp with `const d = discount;` → "clamps a discount outside [0, 1]" fails (negative fee).
3. In `feeEngine.getEffectiveFee`, pass `stakingDiscount: 0` instead of the argument → `feeEngine.test.ts` "applies 10% discount" fails (proves the app really delegates).

- [ ] **Step 10: Commit**

```bash
git add core/fees extension/tsconfig.json extension/vite.config.ts src/modules/fees src/constants/programs.ts
git commit -m "feat(core): one transfer-markup policy for the app and the extension

Pure, with explicit inputs; an unknown TGE status or eligibility charges nothing, and a
discount outside [0, 1] can no longer make the fee negative.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 3: Transfer building moves into `core/solana/transfer.ts` (and the extension gets web3.js)

**Files:**
- Create: `core/solana/transfer.ts`
- Test: `core/solana/__tests__/transfer.test.ts` (vitest — runs under both `extension/` and `web/`)
- Test: `src/modules/solana/__tests__/coreTransfer.test.ts` (jest, app)
- Modify: `src/modules/solana/transactionBuilder.ts` (whole file: shim + app bindings)
- Modify: `extension/package.json`, `extension/package-lock.json` (add `@solana/web3.js`, `buffer`), `extension/vite.config.ts` (a resolver plugin for `core/` replaces the dedupe), `extension/tsconfig.json` (`paths`)

**Interfaces:**
- Consumes: `encodeU64LE`, `findAssociatedTokenAddress` from `core/presale/buyInstructions.ts`.
- Produces (from `core/solana/transfer.ts`):
  - re-export `findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey`
  - `SPL_TOKEN_PROGRAM_ID`, `SPL_ATA_PROGRAM_ID` (`PublicKey`)
  - `BASE_FEE_LAMPORTS_PER_SIGNATURE = 5_000n`, `TOKEN_ACCOUNT_SIZE = 165`, `TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280n`, `SYSTEM_ACCOUNT_RENT_LAMPORTS = 890_880n`
  - `interface Markup {lamports: bigint; treasury: PublicKey}`
  - `computeUnitLimitFor(p: {kind: 'sol'} | {kind: 'spl'; createAta?: boolean}): number` (1 000 / 40 000 / 65 000)
  - `buildTransferCheckedInstruction(source, mint, destination, owner, amount: bigint, decimals: number): TransactionInstruction`
  - `buildCreateAtaInstruction(payer, ata, owner, mint)`, `buildCreateAtaIdempotentInstruction(payer, ata, owner, mint)`
  - `interface SolTransferInput {sender: PublicKey; recipient: PublicKey; lamports: bigint; priorityFee?: number; computeUnitLimit?: number; markup: Markup | null}`, `buildSolTransferInstructions(p): TransactionInstruction[]`
  - `interface SplTransferInput {sender; recipient; mint: PublicKey; amount: bigint; decimals: number; priorityFee?: number; computeUnitLimit?: number; createAta?: boolean; sourceTokenAccount?: PublicKey; markup: Markup | null}`, `buildSplTransferInstructions(p): TransactionInstruction[]`
  - `class SplitTokenBalance`, `class InsufficientTokenBalance`, `selectSourceTokenAccount<T>(accounts: readonly {pubkey: T; amount: bigint}[], requiredAmount?: bigint): T | null`
  - `priorityFeeLamports(microLamportsPerCu: number, computeUnitLimit: number): bigint` (ceil), `networkFeeLamports(signatures: number, microLamportsPerCu: number, computeUnitLimit: number): bigint` (base + priority)
- The app's `src/modules/solana/transactionBuilder.ts` keeps exporting, with unchanged signatures: `findAssociatedTokenAddress`, `resolveCreateAta`, `resolveSourceTokenAccount`, `buildCreateAtaIdempotentInstruction`, `computeUnitLimitFor`, `getTransferMarkupLamports`, `buildTransferInstructions`, `buildTransferTx`, `buildSPLTransferInstructions`, `buildSPLTransferTx`.

- [ ] **Step 1: Add web3.js and buffer to the extension, and fix module resolution for them**

Run: `cd extension && npm install -g npm@11.6.2 >/dev/null && npm install --ignore-scripts @solana/web3.js@^1.99.0 buffer@^6.0.3`
Then: `ls node_modules/@solana/web3.js/node_modules/@noble` → expected `curves  hashes` (web3.js keeps its own @noble v1; the package's root copy stays v2).

`extension/vite.config.ts` — B1a deduped `@noble/*`, `@scure/*` and `micro-key-producer` so that `core/` files (imported by relative path) would not resolve their bare imports upwards to the repository root's `node_modules`. That dedupe cannot stay: `@solana/web3.js` 1.x needs `@noble/curves@1`, whose own files import `@noble/hashes/*.js` subpaths that v2 — this package's copy — does not export (`bytesToUtf8`), so forcing one copy breaks the build (checked in a dry run of this plan: `MISSING_EXPORT "bytesToUtf8"`), while an alias on `.js` subpaths catches web3.js's dependency too. The fix is importer-aware: resolve every bare import made **by a `core/` file** as if made from this package, and nothing else. Replace the import lines, the `SHARED` constant and the `resolve: {dedupe: SHARED},` entry, so the file's head reads:
```ts
import {defineConfig, type Plugin} from 'vite';
import type {UserConfig} from 'vitest/config';
import {resolve, sep} from 'node:path';

// core/ is imported by relative path, and a bare import in a core/ file would otherwise resolve
// upwards from core/ — to the repository root's node_modules (the app's copies) locally, and to
// nothing in CI, which installs only extension/. This resolves every bare import made BY a core/
// file as if it were made from this package, and touches nothing else: a dependency's own imports
// (@solana/web3.js 1.x needs @noble v1, this package has v2) resolve normally, next to it.
const CORE = resolve(__dirname, '../core');
const HERE = resolve(__dirname, 'package.json');
function coreResolvesFromHere(): Plugin {
  return {
    name: 'noctura:core-resolves-from-extension',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (importer === undefined || !importer.startsWith(CORE + sep)) return null;
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null;
      return this.resolve(source, HERE, {...options, skipSelf: true});
    },
  };
}
```
and in `defineConfig`, in place of the `resolve` entry:
```ts
  plugins: [coreResolvesFromHere()],
```
(The rest of the config — `base`, `server`, `build`, `worker`, `test` — is unchanged.)

`extension/tsconfig.json` — add to `compilerOptions.paths`:
```json
      "@solana/web3.js": ["./node_modules/@solana/web3.js"],
      "buffer": ["./node_modules/buffer"],
```
Verify nothing regressed: `npm run build && npm test && npm run gates` → all pass (the vault-isolation gate's five markers are still found only in the unlock bundle).
Run: `npm audit --audit-level=high` → expected exit 0. If it reports a high advisory in the new tree, STOP and report it to the controller.

- [ ] **Step 2: Write the failing core test**

`core/solana/__tests__/transfer.test.ts`:
```ts
import {Buffer} from 'buffer';
import {ComputeBudgetProgram, PublicKey, SystemProgram} from '@solana/web3.js';
import {
  BASE_FEE_LAMPORTS_PER_SIGNATURE, InsufficientTokenBalance, SPL_ATA_PROGRAM_ID, SPL_TOKEN_PROGRAM_ID, SYSTEM_ACCOUNT_RENT_LAMPORTS, SplitTokenBalance, TOKEN_ACCOUNT_RENT_LAMPORTS,
  TOKEN_ACCOUNT_SIZE, buildSolTransferInstructions, buildSplTransferInstructions, computeUnitLimitFor, findAssociatedTokenAddress,
  networkFeeLamports, priorityFeeLamports, selectSourceTokenAccount,
} from '../transfer';

const A = new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
const B = new PublicKey('EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o');
const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
const TREASURY = new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');
const HOLDING = new PublicKey('FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU');

/** SystemProgram.transfer data: u32 LE instruction index 2, then u64 LE lamports. */
function transferLamports(data: Uint8Array): bigint {
  expect([...data.subarray(0, 4)]).toEqual([2, 0, 0, 0]);
  let v = 0n;
  for (let i = 11; i >= 4; i--) v = (v << 8n) | BigInt(data[i] ?? 0);
  return v;
}

describe('fixed costs', () => {
  it('the rent for a new token account is the fixed minimum for 165 bytes', () => {
    expect(TOKEN_ACCOUNT_SIZE).toBe(165);
    // (data + 128 bytes of account overhead) × 3 480 lamports per byte-year × 2 years exempt.
    expect(TOKEN_ACCOUNT_RENT_LAMPORTS).toBe(BigInt((165 + 128) * 3480 * 2));
    expect(TOKEN_ACCOUNT_RENT_LAMPORTS).toBe(2_039_280n);
    expect(SYSTEM_ACCOUNT_RENT_LAMPORTS).toBe(BigInt(128 * 3480 * 2));
  });

  it('prices priority as ceil(price × units / 1e6) and the network fee as 5 000 per signature plus that', () => {
    expect(BASE_FEE_LAMPORTS_PER_SIGNATURE).toBe(5_000n);
    expect(priorityFeeLamports(50_000, 1_000)).toBe(50n);
    expect(priorityFeeLamports(1, 1)).toBe(1n);
    expect(priorityFeeLamports(0, 65_000)).toBe(0n);
    expect(priorityFeeLamports(150_000, 65_000)).toBe(9_750n);
    expect(networkFeeLamports(1, 50_000, 1_000)).toBe(5_050n);
    expect(networkFeeLamports(2, 0, 0)).toBe(10_000n);
    expect(() => priorityFeeLamports(-1, 1)).toThrow();
    expect(() => priorityFeeLamports(1.5, 1)).toThrow();
  });

  it('keeps the per-kind compute-unit limits', () => {
    expect(computeUnitLimitFor({kind: 'sol'})).toBe(1_000);
    expect(computeUnitLimitFor({kind: 'spl'})).toBe(40_000);
    expect(computeUnitLimitFor({kind: 'spl', createAta: true})).toBe(65_000);
  });
});

describe('buildSolTransferInstructions', () => {
  it('budget, transfer — and no markup instruction when there is no markup or it is zero', () => {
    for (const markup of [null, {lamports: 0n, treasury: TREASURY}]) {
      const ixs = buildSolTransferInstructions({sender: A, recipient: B, lamports: 1_000_000n, priorityFee: 50_000, computeUnitLimit: 1_000, markup});
      expect(ixs.map(ix => ix.programId.toBase58())).toEqual([
        ComputeBudgetProgram.programId.toBase58(),
        ComputeBudgetProgram.programId.toBase58(),
        SystemProgram.programId.toBase58(),
      ]);
      expect(transferLamports(ixs[2]!.data)).toBe(1_000_000n);
      expect(ixs[2]!.keys[1]!.pubkey.equals(B)).toBe(true);
    }
  });

  it('a non-zero markup is its own transfer to the treasury, last — never folded into the amount', () => {
    const ixs = buildSolTransferInstructions({sender: A, recipient: B, lamports: 1_000_000n, markup: {lamports: 20_000n, treasury: TREASURY}});
    expect(ixs).toHaveLength(2);
    expect(transferLamports(ixs[0]!.data)).toBe(1_000_000n);
    expect(ixs[1]!.keys[1]!.pubkey.equals(TREASURY)).toBe(true);
    expect(transferLamports(ixs[1]!.data)).toBe(20_000n);
  });
});

describe('buildSplTransferInstructions', () => {
  const tc = (ixs: {programId: PublicKey; data: Uint8Array}[]) => ixs.find(ix => ix.programId.equals(SPL_TOKEN_PROGRAM_ID) && ix.data[0] === 12);

  it('spends from the given holding account (non-canonical) to the recipient ATA, TransferChecked bytes by hand', () => {
    const ixs = buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 1_000_000n, decimals: 9, sourceTokenAccount: HOLDING, markup: null});
    const ix = tc(ixs);
    expect([...(ix?.data ?? [])]).toEqual([12, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0, 9]);
    const keys = (ix as unknown as {keys: {pubkey: PublicKey}[]}).keys.map(k => k.pubkey.toBase58());
    expect(keys).toEqual([HOLDING.toBase58(), MINT.toBase58(), findAssociatedTokenAddress(B, MINT).toBase58(), A.toBase58()]);
  });

  it('falls back to the sender ATA when no holding account is given', () => {
    const ix = tc(buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 1n, decimals: 9, markup: null}));
    expect((ix as unknown as {keys: {pubkey: PublicKey}[]}).keys[0]!.pubkey.equals(findAssociatedTokenAddress(A, MINT))).toBe(true);
  });

  it('creates the recipient ATA first when asked, against the real ATA program', () => {
    const ixs = buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 1n, decimals: 9, createAta: true, markup: null});
    expect(ixs[0]!.programId.equals(SPL_ATA_PROGRAM_ID)).toBe(true);
    expect(ixs[0]!.data.length).toBe(0);
    expect(ixs[0]!.keys.map(k => k.pubkey.toBase58())).toEqual([
      A.toBase58(), findAssociatedTokenAddress(B, MINT).toBase58(), B.toBase58(), MINT.toBase58(),
      SystemProgram.programId.toBase58(), SPL_TOKEN_PROGRAM_ID.toBase58(),
    ]);
  });

  it('refuses an amount outside u64 and decimals outside 0–9', () => {
    expect(() => buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 2n ** 64n, decimals: 9, markup: null})).toThrow(/out of u64 range/);
    expect(() => buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 1n, decimals: 10, markup: null})).toThrow(/invalid decimals/);
  });

  it('encodes the amount without Buffer.writeBigUInt64LE — the Hermes buffer@5.7.1 polyfill has none', () => {
    const proto = Buffer.prototype as unknown as {writeBigUInt64LE?: unknown};
    const saved = proto.writeBigUInt64LE;
    proto.writeBigUInt64LE = undefined;
    try {
      const ix = tc(buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 2n ** 64n - 1n, decimals: 6, markup: null}));
      expect([...(ix?.data ?? [])]).toEqual([12, 255, 255, 255, 255, 255, 255, 255, 255, 6]);
    } finally {
      proto.writeBigUInt64LE = saved;
    }
  });
});

describe('selectSourceTokenAccount', () => {
  it('returns the account holding the most, or null when there is none', () => {
    expect(selectSourceTokenAccount([{pubkey: 'a', amount: 5n}, {pubkey: 'b', amount: 13_399_619n}])).toBe('b');
    expect(selectSourceTokenAccount([])).toBeNull();
  });

  it('refuses an amount split across accounts — TransferChecked spends from one', () => {
    const accounts = [{pubkey: 'a', amount: 100n}, {pubkey: 'b', amount: 60n}];
    expect(() => selectSourceTokenAccount(accounts, 160n)).toThrow(SplitTokenBalance);
    expect(() => selectSourceTokenAccount(accounts, 160n)).toThrow(/split across/);
    expect(() => selectSourceTokenAccount(accounts, 161n)).toThrow(InsufficientTokenBalance);
    expect(selectSourceTokenAccount(accounts, 100n)).toBe('a');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd extension && npx vitest run transfer.test`
Expected: FAIL — `Failed to load url ../transfer`.

- [ ] **Step 4: Write the core module**

`core/solana/transfer.ts`:
```ts
import {Buffer} from 'buffer';
import {ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js';
import {encodeU64LE, findAssociatedTokenAddress} from '../presale/buyInstructions';

/**
 * SOL and SPL transfer building, shared by the app and the extension (spec §4 "Moves into core/").
 * Moved from src/modules/solana/transactionBuilder.ts; what stayed there binds this to the app's fee
 * store and its Connection. Everything here is pure: the markup, the source token account and the
 * priority fee are explicit inputs.
 *
 * `Buffer` is imported, not assumed global (a Vite bundle has none), and every u64 is encoded by
 * hand: buffer@5.7.1, which the app ships on Hermes, has no writeBigUInt64LE.
 */
export {findAssociatedTokenAddress};

export const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const SPL_ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** Solana's base fee per signature (solana.com/docs/core/fees). */
export const BASE_FEE_LAMPORTS_PER_SIGNATURE = 5_000n;

/** An SPL Token account's data length. */
export const TOKEN_ACCOUNT_SIZE = 165;

/**
 * The rent-exempt minimum for a 165-byte token account: (165 + 128 bytes of account overhead) ×
 * 3 480 lamports per byte-year × 2 years = 2 039 280. Fixed, so the cost of creating the
 * recipient's token account can be shown before signing without the rent-exemption RPC method,
 * which the coordinator proxy refuses (spec §4).
 */
export const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280n;

/**
 * The rent-exempt minimum for a plain (0-byte) system account: (0 + 128) × 3 480 × 2 = 890 880.
 * A SOL balance may be 0 or at least this — the runtime refuses a transfer that leaves an account
 * (or creates one) in between. The send engine refuses such a send before simulating, and B1b-2's
 * MAX math uses it.
 */
export const SYSTEM_ACCOUNT_RENT_LAMPORTS = 890_880n;

const MAX_U64 = 18_446_744_073_709_551_615n;

/** The Noctura fee as its own transfer. Null, or zero lamports, means no instruction at all. */
export interface Markup {
  lamports: bigint;
  treasury: PublicKey;
}

/**
 * Compute-unit limit for a transfer — the single source: the send path and the simulation must
 * request the same budget, or the simulation is of a different transaction.
 */
export function computeUnitLimitFor(params: {kind: 'sol'} | {kind: 'spl'; createAta?: boolean}): number {
  if (params.kind === 'sol') return 1_000;
  return params.createAta ? 65_000 : 40_000;
}

/** ceil(price µlamports/CU × limit / 1 000 000) lamports, in BigInt. */
export function priorityFeeLamports(microLamportsPerCu: number, computeUnitLimit: number): bigint {
  for (const v of [microLamportsPerCu, computeUnitLimit]) {
    if (!Number.isSafeInteger(v) || v < 0) throw new RangeError(`priority fee inputs must be non-negative integers: ${v}`);
  }
  return (BigInt(microLamportsPerCu) * BigInt(computeUnitLimit) + 999_999n) / 1_000_000n;
}

/** The network fee a transaction pays: 5 000 lamports per signature plus its priority fee. */
export function networkFeeLamports(signatures: number, microLamportsPerCu: number, computeUnitLimit: number): bigint {
  if (!Number.isSafeInteger(signatures) || signatures < 1) throw new RangeError(`signatures must be a positive integer: ${signatures}`);
  return BASE_FEE_LAMPORTS_PER_SIGNATURE * BigInt(signatures) + priorityFeeLamports(microLamportsPerCu, computeUnitLimit);
}

/**
 * SPL Token TransferChecked (discriminator 12): [12][amount u64 LE][decimals u8]. Keys: source,
 * mint, destination, owner (signer). Checks amount and decimals on chain against the mint.
 */
export function buildTransferCheckedInstruction(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
): TransactionInstruction {
  if (amount < 0n || amount > MAX_U64) throw new Error(`TransferChecked: amount out of u64 range: ${amount}`);
  if (decimals < 0 || decimals > 9 || decimals !== Math.floor(decimals)) throw new Error(`TransferChecked: invalid decimals: ${decimals}`);
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0);
  data.set(encodeU64LE(amount), 1);
  data.writeUInt8(decimals, 9);
  return new TransactionInstruction({
    keys: [
      {pubkey: source, isSigner: false, isWritable: true},
      {pubkey: mint, isSigner: false, isWritable: false},
      {pubkey: destination, isSigner: false, isWritable: true},
      {pubkey: owner, isSigner: true, isWritable: false},
    ],
    programId: SPL_TOKEN_PROGRAM_ID,
    data,
  });
}

function ataKeys(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey) {
  return [
    {pubkey: payer, isSigner: true, isWritable: true},
    {pubkey: ata, isSigner: false, isWritable: true},
    {pubkey: owner, isSigner: false, isWritable: false},
    {pubkey: mint, isSigner: false, isWritable: false},
    {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
  ];
}

/** Associated Token Account "Create": no data; fails if the account exists. */
export function buildCreateAtaInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  return new TransactionInstruction({keys: ataKeys(payer, ata, owner, mint), programId: SPL_ATA_PROGRAM_ID, data: Buffer.alloc(0)});
}

/** Associated Token Account "CreateIdempotent" (data byte 1): a no-op if the account exists. */
export function buildCreateAtaIdempotentInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  return new TransactionInstruction({keys: ataKeys(payer, ata, owner, mint), programId: SPL_ATA_PROGRAM_ID, data: Buffer.from([1])});
}

function pushBudget(instructions: TransactionInstruction[], computeUnitLimit?: number, priorityFee?: number): void {
  if (computeUnitLimit !== undefined) instructions.push(ComputeBudgetProgram.setComputeUnitLimit({units: computeUnitLimit}));
  if (priorityFee !== undefined) instructions.push(ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}));
}

/** The markup is appended only when one is actually charged — never an undisclosed zero-value line. */
function pushMarkup(instructions: TransactionInstruction[], sender: PublicKey, markup: Markup | null): void {
  if (markup === null || markup.lamports <= 0n) return;
  instructions.push(SystemProgram.transfer({fromPubkey: sender, toPubkey: markup.treasury, lamports: markup.lamports}));
}

export interface SolTransferInput {
  sender: PublicKey;
  recipient: PublicKey;
  lamports: bigint;
  /** µlamports per compute unit. */
  priorityFee?: number;
  computeUnitLimit?: number;
  markup: Markup | null;
}

export function buildSolTransferInstructions(p: SolTransferInput): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];
  pushBudget(instructions, p.computeUnitLimit, p.priorityFee);
  instructions.push(SystemProgram.transfer({fromPubkey: p.sender, toPubkey: p.recipient, lamports: p.lamports}));
  pushMarkup(instructions, p.sender, p.markup);
  return instructions;
}

export interface SplTransferInput {
  sender: PublicKey;
  recipient: PublicKey;
  mint: PublicKey;
  /** Smallest unit. */
  amount: bigint;
  decimals: number;
  priorityFee?: number;
  computeUnitLimit?: number;
  /** Create the recipient's ATA first (its rent is TOKEN_ACCOUNT_RENT_LAMPORTS, paid by the sender). */
  createAta?: boolean;
  /** The sender's account to spend from; the derived ATA when absent. */
  sourceTokenAccount?: PublicKey;
  markup: Markup | null;
}

export function buildSplTransferInstructions(p: SplTransferInput): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];
  pushBudget(instructions, p.computeUnitLimit, p.priorityFee);
  const recipientAta = findAssociatedTokenAddress(p.recipient, p.mint);
  if (p.createAta === true) instructions.push(buildCreateAtaInstruction(p.sender, recipientAta, p.recipient, p.mint));
  // A wallet may hold the mint in a NON-canonical account (not its ATA): spend from the account
  // that actually holds it, falling back to the canonical ATA only when none was resolved.
  const source = p.sourceTokenAccount ?? findAssociatedTokenAddress(p.sender, p.mint);
  instructions.push(buildTransferCheckedInstruction(source, p.mint, recipientAta, p.sender, p.amount, p.decimals));
  pushMarkup(instructions, p.sender, p.markup);
  return instructions;
}

export class SplitTokenBalance extends Error {
  constructor(largest: bigint, required: bigint) {
    super(
      'This balance is split across several token accounts. ' +
        `The largest holds ${largest} of the ${required} needed — ` +
        'send a smaller amount, or consolidate the accounts first.',
    );
    this.name = 'SplitTokenBalance';
  }
}

export class InsufficientTokenBalance extends Error {
  constructor(total: bigint, required: bigint) {
    super(`Insufficient token balance: holding ${total}, need ${required}.`);
    this.name = 'InsufficientTokenBalance';
  }
}

/**
 * The account to spend from: the one holding the most of the mint, or null when there is none.
 * TransferChecked spends from ONE account and is all-or-nothing while the displayed balance is the
 * SUM across accounts, so an amount no single account covers is refused here — split across
 * accounts, or simply more than is held — rather than failing on chain with an opaque error.
 */
export function selectSourceTokenAccount<T>(accounts: readonly {pubkey: T; amount: bigint}[], requiredAmount?: bigint): T | null {
  let best: {pubkey: T; amount: bigint} | null = null;
  let total = 0n;
  for (const a of accounts) {
    total += a.amount;
    if (best === null || a.amount > best.amount) best = a;
  }
  if (best === null) return null;
  if (requiredAmount !== undefined && best.amount < requiredAmount) {
    if (total >= requiredAmount) throw new SplitTokenBalance(best.amount, requiredAmount);
    throw new InsufficientTokenBalance(total, requiredAmount);
  }
  return best.pubkey;
}
```

- [ ] **Step 5: Run the core test in both runners**

Run: `cd extension && npx vitest run transfer.test && npx tsc --noEmit`
Expected: PASS; tsc 0.
Run: `cd web && npx vitest run transfer.test && npx tsc --noEmit && npm run build && npm run scan`
Expected: PASS; tsc 0; the secret scan passes.

- [ ] **Step 6: Turn the app's builder into a shim with its bindings**

Replace the whole of `src/modules/solana/transactionBuilder.ts` with:
```ts
import {PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import type {Connection, TransactionInstruction} from '@solana/web3.js';
import {getConnection} from './connection';
import {getAccountInfo} from './queries';
import {NOCTURA_FEE_TREASURY} from '../../constants/programs';
import {feeEngine} from '../fees/feeEngine';
import {
  buildSolTransferInstructions,
  buildSplTransferInstructions,
  findAssociatedTokenAddress,
  selectSourceTokenAccount,
  type Markup,
} from '../../../core/solana/transfer';
import type {TransferParams, SPLTransferParams} from './types';

// The pure builders moved to core/solana/transfer.ts, shared with the browser extension. This file
// keeps what binds them to the app: the markup from the fee store, and the Connection reads.
export * from '../../../core/solana/transfer';

/**
 * True ONLY when the recipient's ATA for `mint` does not exist yet — sending to a recipient who
 * already holds the token must not prepend a create (it fails with "account already in use").
 */
export async function resolveCreateAta(connection: Connection, recipient: PublicKey, mint: PublicKey): Promise<boolean> {
  const ata = findAssociatedTokenAddress(recipient, mint);
  const info = await getAccountInfo(connection, ata);
  return !info.exists;
}

/**
 * The sender's source token account for `mint`: the owned account with the largest balance (the
 * wallet may hold the mint in a non-canonical account), or null. Throws when no single account
 * covers `requiredAmount` — see selectSourceTokenAccount.
 */
export async function resolveSourceTokenAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  requiredAmount?: bigint,
): Promise<PublicKey | null> {
  const response = await connection.getParsedTokenAccountsByOwner(owner, {mint});
  const accounts = response.value.map(({pubkey, account}) => {
    const parsed = account.data.parsed as {info?: {tokenAmount?: {amount?: string}}};
    return {pubkey, amount: BigInt(parsed.info?.tokenAmount?.amount ?? '0')};
  });
  return selectSourceTokenAccount(accounts, requiredAmount);
}

/**
 * The Noctura markup actually charged on a transparent transfer, in lamports — THE single source
 * for the builders and the send screen's fee/MAX math. Delegates to the fee engine (and through it
 * to core/fees), so pre-TGE this is 0n.
 */
export function getTransferMarkupLamports(): bigint {
  return feeEngine.getEffectiveFee('transferMarkup');
}

function appMarkup(): Markup | null {
  const lamports = getTransferMarkupLamports();
  return lamports > 0n ? {lamports, treasury: new PublicKey(NOCTURA_FEE_TREASURY)} : null;
}

/** Native SOL transfer: optional budget, the transfer, and the markup only when non-zero. */
export function buildTransferInstructions(params: TransferParams): TransactionInstruction[] {
  return buildSolTransferInstructions({...params, markup: appMarkup()});
}

export async function buildTransferTx(params: TransferParams): Promise<VersionedTransaction> {
  const {blockhash} = await getConnection().getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: params.sender,
    recentBlockhash: blockhash,
    instructions: buildTransferInstructions(params),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** SPL transfer: optional budget, optional recipient ATA creation, TransferChecked, markup when non-zero. */
export function buildSPLTransferInstructions(params: SPLTransferParams): TransactionInstruction[] {
  return buildSplTransferInstructions({...params, markup: appMarkup()});
}

export async function buildSPLTransferTx(params: SPLTransferParams): Promise<VersionedTransaction> {
  const {blockhash} = await getConnection().getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: params.sender,
    recentBlockhash: blockhash,
    instructions: buildSPLTransferInstructions(params),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}
```

- [ ] **Step 7: Write the app-side test**

`src/modules/solana/__tests__/coreTransfer.test.ts`:
```ts
import {PublicKey, SystemProgram} from '@solana/web3.js';
import {
  SplitTokenBalance,
  TOKEN_ACCOUNT_RENT_LAMPORTS,
  buildSolTransferInstructions,
  priorityFeeLamports,
  selectSourceTokenAccount,
} from '../../../../core/solana/transfer';

// The app's jest maps @solana/web3.js to its manual mock, so this proves the moved module loads
// under the app's runner and makes the same calls; the byte-level checks run under vitest
// (core/solana/__tests__/transfer.test.ts), and the on-device check stays part of an app release.
describe('core/solana/transfer, as the app imports it', () => {
  const sender = new PublicKey('So11111111111111111111111111111111111111112');
  const recipient = new PublicKey('TokenAccountAddr111111111111111111111111111');
  const treasury = new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');

  beforeEach(() => jest.clearAllMocks());

  it('selects the largest holding and refuses a split balance', () => {
    expect(selectSourceTokenAccount([{pubkey: 'a', amount: 1n}, {pubkey: 'b', amount: 9n}], 9n)).toBe('b');
    expect(() => selectSourceTokenAccount([{pubkey: 'a', amount: 5n}, {pubkey: 'b', amount: 5n}], 10n)).toThrow(SplitTokenBalance);
  });

  it('prices the recipient token account and the priority fee in BigInt', () => {
    expect(TOKEN_ACCOUNT_RENT_LAMPORTS).toBe(2_039_280n);
    expect(priorityFeeLamports(50_000, 1_000)).toBe(50n);
  });

  it('adds the markup transfer only when one is charged', () => {
    buildSolTransferInstructions({sender, recipient, lamports: 5n, markup: null});
    expect(SystemProgram.transfer).toHaveBeenCalledTimes(1);
    buildSolTransferInstructions({sender, recipient, lamports: 5n, markup: {lamports: 20_000n, treasury}});
    expect(SystemProgram.transfer).toHaveBeenCalledTimes(3);
    expect(SystemProgram.transfer).toHaveBeenLastCalledWith({fromPubkey: sender, toPubkey: treasury, lamports: 20_000n});
  });
});
```

- [ ] **Step 8: Run the app's tests for every caller of the builder**

Run: `npx jest src/modules/solana src/modules/shielded src/modules/fees src/screens/transparent && npx tsc --noEmit && npx eslint src/modules/solana src/modules/fees src/constants`
Expected: PASS — the existing `transactionBuilder.test.ts` (TransferChecked bytes, the Hermes test, source account, ATA program id, markup pre/post TGE), `submitTransaction.test.ts` and the shielded flows pass unchanged; tsc 0.

- [ ] **Step 9: Mutation checks**

1. In `pushMarkup`, delete `|| markup.lamports <= 0n` → "no markup instruction when … zero" fails (4 instructions).
2. In `buildTransferCheckedInstruction`, replace `data.set(encodeU64LE(amount), 1);` with `data.writeBigUInt64LE(amount, 1);` → the Hermes test fails (`writeBigUInt64LE is not a function`).
3. In `selectSourceTokenAccount`, delete the `if (total >= requiredAmount) throw new SplitTokenBalance(…)` line → "refuses an amount split across accounts" fails (wrong class) and the app's `resolveSourceTokenAccount` "split across" test fails too.
4. In `priorityFeeLamports`, drop `+ 999_999n` → `priorityFeeLamports(1, 1)` expectation fails (0n).

- [ ] **Step 10: Commit**

```bash
git add core/solana/transfer.ts core/solana/__tests__/transfer.test.ts src/modules/solana/transactionBuilder.ts src/modules/solana/__tests__/coreTransfer.test.ts extension/package.json extension/package-lock.json extension/vite.config.ts extension/tsconfig.json
git commit -m "feat(core): SOL/SPL transfer building moves to core, shared with the extension

Markup, source token account and priority fee become explicit inputs; the app keeps thin
bindings to its fee store and Connection. The extension gets web3.js; the @noble dedupe
becomes a resolver that applies only to core/ files (web3.js 1.x needs its own @noble v1).

Co-Authored-By: <the executing model's own line>"
```

---
### Task 4: Balance reads, history decoding and prices in `core/`

**Files:**
- Create: `core/solana/balances.ts`, `core/solana/history.ts`, `core/portfolio/prices.ts`
- Test: `core/solana/__tests__/balances.test.ts`, `core/solana/__tests__/history.test.ts`, `core/portfolio/__tests__/prices.test.ts` (vitest — `web/` runs them too)
- Test: `src/modules/solana/__tests__/coreBalancesHistory.test.ts` (jest, app)
- Modify: `src/modules/solana/tokenBalances.ts` (whole file → shim)
- Modify: `extension/tsconfig.json`, `extension/vite.config.ts` (include `core/portfolio`)

**Interfaces:**
- Consumes: `SolanaReader`, `TokenAccountEntry` (Task 1); `MAINNET_FEE_TREASURY` (Task 2); `MAINNET_NOC_MINT`, `MAINNET_USDC_MINT`, `MAINNET_USDT_MINT`, `NOC_DECIMALS`, `MAINNET_PROGRAM_ID` (`core/presale/addresses.ts`); `JsonGetter` (`core/ports.ts`); `Prices` (`core/portfolio/value.ts`).
- Produces:
  - `core/solana/balances.ts`: re-export of `SPL_TOKEN_PROGRAM` (`'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'`, from `core/presale/buyInstructions.ts`); `type WalletToken = 'SOL' | 'NOC' | 'USDC' | 'USDT'`; `WALLET_TOKENS: Record<WalletToken, {mint: string | null; decimals: number}>`; `tokenForMint(mint: string): WalletToken | null`; `interface TokenAmount {mint: string; amount: string}`; `sumTokenBalancesByMint(accounts: readonly TokenAmount[]): Record<string, string>`; `interface WalletBalances {sol: bigint; noc: bigint; usdc: bigint; usdt: bigint}`; `readWalletBalances(reader: Pick<SolanaReader, 'getBalance' | 'getTokenAccountsByOwner'>, owner: string): Promise<WalletBalances>`.
  - `core/solana/history.ts`: `type HistoryKind = 'sent' | 'received' | 'purchase' | 'other'`; `interface HistoryEntry {signature: string; blockTime: number | null; kind: HistoryKind; token: WalletToken | null; mint: string | null; amount: bigint | null; counterparty: string | null; feeLamports: bigint; failed: boolean}`; `decodeHistoryEntry(owner: string, signature: string, tx: unknown): HistoryEntry`.
  - `core/portfolio/prices.ts`: `PRICE_PATH = '/wallet/prices?ids=solana,usd-coin,tether'`; `fetchUsdPrices(get: JsonGetter): Promise<Prices>`.

History is **new** code (see "Scope" item 4): the app has no sent/received/purchase decoder to move. It reads balance changes rather than instructions, so a token sent from a non-canonical account, an inner-instruction transfer and a presale purchase all come out right; it never throws on a malformed RPC answer (it returns `'other'`).

- [ ] **Step 1: Include `core/portfolio` in the extension**

`extension/tsconfig.json` `include`:
```json
  "include": ["src", "e2e", "../core/keys", "../core/util", "../core/solana", "../core/fees", "../core/portfolio"]
```
`extension/vite.config.ts` — add `'../core/portfolio/**/*.test.ts',` to the end of `test.include`.

- [ ] **Step 2: Write the failing tests**

`core/solana/__tests__/balances.test.ts`:
```ts
import {SPL_TOKEN_PROGRAM, WALLET_TOKENS, readWalletBalances, sumTokenBalancesByMint, tokenForMint} from '../balances';
import type {TokenAccountEntry} from '../rpc';

const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const NOC = WALLET_TOKENS.NOC.mint as string;
const USDT = WALLET_TOKENS.USDT.mint as string;
const entry = (mint: string, amount: bigint, pubkey = 'Acc'): TokenAccountEntry => ({pubkey, mint, owner: OWNER, amount, decimals: 9});

describe('sumTokenBalancesByMint (moved from the app)', () => {
  it('sums every account per mint — a funded non-canonical account next to an empty ATA still counts', () => {
    expect(sumTokenBalancesByMint([{mint: NOC, amount: '13399619'}, {mint: NOC, amount: '0'}, {mint: USDT, amount: '5'}])).toEqual({[NOC]: '13399619', [USDT]: '5'});
  });

  it('sums beyond 2^53 exactly and skips a malformed amount', () => {
    expect(sumTokenBalancesByMint([{mint: NOC, amount: '9007199254740993'}, {mint: NOC, amount: '1'}, {mint: NOC, amount: 'x'}])).toEqual({[NOC]: '9007199254740994'});
  });
});

describe('the wallet tokens', () => {
  it('are read under the classic SPL Token program — Token-2022 holdings are out of scope', () => {
    expect(SPL_TOKEN_PROGRAM).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  });

  it('are SOL, NOC, USDC and USDT with their decimals', () => {
    expect(WALLET_TOKENS).toEqual({
      SOL: {mint: null, decimals: 9},
      NOC: {mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', decimals: 9},
      USDC: {mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6},
      USDT: {mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6},
    });
    expect(tokenForMint(USDT)).toBe('USDT');
    expect(tokenForMint(OWNER)).toBeNull();
  });
});

describe('readWalletBalances', () => {
  it('reads SOL and the three tokens with two calls, token accounts by program, summed per mint', async () => {
    const asked: unknown[] = [];
    const reader = {
      getBalance: async () => 5n,
      getTokenAccountsByOwner: async (_owner: string, filter: {mint: string} | {programId: string}) => {
        asked.push(filter);
        return [entry(NOC, 10n, 'a'), entry(NOC, 3n, 'b'), entry(USDT, 7n, 'c'), entry(OWNER, 99n, 'd')];
      },
    };
    expect(await readWalletBalances(reader, OWNER)).toEqual({sol: 5n, noc: 13n, usdc: 0n, usdt: 7n});
    expect(asked).toEqual([{programId: SPL_TOKEN_PROGRAM}]);
  });
});
```

`core/solana/__tests__/history.test.ts`:
```ts
import {decodeHistoryEntry} from '../history';
import {WALLET_TOKENS} from '../balances';
import {MAINNET_PROGRAM_ID} from '../../presale/addresses';
import {MAINNET_FEE_TREASURY} from '../../fees/transferMarkup';

const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const OTHER = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const SYSTEM = '11111111111111111111111111111111';
const NOC = WALLET_TOKENS.NOC.mint as string;
const USDC = WALLET_TOKENS.USDC.mint as string;
const USDT = WALLET_TOKENS.USDT.mint as string;

interface TxShape {
  keys: string[];
  pre: number[];
  post: number[];
  fee?: number;
  err?: unknown;
  instructions?: unknown[];
  preToken?: unknown[];
  postToken?: unknown[];
}
/** A getTransaction(jsonParsed) result with just the fields the decoder reads. */
function tx(p: TxShape) {
  return {
    blockTime: 1_700_000_000,
    meta: {err: p.err ?? null, fee: p.fee ?? 5000, preBalances: p.pre, postBalances: p.post, preTokenBalances: p.preToken ?? [], postTokenBalances: p.postToken ?? []},
    transaction: {message: {accountKeys: p.keys.map(k => ({pubkey: k, signer: false, writable: true})), instructions: p.instructions ?? []}},
  };
}
const sysTransfer = (source: string, destination: string, lamports: number) => ({program: 'system', programId: SYSTEM, parsed: {type: 'transfer', info: {source, destination, lamports}}});
const tb = (accountIndex: number, mint: string, owner: string, amount: string) => ({accountIndex, mint, owner, uiTokenAmount: {amount, decimals: 9}});

describe('decodeHistoryEntry', () => {
  it('a SOL send: the recipient amount, not the markup or the fee, and the recipient as counterparty', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({
      keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM],
      pre: [10_000_000, 0, 0, 1],
      post: [10_000_000 - 1_000_000 - 20_000 - 5000, 1_000_000, 20_000, 1],
      instructions: [sysTransfer(OWNER, OTHER, 1_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
    }));
    expect(e).toEqual({
      signature: 'sig', blockTime: 1_700_000_000, kind: 'sent', token: 'SOL', mint: null, amount: 1_000_000n, counterparty: OTHER, feeLamports: 5000n, failed: false,
    });
  });

  it('a SOL send with unparsed instructions: the balance change without the fee the owner paid', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OWNER, OTHER], pre: [10_000_000, 0], post: [8_995_000, 1_000_000], instructions: [{programId: SYSTEM}]}));
    expect(e).toMatchObject({kind: 'sent', token: 'SOL', amount: 1_000_000n, counterparty: null});
  });

  it('SOL received: no fee adjustment when the owner did not pay it', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OTHER, OWNER], pre: [5_000_000, 0], post: [2_995_000, 2_000_000], instructions: [sysTransfer(OTHER, OWNER, 2_000_000)]}));
    expect(e).toMatchObject({kind: 'received', token: 'SOL', amount: 2_000_000n, counterparty: OTHER});
  });

  it('NOC sent from a non-canonical holding account: token balances by owner, the other owner as counterparty', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({
      keys: [OWNER, 'Holding111', 'DestAta111'],
      pre: [1_000_000, 2_039_280, 2_039_280],
      post: [995_000, 2_039_280, 2_039_280],
      preToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
      postToken: [tb(1, NOC, OWNER, '3000'), tb(2, NOC, OTHER, '2000')],
    }));
    expect(e).toMatchObject({kind: 'sent', token: 'NOC', mint: NOC, amount: 2000n, counterparty: OTHER});
  });

  it('USDC received into a token account the owner did not have before', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({
      keys: [OTHER, 'SrcAta111', 'NewAta111'],
      pre: [9_000_000, 2_039_280, 0],
      post: [6_955_720, 2_039_280, 2_039_280],
      preToken: [tb(1, USDC, OTHER, '100')],
      postToken: [tb(1, USDC, OTHER, '40'), tb(2, USDC, OWNER, '60')],
    }));
    expect(e).toMatchObject({kind: 'received', token: 'USDC', amount: 60n, counterparty: OTHER});
  });

  it('a presale purchase with SOL, and one with USDT', () => {
    const sol = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OWNER, MAINNET_PROGRAM_ID], pre: [10_000_000, 1], post: [7_995_000, 1], instructions: [{programId: MAINNET_PROGRAM_ID}]}));
    expect(sol).toMatchObject({kind: 'purchase', token: 'SOL', amount: 2_000_000n});
    const usdt = decodeHistoryEntry(OWNER, 'sig', tx({
      keys: [OWNER, 'UsdtAta111', MAINNET_PROGRAM_ID],
      pre: [10_000_000, 2_039_280, 1],
      post: [9_995_000, 2_039_280, 1],
      instructions: [{programId: MAINNET_PROGRAM_ID}],
      preToken: [tb(1, USDT, OWNER, '50000000')],
      postToken: [tb(1, USDT, OWNER, '25000000')],
    }));
    expect(usdt).toMatchObject({kind: 'purchase', token: 'USDT', amount: 25_000_000n});
  });

  it('a failed transaction is "other", failed, with its fee', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OWNER, OTHER], pre: [1_000_000, 0], post: [995_000, 0], err: {InstructionError: [0, 'Custom']}}));
    expect(e).toMatchObject({kind: 'other', failed: true, feeLamports: 5000n, amount: null});
  });

  it('never throws on a malformed answer', () => {
    for (const bad of [null, 42, {meta: 'x'}, {transaction: {message: {accountKeys: 'x'}}}]) {
      expect(decodeHistoryEntry(OWNER, 'sig', bad)).toMatchObject({kind: 'other', amount: null, feeLamports: 0n});
    }
  });
});
```

`core/portfolio/__tests__/prices.test.ts`:
```ts
import {PRICE_PATH, fetchUsdPrices} from '../prices';

const getter = (body: unknown) => {
  const paths: string[] = [];
  return {paths, get: {get: async <T,>(path: string): Promise<T> => (paths.push(path), body as T)}};
};

describe('fetchUsdPrices', () => {
  it('reads SOL, USDC and USDT from one call to the coordinator proxy', async () => {
    const g = getter({success: true, data: {solana: {usd: 150.5}, 'usd-coin': {usd: 1}, tether: {usd: 0.999}}});
    expect(await fetchUsdPrices(g.get)).toEqual({solana: 150.5, usdc: 1, usdt: 0.999});
    expect(g.paths).toEqual([PRICE_PATH]);
    expect(PRICE_PATH).toBe('/wallet/prices?ids=solana,usd-coin,tether');
  });

  it('drops a missing, non-finite or non-positive price instead of reading it as 0', async () => {
    const g = getter({success: true, data: {solana: {usd: 'x'}, 'usd-coin': {usd: 0}, tether: {}}});
    expect(await fetchUsdPrices(g.get)).toEqual({solana: undefined, usdc: undefined, usdt: undefined});
  });

  it('throws when the body is not a success', async () => {
    await expect(fetchUsdPrices(getter({success: false}).get)).rejects.toThrow('prices unavailable');
    await expect(fetchUsdPrices(getter(null).get)).rejects.toThrow('prices unavailable');
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd extension && npx vitest run balances.test history.test prices.test`
Expected: FAIL — `Failed to load url ../balances` / `../history` / `../prices`.

- [ ] **Step 4: Write the implementations**

`core/solana/balances.ts`:
```ts
import type {SolanaReader} from './rpc';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT, NOC_DECIMALS} from '../presale/addresses';
import {SPL_TOKEN_PROGRAM} from '../presale/buyInstructions';

/** The classic SPL Token program — one literal, owned by core/presale/buyInstructions.ts. */
export {SPL_TOKEN_PROGRAM};

export type WalletToken = 'SOL' | 'NOC' | 'USDC' | 'USDT';

/**
 * What the wallet shows and sends. `mint: null` is native SOL. NOC, USDC and USDT are all classic
 * SPL Token mints (owner program `Tokenkeg…`), and balances are read by that program; a Token-2022
 * holding of any of them is out of scope for B1b-1 (plan "Scope" item 11).
 */
export const WALLET_TOKENS: Record<WalletToken, {mint: string | null; decimals: number}> = {
  SOL: {mint: null, decimals: 9},
  NOC: {mint: MAINNET_NOC_MINT, decimals: NOC_DECIMALS},
  USDC: {mint: MAINNET_USDC_MINT, decimals: 6},
  USDT: {mint: MAINNET_USDT_MINT, decimals: 6},
};

export function tokenForMint(mint: string): WalletToken | null {
  for (const t of ['NOC', 'USDC', 'USDT'] as const) if (WALLET_TOKENS[t].mint === mint) return t;
  return null;
}

export interface TokenAmount {
  mint: string;
  /** Base units as a decimal string. */
  amount: string;
}

/**
 * Aggregate raw token-account balances into mint → total. An owner can hold one mint across several
 * accounts (this project's own wallet holds every token in a non-canonical account), so keeping only
 * one account per mint showed zero, or part, of a real balance. Summed as BigInt; a malformed amount
 * is skipped rather than poisoning the map. Moved from src/modules/solana/tokenBalances.ts.
 */
export function sumTokenBalancesByMint(accounts: readonly TokenAmount[]): Record<string, string> {
  const totals = new Map<string, bigint>();
  for (const account of accounts) {
    let amount: bigint;
    try {
      amount = BigInt(account.amount);
    } catch {
      continue;
    }
    totals.set(account.mint, (totals.get(account.mint) ?? 0n) + amount);
  }
  const out: Record<string, string> = {};
  for (const [mint, total] of totals) out[mint] = total.toString();
  return out;
}

export interface WalletBalances {
  sol: bigint;
  noc: bigint;
  usdc: bigint;
  usdt: bigint;
}

/**
 * SOL plus the three tokens for one owner: two calls, every token account by program (not the
 * derived ATA), summed per mint. A failed call throws — "0" and "could not read" must never look
 * alike to someone checking whether their money arrived.
 */
export async function readWalletBalances(
  reader: Pick<SolanaReader, 'getBalance' | 'getTokenAccountsByOwner'>,
  owner: string,
): Promise<WalletBalances> {
  const [sol, accounts] = await Promise.all([reader.getBalance(owner), reader.getTokenAccountsByOwner(owner, {programId: SPL_TOKEN_PROGRAM})]);
  const sums = sumTokenBalancesByMint(accounts.map(a => ({mint: a.mint, amount: a.amount.toString()})));
  const of = (token: WalletToken): bigint => {
    const mint = WALLET_TOKENS[token].mint;
    return mint === null ? 0n : BigInt(sums[mint] ?? '0');
  };
  return {sol, noc: of('NOC'), usdc: of('USDC'), usdt: of('USDT')};
}
```

`core/solana/history.ts`:
```ts
import {MAINNET_PROGRAM_ID} from '../presale/addresses';
import {MAINNET_FEE_TREASURY} from '../fees/transferMarkup';
import {WALLET_TOKENS, tokenForMint, type WalletToken} from './balances';

export type HistoryKind = 'sent' | 'received' | 'purchase' | 'other';

export interface HistoryEntry {
  signature: string;
  blockTime: number | null;
  kind: HistoryKind;
  token: WalletToken | null;
  mint: string | null;
  /** Base units, always positive; null when there is nothing to show. */
  amount: bigint | null;
  counterparty: string | null;
  feeLamports: bigint;
  failed: boolean;
}

type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
const asArray = (x: unknown): unknown[] => (Array.isArray(x) ? (x as unknown[]) : []);
function big(x: unknown): bigint {
  if (typeof x === 'number' && Number.isInteger(x)) return BigInt(x);
  if (typeof x === 'string' && /^-?\d+$/.test(x)) return BigInt(x);
  return 0n;
}
function keyOf(k: unknown): string | null {
  if (typeof k === 'string') return k;
  if (isObj(k) && typeof k.pubkey === 'string') return k.pubkey;
  return null;
}

/** owner → (mint → post − pre), from the token balances the RPC reports. */
function tokenDeltasByOwner(meta: Json): Map<string, Map<string, bigint>> {
  const out = new Map<string, Map<string, bigint>>();
  const add = (entries: unknown, sign: bigint) => {
    for (const e of asArray(entries)) {
      if (!isObj(e) || typeof e.owner !== 'string' || typeof e.mint !== 'string' || !isObj(e.uiTokenAmount)) continue;
      const perMint = out.get(e.owner) ?? new Map<string, bigint>();
      perMint.set(e.mint, (perMint.get(e.mint) ?? 0n) + sign * big(e.uiTokenAmount.amount));
      out.set(e.owner, perMint);
    }
  };
  add(meta.preTokenBalances, -1n);
  add(meta.postTokenBalances, 1n);
  return out;
}

function systemTransfers(instructions: Json[]): {source: string; destination: string; lamports: bigint}[] {
  const out: {source: string; destination: string; lamports: bigint}[] = [];
  for (const ix of instructions) {
    if (ix.program !== 'system' || !isObj(ix.parsed) || ix.parsed.type !== 'transfer' || !isObj(ix.parsed.info)) continue;
    const {source, destination, lamports} = ix.parsed.info;
    if (typeof source === 'string' && typeof destination === 'string') out.push({source, destination, lamports: big(lamports)});
  }
  return out;
}

/**
 * One getTransaction(jsonParsed) result, seen from `owner`: sent, received, a presale purchase, or
 * other. Read from balance changes, not instruction shapes, so non-canonical token accounts and
 * inner instructions come out right. A SOL amount excludes the network fee the owner paid and the
 * Noctura markup (a separate transfer to the fee vault). Untrusted input: never throws.
 *
 * One entry per transaction: when a transaction moves both a token and SOL for the owner (a token
 * send that also paid rent for the recipient's account, or the markup), only the token leg is
 * reported — the SOL leg is not a separate entry (plan "Scope" item 12).
 */
export function decodeHistoryEntry(owner: string, signature: string, tx: unknown): HistoryEntry {
  const t = isObj(tx) ? tx : {};
  const meta = isObj(t.meta) ? t.meta : {};
  const message = isObj(t.transaction) && isObj(t.transaction.message) ? t.transaction.message : {};
  const keys = asArray(message.accountKeys).map(keyOf);
  const instructions = asArray(message.instructions).filter(isObj);
  const feeLamports = big(meta.fee);
  const failed = meta.err !== null && meta.err !== undefined;
  const base = {signature, blockTime: typeof t.blockTime === 'number' ? t.blockTime : null, feeLamports, failed};
  const other: HistoryEntry = {...base, kind: 'other', token: null, mint: null, amount: null, counterparty: null};
  if (failed) return other;

  const index = keys.indexOf(owner);
  let solDelta = 0n;
  if (index >= 0) {
    solDelta = big(asArray(meta.postBalances)[index]) - big(asArray(meta.preBalances)[index]);
    // The first account pays the fee: add it back, so the amount is what moved, not what it cost.
    if (index === 0) solDelta += feeLamports;
  }
  const deltas = tokenDeltasByOwner(meta);
  const mine = deltas.get(owner) ?? new Map<string, bigint>();

  if (instructions.some(ix => ix.programId === MAINNET_PROGRAM_ID)) {
    for (const token of ['USDC', 'USDT'] as const) {
      const mint = WALLET_TOKENS[token].mint as string;
      const d = mine.get(mint) ?? 0n;
      if (d < 0n) return {...base, kind: 'purchase', token, mint, amount: -d, counterparty: null};
    }
    return {...base, kind: 'purchase', token: 'SOL', mint: null, amount: solDelta < 0n ? -solDelta : 0n, counterparty: null};
  }

  for (const [mint, d] of mine) {
    if (d === 0n) continue;
    let counterparty: string | null = null;
    for (const [who, perMint] of deltas) {
      const theirs = perMint.get(mint) ?? 0n;
      if (who !== owner && (d < 0n ? theirs > 0n : theirs < 0n)) {
        counterparty = who;
        break;
      }
    }
    return {...base, kind: d < 0n ? 'sent' : 'received', token: tokenForMint(mint), mint, amount: d < 0n ? -d : d, counterparty};
  }

  if (solDelta < 0n) {
    const out = systemTransfers(instructions).filter(tr => tr.source === owner && tr.destination !== MAINNET_FEE_TREASURY);
    const amount = out.length > 0 ? out.reduce((s, tr) => s + tr.lamports, 0n) : -solDelta;
    return {...base, kind: 'sent', token: 'SOL', mint: null, amount, counterparty: out[0]?.destination ?? null};
  }
  if (solDelta > 0n) {
    const inbound = systemTransfers(instructions).find(tr => tr.destination === owner);
    return {...base, kind: 'received', token: 'SOL', mint: null, amount: solDelta, counterparty: inbound?.source ?? null};
  }
  return other;
}
```

`core/portfolio/prices.ts`:
```ts
import type {JsonGetter} from '../ports';
import type {Prices} from './value';

/**
 * CoinGecko ids, as the coordinator's proxy accepts them. NOC is absent on purpose: the route
 * refuses it — there is no market for NOC before TGE (core/portfolio/value.ts).
 */
export const PRICE_PATH = '/wallet/prices?ids=solana,usd-coin,tether';

/** USD prices for SOL, USDC and USDT. A missing or unusable price is `undefined`, never 0. */
export async function fetchUsdPrices(get: JsonGetter): Promise<Prices> {
  const body = await get.get<unknown>(PRICE_PATH);
  if (typeof body !== 'object' || body === null) throw new Error('prices unavailable');
  const {success, data} = body as {success?: unknown; data?: unknown};
  if (success !== true || typeof data !== 'object' || data === null) throw new Error('prices unavailable');
  const d = data as Record<string, unknown>;
  const usd = (id: string): number | undefined => {
    const e = d[id];
    const v = typeof e === 'object' && e !== null ? (e as {usd?: unknown}).usd : undefined;
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
  };
  return {solana: usd('solana'), usdc: usd('usd-coin'), usdt: usd('tether')};
}
```

- [ ] **Step 5: Run the tests in both runners**

Run: `cd extension && npx vitest run balances.test history.test prices.test && npx tsc --noEmit`
Expected: PASS; tsc 0.
Run: `cd web && npx vitest run balances.test history.test prices.test && npx tsc --noEmit && npm run build && npm run scan`
Expected: PASS; tsc 0; the secret scan passes.

- [ ] **Step 6: Turn the app's `tokenBalances.ts` into a shim, and add the app-side test**

Replace the whole of `src/modules/solana/tokenBalances.ts` with:
```ts
// Moved to core/solana/balances.ts (shared with the browser extension); re-exported unchanged.
export * from '../../../core/solana/balances';
```

`src/modules/solana/__tests__/coreBalancesHistory.test.ts`:
```ts
import {sumTokenBalancesByMint as viaShim} from '../tokenBalances';
import {WALLET_TOKENS, sumTokenBalancesByMint} from '../../../../core/solana/balances';
import {decodeHistoryEntry} from '../../../../core/solana/history';

const NOC = WALLET_TOKENS.NOC.mint as string;
const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

describe('core/solana/{balances,history}, as the app imports them', () => {
  it('the shim and core are one function, summing across non-canonical accounts', () => {
    expect(viaShim).toBe(sumTokenBalancesByMint);
    expect(viaShim([{mint: NOC, amount: '5'}, {mint: NOC, amount: '13399619'}])).toEqual({[NOC]: '13399624'});
  });

  it('decodes a SOL send under the app runner', () => {
    const tx = {
      blockTime: 1,
      meta: {err: null, fee: 5000, preBalances: [2_000_000, 0], postBalances: [995_000, 1_000_000], preTokenBalances: [], postTokenBalances: []},
      transaction: {message: {accountKeys: [{pubkey: OWNER}, {pubkey: 'Other'}], instructions: []}},
    };
    expect(decodeHistoryEntry(OWNER, 's', tx)).toMatchObject({kind: 'sent', token: 'SOL', amount: 1_000_000n});
  });
});
```

Run: `npx jest src/modules/solana src/modules/backgroundSync && npx tsc --noEmit && npx eslint src/modules/solana src/modules/fees src/constants`
Expected: PASS — the existing `tokenBalances.test.ts` and `backgroundSyncModule` tests pass unchanged; tsc 0.

- [ ] **Step 7: Mutation checks**

1. In `decodeHistoryEntry`, delete `if (index === 0) solDelta += feeLamports;` → "unparsed instructions" fails (1 005 000).
2. Remove `&& tr.destination !== MAINNET_FEE_TREASURY` → "a SOL send: the recipient amount, not the markup" fails (1 020 000).
3. In `sumTokenBalancesByMint`, replace the accumulation with `totals.set(account.mint, amount)` → the non-canonical test fails.
4. In `fetchUsdPrices`, drop `&& v > 0` → "drops … non-positive" fails (usdc 0).

- [ ] **Step 8: Commit**

```bash
git add core/solana/balances.ts core/solana/history.ts core/portfolio/prices.ts core/solana/__tests__/balances.test.ts core/solana/__tests__/history.test.ts core/portfolio/__tests__/prices.test.ts src/modules/solana/tokenBalances.ts src/modules/solana/__tests__/coreBalancesHistory.test.ts extension/tsconfig.json extension/vite.config.ts
git commit -m "feat(core): balance reads, history decoding and the price read move to core

Per-mint sums move from the app (a shim keeps its import); history is decoded from balance
changes into sent / received / purchase and never throws on a malformed answer.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 5: The broadcast client (`core/solana/broadcast.ts`)

**Files:**
- Create: `core/solana/broadcast.ts`
- Test: `core/solana/__tests__/broadcast.test.ts` (vitest — `web/` runs it too)

**Interfaces:**
- Consumes: `API_BASE`, `RpcForbidden`, `FetchLike`, `ForbiddenLatch` (Task 1).
- Produces (from `core/solana/broadcast.ts`):
  - `BROADCAST_ENDPOINT = 'https://api.noc-tura.io/api/v1/tx/broadcast'`
  - `type BroadcastRefusal = 'malformed' | 'unsigned' | 'rejected'`
  - `class BroadcastRejected` (`.reason: BroadcastRefusal`, `.detail: string`) — the route (400) or the local pre-check refused; nothing was forwarded
  - `class BroadcastSubstituted` (`.expected`, `.returned`) — the route answered with another signature
  - `class BroadcastUnavailable` (`.status: number | null`) — not acknowledged; the bytes may or may not be on their way
  - `firstSignature(wire: Uint8Array): string` — base58 of the first signature slot; throws `BroadcastRejected` for no slot, a truncated slot or an all-zero (unsigned) slot
  - `broadcastSigned(opts: {fetch: FetchLike; latch: ForbiddenLatch; endpoint?: string}, wire: Uint8Array): Promise<string>`

The contract is in Global Constraints. A transaction's id is its first signature, so a coordinator that answered with another transaction's signature would have the wallet watch the wrong thing: the client computes the expected signature from the bytes it sends and refuses any other answer.

- [ ] **Step 1: Write the failing test**

`core/solana/__tests__/broadcast.test.ts`:
```ts
import {base58, base64} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';
import {PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {BROADCAST_ENDPOINT, BroadcastRejected, BroadcastSubstituted, BroadcastUnavailable, broadcastSigned, firstSignature} from '../broadcast';
import {RpcForbidden, createForbiddenLatch, type FetchInit} from '../rpc';

const OTHER = new PublicKey('9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4');
const BLOCKHASH = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

// Signed with @noble directly and added with addSignature — as the extension signs. (web's secret
// scan reads this file in source mode and refuses Keypair constructors, so none is used here.)
const SEED = new Uint8Array(32).fill(1);

/** A real v0 transfer, signed or not. */
function wire(signed: boolean): {bytes: Uint8Array; signature: string} {
  const payer = new PublicKey(ed25519.getPublicKey(SEED));
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: BLOCKHASH,
    instructions: [SystemProgram.transfer({fromPubkey: payer, toPubkey: OTHER, lamports: 1n})],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  if (signed) tx.addSignature(payer, ed25519.sign(message.serialize(), SEED));
  const bytes = tx.serialize();
  return {bytes, signature: base58.encode(bytes.subarray(1, 65))};
}

function fakeFetch(answer: {status: number; body?: unknown} | 'throw') {
  const calls: {url: string; init: FetchInit}[] = [];
  const fetch = async (url: string, init: FetchInit) => {
    calls.push({url, init});
    if (answer === 'throw') throw new TypeError('Failed to fetch');
    return {status: answer.status, json: async () => answer.body};
  };
  return {fetch, calls};
}

describe('firstSignature', () => {
  it('is the base58 of the first 64-byte slot after the count', () => {
    const w = wire(true);
    expect(firstSignature(w.bytes)).toBe(w.signature);
  });

  it('refuses an unsigned transaction, an empty count and truncated bytes', () => {
    expect(() => firstSignature(wire(false).bytes)).toThrow(BroadcastRejected);
    expect(() => firstSignature(new Uint8Array([0]))).toThrow(BroadcastRejected);
    expect(() => firstSignature(new Uint8Array([1, 7, 7]))).toThrow(BroadcastRejected);
  });
});

describe('broadcastSigned', () => {
  it('POSTs {transaction: base64} to the broadcast route and returns the signature it verified (positive control)', async () => {
    const w = wire(true);
    const {fetch, calls} = fakeFetch({status: 200, body: {signature: w.signature}});
    expect(await broadcastSigned({fetch, latch: createForbiddenLatch()}, w.bytes)).toBe(w.signature);
    expect(BROADCAST_ENDPOINT).toBe('https://api.noc-tura.io/api/v1/tx/broadcast');
    expect(calls[0]?.url).toBe(BROADCAST_ENDPOINT);
    expect(calls[0]?.init).toMatchObject({method: 'POST', credentials: 'omit', headers: {'content-type': 'application/json'}});
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({transaction: base64.encode(w.bytes)});
  });

  it('refuses a signature that is not the one it sent — a coordinator cannot substitute another transaction', async () => {
    const w = wire(true);
    const {fetch} = fakeFetch({status: 200, body: {signature: base58.encode(new Uint8Array(64).fill(9))}});
    await expect(broadcastSigned({fetch, latch: createForbiddenLatch()}, w.bytes)).rejects.toBeInstanceOf(BroadcastSubstituted);
  });

  it('never sends an unsigned transaction', async () => {
    const {fetch, calls} = fakeFetch({status: 200, body: {}});
    await expect(broadcastSigned({fetch, latch: createForbiddenLatch()}, wire(false).bytes)).rejects.toMatchObject({reason: 'unsigned'});
    expect(calls).toHaveLength(0);
  });

  it('maps a 400 to BroadcastRejected with the route\'s reason; an unknown reason is "rejected"', async () => {
    const w = wire(true);
    const malformed = fakeFetch({status: 400, body: {error: 'malformed', message: 'bad base64'}});
    await expect(broadcastSigned({fetch: malformed.fetch, latch: createForbiddenLatch()}, w.bytes)).rejects.toMatchObject({reason: 'malformed', detail: 'bad base64'});
    const odd = fakeFetch({status: 400, body: {error: 'weird'}});
    await expect(broadcastSigned({fetch: odd.fetch, latch: createForbiddenLatch()}, w.bytes)).rejects.toMatchObject({reason: 'rejected'});
  });

  it('a 403 is terminal and trips the shared latch — the next broadcast sends nothing', async () => {
    const w = wire(true);
    const {fetch, calls} = fakeFetch({status: 403});
    const latch = createForbiddenLatch();
    await expect(broadcastSigned({fetch, latch}, w.bytes)).rejects.toBeInstanceOf(RpcForbidden);
    await expect(broadcastSigned({fetch, latch}, w.bytes)).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
  });

  it('a 5xx, a network failure or an unreadable 200 is "not acknowledged"', async () => {
    const w = wire(true);
    for (const answer of [{status: 502}, 'throw' as const, {status: 200, body: {nope: 1}}]) {
      const {fetch} = fakeFetch(answer);
      await expect(broadcastSigned({fetch, latch: createForbiddenLatch()}, w.bytes)).rejects.toBeInstanceOf(BroadcastUnavailable);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd extension && npx vitest run broadcast.test`
Expected: FAIL — `Failed to load url ../broadcast`.

- [ ] **Step 3: Write the implementation**

`core/solana/broadcast.ts`:
```ts
import {base58, base64} from '@scure/base';
import {API_BASE, RpcForbidden, type FetchLike, type FetchResponse, type ForbiddenLatch} from './rpc';

/**
 * The coordinator's broadcast-only route (spec §4 "Broadcast — through the coordinator"). The
 * public RPC hosts answer 403 to any request carrying an extension Origin, so a signed transaction
 * reaches the chain through this route or not at all. The route can drop or delay a transaction;
 * it cannot author or alter one — and cannot pass off another transaction's signature as ours,
 * because the answer is checked against the bytes sent. Contract: the plan's Global Constraints
 * and docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md.
 */
export const BROADCAST_ENDPOINT = `${API_BASE}/tx/broadcast`;

export type BroadcastRefusal = 'malformed' | 'unsigned' | 'rejected';

/** Refused before forwarding (by the route's 400, or locally): nothing reached the network. */
export class BroadcastRejected extends Error {
  readonly reason: BroadcastRefusal;
  readonly detail: string;
  constructor(reason: BroadcastRefusal, detail: string) {
    super(`broadcast refused (${reason}): ${detail}`);
    this.name = 'BroadcastRejected';
    this.reason = reason;
    this.detail = detail;
  }
}

/** The route answered with a signature that is not our transaction's. */
export class BroadcastSubstituted extends Error {
  readonly expected: string;
  readonly returned: string;
  constructor(expected: string, returned: string) {
    super(`the broadcast route returned ${returned}, not ${expected}`);
    this.name = 'BroadcastSubstituted';
    this.expected = expected;
    this.returned = returned;
  }
}

/** Not acknowledged: the bytes may or may not be on their way. The caller keeps watching. */
export class BroadcastUnavailable extends Error {
  readonly status: number | null;
  constructor(status: number | null) {
    super(status === null ? 'the broadcast route could not be reached' : `the broadcast route answered HTTP ${status}`);
    this.name = 'BroadcastUnavailable';
    this.status = status;
  }
}

const REASONS: readonly string[] = ['malformed', 'unsigned', 'rejected'];

/** Compact-u16 ("shortvec"): the signature count that opens every serialized transaction. */
function readShortVec(bytes: Uint8Array): {value: number; size: number} {
  let value = 0;
  for (let size = 0; size < 3; size++) {
    const b = bytes[size];
    if (b === undefined) break;
    value |= (b & 0x7f) << (7 * size);
    if ((b & 0x80) === 0) return {value, size: size + 1};
  }
  throw new BroadcastRejected('malformed', 'no signature count');
}

/** A transaction's id: base58 of its first signature. Refuses what could not be one. */
export function firstSignature(wire: Uint8Array): string {
  const {value: count, size} = readShortVec(wire);
  if (count < 1) throw new BroadcastRejected('unsigned', 'the transaction has no signature slot');
  const signature = wire.subarray(size, size + 64);
  if (signature.length !== 64) throw new BroadcastRejected('malformed', 'the first signature is truncated');
  if (signature.every(b => b === 0)) throw new BroadcastRejected('unsigned', 'the first signature is empty');
  return base58.encode(signature);
}

export async function broadcastSigned(opts: {fetch: FetchLike; latch: ForbiddenLatch; endpoint?: string}, wire: Uint8Array): Promise<string> {
  const expected = firstSignature(wire);
  const body = JSON.stringify({transaction: base64.encode(wire)});
  let res: FetchResponse;
  try {
    // Through the shared latch: queued behind any read in flight; a 403 is terminal for all.
    res = await opts.latch.request('broadcast', () =>
      opts.fetch(opts.endpoint ?? BROADCAST_ENDPOINT, {method: 'POST', headers: {'content-type': 'application/json'}, body, credentials: 'omit'}),
    );
  } catch (e) {
    if (e instanceof RpcForbidden) throw e;
    throw new BroadcastUnavailable(null);
  }
  if (res.status === 400) {
    let answer: unknown = null;
    try {
      answer = await res.json();
    } catch {
      answer = null;
    }
    const {error, message} = (typeof answer === 'object' && answer !== null ? answer : {}) as {error?: unknown; message?: unknown};
    const reason = typeof error === 'string' && REASONS.includes(error) ? (error as BroadcastRefusal) : 'rejected';
    throw new BroadcastRejected(reason, typeof message === 'string' ? message : 'refused');
  }
  if (res.status !== 200) throw new BroadcastUnavailable(res.status);
  let answer: unknown;
  try {
    answer = await res.json();
  } catch {
    throw new BroadcastUnavailable(200);
  }
  const returned = typeof answer === 'object' && answer !== null ? (answer as {signature?: unknown}).signature : undefined;
  if (typeof returned !== 'string') throw new BroadcastUnavailable(200);
  if (returned !== expected) throw new BroadcastSubstituted(expected, returned);
  return expected;
}
```

- [ ] **Step 4: Run it in both runners**

Run: `cd extension && npx vitest run broadcast.test && npx tsc --noEmit`
Expected: PASS; tsc 0.
Run: `cd web && npx vitest run broadcast.test && npx tsc --noEmit && npm run build && npm run scan`
Expected: PASS; tsc 0; the secret scan passes (this test file signs with `@noble` — a `Keypair` constructor here would fail it).

- [ ] **Step 5: Mutation checks**

1. Delete `if (returned !== expected) throw new BroadcastSubstituted(…)` → "refuses a signature that is not the one it sent" fails.
2. Delete the all-zero check in `firstSignature` → "never sends an unsigned transaction" fails (a request is made).
3. Call `opts.fetch` directly instead of through `opts.latch.request` → "a 403 is terminal and trips the shared latch" fails (two calls).

- [ ] **Step 6: Commit**

```bash
git add core/solana/broadcast.ts core/solana/__tests__/broadcast.test.ts
git commit -m "feat(core): a broadcast client for the coordinator's broadcast-only route

It sends only fully signed bytes, verifies that the route answers with the signature of
those bytes, and treats a 403 as terminal.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 6: Background foundations — settings, known recipients, accounts, re-auth challenges and triggers

**Files:**
- Create: `extension/src/background/mutex.ts`, `digest.ts`, `deps.ts`, `settings.ts`, `knownRecipients.ts`, `accountsStore.ts`, `reauthChallenges.ts`, `reauthPolicy.ts`
- Create (test helpers): `extension/src/background/__tests__/fakeDeps.ts`
- Test: `extension/src/background/__tests__/{mutex,digest,settings,knownRecipients,accountsStore,reauthChallenges,reauthPolicy}.test.ts`
- Modify: `extension/src/background/session.ts` (three key constants), `extension/src/background/autolock.ts` (`minutes` reads `readSettings`)
- Modify: `extension/scripts/check-vault-isolation.mjs` + `extension/scripts/__tests__/check-vault-isolation.test.mjs` (background-owned keys rule)

**Interfaces:**
- Consumes: `Ext`, `KV` (`src/ext.ts`); `SolanaReader` (Task 1); `Prices` (`core/portfolio/value.ts`).
- Produces:
  - `mutex.ts`: `type Mutex = <T>(fn: () => Promise<T>) => Promise<T>`, `createMutex(): Mutex`
  - `digest.ts`: `digestOf(value: unknown): string` (sha256 hex of `JSON.stringify(value)`), `randomId(randomBytes: (n: number) => Uint8Array): string` (32 hex chars)
  - `deps.ts`: `interface WalletDeps {reader: SolanaReader; broadcast(wire: Uint8Array): Promise<string>; prices(): Promise<Prices>; stagePrice(): Promise<number | null>; now(): number; randomBytes(n: number): Uint8Array; sleep(ms: number): Promise<void>}`
  - `session.ts`: `PREPARED_KEY = 'v1_prepared'`, `REAUTH_KEY = 'v1_reauth'` (pending records are in `storage.local` — Task 7's `pendingStore.ts`)
  - `settings.ts`: `SETTINGS_KEY = 'v1_settings'`, `interface Settings {autoLockMinutes: number; reauthUsdCents: number; selectedAccount: number}`, `DEFAULT_SETTINGS`, `AUTOLOCK_RANGE = {min: 1, max: 60}`, `REAUTH_USD_CENTS_RANGE = {min: 100, max: 100_000}`, `readSettings(ext): Promise<Settings>`, `writeSettings(ext, s: Settings): Promise<void>`, `type SettingsPatch = {autoLockMinutes?: number; reauthUsdCents?: number}`, `parsePatch(x: unknown): SettingsPatch | null`, `weakens(current: Settings, patch: SettingsPatch): boolean`
  - `knownRecipients.ts`: `KNOWN_RECIPIENTS_KEY = 'v1_known_recipients'`, `MAX_KNOWN_RECIPIENTS = 1000`, `knownRecipients(ext): Promise<Set<string>>`, `addKnownRecipient(ext, address: string): Promise<void>`
  - `accountsStore.ts`: `VAULT_KEY = 'v1_vault'`, `interface AccountView {index: number; name: string; publicKey: string}`, `interface WalletView {scheme: 'slip10' | 'cli'; accounts: AccountView[]}`, `readWalletView(ext): Promise<WalletView | null>`, `MAX_NAME_LENGTH = 32`, `cleanName(x: unknown): string | null`, `renameAccount(ext, index: number, name: string): Promise<boolean>`
  - `reauthChallenges.ts`: `CHALLENGE_TTL_MS = 120_000`, `issueChallenge(ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, digest: string): Promise<string>`, `satisfyChallenge(ext, now: number, id: string): Promise<boolean>`, `challengeSatisfied(ext, now, id, digest): Promise<boolean>`, `consumeChallenge(ext, now, id, digest): Promise<boolean>`
  - `reauthPolicy.ts`: `REAUTH_PERCENT = 5n`, `WHOLE_BALANCE_PERCENT = 99n`, `type SendReauthReason = 'first-send' | 'over-5-percent' | 'over-usd-threshold' | 'whole-balance-to-new'`, `usdMicros(amount: bigint, decimals: number, unitPriceUsd: number | undefined): bigint | null`, `sendReauthReasons(i: {knownRecipient: boolean; amount: bigint; balance: bigint; usdMicros: bigint | null; thresholdCents: number}): SendReauthReason[]`
  - test helpers: `fakeReader(overrides?: Partial<SolanaReader>): SolanaReader` (every method throws "unexpected RPC call"), `fakeDeps(overrides?: Partial<WalletDeps>): WalletDeps & {clock: {t: number}; broadcasts: Uint8Array[]}`

**The re-auth challenge (brief decision 6).** The background issues a random id bound to a digest of the exact action and valid for 2 minutes; the vault page proves the password or passkey against the session's public keys and sends `vault.reauthOk {challengeId}` (Task 9); the background marks the challenge satisfied; the action consumes it once, only with the same digest. Challenges live in `storage.session`, so a lock voids them.

- [ ] **Step 1: Write the failing tests**

`extension/src/background/__tests__/fakeDeps.ts`:
```ts
import type {WalletDeps} from '../deps';
import type {SolanaReader} from '../../../../core/solana/rpc';

const unexpected = (name: string) => async (): Promise<never> => {
  throw new Error(`unexpected RPC call: ${name}`);
};

/** A reader where every method fails loudly unless a test overrides it. Nothing opens a socket. */
export function fakeReader(overrides: Partial<SolanaReader> = {}): SolanaReader {
  return {
    getBalance: unexpected('getBalance'),
    getAccountExists: unexpected('getAccountExists'),
    getMultipleLamports: unexpected('getMultipleLamports'),
    getLatestBlockhash: unexpected('getLatestBlockhash'),
    getBlockHeight: unexpected('getBlockHeight'),
    getSignatureStatuses: unexpected('getSignatureStatuses'),
    getRecentPrioritizationFees: unexpected('getRecentPrioritizationFees'),
    simulateTransaction: unexpected('simulateTransaction'),
    getTokenAccountsByOwner: unexpected('getTokenAccountsByOwner'),
    getSignaturesForAddress: unexpected('getSignaturesForAddress'),
    getTransaction: unexpected('getTransaction'),
    ...overrides,
  };
}

/**
 * Deterministic deps: a settable clock, counting random bytes, prices for SOL/USDC/USDT, a sleep
 * that never resolves (no poller runs unless a test asks for one), and a broadcast that fails
 * unless a test overrides it.
 */
export function fakeDeps(overrides: Partial<WalletDeps> = {}): WalletDeps & {clock: {t: number}; broadcasts: Uint8Array[]} {
  const clock = {t: 1_000_000};
  const broadcasts: Uint8Array[] = [];
  let counter = 0;
  return {
    reader: fakeReader(),
    broadcast: async () => {
      throw new Error('unexpected broadcast');
    },
    prices: async () => ({solana: 150, usdc: 1, usdt: 1}),
    stagePrice: async () => 0.1501,
    now: () => clock.t,
    randomBytes: n => {
      counter += 1;
      return new Uint8Array(n).fill(counter % 256);
    },
    sleep: () => new Promise<void>(() => undefined),
    ...overrides,
    clock,
    broadcasts,
  };
}
```

`extension/src/background/__tests__/mutex.test.ts`:
```ts
import {createMutex} from '../mutex';

describe('createMutex', () => {
  it('runs overlapping tasks one after another, in call order', async () => {
    const serial = createMutex();
    const log: string[] = [];
    let release!: () => void;
    const first = serial(async () => {
      log.push('a start');
      await new Promise<void>(r => (release = r));
      log.push('a end');
    });
    const second = serial(async () => void log.push('b'));
    await Promise.resolve();
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(['a start', 'a end', 'b']);
  });

  it('a rejected task does not block the next one', async () => {
    const serial = createMutex();
    await expect(serial(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await serial(async () => 7)).toBe(7);
  });
});
```

`extension/src/background/__tests__/digest.test.ts`:
```ts
import {digestOf, randomId} from '../digest';

describe('digest', () => {
  it('is the sha256 hex of the JSON, stable and input-sensitive', () => {
    expect(digestOf({a: 1})).toBe(digestOf({a: 1}));
    expect(digestOf({a: 1})).not.toBe(digestOf({a: 2}));
    // The input is the JSON text: '""' for the empty string, '{"a":1}' for the object.
    expect(digestOf('')).toBe('12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126');
    expect(digestOf({a: 1})).toBe('015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862');
    expect(digestOf({a: 1})).toMatch(/^[0-9a-f]{64}$/);
  });

  it('randomId is 16 random bytes as 32 hex characters', () => {
    expect(randomId(n => new Uint8Array(n).fill(171))).toBe('ab'.repeat(16));
  });
});
```

`extension/src/background/__tests__/settings.test.ts`:
```ts
import {DEFAULT_SETTINGS, SETTINGS_KEY, parsePatch, readSettings, weakens, writeSettings} from '../settings';
import {fakeExt} from './fakeExt';

describe('settings', () => {
  it('defaults to a 5-minute auto-lock, a $100 re-auth threshold and account 0', async () => {
    expect(DEFAULT_SETTINGS).toEqual({autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0});
    expect(await readSettings(fakeExt())).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps stored values into range and ignores garbage', async () => {
    const ext = fakeExt();
    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 600, reauthUsdCents: 5, selectedAccount: -1});
    expect(await readSettings(ext)).toEqual({autoLockMinutes: 60, reauthUsdCents: 100, selectedAccount: 0});
    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: '15', reauthUsdCents: 25_000.4, selectedAccount: 2});
    expect(await readSettings(ext)).toEqual({autoLockMinutes: 5, reauthUsdCents: 25_000, selectedAccount: 2});
    await ext.local.set(SETTINGS_KEY, {reauthUsdCents: 1_000_000});
    expect((await readSettings(ext)).reauthUsdCents).toBe(100_000);
  });

  it('writes only its own fields', async () => {
    const ext = fakeExt();
    await writeSettings(ext, {...DEFAULT_SETTINGS, ...({extra: 'no'} as object)});
    expect(await ext.local.get(SETTINGS_KEY)).toEqual(DEFAULT_SETTINGS);
  });

  it('parsePatch accepts the two security settings in range and nothing else', () => {
    expect(parsePatch({autoLockMinutes: 10})).toEqual({autoLockMinutes: 10});
    expect(parsePatch({reauthUsdCents: 50_000, autoLockMinutes: 1})).toEqual({reauthUsdCents: 50_000, autoLockMinutes: 1});
    for (const bad of [{}, null, 'x', {autoLockMinutes: 0}, {autoLockMinutes: 61}, {autoLockMinutes: 2.5}, {reauthUsdCents: 99}, {reauthUsdCents: 100_001}, {selectedAccount: 1}, {autoLockMinutes: 5, x: 1}]) {
      expect(parsePatch(bad)).toBeNull();
    }
  });

  it('weakens: a longer auto-lock or a higher dollar threshold; shorter/lower/equal does not', () => {
    const s = DEFAULT_SETTINGS;
    expect(weakens(s, {autoLockMinutes: 6})).toBe(true);
    expect(weakens(s, {reauthUsdCents: 10_001})).toBe(true);
    expect(weakens(s, {autoLockMinutes: 4, reauthUsdCents: 5_000})).toBe(false);
    expect(weakens(s, {autoLockMinutes: 5})).toBe(false);
  });
});
```

`extension/src/background/__tests__/knownRecipients.test.ts`:
```ts
import {KNOWN_RECIPIENTS_KEY, MAX_KNOWN_RECIPIENTS, addKnownRecipient, knownRecipients} from '../knownRecipients';
import {fakeExt} from './fakeExt';

describe('known recipients', () => {
  it('starts empty, remembers an address once, and survives garbage in storage', async () => {
    const ext = fakeExt();
    expect((await knownRecipients(ext)).size).toBe(0);
    await addKnownRecipient(ext, 'A');
    await addKnownRecipient(ext, 'A');
    expect([...(await knownRecipients(ext))]).toEqual(['A']);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, 'garbage');
    expect((await knownRecipients(ext)).size).toBe(0);
  });

  it('keeps at most MAX_KNOWN_RECIPIENTS, dropping the oldest', async () => {
    const ext = fakeExt();
    await ext.local.set(KNOWN_RECIPIENTS_KEY, Array.from({length: MAX_KNOWN_RECIPIENTS}, (_, i) => `r${i}`));
    await addKnownRecipient(ext, 'newest');
    const set = await knownRecipients(ext);
    expect(set.size).toBe(MAX_KNOWN_RECIPIENTS);
    expect(set.has('r0')).toBe(false);
    expect(set.has('newest')).toBe(true);
  });
});
```

`extension/src/background/__tests__/accountsStore.test.ts`:
```ts
import {VAULT_KEY, cleanName, readWalletView, renameAccount} from '../accountsStore';
import {fakeExt} from './fakeExt';

const ENV = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: 'c2FsdHNhbHRzYWx0c2FsdA=='},
  seed: {iv: 'aXZpdml2aXZpdml2', ct: 'Y3Q='},
  password: {wrapped: 'd3JhcHBlZA=='},
  accounts: [
    {index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'},
    {index: 1, name: 'Account 2', publicKey: 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o'},
  ],
};

describe('accountsStore', () => {
  it('reads the scheme and the accounts, or null without a (well-shaped) wallet', async () => {
    const ext = fakeExt();
    expect(await readWalletView(ext)).toBeNull();
    await ext.local.set(VAULT_KEY, {...ENV, accounts: 'x'});
    expect(await readWalletView(ext)).toBeNull();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await readWalletView(ext)).toEqual({scheme: 'slip10', accounts: ENV.accounts});
  });

  it('cleanName trims, and refuses empty, long, control and bidi-override names', () => {
    expect(cleanName('  Savings  ')).toBe('Savings');
    for (const bad of ['', '   ', 'x'.repeat(33), 'a\nb', 'a\u202eb', 'a\u2066b', 3]) expect(cleanName(bad)).toBeNull();
  });

  it('renames one account and leaves every other byte of the envelope as it was', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await renameAccount(ext, 1, 'Savings')).toBe(true);
    const after = (await ext.local.get(VAULT_KEY)) as typeof ENV;
    expect(after).toEqual({...ENV, accounts: [ENV.accounts[0], {...ENV.accounts[1], name: 'Savings'}]});
  });

  it('refuses an unknown index and a missing wallet', async () => {
    const ext = fakeExt();
    expect(await renameAccount(ext, 0, 'x')).toBe(false);
    await ext.local.set(VAULT_KEY, ENV);
    expect(await renameAccount(ext, 7, 'x')).toBe(false);
    expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
  });
});
```

`extension/src/background/__tests__/reauthChallenges.test.ts`:
```ts
import {CHALLENGE_TTL_MS, challengeSatisfied, consumeChallenge, issueChallenge, satisfyChallenge} from '../reauthChallenges';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';

describe('re-auth challenges', () => {
  it('issue → satisfy → consume once, with the same digest (positive control)', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd1');
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(await challengeSatisfied(ext, deps.now(), id, 'd1')).toBe(false);
    expect(await satisfyChallenge(ext, deps.now(), id)).toBe(true);
    expect(await challengeSatisfied(ext, deps.now(), id, 'd1')).toBe(true);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(true);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
  });

  it('an unsatisfied challenge cannot be consumed, and stays usable', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd1');
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
    await satisfyChallenge(ext, deps.now(), id);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(true);
  });

  it('a different digest never consumes it — and burns it', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd1');
    await satisfyChallenge(ext, deps.now(), id);
    expect(await consumeChallenge(ext, deps.now(), id, 'd2')).toBe(false);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
  });

  it('expires after two minutes, satisfied or not', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const a = await issueChallenge(ext, deps, 'd');
    const b = await issueChallenge(ext, deps, 'd');
    expect(await satisfyChallenge(ext, deps.now() + CHALLENGE_TTL_MS - 1, b)).toBe(true);
    expect(await satisfyChallenge(ext, deps.now() + CHALLENGE_TTL_MS, a)).toBe(false);
    expect(await consumeChallenge(ext, deps.now() + CHALLENGE_TTL_MS, b, 'd')).toBe(false);
    expect(CHALLENGE_TTL_MS).toBe(120_000);
  });

  it('an unknown id is not satisfied', async () => {
    expect(await satisfyChallenge(fakeExt(), 0, 'f'.repeat(32))).toBe(false);
  });
});
```

`extension/src/background/__tests__/reauthPolicy.test.ts`:
```ts
import {sendReauthReasons, usdMicros} from '../reauthPolicy';

const base = {knownRecipient: true, amount: 10n, balance: 1_000n, usdMicros: 1_000_000n, thresholdCents: 10_000};

describe('usdMicros', () => {
  it('values an amount in micro-dollars, in BigInt', () => {
    expect(usdMicros(500_000_000n, 9, 150)).toBe(75_000_000n);
    expect(usdMicros(1_000_000n, 6, 1)).toBe(1_000_000n);
  });

  it('is null — "unknown" — without a usable price', () => {
    for (const p of [undefined, 0, -1, Number.NaN]) expect(usdMicros(1n, 9, p)).toBeNull();
  });
});

describe('sendReauthReasons (spec §2, §3)', () => {
  it('asks nothing for a small send to a known address (positive control)', () => {
    expect(sendReauthReasons(base)).toEqual([]);
  });

  it('first send to a new address', () => {
    expect(sendReauthReasons({...base, knownRecipient: false})).toEqual(['first-send']);
  });

  it('above 5 % of the balance — exactly 5 % is not above', () => {
    expect(sendReauthReasons({...base, amount: 50n})).toEqual([]);
    expect(sendReauthReasons({...base, amount: 51n})).toEqual(['over-5-percent']);
    expect(sendReauthReasons({...base, balance: 0n})).toEqual(['over-5-percent']);
  });

  it('above the dollar threshold — and a missing price counts as above', () => {
    expect(sendReauthReasons({...base, usdMicros: 100_000_000n})).toEqual([]);
    expect(sendReauthReasons({...base, usdMicros: 100_000_001n})).toEqual(['over-usd-threshold']);
    expect(sendReauthReasons({...base, usdMicros: null})).toEqual(['over-usd-threshold']);
  });

  it('the whole balance to a first-time address', () => {
    expect(sendReauthReasons({...base, knownRecipient: false, amount: 990n})).toEqual(['first-send', 'over-5-percent', 'whole-balance-to-new']);
    expect(sendReauthReasons({...base, knownRecipient: true, amount: 1_000n})).toEqual(['over-5-percent']);
  });
});
```

Add to `extension/scripts/__tests__/check-vault-isolation.test.mjs`, at the end of the `describe('vault isolation (storage, and what may import src/ext.ts)'` block (before its closing `});`):
```js
  // B1b-1: storage.local keys only the background writes. No other file may even name them — a
  // popup writing v1_settings could undo a re-authenticated setting without re-authenticating.
  it('lets only the background name the background-owned storage keys', () => {
    const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
    expect(sourceViolations([
      f('src/background/settings.ts', "export const SETTINGS_KEY = 'v1_settings';"),
      f('src/background/knownRecipients.ts', "export const KNOWN_RECIPIENTS_KEY = 'v1_known_recipients';"),
    ])).toEqual([]);
    expect(sourceViolations([f('src/popup/main.ts', "chrome.runtime.sendMessage({type: 'x', key: 'v1_settings'});")])).toEqual([OWNED('src/popup/main.ts', 'v1_settings')]);
    expect(sourceViolations([f('src/unlock/main.ts', '// v1_known_recipients')])).toEqual([OWNED('src/unlock/main.ts', 'v1_known_recipients')]);
    expect(sourceViolations([f('src/ext.ts', "const k = 'v1_settings';")])).toEqual([OWNED('src/ext.ts', 'v1_settings')]);
    expect(sourceViolations([f('src/popup/main.ts', "const p = 'v1_pending'; const f = 'v1_forbidden_until';")])).toEqual([
      OWNED('src/popup/main.ts', 'v1_pending'),
      OWNED('src/popup/main.ts', 'v1_forbidden_until'),
    ]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd extension && npx vitest run src/background scripts/__tests__/check-vault-isolation`
Expected: FAIL — missing modules (`../mutex`, `../digest`, `../settings`, …) and the new gate test.

- [ ] **Step 3: Write the implementations**

`extension/src/background/mutex.ts`:
```ts
export type Mutex = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Runs read-modify-write sequences one at a time. storage.session has no transactions, and two
 * messages handled concurrently (two "Send" taps, a send racing the poller) must not interleave.
 */
export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}
```

`extension/src/background/digest.ts`:
```ts
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';

/** sha256 hex of the JSON text. Callers build the object key by key, so the text is canonical. */
export function digestOf(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(value))));
}

/** 16 random bytes as 32 hex characters: prepared-send, pending and challenge ids. */
export function randomId(randomBytes: (n: number) => Uint8Array): string {
  return bytesToHex(randomBytes(16));
}
```

`extension/src/background/deps.ts`:
```ts
import type {SolanaReader} from '../../../core/solana/rpc';
import type {Prices} from '../../../core/portfolio/value';

/**
 * Everything the wallet engine needs from outside: chain reads, the broadcast route, prices, time
 * and randomness. The browser's implementation is browserDeps() (added in Task 9); tests pass a
 * fake, so no unit test can reach the network.
 */
export interface WalletDeps {
  reader: SolanaReader;
  /** Sends signed wire bytes through the coordinator's broadcast route; resolves to the verified signature. */
  broadcast(wire: Uint8Array): Promise<string>;
  /** USD prices for SOL, USDC and USDT. */
  prices(): Promise<Prices>;
  /** USD per NOC at the current presale stage (owner decision B), or null when /stats does not say it validly. */
  stagePrice(): Promise<number | null>;
  now(): number;
  randomBytes(n: number): Uint8Array;
  sleep(ms: number): Promise<void>;
}
```

`extension/src/background/session.ts` — add below `export const SESSION_KEY = 'v1_session';`:
```ts
/** Unsigned sends waiting for "Send" (cleared by lock). */
export const PREPARED_KEY = 'v1_prepared';
/** Re-authentication challenges (cleared by lock). */
export const REAUTH_KEY = 'v1_reauth';
```

`extension/src/background/settings.ts`:
```ts
import type {Ext} from '../ext';

/** storage.local key. Written only by the background (scripts/check-vault-isolation.mjs). */
export const SETTINGS_KEY = 'v1_settings';

export interface Settings {
  /** Idle minutes before auto-lock, 1–60 (spec §2). */
  autoLockMinutes: number;
  /** The absolute re-authentication threshold, in US cents (spec §3: default $100). */
  reauthUsdCents: number;
  /** The account index the popup shows. */
  selectedAccount: number;
}

export const DEFAULT_SETTINGS: Settings = {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0};
export const AUTOLOCK_RANGE = {min: 1, max: 60};
/** $1 … $1 000: one re-authentication must not be able to raise the threshold a hundredfold (controller ruling). */
export const REAUTH_USD_CENTS_RANGE = {min: 100, max: 100_000};

function clampInt(v: unknown, range: {min: number; max: number}, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(v)));
}

/** Stored values are claims: each field is checked and clamped, garbage falls back to the default. */
export async function readSettings(ext: Ext): Promise<Settings> {
  const raw = await ext.local.get(SETTINGS_KEY);
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const sel = o.selectedAccount;
  return {
    autoLockMinutes: clampInt(o.autoLockMinutes, AUTOLOCK_RANGE, DEFAULT_SETTINGS.autoLockMinutes),
    reauthUsdCents: clampInt(o.reauthUsdCents, REAUTH_USD_CENTS_RANGE, DEFAULT_SETTINGS.reauthUsdCents),
    selectedAccount: typeof sel === 'number' && Number.isSafeInteger(sel) && sel >= 0 ? sel : DEFAULT_SETTINGS.selectedAccount,
  };
}

export async function writeSettings(ext: Ext, s: Settings): Promise<void> {
  await ext.local.set(SETTINGS_KEY, {autoLockMinutes: s.autoLockMinutes, reauthUsdCents: s.reauthUsdCents, selectedAccount: s.selectedAccount});
}

export type SettingsPatch = {autoLockMinutes?: number; reauthUsdCents?: number};

const inRange = (v: unknown, r: {min: number; max: number}): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= r.min && v <= r.max;

/** The security settings a message may change: only these two keys, integers, in range. */
export function parsePatch(x: unknown): SettingsPatch | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0 || keys.some(k => k !== 'autoLockMinutes' && k !== 'reauthUsdCents')) return null;
  const patch: SettingsPatch = {};
  if ('autoLockMinutes' in o) {
    if (!inRange(o.autoLockMinutes, AUTOLOCK_RANGE)) return null;
    patch.autoLockMinutes = o.autoLockMinutes;
  }
  if ('reauthUsdCents' in o) {
    if (!inRange(o.reauthUsdCents, REAUTH_USD_CENTS_RANGE)) return null;
    patch.reauthUsdCents = o.reauthUsdCents;
  }
  return patch;
}

/** A change that lowers protection needs re-authentication (spec §1): later lock, higher threshold. */
export function weakens(current: Settings, patch: SettingsPatch): boolean {
  return (
    (patch.autoLockMinutes !== undefined && patch.autoLockMinutes > current.autoLockMinutes) ||
    (patch.reauthUsdCents !== undefined && patch.reauthUsdCents > current.reauthUsdCents)
  );
}
```

`extension/src/background/knownRecipients.ts`:
```ts
import type {Ext} from '../ext';
import {createMutex} from './mutex';

/**
 * Addresses this wallet has sent to (a send confirmed on chain), for the "first send to a new
 * address" re-authentication trigger. storage.local, written only by the background.
 */
export const KNOWN_RECIPIENTS_KEY = 'v1_known_recipients';
export const MAX_KNOWN_RECIPIENTS = 1000;

const serial = createMutex();

async function load(ext: Ext): Promise<string[]> {
  const v = await ext.local.get(KNOWN_RECIPIENTS_KEY);
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

export async function knownRecipients(ext: Ext): Promise<Set<string>> {
  return new Set(await load(ext));
}

export async function addKnownRecipient(ext: Ext, address: string): Promise<void> {
  await serial(async () => {
    const list = (await load(ext)).filter(a => a !== address);
    list.push(address);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, list.slice(-MAX_KNOWN_RECIPIENTS));
  });
}
```

`extension/src/background/accountsStore.ts`:
```ts
import type {Ext} from '../ext';
import {createMutex} from './mutex';

/** The envelope (written by the vault page). The background reads it and edits names only. */
export const VAULT_KEY = 'v1_vault';
export const MAX_NAME_LENGTH = 32;

export interface AccountView {
  index: number;
  name: string;
  publicKey: string;
}
export interface WalletView {
  scheme: 'slip10' | 'cli';
  accounts: AccountView[];
}

const serial = createMutex();
type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);

function accountsOf(env: Json): AccountView[] | null {
  if (!Array.isArray(env.accounts) || env.accounts.length === 0) return null;
  const out: AccountView[] = [];
  for (const a of env.accounts as unknown[]) {
    if (!isObj(a) || typeof a.index !== 'number' || !Number.isSafeInteger(a.index) || typeof a.name !== 'string' || typeof a.publicKey !== 'string') return null;
    out.push({index: a.index, name: a.name, publicKey: a.publicKey});
  }
  return out;
}

/** Public data only: the scheme and each account's index, name and address. Null without a wallet. */
export async function readWalletView(ext: Ext): Promise<WalletView | null> {
  const env = await ext.local.get(VAULT_KEY);
  if (!isObj(env) || (env.scheme !== 'slip10' && env.scheme !== 'cli')) return null;
  const accounts = accountsOf(env);
  return accounts === null ? null : {scheme: env.scheme, accounts};
}

// C0 and C1 controls, and the bidi embedding/override/isolate characters that can make an
// account name read as something else.
const FORBIDDEN_IN_NAME = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

export function cleanName(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const name = x.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH || FORBIDDEN_IN_NAME.test(name)) return null;
  return name;
}

/**
 * Names are outside the seed's AES-GCM additionalData (spec §2), so renaming needs no key and no
 * re-encryption: every other field of the stored envelope is written back exactly as read.
 */
export async function renameAccount(ext: Ext, index: number, name: string): Promise<boolean> {
  return serial(async () => {
    const env = await ext.local.get(VAULT_KEY);
    if (!isObj(env) || accountsOf(env) === null) return false;
    const accounts = env.accounts as Json[];
    if (!accounts.some(a => a.index === index)) return false;
    await ext.local.set(VAULT_KEY, {...env, accounts: accounts.map(a => (a.index === index ? {...a, name} : a))});
    return true;
  });
}
```

`extension/src/background/reauthChallenges.ts`:
```ts
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {REAUTH_KEY} from './session';
import {createMutex} from './mutex';
import {randomId} from './digest';

/** How long the vault page has to prove the factor (brief decision 6). */
export const CHALLENGE_TTL_MS = 120_000;

interface Challenge {
  digest: string;
  expiresAt: number;
  satisfied: boolean;
}
type Store = Record<string, Challenge>;

const serial = createMutex();

function isChallenge(x: unknown): x is Challenge {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return typeof c.digest === 'string' && typeof c.expiresAt === 'number' && typeof c.satisfied === 'boolean';
}

async function load(ext: Ext): Promise<Store> {
  const v = await ext.session.get(REAUTH_KEY);
  const out: Store = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const [id, c] of Object.entries(v as Record<string, unknown>)) if (isChallenge(c)) out[id] = c;
  return out;
}

const live = (store: Store, now: number): Store => Object.fromEntries(Object.entries(store).filter(([, c]) => c.expiresAt > now));

/** A new challenge for the action whose digest is given; the vault page proves, the action consumes. */
export async function issueChallenge(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, digest: string): Promise<string> {
  const id = randomId(deps.randomBytes);
  await serial(async () => {
    const now = deps.now();
    const store = live(await load(ext), now);
    store[id] = {digest, expiresAt: now + CHALLENGE_TTL_MS, satisfied: false};
    await ext.session.set(REAUTH_KEY, store);
  });
  return id;
}

/** vault.reauthOk: the proof succeeded in the vault page. False for an unknown or expired id. */
export async function satisfyChallenge(ext: Ext, now: number, id: string): Promise<boolean> {
  return serial(async () => {
    const store = live(await load(ext), now);
    const c = store[id];
    if (c !== undefined) store[id] = {...c, satisfied: true};
    await ext.session.set(REAUTH_KEY, store);
    return c !== undefined;
  });
}

/** Peek without consuming: may the action proceed? */
export async function challengeSatisfied(ext: Ext, now: number, id: string, digest: string): Promise<boolean> {
  const c = (await load(ext))[id];
  return c !== undefined && c.satisfied && c.expiresAt > now && c.digest === digest;
}

/**
 * True exactly once, for a satisfied, unexpired challenge with the same digest. A different digest
 * burns the challenge (it can never be right); a not-yet-satisfied one is left for the vault page.
 */
export async function consumeChallenge(ext: Ext, now: number, id: string, digest: string): Promise<boolean> {
  return serial(async () => {
    const store = live(await load(ext), now);
    const c = store[id];
    if (c === undefined) return false;
    if (c.digest === digest && !c.satisfied) return false;
    delete store[id];
    await ext.session.set(REAUTH_KEY, store);
    return c.digest === digest;
  });
}
```

`extension/src/background/reauthPolicy.ts`:
```ts
/** Spec §3 / screen.md §0: above 5 % of the account's balance (of the token being sent). */
export const REAUTH_PERCENT = 5n;
/** "Whole or nearly whole balance". */
export const WHOLE_BALANCE_PERCENT = 99n;

export type SendReauthReason = 'first-send' | 'over-5-percent' | 'over-usd-threshold' | 'whole-balance-to-new';

/** amount × price in micro-dollars, BigInt. Null — unknown — without a usable price. */
export function usdMicros(amount: bigint, decimals: number, unitPriceUsd: number | undefined): bigint | null {
  if (unitPriceUsd === undefined || !Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) return null;
  const priceMicros = BigInt(Math.round(unitPriceUsd * 1_000_000));
  return (amount * priceMicros) / 10n ** BigInt(decimals);
}

/**
 * Which re-authentication triggers a send meets (spec §2, §3). Every rule fails closed: an unknown
 * price is above the threshold, a zero or unknown balance is above 5 %.
 */
export function sendReauthReasons(i: {knownRecipient: boolean; amount: bigint; balance: bigint; usdMicros: bigint | null; thresholdCents: number}): SendReauthReason[] {
  const out: SendReauthReason[] = [];
  if (!i.knownRecipient) out.push('first-send');
  if (i.balance <= 0n || i.amount * 100n > i.balance * REAUTH_PERCENT) out.push('over-5-percent');
  if (i.usdMicros === null || i.usdMicros > BigInt(i.thresholdCents) * 10_000n) out.push('over-usd-threshold');
  if (!i.knownRecipient && i.balance > 0n && i.amount * 100n >= i.balance * WHOLE_BALANCE_PERCENT) out.push('whole-balance-to-new');
  return out;
}
```

`extension/src/background/autolock.ts` — replace the `minutes` function and `DEFAULT_AUTOLOCK_MINUTES` with:
```ts
import {DEFAULT_SETTINGS, readSettings} from './settings';

export const DEFAULT_AUTOLOCK_MINUTES = DEFAULT_SETTINGS.autoLockMinutes;

async function minutes(ext: Ext): Promise<number> {
  return (await readSettings(ext)).autoLockMinutes;
}
```
(the `import` goes with the file's other imports at the top.)

`extension/scripts/check-vault-isolation.mjs` — below the `LISTEN_ALLOWED` constant add:
```js
// storage.local keys only the background writes (plan B1b-1): no other file may even name them —
// a popup writing v1_settings could undo a re-authenticated setting without re-authenticating.
export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until'];
const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
```
and in `sourceViolations`, after the `LISTENS_RUNTIME` line:
```js
    if (!BACKGROUND_OWNED_ALLOWED.test(path)) {
      for (const key of BACKGROUND_OWNED_KEYS) if (text.includes(key)) out.push(`${path}: names ${key}, which only the background may write`);
    }
```

- [ ] **Step 4: Run the tests and the gates**

Run: `cd extension && npx vitest run src/background scripts && npx tsc --noEmit && npm run build && npm run gates`
Expected: PASS — including the existing `autolock.test.ts` (clamping 600 → 60, 0 → 1, NaN/Infinity/'15' → 5) and `messages.test.ts` ("activity.ping re-arms using the current settings"); gates print `vault isolation ok`.

- [ ] **Step 5: Mutation checks**

1. In `consumeChallenge`, replace `delete store[id];` + write with nothing → "issue → satisfy → consume once" fails (second consume true).
2. In `sendReauthReasons`, change `>` to `>=` in the 5 % rule → "exactly 5 % is not above" fails.
3. Change `i.usdMicros === null ||` to `i.usdMicros !== null &&` → "a missing price counts as above" fails.
4. In `weakens`, drop the `reauthUsdCents` clause → "weakens: … a higher dollar threshold" fails.
5. In `renameAccount`, write `{accounts: …}` instead of `{...env, accounts: …}` → "leaves every other byte" fails.
6. In the gate, empty `BACKGROUND_OWNED_KEYS` → "lets only the background name the background-owned storage keys" fails.

- [ ] **Step 6: Commit**

```bash
git add extension/src/background extension/scripts/check-vault-isolation.mjs extension/scripts/__tests__/check-vault-isolation.test.mjs
git commit -m "feat(extension): settings, known recipients, account names and re-auth challenges

Background-owned storage with a gate rule that no other file may name its keys; re-auth
challenges bound to an action digest, consumed once; the spec's send triggers, failing closed.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 7: Preparing a send — build, simulate, price, decide re-authentication

**Files:**
- Create: `extension/src/background/sendTypes.ts`, `feePolicy.ts`, `pendingStore.ts`, `prepare.ts`
- Create (test helper): `extension/src/background/__tests__/fixtures.ts`
- Test: `extension/src/background/__tests__/pendingStore.test.ts`, `extension/src/background/__tests__/prepare.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 and 6 — `SolanaReader`, `estimatePriorityFee` (`core/solana/priorityFee.ts`), the transfer builders and fee arithmetic, `WALLET_TOKENS`, `effectiveFee`/`TRANSFER_MARKUP_LAMPORTS`/`MAINNET_FEE_TREASURY`, `WalletDeps`, `getSession`, `PREPARED_KEY`, `knownRecipients`, `readSettings`, `sendReauthReasons`/`usdMicros`, `issueChallenge`, `digestOf`/`randomId`, `createMutex`.
- Produces:
  - `sendTypes.ts`: `interface SendIntent {token: WalletToken; recipient: string; amount: string}`; `type SendRefusal = 'locked' | 'unknown-account' | 'in-flight' | 'split-balance' | 'insufficient-token' | 'insufficient-sol' | 'simulation-failed' | 'unknown-prepared' | 'prepared-expired' | 'reauth-required' | 'sender-below-rent' | 'recipient-below-rent'`; `class SendRefused` (`.code`, `.detail`); `type ResendRefusal = 'unknown' | 'not-open' | 'too-soon'`; `class ResendRefused` (`.code`)
  - `feePolicy.ts`: `EXTENSION_FEE_INPUTS: FeePolicyInputs` (both statuses `'unknown'`, discount 0)
  - `pendingStore.ts`: `PENDING_KEY = 'v1_pending'` (storage.local); `type PendingState = 'pending' | 'stuck' | 'confirmed' | 'failed' | 'expired'`; `interface PendingRecord {id; account; signature; wire (base64); lastValidBlockHeight; createdAt; lastSentAt; state; detail: string | null; intent: SendIntent; expiryNullSeenAt: number | null}`; `type PendingView = Omit<PendingRecord, 'wire'>`; `MAX_RECORDS = 20`; `isOpen(r)`; `readPending(ext)`; `inFlightFor(records, account)`; `viewOf(r)`; `updatePending(ext, change): Promise<PendingRecord[]>`
  - `prepare.ts`: `PREPARED_TTL_MS = 30_000`, `MAX_PREPARED = 5`; `interface PreparedSend {id; account; intent; message (base64 unsigned v0 message); lastValidBlockHeight; createdAt; digest; challengeId: string | null}`; `interface PreparedView {id; fees: {networkLamports; priorityLamports; rentLamports; markupLamports: string; markupReason: FeeReason}; solRequiredLamports: string; reauth: {challengeId: string; reasons: SendReauthReason[]} | null}`; `isAddress(x: unknown): x is string`; `parseIntent(x: unknown): SendIntent | null`; `prepareSend(ext, deps, account: string, intent: SendIntent): Promise<PreparedView>`; `peekPrepared(ext, id): Promise<PreparedSend | null>`; `takePrepared(ext, deps: Pick<WalletDeps, 'now'>, id): Promise<PreparedSend>`
  - test fixtures: `SEED`, `PUB`, `ACCOUNT: SessionAccount`, `RECIPIENT`, `BLOCKHASH`, `HOLDING_SMALL`, `HOLDING_LARGE`, `unlocked(ext)`, `sendReader(overrides?)`, `pendingRecord(overrides?): PendingRecord`, `signedWire(lamports?: bigint): Uint8Array`

The order inside `prepareSend` is the spec's: refuse early and cheaply (locked, unknown account, a send already in flight — no network at all), then read (priority fee, blockhash, SOL balance, token holdings, recipient ATA), build with the markup from the core policy, refuse a split or short balance **before** simulating, simulate through the proxy, then evaluate the re-authentication triggers and, if any is met, issue a challenge bound to the digest of this exact message. The prepared send is single-use and lives 30 s — spec §3's re-simulation interval, well inside its blockhash's life.

- [ ] **Step 1: Write the test helpers and the failing tests**

`extension/src/background/__tests__/fixtures.ts`:
```ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../../ext';
import type {SessionAccount} from '../../vault/accounts';
import type {SolanaReader} from '../../../../core/solana/rpc';
import {setSession} from '../session';
import type {PendingRecord} from '../pendingStore';
import {fakeReader} from './fakeDeps';

/** A real Ed25519 keypair (32 × 0x01 seed): its address is AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9. */
export const SEED = new Uint8Array(32).fill(1);
export const PUB = ed25519.getPublicKey(SEED);
export const ACCOUNT: SessionAccount = {index: 0, publicKey: base58.encode(PUB), secretKey: base64.encode(new Uint8Array([...SEED, ...PUB]))};
export const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
/** Any 32-byte base58 value serves as a blockhash here. */
export const BLOCKHASH = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
export const HOLDING_SMALL = '4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF';
export const HOLDING_LARGE = 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU';

export async function unlocked(ext: Ext): Promise<void> {
  await setSession(ext, [ACCOUNT]);
}

/** The reads a SOL send makes: quiet fees, blockhash valid to height 1000, 10 SOL, simulation passes. */
export function sendReader(overrides: Partial<SolanaReader> = {}): SolanaReader {
  return fakeReader({
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    getBalance: async () => 10_000_000_000n,
    simulateTransaction: async () => ({err: null, logs: [], unitsConsumed: 450}),
    // The recipient's system account exists (a new one must receive ≥ 890 880 lamports — M4).
    getAccountExists: async () => true,
    ...overrides,
  });
}

/** A pending record with every field set; override what a test is about. */
export const pendingRecord = (over: Partial<PendingRecord> = {}): PendingRecord => ({
  id: 'r1',
  account: 'A',
  signature: 's1',
  wire: 'AQ==',
  lastValidBlockHeight: 1000,
  createdAt: 0,
  lastSentAt: 0,
  state: 'pending',
  detail: null,
  intent: {token: 'SOL', recipient: 'R', amount: '1'},
  expiryNullSeenAt: null,
  ...over,
});

/** A signed v0 transfer from ACCOUNT; `lamports` varies it so two wires differ. */
export function signedWire(lamports = 1n): Uint8Array {
  const payer = new PublicKey(ACCOUNT.publicKey);
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: BLOCKHASH,
    instructions: [SystemProgram.transfer({fromPubkey: payer, toPubkey: new PublicKey(RECIPIENT), lamports})],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.addSignature(payer, ed25519.sign(message.serialize(), SEED));
  return tx.serialize();
}
```

`extension/src/background/__tests__/pendingStore.test.ts`:
```ts
import {MAX_RECORDS, inFlightFor, isOpen, readPending, updatePending, viewOf, type PendingRecord} from '../pendingStore';
import {PENDING_KEY} from '../pendingStore';
import {fakeExt} from './fakeExt';
import {pendingRecord as record} from './fixtures';

describe('pendingStore', () => {
  it('reads nothing from an empty or garbage store; records live in storage.local, never session', async () => {
    const ext = fakeExt();
    expect(await readPending(ext)).toEqual([]);
    await ext.local.set(PENDING_KEY, 'x');
    expect(await readPending(ext)).toEqual([]);
    await updatePending(ext, () => [record()]);
    expect(await ext.local.get(PENDING_KEY)).toHaveLength(1);
    expect(await ext.session.get(PENDING_KEY)).toBeUndefined();
  });

  it('open means pending or stuck; one open record per account is "in flight"', () => {
    expect(['pending', 'stuck', 'confirmed', 'failed', 'expired'].map(state => isOpen(record({state: state as PendingRecord['state']})))).toEqual([true, true, false, false, false]);
    expect(inFlightFor([record({state: 'expired'}), record({id: 'r2', state: 'stuck'})], 'A')?.id).toBe('r2');
    expect(inFlightFor([record({state: 'confirmed'})], 'A')).toBeUndefined();
  });

  it('the view carries no signed bytes', () => {
    expect('wire' in viewOf(record())).toBe(false);
  });

  it('keeps every open record and only the newest closed ones', async () => {
    const ext = fakeExt();
    const closed = Array.from({length: MAX_RECORDS + 5}, (_, i) => record({id: `c${i}`, state: 'confirmed'}));
    const after = await updatePending(ext, () => [record({id: 'open'}), ...closed]);
    expect(after).toHaveLength(MAX_RECORDS);
    expect(after[0]?.id).toBe('open');
    expect(after.at(-1)?.id).toBe(`c${MAX_RECORDS + 4}`);
  });
});
```

`extension/src/background/__tests__/prepare.test.ts`:
```ts
import {base64} from '@scure/base';
import {VersionedMessage} from '@solana/web3.js';
import {PREPARED_TTL_MS, parseIntent, peekPrepared, prepareSend, takePrepared} from '../prepare';
import {PREPARED_KEY} from '../session';
import {PENDING_KEY} from '../pendingStore';
import {stagePriceFrom} from '../deps';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {challengeSatisfied} from '../reauthChallenges';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {SPL_TOKEN_PROGRAM_ID} from '../../../../core/solana/transfer';
import {RpcForbidden} from '../../../../core/solana/rpc';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL, RECIPIENT, sendReader, unlocked} from './fixtures';
import {pendingRecord as record} from './fixtures';

const SOL_INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};
const NOC = WALLET_TOKENS.NOC.mint as string;

async function knownSetup() {
  const ext = fakeExt();
  await unlocked(ext);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  return ext;
}

describe('parseIntent', () => {
  it('accepts a wallet token, a base58 address and a positive integer amount up to u64', () => {
    expect(parseIntent(SOL_INTENT)).toEqual(SOL_INTENT);
    expect(parseIntent({...SOL_INTENT, amount: '18446744073709551615'})).not.toBeNull();
  });

  it('refuses anything else', () => {
    for (const bad of [
      null, {...SOL_INTENT, token: 'BONK'}, {...SOL_INTENT, recipient: '0OIl'}, {...SOL_INTENT, recipient: 'abc'},
      {...SOL_INTENT, amount: '0'}, {...SOL_INTENT, amount: '01'}, {...SOL_INTENT, amount: '1.5'}, {...SOL_INTENT, amount: '-1'},
      {...SOL_INTENT, amount: '18446744073709551616'}, {...SOL_INTENT, amount: 5},
    ]) {
      expect(parseIntent(bad)).toBeNull();
    }
  });
});

describe('prepareSend', () => {
  it('a small SOL send to a known address: network fee, no markup (status unknown), no re-auth (positive control)', async () => {
    const ext = await knownSetup();
    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
    // 5 000 per signature + ceil(50 000 µlamports × 1 000 CU / 1e6) = 5 050 lamports.
    expect(view.fees).toEqual({networkLamports: '5050', priorityLamports: '50', rentLamports: '0', markupLamports: '0', markupReason: 'status-unknown'});
    expect(view.solRequiredLamports).toBe('1005050');
    expect(view.reauth).toBeNull();
    const stored = (await ext.session.get(PREPARED_KEY)) as {id: string; lastValidBlockHeight: number}[];
    expect(stored.map(p => p.id)).toEqual([view.id]);
    expect(stored[0]?.lastValidBlockHeight).toBe(1000);
  });

  it('stores an unsigned v0 message paid by the account, for this blockhash and recipient', async () => {
    const ext = await knownSetup();
    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
    const msg = VersionedMessage.deserialize(base64.decode((await peekPrepared(ext, view.id))!.message));
    expect(msg.staticAccountKeys[0]?.toBase58()).toBe(ACCOUNT.publicKey);
    expect(msg.recentBlockhash).toBe(BLOCKHASH);
    expect(msg.staticAccountKeys.map(k => k.toBase58())).toContain(RECIPIENT);
  });

  it('a first send to a new address issues a challenge bound to this prepared send', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const view = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    expect(view.reauth?.reasons).toEqual(['first-send']);
    const p = await peekPrepared(ext, view.id);
    expect(p?.challengeId).toBe(view.reauth?.challengeId);
    expect(await challengeSatisfied(ext, deps.now(), view.reauth!.challengeId, p!.digest)).toBe(false);
  });

  it('sending to the account itself is not a first send', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, recipient: ACCOUNT.publicKey});
    expect(view.reauth).toBeNull();
  });

  it('a missing price counts as above the dollar threshold', async () => {
    const ext = await knownSetup();
    const deps = fakeDeps({
      reader: sendReader(),
      prices: async () => {
        throw new Error('prices down');
      },
    });
    expect((await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT)).reauth?.reasons).toEqual(['over-usd-threshold']);
  });

  it('an SPL send spends from the largest holding, creates the recipient account and shows its rent up front', async () => {
    const ext = await knownSetup();
    const reader = sendReader({
      getTokenAccountsByOwner: async () => [
        {pubkey: HOLDING_SMALL, mint: NOC, owner: ACCOUNT.publicKey, amount: 5n, decimals: 9},
        {pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 13_399_619n, decimals: 9},
      ],
      getAccountExists: async () => false,
    });
    const view = await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {token: 'NOC', recipient: RECIPIENT, amount: '1000000'});
    // 65 000 CU with the create: priority ceil(50 000 × 65 000 / 1e6) = 3 250; network 8 250; rent 2 039 280.
    expect(view.fees).toMatchObject({rentLamports: '2039280', priorityLamports: '3250', networkLamports: '8250'});
    expect(view.solRequiredLamports).toBe('2047530');
    const msg = VersionedMessage.deserialize(base64.decode((await peekPrepared(ext, view.id))!.message));
    const keys = msg.staticAccountKeys.map(k => k.toBase58());
    const transferChecked = msg.compiledInstructions.find(ix => keys[ix.programIdIndex] === SPL_TOKEN_PROGRAM_ID.toBase58() && ix.data[0] === 12);
    expect(keys[transferChecked!.accountKeyIndexes[0]!]).toBe(HOLDING_LARGE);
  });

  it('NOC is valued at the presale stage price for the dollar rule (owner decision B)', async () => {
    const ext = await knownSetup();
    const reader = sendReader({
      getTokenAccountsByOwner: async () => [{pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 10_000_000_000_000n, decimals: 9}],
      getAccountExists: async () => true,
    });
    // 100 NOC × $0.1501 = $15.01: under $100, and 1 % of the holding.
    const intent = {token: 'NOC' as const, recipient: RECIPIENT, amount: '100000000000'};
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, intent)).reauth).toBeNull();
    const noStage = fakeDeps({
      reader,
      stagePrice: async () => {
        throw new Error('stats down');
      },
    });
    expect((await prepareSend(ext, noStage, ACCOUNT.publicKey, intent)).reauth?.reasons).toEqual(['over-usd-threshold']);
    // /stats answered without a usable currentStage: stagePriceFrom gives null → re-auth required.
    const missingStage = fakeDeps({reader, stagePrice: async () => stagePriceFrom({success: true, data: {totalNocSold: 0}})});
    expect((await prepareSend(ext, missingStage, ACCOUNT.publicKey, intent)).reauth?.reasons).toEqual(['over-usd-threshold']);
    const forbidden = fakeDeps({
      reader,
      stagePrice: async () => {
        throw new RpcForbidden('/stats');
      },
    });
    await expect(prepareSend(ext, forbidden, ACCOUNT.publicKey, intent)).rejects.toBeInstanceOf(RpcForbidden);
  });

  it('refuses a send that would leave the sender below the rent-exempt minimum — but not one that empties it', async () => {
    const ext = await knownSetup();
    // 10 SOL; 1 SOL − 5 050 fee − 500 000 left would remain.
    const leaves = (10_000_000_000n - 500_000n - 5_050n).toString();
    await expect(prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, amount: leaves})).rejects.toMatchObject({code: 'sender-below-rent'});
    const everything = (10_000_000_000n - 5_050n).toString();
    expect((await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, amount: everything})).solRequiredLamports).toBe('10000000000');
  });

  it('refuses less than the rent-exempt minimum to a brand-new recipient account', async () => {
    const ext = await knownSetup();
    const reader = sendReader({getAccountExists: async () => false});
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '890879'})).rejects.toMatchObject({code: 'recipient-below-rent'});
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '890880'})).id).toMatch(/^[0-9a-f]{32}$/);
    expect((await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '1000'})).id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('refuses a balance split across accounts, before simulating', async () => {
    const ext = await knownSetup();
    const reader = sendReader({
      getTokenAccountsByOwner: async () => [
        {pubkey: HOLDING_SMALL, mint: NOC, owner: ACCOUNT.publicKey, amount: 100n, decimals: 9},
        {pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 60n, decimals: 9},
      ],
      simulateTransaction: async () => {
        throw new Error('must not simulate');
      },
    });
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {token: 'NOC', recipient: RECIPIENT, amount: '160'})).rejects.toMatchObject({code: 'split-balance'});
  });

  it('refuses when SOL cannot cover the amount and the fees', async () => {
    const ext = await knownSetup();
    const reader = sendReader({getBalance: async () => 1_000_000n});
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'insufficient-sol'});
  });

  it('refuses a transaction whose simulation fails', async () => {
    const ext = await knownSetup();
    const reader = sendReader({simulateTransaction: async () => ({err: {InstructionError: [2, {Custom: 1}]}, logs: [], unitsConsumed: null})});
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-failed', detail: '{"InstructionError":[2,{"Custom":1}]}'});
  });

  it('refuses while a send from the account is in flight — without a single network call', async () => {
    const ext = await knownSetup();
    await ext.local.set(PENDING_KEY, [record({account: ACCOUNT.publicKey, state: 'stuck'})]);
    await expect(prepareSend(ext, fakeDeps({reader: fakeReader()}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'in-flight'});
  });

  it('refuses when locked, and for an account the session does not hold', async () => {
    await expect(prepareSend(fakeExt(), fakeDeps(), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'locked'});
    const ext = await knownSetup();
    await expect(prepareSend(ext, fakeDeps(), RECIPIENT, SOL_INTENT)).rejects.toMatchObject({code: 'unknown-account'});
  });

  it('a 403 from the coordinator surfaces as RpcForbidden, not as a refusal to retry', async () => {
    const ext = await knownSetup();
    const reader = sendReader({
      getLatestBlockhash: async () => {
        throw new RpcForbidden('getLatestBlockhash');
      },
    });
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toBeInstanceOf(RpcForbidden);
  });

  it('a newer prepare replaces the older one; taking is single use; an expired one is refused as prepared-expired', async () => {
    const ext = await knownSetup();
    const deps = fakeDeps({reader: sendReader()});
    const first = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    const second = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    expect(await peekPrepared(ext, first.id)).toBeNull();
    expect((await takePrepared(ext, deps, second.id)).id).toBe(second.id);
    await expect(takePrepared(ext, deps, second.id)).rejects.toMatchObject({code: 'unknown-prepared'});
    const third = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    deps.clock.t += PREPARED_TTL_MS;
    await expect(takePrepared(ext, deps, third.id)).rejects.toMatchObject({code: 'prepared-expired'});
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd extension && npx vitest run pendingStore.test prepare.test`
Expected: FAIL — missing `../pendingStore`, `../prepare`.

- [ ] **Step 3: Write the implementations**

`extension/src/background/sendTypes.ts`:
```ts
import type {WalletToken} from '../../../core/solana/balances';

/** What the user asked for. `amount` is base units as a decimal string (messages are JSON). */
export interface SendIntent {
  token: WalletToken;
  recipient: string;
  amount: string;
}

export type SendRefusal =
  | 'locked'
  | 'unknown-account'
  | 'in-flight'
  | 'split-balance'
  | 'insufficient-token'
  | 'insufficient-sol'
  | 'simulation-failed'
  | 'unknown-prepared'
  | 'prepared-expired'
  | 'reauth-required'
  | 'sender-below-rent'
  | 'recipient-below-rent';

/** A send the engine will not make, with a fixed code the screens translate and a detail for the curious. */
export class SendRefused extends Error {
  readonly code: SendRefusal;
  readonly detail: string;
  constructor(code: SendRefusal, detail = '') {
    super(detail === '' ? code : `${code}: ${detail}`);
    this.name = 'SendRefused';
    this.code = code;
    this.detail = detail;
  }
}

export type ResendRefusal = 'unknown' | 'not-open' | 'too-soon';

export class ResendRefused extends Error {
  readonly code: ResendRefusal;
  constructor(code: ResendRefusal) {
    super(`resend refused: ${code}`);
    this.name = 'ResendRefused';
    this.code = code;
  }
}
```

`extension/src/background/feePolicy.ts`:
```ts
import type {FeePolicyInputs} from '../../../core/fees/transferMarkup';

/**
 * Plan B1b-1, decision 4. The extension has no trustworthy source for the TGE status or for
 * zero-fee eligibility — and neither does the app: its tgeStatus is never written and its
 * eligibility is hard-coded false. The TGE date must not be written into the extension. So both
 * inputs are 'unknown' and the core policy charges nothing, with the reason 'status-unknown' on the
 * fee line, until the coordinator reports them (docs/superpowers/specs/2026-09-29-coordinator-
 * broadcast-route.md, ask 6). In the user's favour, and disclosed.
 */
export const EXTENSION_FEE_INPUTS: FeePolicyInputs = {tgeStatus: 'unknown', isZeroFeeEligible: 'unknown', stakingDiscount: 0};
```

`extension/src/background/pendingStore.ts`:
```ts
import type {Ext} from '../ext';
import {createMutex} from './mutex';
import type {SendIntent} from './sendTypes';

/**
 * storage.local, written only by the background (owner decision A, 2026-09-29): a pending send must
 * survive a lock and a browser restart, or a second transaction could be built while the first may
 * still land. Signed bytes only — public once broadcast; at most MAX_RECORDS records.
 */
export const PENDING_KEY = 'v1_pending';

export type PendingState = 'pending' | 'stuck' | 'confirmed' | 'failed' | 'expired';

/** A signed send, from before its broadcast until confirmed, failed or expired (spec §4 "No double spend"). */
export interface PendingRecord {
  id: string;
  account: string;
  signature: string;
  /** The signed wire bytes, base64: "send again" re-sends exactly these. */
  wire: string;
  lastValidBlockHeight: number;
  createdAt: number;
  lastSentAt: number;
  state: PendingState;
  detail: string | null;
  intent: SendIntent;
  /** When a full-history status check past expiry first came back null; `expired` needs a second one ≥ 2 s later. */
  expiryNullSeenAt: number | null;
}

/** What leaves the background: everything but the signed bytes. */
export type PendingView = Omit<PendingRecord, 'wire'>;

export const MAX_RECORDS = 20;

export const isOpen = (r: PendingRecord): boolean => r.state === 'pending' || r.state === 'stuck';

const serial = createMutex();

export async function readPending(ext: Ext): Promise<PendingRecord[]> {
  const v = await ext.local.get(PENDING_KEY);
  return Array.isArray(v) ? (v as PendingRecord[]) : [];
}

export function inFlightFor(records: readonly PendingRecord[], account: string): PendingRecord | undefined {
  return records.find(r => r.account === account && isOpen(r));
}

export function viewOf(r: PendingRecord): PendingView {
  return {
    id: r.id,
    account: r.account,
    signature: r.signature,
    lastValidBlockHeight: r.lastValidBlockHeight,
    createdAt: r.createdAt,
    lastSentAt: r.lastSentAt,
    state: r.state,
    detail: r.detail,
    intent: r.intent,
    expiryNullSeenAt: r.expiryNullSeenAt,
  };
}

/** Every open record, plus the newest closed ones up to MAX_RECORDS in all. */
function trim(records: PendingRecord[]): PendingRecord[] {
  const openCount = records.filter(isOpen).length;
  const closed = records.filter(r => !isOpen(r));
  const keepClosed = new Set(closed.slice(Math.max(0, closed.length - Math.max(0, MAX_RECORDS - openCount))));
  return records.filter(r => isOpen(r) || keepClosed.has(r));
}

/** The one way records change: read, change, trim, write — serialised. */
export async function updatePending(ext: Ext, change: (records: PendingRecord[]) => PendingRecord[]): Promise<PendingRecord[]> {
  return serial(async () => {
    const next = trim(change(await readPending(ext)));
    await ext.local.set(PENDING_KEY, next);
    return next;
  });
}
```

`extension/src/background/prepare.ts`:
```ts
import {PublicKey, TransactionMessage, VersionedTransaction, type TransactionInstruction} from '@solana/web3.js';
import {base64} from '@scure/base';
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {PREPARED_KEY, getSession} from './session';
import {inFlightFor, readPending} from './pendingStore';
import {EXTENSION_FEE_INPUTS} from './feePolicy';
import {knownRecipients} from './knownRecipients';
import {readSettings} from './settings';
import {sendReauthReasons, usdMicros, type SendReauthReason} from './reauthPolicy';
import {issueChallenge} from './reauthChallenges';
import {digestOf, randomId} from './digest';
import {createMutex} from './mutex';
import {SendRefused, type SendIntent} from './sendTypes';
import {estimatePriorityFee} from '../../../core/solana/priorityFee';
import {
  InsufficientTokenBalance,
  SYSTEM_ACCOUNT_RENT_LAMPORTS,
  SplitTokenBalance,
  TOKEN_ACCOUNT_RENT_LAMPORTS,
  buildSolTransferInstructions,
  buildSplTransferInstructions,
  computeUnitLimitFor,
  findAssociatedTokenAddress,
  networkFeeLamports,
  priorityFeeLamports,
  selectSourceTokenAccount,
  type Markup,
} from '../../../core/solana/transfer';
import {WALLET_TOKENS, type WalletToken} from '../../../core/solana/balances';
import {MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS, effectiveFee, type FeeReason} from '../../../core/fees/transferMarkup';
import type {Prices} from '../../../core/portfolio/value';
import {RpcForbidden} from '../../../core/solana/rpc';

/** Spec §3: after 30 s unconfirmed a transaction is simulated again — a prepared send older than that is re-prepared. */
export const PREPARED_TTL_MS = 30_000;
export const MAX_PREPARED = 5;
const MAX_U64 = 18_446_744_073_709_551_615n;
const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];

export interface PreparedSend {
  id: string;
  account: string;
  intent: SendIntent;
  /** The unsigned v0 message, base64 — exactly what will be signed. */
  message: string;
  lastValidBlockHeight: number;
  createdAt: number;
  /** Binds a re-auth challenge to this exact message. */
  digest: string;
  challengeId: string | null;
}

export interface PreparedView {
  id: string;
  fees: {networkLamports: string; priorityLamports: string; rentLamports: string; markupLamports: string; markupReason: FeeReason};
  solRequiredLamports: string;
  reauth: {challengeId: string; reasons: SendReauthReason[]} | null;
}

const serial = createMutex();

export function isAddress(x: unknown): x is string {
  if (typeof x !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x)) return false;
  try {
    return new PublicKey(x).toBase58() === x;
  } catch {
    return false;
  }
}

/** Page-supplied input is hostile until checked: a wallet token, an address, a positive u64 amount. */
export function parseIntent(x: unknown): SendIntent | null {
  if (typeof x !== 'object' || x === null) return null;
  const {token, recipient, amount} = x as Record<string, unknown>;
  if (typeof token !== 'string' || !TOKENS.includes(token)) return null;
  if (!isAddress(recipient)) return null;
  if (typeof amount !== 'string' || !/^[1-9]\d{0,19}$/.test(amount) || BigInt(amount) > MAX_U64) return null;
  return {token: token as WalletToken, recipient, amount};
}

/**
 * USD per whole token for the dollar re-auth rule. NOC has no market price; it is valued at the
 * current presale stage price (owner decision B). A price that cannot be read is `undefined`, which
 * the rule counts as above the threshold (fail closed) — but a 403 is never swallowed.
 */
async function unitPrice(deps: WalletDeps, token: WalletToken): Promise<number | undefined> {
  try {
    if (token === 'NOC') return (await deps.stagePrice()) ?? undefined;
    const prices: Prices = await deps.prices();
    if (token === 'SOL') return prices.solana;
    return token === 'USDC' ? prices.usdc : prices.usdt;
  } catch (e) {
    if (e instanceof RpcForbidden) throw e;
    return undefined;
  }
}

async function loadPrepared(ext: Ext): Promise<PreparedSend[]> {
  const v = await ext.session.get(PREPARED_KEY);
  return Array.isArray(v) ? (v as PreparedSend[]) : [];
}

export async function prepareSend(ext: Ext, deps: WalletDeps, account: string, intent: SendIntent): Promise<PreparedView> {
  const session = await getSession(ext);
  if (session === null) throw new SendRefused('locked');
  if (!session.some(a => a.publicKey === account)) throw new SendRefused('unknown-account');
  // One in-flight send per account: nothing new is built while an earlier one may still land.
  if (inFlightFor(await readPending(ext), account) !== undefined) throw new SendRefused('in-flight');

  const sender = new PublicKey(account);
  const recipient = new PublicKey(intent.recipient);
  const amount = BigInt(intent.amount);
  const token = WALLET_TOKENS[intent.token];
  const fee = effectiveFee(TRANSFER_MARKUP_LAMPORTS, EXTENSION_FEE_INPUTS);
  const markup: Markup | null = fee.lamports > 0n ? {lamports: fee.lamports, treasury: new PublicKey(MAINNET_FEE_TREASURY)} : null;
  const [price, latest, solBalance] = await Promise.all([
    estimatePriorityFee(deps.reader, 'normal'),
    deps.reader.getLatestBlockhash(),
    deps.reader.getBalance(account),
  ]);

  let instructions: TransactionInstruction[];
  let computeUnitLimit: number;
  let rent = 0n;
  let tokenBalance: bigint;
  let recipientExists = true;
  if (token.mint === null) {
    recipientExists = await deps.reader.getAccountExists(intent.recipient);
    computeUnitLimit = computeUnitLimitFor({kind: 'sol'});
    instructions = buildSolTransferInstructions({sender, recipient, lamports: amount, priorityFee: price, computeUnitLimit, markup});
    tokenBalance = solBalance;
  } else {
    const mint = new PublicKey(token.mint);
    const holdings = await deps.reader.getTokenAccountsByOwner(account, {mint: token.mint});
    tokenBalance = holdings.reduce((sum, h) => sum + h.amount, 0n);
    let source: string | null;
    try {
      source = selectSourceTokenAccount(holdings.map(h => ({pubkey: h.pubkey, amount: h.amount})), amount);
    } catch (e) {
      if (e instanceof SplitTokenBalance) throw new SendRefused('split-balance', e.message);
      if (e instanceof InsufficientTokenBalance) throw new SendRefused('insufficient-token', e.message);
      throw e;
    }
    if (source === null) throw new SendRefused('insufficient-token', 'This account holds none of this token.');
    const createAta = !(await deps.reader.getAccountExists(findAssociatedTokenAddress(recipient, mint).toBase58()));
    rent = createAta ? TOKEN_ACCOUNT_RENT_LAMPORTS : 0n;
    computeUnitLimit = computeUnitLimitFor({kind: 'spl', createAta});
    instructions = buildSplTransferInstructions({
      sender,
      recipient,
      mint,
      amount,
      decimals: token.decimals,
      priorityFee: price,
      computeUnitLimit,
      createAta,
      sourceTokenAccount: new PublicKey(source),
      markup,
    });
  }

  const message = new TransactionMessage({payerKey: sender, recentBlockhash: latest.blockhash, instructions}).compileToV0Message();
  const networkLamports = networkFeeLamports(message.header.numRequiredSignatures, price, computeUnitLimit);
  const priorityLamports = priorityFeeLamports(price, computeUnitLimit);
  const markupLamports = markup?.lamports ?? 0n;
  const solRequired = (token.mint === null ? amount : 0n) + networkLamports + rent + markupLamports;
  if (solRequired > solBalance) throw new SendRefused('insufficient-sol', `${solRequired} lamports needed, ${solBalance} held`);
  // Rent-exempt minimums (review M4): the runtime refuses a transfer that leaves the sender with
  // 1…889 879 lamports, or creates a system account with less than 890 880 — refuse it here, with a
  // reason, rather than as an opaque simulation failure.
  const remainder = solBalance - solRequired;
  if (remainder > 0n && remainder < SYSTEM_ACCOUNT_RENT_LAMPORTS) {
    throw new SendRefused('sender-below-rent', `${remainder} lamports would remain; keep at least ${SYSTEM_ACCOUNT_RENT_LAMPORTS} or send everything`);
  }
  if (!recipientExists && amount < SYSTEM_ACCOUNT_RENT_LAMPORTS) {
    throw new SendRefused('recipient-below-rent', `a new account needs at least ${SYSTEM_ACCOUNT_RENT_LAMPORTS} lamports`);
  }

  const simulation = await deps.reader.simulateTransaction(base64.encode(new VersionedTransaction(message).serialize()));
  if (simulation.err !== null) throw new SendRefused('simulation-failed', JSON.stringify(simulation.err));

  const knownRecipient = session.some(a => a.publicKey === intent.recipient) || (await knownRecipients(ext)).has(intent.recipient);
  const settings = await readSettings(ext);
  const reasons = sendReauthReasons({
    knownRecipient,
    amount,
    balance: tokenBalance,
    usdMicros: usdMicros(amount, token.decimals, await unitPrice(deps, intent.token)),
    thresholdCents: settings.reauthUsdCents,
  });

  const messageB64 = base64.encode(message.serialize());
  const digest = digestOf({kind: 'send', account, token: intent.token, recipient: intent.recipient, amount: intent.amount, message: messageB64});
  const challengeId = reasons.length > 0 ? await issueChallenge(ext, deps, digest) : null;
  const prepared: PreparedSend = {
    id: randomId(deps.randomBytes),
    account,
    intent,
    message: messageB64,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    createdAt: deps.now(),
    digest,
    challengeId,
  };
  await serial(async () => {
    const now = deps.now();
    const keep = (await loadPrepared(ext)).filter(p => p.account !== account && now - p.createdAt < PREPARED_TTL_MS).slice(-(MAX_PREPARED - 1));
    await ext.session.set(PREPARED_KEY, [...keep, prepared]);
  });
  return {
    id: prepared.id,
    fees: {
      networkLamports: networkLamports.toString(),
      priorityLamports: priorityLamports.toString(),
      rentLamports: rent.toString(),
      markupLamports: markupLamports.toString(),
      markupReason: fee.reason,
    },
    solRequiredLamports: solRequired.toString(),
    reauth: challengeId === null ? null : {challengeId, reasons},
  };
}

export async function peekPrepared(ext: Ext, id: string): Promise<PreparedSend | null> {
  return (await loadPrepared(ext)).find(p => p.id === id) ?? null;
}

/** Single use: removed as it is taken, so a second "Send" with the same id finds nothing. */
export async function takePrepared(ext: Ext, deps: Pick<WalletDeps, 'now'>, id: string): Promise<PreparedSend> {
  return serial(async () => {
    const all = await loadPrepared(ext);
    const found = all.find(p => p.id === id);
    if (found === undefined) throw new SendRefused('unknown-prepared');
    await ext.session.set(PREPARED_KEY, all.filter(p => p.id !== id));
    if (deps.now() - found.createdAt >= PREPARED_TTL_MS) throw new SendRefused('prepared-expired');
    return found;
  });
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `cd extension && npx vitest run pendingStore.test prepare.test && npx tsc --noEmit`
Expected: PASS; tsc 0.

- [ ] **Step 5: Mutation checks**

1. Delete the `inFlightFor(…)` line in `prepareSend` → "refuses while a send … is in flight — without a single network call" fails (`unexpected RPC call`).
2. Delete `+ rent` from `solRequired` → the SPL test's `solRequiredLamports` expectation fails (`8250`), i.e. the rent would not be shown up front.
3. In `takePrepared`, drop the `ext.session.set(PREPARED_KEY, …filter…)` line → "taking is single use" fails.
3a. Change `remainder > 0n &&` to `remainder >= 0n &&` → "not one that empties it" fails; delete the `recipient-below-rent` check → its test fails.
3b. In `unitPrice`, return `undefined` for NOC → the stage-price test fails (`over-usd-threshold`); drop the `RpcForbidden` rethrow → the 403 expectation fails.
4. Replace `EXTENSION_FEE_INPUTS` with `{tgeStatus: 'claimable', isZeroFeeEligible: false, stakingDiscount: 0}` → the positive control fails (`markupLamports: '20000'`) — proving the fee line comes from the core policy.

- [ ] **Step 6: Commit**

```bash
git add extension/src/background/sendTypes.ts extension/src/background/feePolicy.ts extension/src/background/pendingStore.ts extension/src/background/prepare.ts extension/src/background/__tests__/fixtures.ts extension/src/background/__tests__/pendingStore.test.ts extension/src/background/__tests__/prepare.test.ts
git commit -m "feat(extension): prepare a send — build, simulate, price, decide re-authentication

Refuses cheaply first (locked, unknown account, a send in flight), spends from the largest
holding, shows ATA rent and the fee lines up front, and binds any re-auth challenge to the
exact message that will be signed.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 8: Sending — sign, broadcast, pending → confirmed / failed / stuck / expired, never a double spend

**Files:**
- Create: `extension/src/background/pending.ts`, `extension/src/background/send.ts`
- Test: `extension/src/background/__tests__/pending.test.ts`, `extension/src/background/__tests__/send.test.ts`
- (No change to `autolock.ts`: pending records are in `storage.local`, and `lock()` keeps clearing `storage.session` exactly as B1a wrote it.)

**Interfaces:**
- Consumes: `pendingStore.ts`, `sendTypes.ts`, `prepare.ts` (`peekPrepared`, `takePrepared`, `PreparedSend`) from Task 7; `challengeSatisfied`, `consumeChallenge`, `addKnownRecipient` (Task 6); `firstSignature`, `BroadcastRejected`, `BroadcastSubstituted` (Task 5); `RpcForbidden`, `SignatureStatus` (Task 1); `armAutolock` (B1a).
- Produces:
  - `pending.ts`: `POLL_INTERVAL_MS = 2_000`, `STUCK_AFTER_MS = 90_000`, `RESEND_MIN_INTERVAL_MS = 2_000`, `NOT_CONFIRMED = 'Not confirmed — no funds moved.'`, `EXPIRY_MARGIN_BLOCKS = 32`, `PENDING_ALARM = 'pending-poll'`, `PENDING_ALARM_MINUTES = 0.5`; `submitSigned(ext, deps, input: {account: string; wire: Uint8Array; lastValidBlockHeight: number; intent: SendIntent}): Promise<PendingView>`; `resend(ext, deps, id: string): Promise<PendingView>`; `pollOnce(ext, deps): Promise<boolean>` (true while anything is open); `startPoller(ext, deps): Promise<void>` (idempotent per `ext`); `armPendingAlarm(ext): Promise<void>`; `onPendingAlarm(ext, deps): Promise<void>`
  - `send.ts`: `signPrepared(prepared: PreparedSend, account: SessionAccount): Uint8Array`; `sendPrepared(ext, deps, id: string): Promise<PendingView>`

The rules, from spec §4 and the brief, with where each is enforced:
- the record is written to `storage.local` (`v1_pending`, owner decision A) **before** the broadcast (a service worker stopped in between still knows the transaction exists) — `submitSigned`;
- one open record per account — `submitSigned` checks inside the serialised update, so two racing sends cannot both pass;
- "send again" re-sends **the same bytes** (same signature — idempotent), never faster than every 2 s — `resend`;
- polling every ≥ 2 s with `getSignatureStatuses`; an on-chain `err` is `failed` ("the network fee was paid, nothing was sent"); `getBlockHeight` failing skips that round's expiry check; `expired` ("Not confirmed — no funds moved.") only when the height is past `lastValidBlockHeight + EXPIRY_MARGIN_BLOCKS` (32 — the heights come from the coordinator's RPC and nodes disagree by a few slots) **and** a status check **with full history** is null in two rounds at least 2 s apart (`expiryNullSeenAt`; review H3) — the app's `findLandedSignature` rule, made stricter; > 90 s is `stuck` and keeps polling — `pollOnce`;
- an MV3 service worker may be stopped between polls: a 30 s `alarms` tick (the `alarms` permission is already held) calls `pollOnce` while any record is open and no loop is running (review M5) — `armPendingAlarm`/`onPendingAlarm`;
- a first broadcast refused by the route (400) or by a 403 is `failed` (nothing was forwarded); a refused *re*-send changes nothing but the detail, because the first copy may already have landed; "not acknowledged" stays pending — `deliver`;
- a confirmed send adds its recipient to the known recipients (first-send detection) — `pollOnce`;
- a lock does not touch `v1_pending` (it is in `storage.local`), and every change to it goes through the pendingStore mutex (`updatePending`).

- [ ] **Step 1: Write the failing tests**

`extension/src/background/__tests__/pending.test.ts`:
```ts
import {SESSION_KEY} from '../session';
import {
  EXPIRY_MARGIN_BLOCKS, NOT_CONFIRMED, PENDING_ALARM, PENDING_ALARM_MINUTES, POLL_INTERVAL_MS, RESEND_MIN_INTERVAL_MS, STUCK_AFTER_MS,
  onPendingAlarm, pollOnce, resend, startPoller, submitSigned,
} from '../pending';
import {PENDING_KEY, readPending} from '../pendingStore';
import {knownRecipients} from '../knownRecipients';
import {lock} from '../autolock';
import type {WalletDeps} from '../deps';
import {BroadcastRejected, BroadcastUnavailable, firstSignature} from '../../../../core/solana/broadcast';
import type {SignatureStatus} from '../../../../core/solana/rpc';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire, unlocked} from './fixtures';

const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1'};
const confirmed: SignatureStatus = {err: null, confirmationStatus: 'confirmed'};
/** Past lastValidBlockHeight (1000) by more than the 32-block margin — literal, so a changed margin shows. */
const EXPIRED_HEIGHT = 1033;

/** Deps whose broadcast route accepts and echoes the signature, recording the bytes. */
function depsWith(over: Partial<WalletDeps> = {}) {
  const d = fakeDeps(over);
  if (over.broadcast === undefined) {
    d.broadcast = async wire => {
      d.broadcasts.push(wire);
      return firstSignature(wire);
    };
  }
  return d;
}

async function submitted(over: Partial<WalletDeps> = {}) {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = depsWith(over);
  const view = await submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT});
  return {ext, deps, view};
}

/** A reader where the transaction is never seen and the chain is at `height`; records the history flag of each status call. */
function unseenAt(height: number, asked: (boolean | undefined)[] = []) {
  return fakeReader({
    getSignatureStatuses: async (sigs, history) => (asked.push(history), sigs.map(() => null)),
    getBlockHeight: async () => height,
  });
}

describe('submitSigned', () => {
  it('writes the record (storage.local) before broadcasting, then leaves it pending (positive control)', async () => {
    const ext = fakeExt();
    const seen: number[] = [];
    const deps = depsWith();
    deps.broadcast = async wire => {
      seen.push((await readPending(ext)).length);
      return firstSignature(wire);
    };
    const view = await submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT});
    expect(seen).toEqual([1]);
    expect(await ext.local.get(PENDING_KEY)).toHaveLength(1);
    expect(view).toMatchObject({state: 'pending', detail: null, expiryNullSeenAt: null, signature: firstSignature(signedWire())});
    expect('wire' in view).toBe(false);
  });

  it('arms the 30 s pending alarm', async () => {
    const {ext} = await submitted();
    expect(ext.alarmsSet.get(PENDING_ALARM)).toBe(PENDING_ALARM_MINUTES);
  });

  it('allows one open send per account — a second is refused and never broadcast', async () => {
    const {ext, deps} = await submitted();
    await expect(submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(2n), lastValidBlockHeight: 1000, intent: INTENT})).rejects.toMatchObject({code: 'in-flight'});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('a first broadcast refused by the route is failed — nothing was forwarded', async () => {
    const {view} = await submitted({
      broadcast: async () => {
        throw new BroadcastRejected('rejected', 'Blockhash not found');
      },
    });
    expect(view.state).toBe('failed');
    expect(view.detail).toContain('No funds moved');
  });

  it('a broadcast that is not acknowledged stays pending and says so', async () => {
    const {view} = await submitted({
      broadcast: async () => {
        throw new BroadcastUnavailable(502);
      },
    });
    expect(view.state).toBe('pending');
    expect(view.detail).toContain('same transaction');
  });
});

describe('pollOnce', () => {
  it('confirmed: the state, and the recipient becomes known', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900});
    expect(await pollOnce(ext, deps)).toBe(false);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
    expect((await knownRecipients(ext)).has(RECIPIENT)).toBe(true);
  });

  it('landed but failed: failed, and the fee was paid', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({getSignatureStatuses: async () => [{err: {InstructionError: [0, 'x']}, confirmationStatus: 'confirmed'}], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'failed'});
    expect((await readPending(ext))[0]?.detail).toContain('network fee was paid');
  });

  it('within the margin past lastValidBlockHeight: no expiry check at all', async () => {
    const {ext, deps} = await submitted();
    const asked: (boolean | undefined)[] = [];
    expect(EXPIRY_MARGIN_BLOCKS).toBe(32);
    deps.reader = unseenAt(1032, asked);
    expect(await pollOnce(ext, deps)).toBe(true);
    expect(asked).toEqual([undefined]);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: null});
  });

  it('past the margin: the first null full-history answer only marks it; a second ≥ 2 s later expires it — no funds moved', async () => {
    const {ext, deps} = await submitted();
    const asked: (boolean | undefined)[] = [];
    deps.reader = unseenAt(EXPIRED_HEIGHT, asked);
    expect(await pollOnce(ext, deps)).toBe(true);
    expect(asked).toEqual([undefined, true]);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: deps.now()});
    deps.clock.t += POLL_INTERVAL_MS - 1;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('pending');
    deps.clock.t += 1;
    expect(await pollOnce(ext, deps)).toBe(false);
    expect((await readPending(ext))[0]).toMatchObject({state: 'expired', detail: NOT_CONFIRMED});
  });

  it('past the margin but found in the full history on the second round: confirmed, not expired', async () => {
    const {ext, deps} = await submitted();
    deps.reader = unseenAt(EXPIRED_HEIGHT);
    await pollOnce(ext, deps);
    deps.clock.t += POLL_INTERVAL_MS;
    deps.reader = fakeReader({
      getSignatureStatuses: async (sigs, history) => (history === true ? [confirmed] : sigs.map(() => null)),
      getBlockHeight: async () => EXPIRED_HEIGHT,
    });
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
  });

  it('a getBlockHeight failure skips the expiry check for that round', async () => {
    const {ext, deps} = await submitted();
    let statusCalls = 0;
    deps.reader = fakeReader({
      getSignatureStatuses: async sigs => (statusCalls++, sigs.map(() => null)),
      getBlockHeight: async () => {
        throw new Error('hiccup');
      },
    });
    expect(await pollOnce(ext, deps)).toBe(true);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: null});
    expect(statusCalls).toBe(1);
  });

  it('a status failure changes nothing', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({
      getSignatureStatuses: async () => {
        throw new Error('down');
      },
    });
    expect(await pollOnce(ext, deps)).toBe(true);
    expect((await readPending(ext))[0]?.state).toBe('pending');
  });

  it('stuck after 90 s, still watched — and a stuck send can still confirm', async () => {
    const {ext, deps} = await submitted();
    deps.reader = unseenAt(900);
    deps.clock.t += STUCK_AFTER_MS;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('pending');
    deps.clock.t += 1;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('stuck');
    deps.reader = fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
  });
});

describe('resend', () => {
  it('re-sends exactly the same bytes — same signature — never a new transaction', async () => {
    const {ext, deps, view} = await submitted();
    deps.clock.t += RESEND_MIN_INTERVAL_MS;
    const again = await resend(ext, deps, view.id);
    expect(deps.broadcasts).toHaveLength(2);
    expect([...deps.broadcasts[1]!]).toEqual([...deps.broadcasts[0]!]);
    expect(again.signature).toBe(view.signature);
  });

  it('refuses a resend within 2 s, after the send closed, and for an unknown id', async () => {
    const {ext, deps, view} = await submitted();
    await expect(resend(ext, deps, view.id)).rejects.toMatchObject({code: 'too-soon'});
    await expect(resend(ext, deps, 'nope')).rejects.toMatchObject({code: 'unknown'});
    deps.reader = unseenAt(EXPIRED_HEIGHT);
    await pollOnce(ext, deps);
    deps.clock.t += POLL_INTERVAL_MS;
    await pollOnce(ext, deps);
    await expect(resend(ext, deps, view.id)).rejects.toMatchObject({code: 'not-open'});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('a refused RE-send does not mark the send failed — the first copy may already have landed', async () => {
    const {ext, deps, view} = await submitted();
    deps.broadcast = async () => {
      throw new BroadcastRejected('rejected', 'already processed');
    };
    deps.clock.t += RESEND_MIN_INTERVAL_MS;
    expect((await resend(ext, deps, view.id)).state).toBe('pending');
  });
});

describe('startPoller and the alarm', () => {
  it('polls every 2 s until nothing is open, and never runs twice at once', async () => {
    const sleeps: number[] = [];
    let round = 0;
    const {ext, deps} = await submitted({
      sleep: async ms => void sleeps.push(ms),
      reader: fakeReader({getSignatureStatuses: async sigs => (round++ === 0 ? sigs.map(() => null) : [confirmed]), getBlockHeight: async () => 900}),
    });
    const a = startPoller(ext, deps);
    expect(startPoller(ext, deps)).toBe(a);
    await a;
    expect(POLL_INTERVAL_MS).toBe(2_000);
    expect(sleeps.every(ms => ms === POLL_INTERVAL_MS)).toBe(true);
    expect(sleeps.length).toBeGreaterThanOrEqual(2);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
  });

  it('the alarm polls while no loop runs, re-arms while anything is open, and clears itself after', async () => {
    // A service worker that restarted with a record open: nothing is polling in this context.
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: firstSignature(signedWire())})]);
    const deps = depsWith({reader: unseenAt(900)});
    await onPendingAlarm(ext, deps);
    expect(ext.alarmsSet.get(PENDING_ALARM)).toBe(PENDING_ALARM_MINUTES);
    deps.reader = fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900});
    await onPendingAlarm(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
    expect(ext.alarmsSet.has(PENDING_ALARM)).toBe(false);
  });
});

describe('lock and pending sends (owner decision A)', () => {
  it('a lock clears storage.session and leaves v1_pending in storage.local intact', async () => {
    const {ext} = await submitted();
    await ext.session.set('v1_prepared', [{id: 'x'}]);
    const before = await ext.local.get(PENDING_KEY);
    await lock(ext);
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
    expect(await ext.session.get('v1_prepared')).toBeUndefined();
    expect(await ext.local.get(PENDING_KEY)).toEqual(before);
  });
});
```

`extension/src/background/__tests__/send.test.ts`:
```ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {sendPrepared} from '../send';
import {peekPrepared, prepareSend, PREPARED_TTL_MS} from '../prepare';
import {challengeSatisfied, consumeChallenge, satisfyChallenge} from '../reauthChallenges';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {AUTOLOCK_ALARM} from '../autolock';
import {firstSignature} from '../../../../core/solana/broadcast';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, PUB, RECIPIENT, sendReader, unlocked} from './fixtures';

const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};

async function setup(known: boolean) {
  const ext = fakeExt();
  await unlocked(ext);
  if (known) await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  const deps = fakeDeps({reader: sendReader()});
  deps.broadcast = async wire => {
    deps.broadcasts.push(wire);
    return firstSignature(wire);
  };
  const view = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
  return {ext, deps, view};
}

describe('sendPrepared', () => {
  it('signs the prepared message with the session key and broadcasts it (positive control)', async () => {
    const {ext, deps, view} = await setup(true);
    const sent = await sendPrepared(ext, deps, view.id);
    const tx = VersionedTransaction.deserialize(deps.broadcasts[0]!);
    expect(ed25519.verify(tx.signatures[0]!, tx.message.serialize(), PUB)).toBe(true);
    expect(sent.signature).toBe(base58.encode(tx.signatures[0]!));
    expect(sent.state).toBe('pending');
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(true);
  });

  it('refuses before re-authentication without burning the prepared send, then sends once it is proven', async () => {
    const {ext, deps, view} = await setup(false);
    const challengeId = view.reauth!.challengeId;
    const {digest} = (await peekPrepared(ext, view.id))!;
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'reauth-required', detail: challengeId});
    expect(await peekPrepared(ext, view.id)).not.toBeNull();
    expect(deps.broadcasts).toHaveLength(0);
    await satisfyChallenge(ext, deps.now(), challengeId);
    expect((await sendPrepared(ext, deps, view.id)).state).toBe('pending');
    expect(await peekPrepared(ext, view.id)).toBeNull();
    // Consumed: the same proof cannot authorise anything again.
    expect(await challengeSatisfied(ext, deps.now(), challengeId, digest)).toBe(false);
    expect(await consumeChallenge(ext, deps.now(), challengeId, digest)).toBe(false);
  });

  it('a prepared send is single use: a second Send finds nothing', async () => {
    const {ext, deps, view} = await setup(true);
    await sendPrepared(ext, deps, view.id);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'unknown-prepared'});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('refuses an expired prepared send as prepared-expired (the caller re-prepares) and a locked wallet', async () => {
    const {ext, deps, view} = await setup(true);
    deps.clock.t += PREPARED_TTL_MS;
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'prepared-expired'});
    await expect(sendPrepared(fakeExt(), deps, 'x')).rejects.toMatchObject({code: 'locked'});
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd extension && npx vitest run pending.test send.test`
Expected: FAIL — missing `../pending`, `../send`.

- [ ] **Step 3: Write the implementations**

`extension/src/background/pending.ts`:
```ts
import {base64} from '@scure/base';
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {addKnownRecipient} from './knownRecipients';
import {randomId} from './digest';
import {inFlightFor, isOpen, readPending, updatePending, viewOf, type PendingRecord, type PendingView} from './pendingStore';
import {ResendRefused, SendRefused, type ResendRefusal, type SendIntent} from './sendTypes';
import {BroadcastRejected, BroadcastSubstituted, firstSignature} from '../../../core/solana/broadcast';
import {RpcForbidden, type SignatureStatus} from '../../../core/solana/rpc';

/** ≥ 2 s: the proxy's request budget, and CrowdSec (spec §4). */
export const POLL_INTERVAL_MS = 2_000;
/** Spec §4: pending past ~90 s goes to the stuck-transaction screen (#54). */
export const STUCK_AFTER_MS = 90_000;
/** "Send again" cannot be pressed twice in a row (spec §4, #54). */
export const RESEND_MIN_INTERVAL_MS = 2_000;
/**
 * Blocks past lastValidBlockHeight before expiry is even considered: the height comes from the
 * coordinator's RPC, and the node that would still accept the transaction may be a few blocks behind.
 */
export const EXPIRY_MARGIN_BLOCKS = 32;
export const NOT_CONFIRMED = 'Not confirmed — no funds moved.';
/** A service worker may be stopped between polls: this alarm (30 s, the browsers' minimum) picks it up. */
export const PENDING_ALARM = 'pending-poll';
export const PENDING_ALARM_MINUTES = 0.5;

type Update = Partial<Pick<PendingRecord, 'state' | 'detail' | 'expiryNullSeenAt'>>;

async function patch(ext: Ext, id: string, change: (r: PendingRecord) => PendingRecord): Promise<void> {
  await updatePending(ext, records => records.map(r => (r.id === id && isOpen(r) ? change(r) : r)));
}

export async function armPendingAlarm(ext: Ext): Promise<void> {
  await ext.alarms.create(PENDING_ALARM, {delayInMinutes: PENDING_ALARM_MINUTES});
}

/**
 * Hand the signed bytes to the broadcast route. On a first attempt, a refusal (400) or a 403 means
 * nothing was forwarded: failed. On a re-send the first copy may already have landed, so only the
 * detail changes. "Not acknowledged" is never failure: the poller decides.
 */
async function deliver(ext: Ext, deps: WalletDeps, record: PendingRecord, attempt: 'first' | 'again'): Promise<void> {
  try {
    await deps.broadcast(base64.decode(record.wire));
    await patch(ext, record.id, r => ({...r, detail: null}));
  } catch (e) {
    if (attempt === 'first' && e instanceof BroadcastRejected) {
      await patch(ext, record.id, r => ({...r, state: 'failed', detail: `The network refused this transaction (${e.reason}: ${e.detail}). No funds moved.`}));
    } else if (attempt === 'first' && e instanceof RpcForbidden) {
      await patch(ext, record.id, r => ({...r, state: 'failed', detail: 'The coordinator refused the broadcast (HTTP 403). No funds moved; not retried.'}));
    } else if (e instanceof BroadcastSubstituted) {
      await patch(ext, record.id, r => ({...r, detail: 'The coordinator answered with another signature; watching this transaction’s own signature.'}));
    } else {
      await patch(ext, record.id, r => ({...r, detail: 'Not acknowledged yet; still watching. "Send again" re-sends the same transaction.'}));
    }
  }
}

export async function submitSigned(
  ext: Ext,
  deps: WalletDeps,
  input: {account: string; wire: Uint8Array; lastValidBlockHeight: number; intent: SendIntent},
): Promise<PendingView> {
  const now = deps.now();
  const record: PendingRecord = {
    id: randomId(deps.randomBytes),
    account: input.account,
    signature: firstSignature(input.wire),
    wire: base64.encode(input.wire),
    lastValidBlockHeight: input.lastValidBlockHeight,
    createdAt: now,
    lastSentAt: now,
    state: 'pending',
    detail: null,
    intent: input.intent,
    expiryNullSeenAt: null,
  };
  const guard = {refused: false};
  await updatePending(ext, records => {
    if (inFlightFor(records, input.account) !== undefined) {
      guard.refused = true;
      return records;
    }
    return [...records, record];
  });
  if (guard.refused) throw new SendRefused('in-flight');
  // Written above BEFORE the broadcast below: a service worker stopped in between still knows it.
  await armPendingAlarm(ext);
  await deliver(ext, deps, record, 'first');
  void startPoller(ext, deps);
  return viewOf((await readPending(ext)).find(r => r.id === record.id) ?? record);
}

/** "Send again": the same signed bytes, so the same signature — it can land at most once. */
export async function resend(ext: Ext, deps: WalletDeps, id: string): Promise<PendingView> {
  const out: {record?: PendingRecord; refusal?: ResendRefusal} = {};
  await updatePending(ext, records =>
    records.map(r => {
      if (r.id !== id) return r;
      if (!isOpen(r)) {
        out.refusal = 'not-open';
        return r;
      }
      if (deps.now() - r.lastSentAt < RESEND_MIN_INTERVAL_MS) {
        out.refusal = 'too-soon';
        return r;
      }
      out.record = {...r, lastSentAt: deps.now()};
      return out.record;
    }),
  );
  if (out.record === undefined) throw new ResendRefused(out.refusal ?? 'unknown');
  await deliver(ext, deps, out.record, 'again');
  void startPoller(ext, deps);
  const current = (await readPending(ext)).find(r => r.id === id) ?? out.record;
  return viewOf(current);
}

/** Check err FIRST: a landed-but-failed transaction also carries a confirmationStatus. */
function landed(s: SignatureStatus | null): 'confirmed' | 'failed' | null {
  if (s === null) return null;
  if (s.err !== null) return 'failed';
  return s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized' ? 'confirmed' : null;
}

const failedDetail = (err: unknown): string => `Landed but failed (${JSON.stringify(err)}): the network fee was paid, nothing was sent.`;

/** One polling round over every open record. True while anything is still open. */
export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
  const open = (await readPending(ext)).filter(isOpen);
  if (open.length === 0) return false;
  let statuses: (SignatureStatus | null)[];
  try {
    statuses = await deps.reader.getSignatureStatuses(open.map(r => r.signature));
  } catch {
    return true; // nothing learned this round; a 403 has tripped the latch, and the next round is ≥ 2 s away
  }
  let height: number | null;
  try {
    height = await deps.reader.getBlockHeight();
  } catch {
    height = null; // the app's rule: a hiccup skips the expiry check this round
  }
  const now = deps.now();
  const updates = new Map<string, Update>();
  for (const [i, r] of open.entries()) {
    const s = statuses[i] ?? null;
    const verdict = landed(s);
    if (verdict === 'confirmed') {
      updates.set(r.id, {state: 'confirmed', detail: null});
    } else if (verdict === 'failed') {
      updates.set(r.id, {state: 'failed', detail: failedDetail(s?.err)});
    } else if (height !== null && height > r.lastValidBlockHeight + EXPIRY_MARGIN_BLOCKS) {
      // Past the blockhash's life, with margin, so this transaction can no longer land — but it may
      // have landed before. Ask with the full status history, and say "no funds moved" only after
      // that answer is null in two rounds at least POLL_INTERVAL_MS apart.
      let last: SignatureStatus | null;
      try {
        last = (await deps.reader.getSignatureStatuses([r.signature], true))[0] ?? null;
      } catch {
        continue;
      }
      const final = landed(last);
      if (final === 'confirmed') updates.set(r.id, {state: 'confirmed', detail: null});
      else if (final === 'failed') updates.set(r.id, {state: 'failed', detail: failedDetail(last?.err)});
      else if (r.expiryNullSeenAt !== null && now - r.expiryNullSeenAt >= POLL_INTERVAL_MS) updates.set(r.id, {state: 'expired', detail: NOT_CONFIRMED});
      else updates.set(r.id, {expiryNullSeenAt: r.expiryNullSeenAt ?? now});
    } else if (r.state === 'pending' && now - r.createdAt > STUCK_AFTER_MS) {
      updates.set(r.id, {state: 'stuck'});
    }
  }
  const after = await updatePending(ext, records =>
    records.map(r => {
      const u = updates.get(r.id);
      return u !== undefined && isOpen(r) ? {...r, ...u} : r;
    }),
  );
  for (const r of open) {
    if (updates.get(r.id)?.state === 'confirmed') await addKnownRecipient(ext, r.intent.recipient);
  }
  return after.some(isOpen);
}

const loops = new WeakMap<Ext, Promise<void>>();

/**
 * One polling loop per extension context, every POLL_INTERVAL_MS until nothing is open; a running
 * loop is returned, never doubled. A worker stopped anyway is picked up by the 30 s alarm
 * (onPendingAlarm), on its next start (index.ts) or on the next wallet.* message.
 */
export function startPoller(ext: Ext, deps: WalletDeps): Promise<void> {
  const running = loops.get(ext);
  if (running !== undefined) return running;
  const loop = (async () => {
    try {
      for (;;) {
        await deps.sleep(POLL_INTERVAL_MS);
        if (!(await pollOnce(ext, deps))) return;
      }
    } catch {
      // A storage failure: the alarm, the next wallet.* message or a service-worker start resumes polling.
    } finally {
      loops.delete(ext);
    }
  })();
  loops.set(ext, loop);
  return loop;
}

/**
 * The 30 s alarm: poll once if no loop is running (a running loop already polls every 2 s — two
 * pollers would break the ≥ 2 s rule), then re-arm while anything is open, or clear the alarm.
 */
export async function onPendingAlarm(ext: Ext, deps: WalletDeps): Promise<void> {
  let open = true;
  if (loops.has(ext)) open = (await readPending(ext)).some(isOpen);
  else {
    try {
      open = await pollOnce(ext, deps);
    } catch {
      open = true;
    }
  }
  if (open) await armPendingAlarm(ext);
  else await ext.alarms.clear(PENDING_ALARM);
}
```

`extension/src/background/send.ts`:
```ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {VersionedMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';
import type {WalletDeps} from './deps';
import {getSession} from './session';
import {armAutolock} from './autolock';
import {challengeSatisfied, consumeChallenge} from './reauthChallenges';
import {peekPrepared, takePrepared, type PreparedSend} from './prepare';
import {submitSigned} from './pending';
import type {PendingView} from './pendingStore';
import {SendRefused} from './sendTypes';

/** Sign exactly the prepared message, as its payer, with the session key; the key bytes are zeroed after. */
export function signPrepared(prepared: PreparedSend, account: SessionAccount): Uint8Array {
  const message = VersionedMessage.deserialize(base64.decode(prepared.message));
  const payer = message.staticAccountKeys[0];
  if (payer === undefined || payer.toBase58() !== account.publicKey) throw new SendRefused('unknown-account');
  const secret = base64.decode(account.secretKey);
  try {
    const tx = new VersionedTransaction(message);
    tx.addSignature(payer, ed25519.sign(message.serialize(), secret.subarray(0, 32)));
    return tx.serialize();
  } finally {
    secret.fill(0);
  }
}

export async function sendPrepared(ext: Ext, deps: WalletDeps, id: string): Promise<PendingView> {
  const session = await getSession(ext);
  if (session === null) throw new SendRefused('locked');
  const peek = await peekPrepared(ext, id);
  if (peek === null) throw new SendRefused('unknown-prepared');
  // Checked before the prepared send is taken, so a Send before re-authenticating does not burn it.
  if (peek.challengeId !== null && !(await challengeSatisfied(ext, deps.now(), peek.challengeId, peek.digest))) {
    throw new SendRefused('reauth-required', peek.challengeId);
  }
  const prepared = await takePrepared(ext, deps, id);
  if (prepared.challengeId !== null && !(await consumeChallenge(ext, deps.now(), prepared.challengeId, prepared.digest))) {
    throw new SendRefused('reauth-required');
  }
  const account = session.find(a => a.publicKey === prepared.account);
  if (account === undefined) throw new SendRefused('unknown-account');
  const view = await submitSigned(ext, deps, {
    account: prepared.account,
    wire: signPrepared(prepared, account),
    lastValidBlockHeight: prepared.lastValidBlockHeight,
    intent: prepared.intent,
  });
  await armAutolock(ext); // an approved signature resets the idle timer (spec §2)
  return view;
}
```

- [ ] **Step 3: Run the tests**

Run: `cd extension && npx vitest run src/background && npx tsc --noEmit`
Expected: PASS (all background tests, B1a's included); tsc 0.

- [ ] **Step 4: Mutation checks**

1. In `submitSigned`, move the `updatePending(…)` call after `deliver(…)` → "writes the record … before broadcasting" fails (`seen` is `[0]`).
2. In `resend`, rebuild instead of re-sending: replace `deliver(ext, deps, out.record, 'again')` with `deliver(ext, deps, {...out.record, wire: base64.encode(signedWire(2n))}, 'again')` (import the fixture temporarily) → "re-sends exactly the same bytes" fails.
3. Set `EXPIRY_MARGIN_BLOCKS = 0` → "within the margin … no expiry check at all" fails (a full-history call is made).
4. Drop the second-round requirement: replace the `expiryNullSeenAt` branch pair with `else updates.set(r.id, {state: 'expired', detail: NOT_CONFIRMED});` → "the first null full-history answer only marks it" fails (expired after one round).
5. Delete the full-history check (set `expired` whenever the margin is passed) → "found in the full history on the second round: confirmed" fails.
6. Change `height = null` in the `getBlockHeight` catch to `height = Number.MAX_SAFE_INTEGER` → "a getBlockHeight failure skips the expiry check" fails.
7. In `deliver`, drop `attempt === 'first' &&` from the `BroadcastRejected` branch → "a refused RE-send does not mark the send failed" fails.
8. Set `POLL_INTERVAL_MS = 500` → "polls every 2 s" fails.
9. In `onPendingAlarm`, replace `if (open) await armPendingAlarm(ext);` with `if (open) {}` → "the alarm … re-arms while anything is open" fails; delete `await armPendingAlarm(ext);` from `submitSigned` → "arms the 30 s pending alarm" fails.
10. In `sendPrepared`, drop the `challengeSatisfied` peek → "refuses before re-authentication without burning" fails (`unknown-prepared` on the second attempt, or a broadcast).

- [ ] **Step 5: Commit**

```bash
git add extension/src/background/pending.ts extension/src/background/send.ts extension/src/background/autolock.ts extension/src/background/__tests__/pending.test.ts extension/src/background/__tests__/send.test.ts
git commit -m "feat(extension): the send engine — pending until confirmed or expired, never a double spend

The record is written to storage.local before the broadcast; send-again re-sends the same
bytes; polling is every 2 s (plus a 30 s alarm); \"no funds moved\" needs the height past the
blockhash + 32 and two null full-history checks 2 s apart; one open send per account.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 9: The background wallet API — message types, partitions, deps, history, start-up

**Files:**
- Create: `extension/src/background/history.ts`, `extension/src/background/walletApi.ts`
- Modify: `extension/src/background/deps.ts` (add `PRICE_TTL_MS`, `createJsonGetter`, `browserDeps`)
- Modify: `extension/src/background/messages.ts` (partition list, vault-page-only types, `vault.reauthOk`, wallet dispatch, `deps` parameter)
- Modify: `extension/src/background/index.ts` (build deps, pass them, resume polling at start)
- Test: `extension/src/background/__tests__/history.test.ts`, `walletApi.test.ts`, `deps.test.ts`
- Modify: `extension/src/background/__tests__/messages.test.ts` (new partition tests)

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces:
  - `deps.ts`: `PRICE_TTL_MS = 60_000`; `FORBIDDEN_UNTIL_KEY = 'v1_forbidden_until'`; `latchStore(ext): LatchStore`; `createJsonGetter(fetch: FetchLike, latch: ForbiddenLatch): JsonGetter`; `stagePriceFrom(body: unknown): number | null` (strict `/stats` validation — no stage-1 fallback); `browserDeps(ext: Ext): WalletDeps` (one serialising `ForbiddenLatch`, persisted in `storage.local`, shared by the RPC, the broadcast route and the JSON reads; `stagePrice()` via `stagePriceFrom`)
  - `history.ts`: `HISTORY_PAGE_SIZE = 10`, `TX_MIN_INTERVAL_MS = 500`, `MAX_CACHED = 500`; `interface HistoryView {signature; blockTime: number | null; kind: HistoryKind; token: WalletToken | null; mint: string | null; amount: string | null; counterparty: string | null; feeLamports: string; failed: boolean}`; `interface History {page(owner: string, before?: string): Promise<HistoryView[]>}`; `createHistory(deps: Pick<WalletDeps, 'reader' | 'now' | 'sleep'>): History`
  - `walletApi.ts`: `type Result = {ok: true; data?: unknown} | {ok: false; error: string; data?: unknown}`; `WALLET_TYPES`; `type WalletType`; `isWalletType(t: string): t is WalletType`; `handleWallet(ext, deps, type: WalletType, msg: Record<string, unknown>): Promise<Result>`
  - `messages.ts`: `PRIVILEGED` now `['vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'activity.ping', ...WALLET_TYPES]`; `handleMessage(ext, msg, sender, deps?: WalletDeps): Promise<Result>`

**The message API (all privileged — own extension origin only; `vault.setKeys` and `vault.reauthOk` additionally only from `/unlock.html`).** Every amount is a decimal string.

| type | request | reply `data` |
|---|---|---|
| `wallet.state` | — | `{hasWallet, unlocked, scheme, accounts: [{index, name, publicKey}], selected}` |
| `wallet.balances` | `{account}` | `{sol, noc, usdc, usdt}` |
| `wallet.probeBalances` | `{publicKeys: string[1..6]}` | `{resolved: true, balances: [{publicKey, lamports, noc}]}` or `{resolved: false, balances: []}` |
| `wallet.prepareSend` | `{account, intent: {token, recipient, amount}}` | `PreparedView` |
| `wallet.send` | `{id}` | `PendingView`; `error: 'reauth-required'` carries `data.challengeId`; `error: 'prepared-expired'` (older than `PREPARED_TTL_MS`, e.g. a slow re-authentication) means: prepare again |
| `wallet.resend` | `{id}` | `PendingView` |
| `wallet.pending` | — | `PendingView[]` (and resumes polling if any is open) |
| `wallet.history` | `{account, before?}` | `HistoryView[]` |
| `accounts.rename` | `{index, name}` | — |
| `accounts.select` | `{index}` | — |
| `settings.get` | — | `Settings` |
| `settings.set` | `{patch, challengeId?}` | `Settings`; a weakening patch without a satisfied challenge → `error: 'reauth-required'`, `data.challengeId` |
| `vault.reauthOk` | `{challengeId}` | — (unlock page only; unlocked only) |

Errors: `'malformed'`, `'unavailable'` (no deps), the `SendRefusal`/`ResendRefusal` codes, `'unknown-account'`, `'unknown-challenge'`, `'locked'`, `'coordinator-refused'` (a 403 — terminal), `'failed'` (anything else).

- [ ] **Step 1: Write the failing tests**

`extension/src/background/__tests__/deps.test.ts`:
```ts
import {FORBIDDEN_UNTIL_KEY, browserDeps, createJsonGetter, stagePriceFrom} from '../deps';
import {FORBIDDEN_COOLDOWN_MS, RpcForbidden, createForbiddenLatch, createRpc, type FetchInit} from '../../../../core/solana/rpc';
import {fakeExt} from './fakeExt';

describe('createJsonGetter', () => {
  it('GETs API_BASE + path without credentials and returns the JSON (positive control)', async () => {
    const calls: {url: string; init: FetchInit}[] = [];
    const get = createJsonGetter(async (url, init) => (calls.push({url, init}), {status: 200, json: async () => ({x: 1})}), createForbiddenLatch());
    expect(await get.get('/wallet/prices?ids=solana')).toEqual({x: 1});
    expect(calls).toEqual([{url: 'https://api.noc-tura.io/api/v1/wallet/prices?ids=solana', init: {method: 'GET', credentials: 'omit'}}]);
  });

  it('a 403 on any coordinator route trips the one latch the RPC shares — no second request anywhere', async () => {
    let requests = 0;
    const fetch = async () => (requests++, {status: 403, json: async () => null});
    const latch = createForbiddenLatch();
    const get = createJsonGetter(fetch, latch);
    const rpc = createRpc({fetch, latch});
    await expect(get.get('/wallet/prices')).rejects.toBeInstanceOf(RpcForbidden);
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(requests).toBe(1);
  });
});

describe('browserDeps (review M3: the cool-down survives a restarted worker)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('after a 403 the cool-down is stored, and a FRESH browserDeps still refuses without a request', async () => {
    let requests = 0;
    // A stubbed fetch: nothing here leaves the process.
    vi.stubGlobal('fetch', async () => (requests++, {status: 403, json: async () => null}));
    const ext = fakeExt();
    await expect(browserDeps(ext).reader.getBlockHeight()).rejects.toBeInstanceOf(RpcForbidden);
    expect(requests).toBe(1);
    const until = await ext.local.get(FORBIDDEN_UNTIL_KEY);
    expect(typeof until === 'number' && until > Date.now() + FORBIDDEN_COOLDOWN_MS - 60_000).toBe(true);
    await expect(browserDeps(ext).reader.getBlockHeight()).rejects.toBeInstanceOf(RpcForbidden);
    await expect(browserDeps(ext).stagePrice()).rejects.toBeInstanceOf(RpcForbidden);
    expect(requests).toBe(1);
  });

  it('reads the NOC stage price from /stats (owner decision B)', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => (urls.push(url), {status: 200, json: async () => ({success: true, data: {currentStage: 1, totalNocSold: 0, isPaused: false}})}));
    expect(await browserDeps(fakeExt()).stagePrice()).toBe(0.1723);
    expect(urls).toEqual(['https://api.noc-tura.io/api/v1/stats']);
  });
});

describe('stagePriceFrom (strict: no stage-1 fallback, which would fail open)', () => {
  it('a known stage gives its price (positive control)', () => {
    expect(stagePriceFrom({success: true, data: {currentStage: 0}})).toBe(0.1501);
    expect(stagePriceFrom({success: true, data: {currentStage: 9}})).toBe(0.3499);
  });

  it('a missing, unknown or malformed stage is null — never the stage-1 price', () => {
    for (const body of [
      {success: true, data: {}},
      {success: true, data: {currentStage: null}},
      {success: true, data: {currentStage: '1'}},
      {success: true, data: {currentStage: 1.5}},
      {success: true, data: {currentStage: -1}},
      {success: true, data: {currentStage: 10}},
      {success: false, data: {currentStage: 1}},
      null,
    ]) {
      expect(stagePriceFrom(body)).toBeNull();
    }
  });
});
```

`extension/src/background/__tests__/history.test.ts`:
```ts
import {HISTORY_PAGE_SIZE, TX_MIN_INTERVAL_MS, createHistory} from '../history';
import {fakeReader} from './fakeDeps';

const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const solSend = {
  blockTime: 5,
  meta: {err: null, fee: 5000, preBalances: [2_000_000, 0], postBalances: [995_000, 1_000_000], preTokenBalances: [], postTokenBalances: []},
  transaction: {message: {accountKeys: [{pubkey: OWNER}, {pubkey: 'Other'}], instructions: []}},
};

describe('history', () => {
  it('pages by signature, decodes each, paces getTransaction to ≤ 2 per second and caches', async () => {
    const sleeps: number[] = [];
    const fetched: string[] = [];
    const asked: unknown[] = [];
    const reader = fakeReader({
      getSignaturesForAddress: async (_a, opts) => (asked.push(opts), [{signature: 's1', blockTime: 5, err: null}, {signature: 's2', blockTime: 4, err: null}, {signature: 's3', blockTime: 3, err: null}]),
      getTransaction: async sig => (fetched.push(sig), sig === 's3' ? null : solSend),
    });
    const history = createHistory({reader, now: () => 0, sleep: async ms => void sleeps.push(ms)});
    const page = await history.page(OWNER);
    expect(page.map(e => [e.signature, e.kind, e.amount])).toEqual([['s1', 'sent', '1000000'], ['s2', 'sent', '1000000']]);
    expect(page[0]?.feeLamports).toBe('5000');
    expect(sleeps).toEqual([TX_MIN_INTERVAL_MS, TX_MIN_INTERVAL_MS]);
    expect(asked).toEqual([{limit: HISTORY_PAGE_SIZE}]);
    await history.page(OWNER, 's1');
    expect(fetched).toEqual(['s1', 's2', 's3', 's3']);
    expect(asked[1]).toEqual({limit: HISTORY_PAGE_SIZE, before: 's1'});
    expect(TX_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(500);
  });
});
```
(`s3` is not indexed yet, so it is neither shown nor cached and is asked again on the next page; `s1`/`s2` come from the cache.)

`extension/src/background/__tests__/walletApi.test.ts`:
```ts
import {base58} from '@scure/base';
import {handleWallet} from '../walletApi';
import {SETTINGS_KEY} from '../settings';
import {VAULT_KEY} from '../accountsStore';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {satisfyChallenge} from '../reauthChallenges';
import {AUTOLOCK_ALARM} from '../autolock';
import {firstSignature} from '../../../../core/solana/broadcast';
import {RpcForbidden} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, sendReader, unlocked} from './fixtures';

const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT.publicKey}, {index: 3, name: 'Old', publicKey: RECIPIENT}]};
const NOC = WALLET_TOKENS.NOC.mint as string;

describe('handleWallet', () => {
  it('wallet.state: public account data, lock state and the selected account', async () => {
    const ext = fakeExt();
    expect(await handleWallet(ext, fakeDeps(), 'wallet.state', {})).toEqual({ok: true, data: {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null}});
    await ext.local.set(VAULT_KEY, ENV);
    await unlocked(ext);
    await ext.local.set(SETTINGS_KEY, {selectedAccount: 3});
    const r = await handleWallet(ext, fakeDeps(), 'wallet.state', {});
    expect(r).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 3}});
    expect(JSON.stringify(r)).not.toContain('secretKey');
  });

  it('wallet.balances: strings, for a valid address only', async () => {
    const reader = fakeReader({getBalance: async () => 7n, getTokenAccountsByOwner: async () => [{pubkey: 'a', mint: NOC, owner: ACCOUNT.publicKey, amount: 12n, decimals: 9}]});
    expect(await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.balances', {account: ACCOUNT.publicKey})).toEqual({ok: true, data: {sol: '7', noc: '12', usdc: '0', usdt: '0'}});
    expect(await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.balances', {account: 'nope'})).toEqual({ok: false, error: 'malformed'});
  });

  it('wallet.probeBalances: public keys only, at most six; SOL failing is "unresolved", NOC is best-effort', async () => {
    const reader = fakeReader({
      getMultipleLamports: async keys => keys.map((_, i) => BigInt(i)),
      getTokenAccountsByOwner: async owner => {
        if (owner === RECIPIENT) throw new Error('flaky');
        return [{pubkey: 'a', mint: NOC, owner, amount: 5n, decimals: 9}];
      },
    });
    const r = await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.probeBalances', {publicKeys: [ACCOUNT.publicKey, RECIPIENT]});
    expect(r).toEqual({ok: true, data: {resolved: true, balances: [{publicKey: ACCOUNT.publicKey, lamports: '0', noc: '5'}, {publicKey: RECIPIENT, lamports: '1', noc: '0'}]}});
    const down = fakeReader({
      getMultipleLamports: async () => {
        throw new Error('down');
      },
    });
    expect(await handleWallet(fakeExt(), fakeDeps({reader: down}), 'wallet.probeBalances', {publicKeys: [RECIPIENT]})).toEqual({ok: true, data: {resolved: false, balances: []}});
    expect(await handleWallet(fakeExt(), fakeDeps(), 'wallet.probeBalances', {publicKeys: Array(7).fill(RECIPIENT)})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(fakeExt(), fakeDeps(), 'wallet.probeBalances', {publicKeys: ['x']})).toEqual({ok: false, error: 'malformed'});
  });

  it('prepareSend → send → pending, end to end through the API', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const deps = fakeDeps({reader: sendReader()});
    deps.broadcast = async wire => firstSignature(wire);
    const prep = await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000'}});
    expect(prep.ok).toBe(true);
    const {id} = prep.data as {id: string};
    const sent = await handleWallet(ext, deps, 'wallet.send', {id});
    expect(sent).toMatchObject({ok: true, data: {state: 'pending'}});
    const pending = await handleWallet(ext, deps, 'wallet.pending', {});
    expect((pending.data as {state: string}[]).map(p => p.state)).toEqual(['pending']);
    expect(JSON.stringify(pending)).not.toContain('"wire"');
  });

  it('wallet.send before re-authentication answers reauth-required with the challenge id', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const prep = await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000'}});
    const {id, reauth} = prep.data as {id: string; reauth: {challengeId: string}};
    expect(await handleWallet(ext, deps, 'wallet.send', {id})).toEqual({ok: false, error: 'reauth-required', data: {challengeId: reauth.challengeId}});
  });

  it('refusals and a 403 become fixed error codes', async () => {
    const ext = fakeExt();
    expect(await handleWallet(ext, fakeDeps(), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}})).toMatchObject({ok: false, error: 'locked'});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'BONK'}})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.resend', {id: 'x'})).toEqual({ok: false, error: 'unknown'});
    const reader = fakeReader({
      getBalance: async () => {
        throw new RpcForbidden('getBalance');
      },
      getTokenAccountsByOwner: async () => [],
    });
    expect(await handleWallet(ext, fakeDeps({reader}), 'wallet.balances', {account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'coordinator-refused'});
  });

  it('wallet.history refuses a malformed page cursor without a request (review M6)', async () => {
    const sig = base58.encode(new Uint8Array(64).fill(7));
    const reader = fakeReader({getSignaturesForAddress: async () => []});
    expect(await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.history', {account: ACCOUNT.publicKey, before: sig})).toEqual({ok: true, data: []});
    // fakeDeps' own reader throws on any call, so a request here would answer 'failed', not 'malformed'.
    for (const before of ['nope', base58.encode(new Uint8Array(32).fill(7)), 42]) {
      expect(await handleWallet(fakeExt(), fakeDeps(), 'wallet.history', {account: ACCOUNT.publicKey, before})).toEqual({ok: false, error: 'malformed'});
    }
  });

  it('accounts.rename and accounts.select', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await handleWallet(ext, fakeDeps(), 'accounts.rename', {index: 3, name: ' Savings '})).toEqual({ok: true});
    expect(((await ext.local.get(VAULT_KEY)) as typeof ENV).accounts[1]?.name).toBe('Savings');
    expect(await handleWallet(ext, fakeDeps(), 'accounts.rename', {index: 3, name: 'a\u202eb'})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.select', {index: 3})).toEqual({ok: true});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.select', {index: 9})).toEqual({ok: false, error: 'unknown-account'});
  });

  it('settings.set: strengthening applies at once; weakening needs a satisfied challenge for that exact patch', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 2}})).toMatchObject({ok: true, data: {autoLockMinutes: 2}});
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(2);
    const ask = await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}});
    expect(ask).toMatchObject({ok: false, error: 'reauth-required'});
    const {challengeId} = ask.data as {challengeId: string};
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}, challengeId})).toMatchObject({ok: false, error: 'reauth-required'});
    await satisfyChallenge(ext, deps.now(), challengeId);
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 60}, challengeId})).toMatchObject({ok: false, error: 'reauth-required'});
    const second = await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}});
    const id2 = (second.data as {challengeId: string}).challengeId;
    await satisfyChallenge(ext, deps.now(), id2);
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}, challengeId: id2})).toMatchObject({ok: true, data: {autoLockMinutes: 30}});
    expect(await handleWallet(ext, deps, 'settings.get', {})).toMatchObject({ok: true, data: {autoLockMinutes: 30}});
  });

  it('settings.set: a weakening patch while locked is refused outright', async () => {
    expect(await handleWallet(fakeExt(), fakeDeps(), 'settings.set', {patch: {reauthUsdCents: 50_000}})).toEqual({ok: false, error: 'locked'});
    expect(await handleWallet(fakeExt(), fakeDeps(), 'settings.set', {patch: {x: 1}})).toEqual({ok: false, error: 'malformed'});
  });
});
```

Add to `extension/src/background/__tests__/messages.test.ts` — the existing `import {handleMessage} from '../messages';` becomes `import {PRIVILEGED, handleMessage} from '../messages';`, two imports join it, and the new `describe` goes at the end:
```ts
import {issueChallenge} from '../reauthChallenges';
import {fakeDeps} from './fakeDeps';
```
```ts
describe('message partitions (B1b-1 types)', () => {
  // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
  // 'unknown type' here, which fails, rather than silently shrinking the test.
  const ALL = [
    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'activity.ping',
    'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
    'wallet.pending', 'wallet.history', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
  ];

  it('every privileged type is refused from a web page', async () => {
    expect([...PRIVILEGED].sort()).toEqual([...ALL].sort());
    for (const type of ALL) {
      expect(await handleMessage(fakeExt(), {type}, page, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
  });

  it('vault.reauthOk only from the vault page, only while unlocked, only for a live challenge', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
    const challengeId = await issueChallenge(ext, deps, 'd');
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, popup, deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId: 'f'.repeat(32)}, unlockPage, deps)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps)).toEqual({ok: true});
    await handleMessage(ext, {type: 'vault.lock'}, popup);
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps)).toEqual({ok: false, error: 'locked'});
  });

  it('wallet types answer "unavailable" when the background has no deps, and route when it does', async () => {
    expect(await handleMessage(fakeExt(), {type: 'settings.get'}, popup)).toEqual({ok: false, error: 'unavailable'});
    expect(await handleMessage(fakeExt(), {type: 'settings.get'}, popup, fakeDeps())).toMatchObject({ok: true, data: {autoLockMinutes: 5}});
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd extension && npx vitest run src/background`
Expected: FAIL — missing `../history`, `../walletApi`, `createJsonGetter`, and the new partition tests (`PRIVILEGED` lacks the new types).

- [ ] **Step 3: Write the implementations**

`extension/src/background/deps.ts` — replace the file with:
```ts
import type {JsonGetter} from '../../../core/ports';
import type {Ext} from '../ext';
import {API_BASE, RpcHttpError, createForbiddenLatch, createRpc, solanaReader, type FetchLike, type ForbiddenLatch, type LatchStore, type SolanaReader} from '../../../core/solana/rpc';
import {PRESALE_STAGE_PRICES} from '../../../core/presale/stagePrices';
import {broadcastSigned} from '../../../core/solana/broadcast';
import {fetchUsdPrices} from '../../../core/portfolio/prices';
import type {Prices} from '../../../core/portfolio/value';

/**
 * Everything the wallet engine needs from outside: chain reads, the broadcast route, prices, time
 * and randomness. browserDeps() is the real one; tests pass a fake, so no unit test reaches the
 * network.
 */
export interface WalletDeps {
  reader: SolanaReader;
  /** Sends signed wire bytes through the coordinator's broadcast route; resolves to the verified signature. */
  broadcast(wire: Uint8Array): Promise<string>;
  /** USD prices for SOL, USDC and USDT. */
  prices(): Promise<Prices>;
  /** USD per NOC at the current presale stage (owner decision B), or null when /stats does not say it validly. */
  stagePrice(): Promise<number | null>;
  now(): number;
  randomBytes(n: number): Uint8Array;
  sleep(ms: number): Promise<void>;
}

/** Prices are shown to two decimals; a minute is plenty, and the proxy's budget is shared. */
export const PRICE_TTL_MS = 60_000;

/** GET a bare path under API_BASE. A 403 trips the shared latch, like the RPC and the broadcast route. */
export function createJsonGetter(fetch: FetchLike, latch: ForbiddenLatch): JsonGetter {
  return {
    async get<T>(path: string): Promise<T> {
      // Through the shared latch: serialised with the RPC and the broadcast route; a 403 is terminal.
      const res = await latch.request(path, () => fetch(`${API_BASE}${path}`, {method: 'GET', credentials: 'omit'}));
      if (res.status !== 200) throw new RpcHttpError(path, res.status);
      return (await res.json()) as T;
    },
  };
}

/**
 * NOC's USD price for the dollar re-auth rule, read strictly from a /stats body. NOT web's
 * fetchPresaleStats: that maps a missing currentStage to stage 1 — the lowest price — which is right
 * for a display but would under-value NOC here and skip a re-authentication (fail open). Here a
 * missing, non-integer or unknown stage, or a price that is not a positive finite number, is null,
 * and null counts as above the threshold. web's own display is unchanged.
 */
export function stagePriceFrom(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const {success, data} = body as {success?: unknown; data?: unknown};
  if (success !== true || typeof data !== 'object' || data === null) return null;
  const stage = (data as {currentStage?: unknown}).currentStage;
  if (typeof stage !== 'number' || !Number.isSafeInteger(stage) || stage < 0 || stage >= PRESALE_STAGE_PRICES.length) return null;
  const price = PRESALE_STAGE_PRICES[stage];
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
}

/** storage.local, background-owned: the end of a 403 cool-down, so a restarted worker keeps it (review M3). */
export const FORBIDDEN_UNTIL_KEY = 'v1_forbidden_until';

export function latchStore(ext: Ext): LatchStore {
  return {
    load: async () => {
      const v = await ext.local.get(FORBIDDEN_UNTIL_KEY);
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    },
    save: until => ext.local.set(FORBIDDEN_UNTIL_KEY, until),
  };
}

/** The background's real deps: one latch for every coordinator route, so one 403 silences them all. */
export function browserDeps(ext: Ext): WalletDeps {
  const fetch: FetchLike = (url, init) => globalThis.fetch(url, init);
  const latch = createForbiddenLatch({store: latchStore(ext)});
  const get = createJsonGetter(fetch, latch);
  let cache: {at: number; prices: Prices} | null = null;
  let stage: {at: number; price: number} | null = null;
  return {
    reader: solanaReader(createRpc({fetch, latch})),
    broadcast: wire => broadcastSigned({fetch, latch}, wire),
    async prices() {
      const now = Date.now();
      if (cache !== null && now - cache.at < PRICE_TTL_MS) return cache.prices;
      const prices = await fetchUsdPrices(get);
      cache = {at: now, prices};
      return prices;
    },
    // Owner decision B: NOC at the current presale stage price, read as web/ reads it (/stats).
    async stagePrice() {
      const now = Date.now();
      if (stage !== null && now - stage.at < PRICE_TTL_MS) return stage.price;
      const price = stagePriceFrom(await get.get<unknown>('/stats'));
      if (price !== null) stage = {at: now, price};
      return price;
    },
    now: () => Date.now(),
    randomBytes: n => globalThis.crypto.getRandomValues(new Uint8Array(n)),
    sleep: ms => new Promise<void>(resolve => setTimeout(resolve, ms)),
  };
}
```

`extension/src/background/history.ts`:
```ts
import type {WalletDeps} from './deps';
import {createMutex} from './mutex';
import {decodeHistoryEntry, type HistoryEntry, type HistoryKind} from '../../../core/solana/history';
import type {WalletToken} from '../../../core/solana/balances';

export const HISTORY_PAGE_SIZE = 10;
/** At most 2 getTransaction per second (spec §4), well inside the proxy's 240 requests a minute. */
export const TX_MIN_INTERVAL_MS = 500;
export const MAX_CACHED = 500;

export interface HistoryView {
  signature: string;
  blockTime: number | null;
  kind: HistoryKind;
  token: WalletToken | null;
  mint: string | null;
  amount: string | null;
  counterparty: string | null;
  feeLamports: string;
  failed: boolean;
}

export interface History {
  page(owner: string, before?: string): Promise<HistoryView[]>;
}

const toView = (e: HistoryEntry): HistoryView => ({
  signature: e.signature,
  blockTime: e.blockTime,
  kind: e.kind,
  token: e.token,
  mint: e.mint,
  amount: e.amount === null ? null : e.amount.toString(),
  counterparty: e.counterparty,
  feeLamports: e.feeLamports.toString(),
  failed: e.failed,
});

export function createHistory(deps: Pick<WalletDeps, 'reader' | 'now' | 'sleep'>): History {
  const cache = new Map<string, HistoryEntry>();
  const serial = createMutex();
  let lastFetch = Number.NEGATIVE_INFINITY;

  async function paced(signature: string): Promise<unknown> {
    const wait = lastFetch + TX_MIN_INTERVAL_MS - deps.now();
    if (wait > 0) await deps.sleep(wait);
    lastFetch = deps.now();
    return deps.reader.getTransaction(signature);
  }

  async function page(owner: string, before?: string): Promise<HistoryView[]> {
    const opts = before === undefined ? {limit: HISTORY_PAGE_SIZE} : {limit: HISTORY_PAGE_SIZE, before};
    const signatures = await deps.reader.getSignaturesForAddress(owner, opts);
    const out: HistoryView[] = [];
    for (const s of signatures) {
      const key = `${owner}:${s.signature}`;
      let entry = cache.get(key);
      if (entry === undefined) {
        const tx = await paced(s.signature);
        if (tx === null || tx === undefined) continue; // not indexed yet: not cached, asked again next time
        entry = decodeHistoryEntry(owner, s.signature, tx);
        cache.set(key, entry);
        if (cache.size > MAX_CACHED) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
      }
      out.push(toView(entry));
    }
    return out;
  }

  // One page at a time, so two popups cannot double the getTransaction rate.
  return {page: (owner, before) => serial(() => page(owner, before))};
}
```

`extension/src/background/walletApi.ts`:
```ts
import {base58} from '@scure/base';
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {getSession} from './session';
import {armAutolock} from './autolock';
import {parsePatch, readSettings, weakens, writeSettings} from './settings';
import {cleanName, readWalletView, renameAccount} from './accountsStore';
import {consumeChallenge, issueChallenge} from './reauthChallenges';
import {digestOf} from './digest';
import {isAddress, parseIntent, prepareSend} from './prepare';
import {sendPrepared} from './send';
import {resend, startPoller} from './pending';
import {isOpen, readPending, viewOf} from './pendingStore';
import {createHistory, type History} from './history';
import {ResendRefused, SendRefused} from './sendTypes';
import {readWalletBalances, WALLET_TOKENS} from '../../../core/solana/balances';
import {RpcForbidden} from '../../../core/solana/rpc';

export type Result = {ok: true; data?: unknown} | {ok: false; error: string; data?: unknown};

export const WALLET_TYPES = [
  'wallet.state',
  'wallet.balances',
  'wallet.probeBalances',
  'wallet.prepareSend',
  'wallet.send',
  'wallet.resend',
  'wallet.pending',
  'wallet.history',
  'accounts.rename',
  'accounts.select',
  'settings.get',
  'settings.set',
] as const;
export type WalletType = (typeof WALLET_TYPES)[number];
export const isWalletType = (t: string): t is WalletType => (WALLET_TYPES as readonly string[]).includes(t);

/** Onboarding probes SLIP-0010 accounts 0–4 and cli: six public keys at most. */
const MAX_PROBE = 6;
const MALFORMED: Result = {ok: false, error: 'malformed'};
const histories = new WeakMap<WalletDeps, History>();
const isIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

/** A transaction signature: base58 of exactly 64 bytes (review M6 — a page cursor is never passed on unchecked). */
function isSignature(x: unknown): x is string {
  if (typeof x !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(x)) return false;
  try {
    return base58.decode(x).length === 64;
  } catch {
    return false;
  }
}

function historyFor(deps: WalletDeps): History {
  let h = histories.get(deps);
  if (h === undefined) {
    h = createHistory(deps);
    histories.set(deps, h);
  }
  return h;
}

function failure(e: unknown): Result {
  if (e instanceof SendRefused) {
    return e.code === 'reauth-required' && e.detail !== '' ? {ok: false, error: e.code, data: {challengeId: e.detail}} : {ok: false, error: e.code, data: {detail: e.detail}};
  }
  if (e instanceof ResendRefused) return {ok: false, error: e.code};
  if (e instanceof RpcForbidden) return {ok: false, error: 'coordinator-refused'};
  return {ok: false, error: 'failed'};
}

async function walletState(ext: Ext) {
  const [view, session, settings] = await Promise.all([readWalletView(ext), getSession(ext), readSettings(ext)]);
  if (view === null) return {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null};
  const selected = view.accounts.some(a => a.index === settings.selectedAccount) ? settings.selectedAccount : (view.accounts[0]?.index ?? null);
  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts: view.accounts, selected};
}

/** Balances for onboarding's candidate addresses: public keys in, public numbers out. */
async function probe(deps: WalletDeps, keys: unknown): Promise<Result> {
  if (!Array.isArray(keys)) return MALFORMED;
  const list = keys as unknown[];
  if (list.length === 0 || list.length > MAX_PROBE || !list.every(isAddress)) return MALFORMED;
  let lamports: bigint[];
  try {
    lamports = await deps.reader.getMultipleLamports(list);
  } catch (e) {
    if (e instanceof RpcForbidden) throw e;
    return {ok: true, data: {resolved: false, balances: []}};
  }
  const nocMint = WALLET_TOKENS.NOC.mint as string;
  const balances: {publicKey: string; lamports: string; noc: string}[] = [];
  for (const [i, publicKey] of list.entries()) {
    let noc = 0n;
    try {
      noc = (await deps.reader.getTokenAccountsByOwner(publicKey, {mint: nocMint})).reduce((sum, a) => sum + a.amount, 0n);
    } catch (e) {
      if (e instanceof RpcForbidden) throw e; // best-effort like the app — but a 403 is never swallowed
    }
    balances.push({publicKey, lamports: (lamports[i] ?? 0n).toString(), noc: noc.toString()});
  }
  return {ok: true, data: {resolved: true, balances}};
}

async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unknown>): Promise<Result> {
  const patch = parsePatch(msg.patch);
  if (patch === null) return MALFORMED;
  const current = await readSettings(ext);
  if (weakens(current, patch)) {
    if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
    const digest = digestOf({kind: 'settings', autoLockMinutes: patch.autoLockMinutes ?? null, reauthUsdCents: patch.reauthUsdCents ?? null});
    const id = msg.challengeId;
    if (typeof id !== 'string' || !(await consumeChallenge(ext, deps.now(), id, digest))) {
      return {ok: false, error: 'reauth-required', data: {challengeId: await issueChallenge(ext, deps, digest)}};
    }
  }
  const next = {...current, ...patch};
  await writeSettings(ext, next);
  if (patch.autoLockMinutes !== undefined && (await getSession(ext)) !== null) await armAutolock(ext);
  return {ok: true, data: next};
}

export async function handleWallet(ext: Ext, deps: WalletDeps, type: WalletType, msg: Record<string, unknown>): Promise<Result> {
  try {
    switch (type) {
      case 'wallet.state':
        return {ok: true, data: await walletState(ext)};
      case 'wallet.balances': {
        const {account} = msg;
        if (!isAddress(account)) return MALFORMED;
        const b = await readWalletBalances(deps.reader, account);
        return {ok: true, data: {sol: b.sol.toString(), noc: b.noc.toString(), usdc: b.usdc.toString(), usdt: b.usdt.toString()}};
      }
      case 'wallet.probeBalances':
        return await probe(deps, msg.publicKeys);
      case 'wallet.prepareSend': {
        const {account} = msg;
        const intent = parseIntent(msg.intent);
        if (!isAddress(account) || intent === null) return MALFORMED;
        return {ok: true, data: await prepareSend(ext, deps, account, intent)};
      }
      case 'wallet.send': {
        const {id} = msg;
        if (typeof id !== 'string') return MALFORMED;
        return {ok: true, data: await sendPrepared(ext, deps, id)};
      }
      case 'wallet.resend': {
        const {id} = msg;
        if (typeof id !== 'string') return MALFORMED;
        return {ok: true, data: await resend(ext, deps, id)};
      }
      case 'wallet.pending': {
        const records = await readPending(ext);
        if (records.some(isOpen)) void startPoller(ext, deps);
        return {ok: true, data: records.map(viewOf)};
      }
      case 'wallet.history': {
        const {account, before} = msg;
        if (!isAddress(account) || (before !== undefined && !isSignature(before))) return MALFORMED;
        return {ok: true, data: await historyFor(deps).page(account, before)};
      }
      case 'accounts.rename': {
        const {index} = msg;
        const name = cleanName(msg.name);
        if (!isIndex(index) || name === null) return MALFORMED;
        return (await renameAccount(ext, index, name)) ? {ok: true} : {ok: false, error: 'unknown-account'};
      }
      case 'accounts.select': {
        const {index} = msg;
        if (!isIndex(index)) return MALFORMED;
        const view = await readWalletView(ext);
        if (view === null || !view.accounts.some(a => a.index === index)) return {ok: false, error: 'unknown-account'};
        await writeSettings(ext, {...(await readSettings(ext)), selectedAccount: index});
        return {ok: true};
      }
      case 'settings.get':
        return {ok: true, data: await readSettings(ext)};
      case 'settings.set':
        return await setSettings(ext, deps, msg);
    }
  } catch (e) {
    return failure(e);
  }
}
```

`extension/src/background/messages.ts` — four edits:
1. Imports: add
```ts
import type {WalletDeps} from './deps';
import {satisfyChallenge} from './reauthChallenges';
import {WALLET_TYPES, handleWallet, isWalletType, type Result} from './walletApi';
```
and delete the file's local `type Result = …` line.
2. Replace the `PRIVILEGED` line with:
```ts
export const PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'activity.ping', ...WALLET_TYPES] as const;
/** Only the vault page itself may hand over keys, or report a re-authentication it proved. */
const VAULT_PAGE_ONLY: readonly string[] = ['vault.setKeys', 'vault.reauthOk'];
```
3. Change the signature to `export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps?: WalletDeps): Promise<Result> {`, and below the existing `if (privileged && !isOwnPage(ext, sender)) return {ok: false, error: 'forbidden'};` add:
```ts
  if (VAULT_PAGE_ONLY.includes(type) && pagePath(ext, sender) !== '/unlock.html') return {ok: false, error: 'forbidden'};
```
then delete the now-redundant first line of `case 'vault.setKeys':` (`if (pagePath(ext, sender) !== '/unlock.html') return {ok: false, error: 'forbidden'};`).
4. Add a case before `default`, and replace `default`:
```ts
    case 'vault.reauthOk': {
      if (deps === undefined) return {ok: false, error: 'unavailable'};
      const challengeId = (msg as {challengeId?: unknown}).challengeId;
      if (typeof challengeId !== 'string') return {ok: false, error: 'malformed'};
      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
      return (await satisfyChallenge(ext, deps.now(), challengeId)) ? {ok: true} : {ok: false, error: 'unknown-challenge'};
    }
    default:
      if (isWalletType(type)) {
        return deps === undefined ? {ok: false, error: 'unavailable'} : handleWallet(ext, deps, type, msg as Record<string, unknown>);
      }
      return {ok: false, error: 'unknown type'};
```

`extension/src/background/index.ts` — four edits:
```ts
import {browserDeps} from './deps';
import {isOpen, readPending} from './pendingStore';
import {PENDING_ALARM, armPendingAlarm, onPendingAlarm, startPoller} from './pending';
```
below `const ext = browserExt();` add `const deps = browserDeps(ext);`; the message listener passes it: `handleMessage(ext, msg, sender, deps).then(reply, () => reply({ok: false, error: 'internal'}));`; the alarm listener gains the pending tick:
```ts
api.alarms.onAlarm.addListener(a => {
  if (a.name === AUTOLOCK_ALARM) void lock(ext);
  if (a.name === PENDING_ALARM) void onPendingAlarm(ext, deps);
});
```
and at the end of the file:
```ts
// A service worker stopped while a send was open restarts here: resume watching it.
void readPending(ext).then(
  records => {
    if (!records.some(isOpen)) return;
    void startPoller(ext, deps);
    void armPendingAlarm(ext);
  },
  () => undefined,
);
```

- [ ] **Step 4: Run the unit tests, the build, the gates and the existing E2E**

Run: `cd extension && npx vitest run && npx tsc --noEmit && npm run build && npm run gates`
Expected: PASS; `vault isolation ok` — the background now bundles web3.js and the send engine, and none of the five vault markers.
Run: `npm run e2e`
Expected: the B1a `unlock.spec.ts` passes — this is the first check that the service worker still starts with web3.js inside it.

- [ ] **Step 5: Mutation checks**

1. Remove `'wallet.send'` from `WALLET_TYPES` → "every privileged type is refused from a web page" fails (the list comparison and `'unknown type'`).
2. Delete the `VAULT_PAGE_ONLY` line → "vault.reauthOk only from the vault page" fails (the popup is accepted).
3. In `vault.reauthOk`, drop the `getSession` check → the locked expectation fails.
4. In `setSettings`, skip `consumeChallenge` (treat any `challengeId` string as proof) → "weakening needs a satisfied challenge" fails.
5. In `history.ts`, delete the `await deps.sleep(wait)` line → `sleeps` is `[]`, the pacing test fails.
5a. In `wallet.history`, go back to `typeof before !== 'string'` → "refuses a malformed page cursor" fails (`'failed'`, a request was made).
5c. In `stagePriceFrom`, restore web's fallback: replace `const stage = (data as {currentStage?: unknown}).currentStage;` with `const stage = (data as {currentStage?: unknown}).currentStage ?? 0;` → "a missing, unknown or malformed stage is null" fails, and so does prepare.test's missing-currentStage case (`reauth` becomes null — re-authentication skipped).
5b. In `browserDeps`, build the latch without `store` → "a FRESH browserDeps still refuses" fails (a second request).
6. In `failure`, map `RpcForbidden` to `'failed'` → "refusals and a 403 become fixed error codes" fails.

- [ ] **Step 6: Commit**

```bash
git add extension/src/background
git commit -m "feat(extension): the background wallet API

wallet.* / accounts.* / settings.* and vault.reauthOk in the privileged partition, each
with a partition test; one 403 latch across every coordinator route; paced, cached history;
polling resumes when the service worker restarts.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 10: The RPC method gate (`check-rpc-methods.mjs`)

**Files:**
- Create: `extension/scripts/check-rpc-methods.mjs`
- Test: `extension/scripts/__tests__/check-rpc-methods.test.mjs`
- Modify: `extension/package.json` (`gates` script)

**Interfaces:**
- Consumes: `listSourceFiles(root)` exported by `scripts/check-vault-isolation.mjs`; `core/solana/rpc.ts` (read as text).
- Produces: `SPEC_ALLOWED`, `KNOWN_RPC_METHODS`, `CONNECTION_ONLY`, `RPC_FILE`, `allowlistFrom(text)`, `reachable(starts, read, exists)`, `methodViolations(files, allowed)`, `checkRepo(root)` — and a `gates` step that fails the build.

Spec §5 "RPC method list: every call maps to an allowed method". The TypeScript type already refuses a call to another method, and `createRpc` refuses it at run time; this gate covers what neither sees: a method name written as a string anywhere in the code the extension bundles (its own sources **and every `core/` file they reach**, followed import by import), a web3.js `Connection` (which can call anything), and a drift between the list in `core/solana/rpc.ts` and the spec's. It fails INCONCLUSIVE when `core/solana/rpc.ts` is not reachable (the check would pass trivially) or no allowed method name is found at all.

- [ ] **Step 1: Write the failing test**

`extension/scripts/__tests__/check-rpc-methods.test.mjs`:
```js
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONNECTION_ONLY, KNOWN_RPC_METHODS, SPEC_ALLOWED, allowlistFrom, checkRepo, methodViolations, reachable} from '../check-rpc-methods.mjs';
import {listSourceFiles} from '../check-vault-isolation.mjs';

const f = (path, text) => ({path, text});

describe('the RPC method gate', () => {
  it('flags a refused method named as a string, anywhere in a bundled file', () => {
    expect(methodViolations([f('src/background/x.ts', "rpc.call('getProgramAccounts' as never, [])")], SPEC_ALLOWED)).toEqual([
      'src/background/x.ts: names the RPC method getProgramAccounts, which the coordinator proxy refuses (HTTP 403)',
    ]);
    expect(methodViolations([f('../core/solana/y.ts', 'const m = `sendTransaction`;')], SPEC_ALLOWED)).toHaveLength(1);
  });

  it('accepts the allowed names (positive control) and ignores words that are not RPC methods', () => {
    expect(methodViolations([f('a.ts', "call('getBalance', []); const t = 'wallet.balances'; const u = 'getAssociatedTokenAddress';")], SPEC_ALLOWED)).toEqual([]);
  });

  it('flags a web3.js Connection and its methods that bypass the list', () => {
    expect(methodViolations([f('a.ts', "import {Connection, PublicKey} from '@solana/web3.js';")], SPEC_ALLOWED)).toEqual(['a.ts: uses a web3.js Connection, which bypasses the RPC allowlist']);
    expect(methodViolations([f('b.ts', 'const c = new Connection(url);')], SPEC_ALLOWED)).toEqual(['b.ts: uses a web3.js Connection, which bypasses the RPC allowlist']);
    expect(methodViolations([f('c.ts', 'await conn.getParsedTransaction(sig);')], SPEC_ALLOWED)).toEqual(['c.ts: calls Connection.getParsedTransaction, which bypasses the RPC allowlist']);
    expect(methodViolations([f('d.ts', 'await reader.getSignatureStatuses([s]);')], SPEC_ALLOWED)).toEqual([]);
    expect(CONNECTION_ONLY).toContain('sendRawTransaction');
  });

  it('reads the list out of core/solana/rpc.ts', () => {
    expect(allowlistFrom("export const ALLOWED_RPC_METHODS = [\n  'getBalance',\n  'getBlockHeight',\n] as const;")).toEqual(['getBalance', 'getBlockHeight']);
    expect(allowlistFrom('nothing here')).toBeNull();
  });

  it('follows relative imports from the extension into core/ and reports one it cannot resolve', () => {
    const files = {
      'src/background/index.ts': "import {x} from '../../../core/solana/a';",
      '../core/solana/a.ts': "import {y} from './b';\nexport * from '../presale/c';",
      '../core/solana/b.ts': 'export const y = 1;',
      '../core/presale/c.ts': "import('./missing');",
    };
    const {files: seen, problems} = reachable(['src/background/index.ts'], p => files[p], p => p in files);
    expect(seen.sort()).toEqual(['../core/presale/c.ts', '../core/solana/a.ts', '../core/solana/b.ts', 'src/background/index.ts']);
    expect(problems).toEqual(['../core/presale/c.ts imports ./missing, which does not resolve to a file']);
  });

  it('the spec list is the eleven methods, and every name on it is a real RPC method', () => {
    expect(SPEC_ALLOWED).toHaveLength(11);
    for (const m of SPEC_ALLOWED) expect(KNOWN_RPC_METHODS).toContain(m);
  });

  it('is INCONCLUSIVE — and fails — where core/solana/rpc.ts is not reached (negative control)', () => {
    const empty = mkdtempSync(join(tmpdir(), 'rpcgate-'));
    try {
      expect(checkRepo(empty)).toEqual(['INCONCLUSIVE: ../core/solana/rpc.ts is reachable from no extension source — the check would pass trivially']);
    } finally {
      rmSync(empty, {recursive: true, force: true});
    }
  });

  it('passes on this repository (the gate is not vacuous: rpc.ts is reached)', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    expect(checkRepo(root)).toEqual([]);
  });

  it('does not read itself: the gate spells refused method names, and scripts/ is not bundled', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    expect(listSourceFiles(root)).not.toContain('scripts/check-rpc-methods.mjs');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd extension && npx vitest run check-rpc-methods`
Expected: FAIL — `Failed to load url ../check-rpc-methods.mjs`.

- [ ] **Step 3: Write the gate**

`extension/scripts/check-rpc-methods.mjs`:
```js
#!/usr/bin/env node
// Spec §4/§5: every JSON-RPC method the extension can call is on the coordinator proxy's
// allowlist. A refused method is answered with HTTP 403, and a few 403s in a burst get the user's
// IP banned from the whole domain by the host's CrowdSec bouncer. The TypeScript type (RpcMethod)
// and createRpc's run-time check cover calls through the client; this gate covers what they do
// not see: a method name spelled as a string in any file the extension bundles — its own sources
// and every core/ file they reach, followed import by import — a web3.js Connection (which can call
// any method), and drift between core/solana/rpc.ts's list and the spec's.
//
// Limits, deliberate: it reads text, so a refused name inside a quoted comment fails the gate
// (fail-closed); a name assembled at run time is out of its reach — createRpc refuses that one.
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, posix, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {listSourceFiles} from './check-vault-isolation.mjs';

// The spec's list, §4 "RPC — reads", copied here on purpose: core/solana/rpc.ts must equal it.
export const SPEC_ALLOWED = [
  'getBalance', 'getAccountInfo', 'getMultipleAccounts', 'getLatestBlockhash', 'simulateTransaction', 'getSignaturesForAddress',
  'getTransaction', 'getSignatureStatuses', 'getRecentPrioritizationFees', 'getTokenAccountsByOwner', 'getBlockHeight',
];

// Every Solana JSON-RPC method name (HTTP, current and deprecated). A string equal to one of these
// is a method name; any other string is not this gate's business.
export const KNOWN_RPC_METHODS = [
  'getAccountInfo', 'getBalance', 'getBlock', 'getBlockCommitment', 'getBlockHeight', 'getBlockProduction', 'getBlockTime',
  'getBlocks', 'getBlocksWithLimit', 'getClusterNodes', 'getConfirmedBlock', 'getConfirmedBlocks', 'getConfirmedBlocksWithLimit',
  'getConfirmedSignaturesForAddress2', 'getConfirmedTransaction', 'getEpochInfo', 'getEpochSchedule', 'getFeeCalculatorForBlockhash',
  'getFeeForMessage', 'getFeeRateGovernor', 'getFees', 'getFirstAvailableBlock', 'getGenesisHash', 'getHealth', 'getHighestSnapshotSlot',
  'getIdentity', 'getInflationGovernor', 'getInflationRate', 'getInflationReward', 'getLargestAccounts', 'getLatestBlockhash',
  'getLeaderSchedule', 'getMaxRetransmitSlot', 'getMaxShredInsertSlot', 'getMinimumBalanceForRentExemption', 'getMultipleAccounts',
  'getProgramAccounts', 'getRecentBlockhash', 'getRecentPerformanceSamples', 'getRecentPrioritizationFees', 'getSignatureStatuses',
  'getSignaturesForAddress', 'getSlot', 'getSlotLeader', 'getSlotLeaders', 'getSnapshotSlot', 'getStakeActivation',
  'getStakeMinimumDelegation', 'getSupply', 'getTokenAccountBalance', 'getTokenAccountsByDelegate', 'getTokenAccountsByOwner',
  'getTokenLargestAccounts', 'getTokenSupply', 'getTransaction', 'getTransactionCount', 'getVersion', 'getVoteAccounts',
  'isBlockhashValid', 'minimumLedgerSlot', 'requestAirdrop', 'sendTransaction', 'simulateTransaction',
];
const KNOWN = new Set(KNOWN_RPC_METHODS);

// web3.js Connection methods that reach the RPC under a name the list above does not show, or that
// the proxy refuses. The extension's reader has none of these names.
export const CONNECTION_ONLY = [
  'sendRawTransaction', 'sendEncodedTransaction', 'confirmTransaction', 'getParsedTransaction', 'getParsedTransactions',
  'getParsedTokenAccountsByOwner', 'getParsedAccountInfo', 'getParsedProgramAccounts', 'getSignatureStatus', 'getMultipleAccountsInfo',
  'getMultipleParsedAccounts', 'getAddressLookupTable', 'onAccountChange', 'onSignature',
];

export const RPC_FILE = '../core/solana/rpc.ts';

const EXTENSIONS = ['', '.ts', '.mts', '.mjs', '.js', '/index.ts'];
const FROM_SPEC = /\bfrom\s*(['"`])([^'"`]+)\1/g;
const CALL_SPEC = /\bimport\s*\(?\s*(['"`])([^'"`$]+)\1/g;

function specifiers(text) {
  const out = [];
  for (const re of [FROM_SPEC, CALL_SPEC]) for (const m of text.matchAll(re)) out.push(m[2]);
  return out;
}

/** Every file reachable from `starts` by relative imports (package-relative, / separators). */
export function reachable(starts, read, exists) {
  const seen = new Set();
  const problems = [];
  const stack = [...starts];
  while (stack.length > 0) {
    const path = stack.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    const text = read(path);
    if (text === undefined) continue;
    for (const spec of specifiers(text)) {
      if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
      const base = posix.normalize(posix.join(posix.dirname(path), spec));
      const target = EXTENSIONS.map(e => base + e).find(exists);
      if (target === undefined) problems.push(`${path} imports ${spec}, which does not resolve to a file`);
      else stack.push(target);
    }
  }
  return {files: [...seen], problems};
}

/** The ALLOWED_RPC_METHODS literal from core/solana/rpc.ts, or null when it cannot be found. */
export function allowlistFrom(text) {
  const m = /ALLOWED_RPC_METHODS\s*=\s*\[([^\]]*)\]\s*as\s+const/.exec(text);
  if (!m) return null;
  return [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map(x => x[1]);
}

export function methodViolations(files, allowed) {
  const out = [];
  for (const {path, text} of files) {
    const named = new Set();
    for (const m of text.matchAll(/(['"`])([A-Za-z0-9]+)\1/g)) if (KNOWN.has(m[2]) && !allowed.includes(m[2])) named.add(m[2]);
    for (const name of named) out.push(`${path}: names the RPC method ${name}, which the coordinator proxy refuses (HTTP 403)`);
    if (/\bnew\s+Connection\s*\(/.test(text) || /\bimport\s*\{[^}]*\bConnection\b[^}]*\}\s*from\s*['"]@solana\/web3\.js['"]/.test(text)) {
      out.push(`${path}: uses a web3.js Connection, which bypasses the RPC allowlist`);
    }
    for (const name of CONNECTION_ONLY) {
      if (new RegExp(`\\.${name}\\s*\\(`).test(text)) out.push(`${path}: calls Connection.${name}, which bypasses the RPC allowlist`);
    }
  }
  return out;
}

/** The whole check against a checkout; [] means it passed. */
export function checkRepo(root) {
  const read = rel => {
    const p = join(root, rel);
    return existsSync(p) && statSync(p).isFile() ? readFileSync(p, 'utf8') : undefined;
  };
  const exists = rel => read(rel) !== undefined;
  const {files, problems} = reachable(listSourceFiles(root), read, exists);
  if (!files.includes(RPC_FILE)) {
    problems.push(`INCONCLUSIVE: ${RPC_FILE} is reachable from no extension source — the check would pass trivially`);
    return problems;
  }
  const allowed = allowlistFrom(read(RPC_FILE) ?? '');
  if (allowed === null) return [...problems, `${RPC_FILE}: ALLOWED_RPC_METHODS not found`];
  if ([...allowed].sort().join(',') !== [...SPEC_ALLOWED].sort().join(',')) {
    problems.push(`${RPC_FILE}: ALLOWED_RPC_METHODS (${allowed.join(', ')}) differs from the spec's list`);
  }
  const texts = files.map(path => ({path, text: read(path) ?? ''}));
  if (!texts.some(({text}) => SPEC_ALLOWED.some(m => text.includes(`'${m}'`)))) {
    problems.push('INCONCLUSIVE: no allowed method name found in any bundled file — the check would pass trivially');
  }
  return [...problems, ...methodViolations(texts, allowed)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkRepo(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('rpc methods ok: every method name the extension bundles is on the proxy allowlist, and the list equals the spec');
}
```

`extension/package.json` — the `gates` script becomes:
```json
    "gates": "node scripts/check-permissions.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs",
```

- [ ] **Step 4: Run the test and the real gate**

Run: `cd extension && npx vitest run check-rpc-methods && npm run build && npm run gates`
Expected: PASS; the last line printed is `rpc methods ok: …`.

- [ ] **Step 5: Mutation checks**

1. Add `'getProgramAccounts',` to `ALLOWED_RPC_METHODS` in `core/solana/rpc.ts` → `npm run gates` fails (`differs from the spec's list`) — and the Task 1 unit test fails too.
2. Add `const probe = 'getSlot';` to `extension/src/background/walletApi.ts` → `npm run gates` fails naming `getSlot`.
3. Add `import {Connection} from '@solana/web3.js';` to `extension/src/background/prepare.ts` → the gate fails (`uses a web3.js Connection`).

- [ ] **Step 6: Commit**

```bash
git add extension/scripts/check-rpc-methods.mjs extension/scripts/__tests__/check-rpc-methods.test.mjs extension/package.json
git commit -m "feat(extension): a gate that every RPC method name the extension bundles is allowed

Follows imports from the extension into core/, refuses a web3.js Connection, and requires
core/solana/rpc.ts's list to equal the spec's.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 11: Vault primitives — re-encrypting for a changed account list, re-auth outcomes, `writeLocal`

**Files:**
- Modify: `extension/src/vault/envelope.ts` (add `reencryptForAccounts`)
- Modify: `extension/src/vault/reauth.ts` (whole file: outcomes, `openProven`, `unwrapDataKey`)
- Modify: `extension/src/ext.ts` (add `VAULT_PAGE_WRITABLE_KEY`, `writeLocal`)
- Modify: `extension/scripts/check-vault-isolation.mjs` (the vault page may import `readLocal` and `writeLocal`)
- Test: `extension/src/vault/__tests__/envelope.test.ts`, `extension/src/vault/__tests__/reauth.test.ts`, `extension/src/__tests__/ext.test.ts`, `extension/scripts/__tests__/check-vault-isolation.test.mjs` (new cases appended)

**Interfaces:**
- Consumes: B1a's envelope internals (`checkEnvelope`, `headerAad`, `isIndex`, `subtle`, `random`, `b64`, `utf8`, `decryptMnemonic`), `deriveSessionAccounts`.
- Produces:
  - `envelope.ts`: `reencryptForAccounts(env: EnvelopeV1, dataKey: Uint8Array, accounts: EnvelopeV1['accounts']): Promise<EnvelopeV1>` — same data key, same wraps, new IV, new header AAD
  - `reauth.ts`: `type ReauthFactor = {password: string; kdf: Kdf} | {prfOutput: Uint8Array}`; `type SessionKeys = Pick<SessionAccount, 'index' | 'publicKey'>[]`; `type ReauthOutcome = 'ok' | 'wrong' | 'mismatch' | 'damaged' | 'failed'`; `unwrapDataKey(env, factor): Promise<Uint8Array>`; `type Proven = {outcome: 'ok'; dataKey: Uint8Array; mnemonic: string} | {outcome: Exclude<ReauthOutcome, 'ok'>}`; `openProven(env, factor, session: SessionKeys): Promise<Proven>` (the caller zeroes an `'ok'` result's `dataKey`); `reauthenticate(env, factor, session): Promise<ReauthOutcome>`; `proveWithPassword`/`proveWithPrf` keep their B1a signatures (session widened to `SessionKeys`)
  - `ext.ts`: `VAULT_PAGE_WRITABLE_KEY = 'v1_vault'`, `writeLocal(key: string, value: unknown): Promise<void>` (throws for any other key)

Why these three: spec §2 says any code that adds or removes an account must re-encrypt the seed (its AAD is the header, accounts included) — under the **same** data key, so the password and passkey wraps stay valid. Re-authentication must tell a wrong password (retry, with the backoff) from a proof **mismatch** (the session does not belong to this vault: lock). And the vault page must be able to write the envelope — only the envelope.

- [ ] **Step 1: Write the failing tests**

In each block below that is appended to an existing test file, the `import` lines go into that file's import block at the top and the rest at the end of the file.

Append to `extension/src/vault/__tests__/envelope.test.ts` (inside the file, after the existing `describe` — it already has `MNEMONIC`, `kdf`, `accounts`):
```ts
import {reencryptForAccounts} from '../envelope';

describe('reencryptForAccounts (adding or removing an account, spec §2)', () => {
  const two = [
    {index: 0, name: 'Account 1', publicKey: 'x'},
    {index: 1, name: 'Account 2', publicKey: 'y'},
  ];

  it('re-encrypts under the same data key: the password still unlocks, the new header decrypts (positive control)', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const next = await reencryptForAccounts(env, dk, two);
    expect(next.accounts).toEqual(two);
    expect(next.password).toEqual(env.password);
    expect(next.kdf).toEqual(env.kdf);
    const dk2 = await unlockWithPassword(next, 'correct horse battery', kdf);
    expect(await decryptMnemonic(next, dk2)).toBe(MNEMONIC);
  });

  it('uses a fresh IV, and the old ciphertext does not decrypt under the new header', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const next = await reencryptForAccounts(env, dk, two);
    expect(next.seed.iv).not.toBe(env.seed.iv);
    await expect(decryptMnemonic({...next, seed: env.seed}, dk)).rejects.toThrow();
  });

  it('keeps a passkey wrap working', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const withPasskey = await addPasskeyWrap(env, dk, prf, crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
    const next = await reencryptForAccounts(withPasskey, dk, two);
    expect(await decryptMnemonic(next, await unlockWithPrf(next, prf))).toBe(MNEMONIC);
  });

  it('refuses no accounts, a duplicate index, a second cli account and the wrong data key', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    await expect(reencryptForAccounts(env, dk, [])).rejects.toThrow(/at least one account/);
    await expect(reencryptForAccounts(env, dk, [two[0]!, {...two[1]!, index: 0}])).rejects.toThrow(/malformed account/);
    const cli = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'cli', accounts, kdf});
    const cliKey = await unlockWithPassword(cli, 'correct horse battery', kdf);
    await expect(reencryptForAccounts(cli, cliKey, two)).rejects.toThrow(/cli wallet has exactly one account/);
    await expect(reencryptForAccounts(env, crypto.getRandomValues(new Uint8Array(32)), two)).rejects.toThrow();
  });
});
```

Append to `extension/src/vault/__tests__/reauth.test.ts`:
```ts
import {openProven, reauthenticate} from '../reauth';
import {CorruptEnvelope} from '../envelope';

describe('re-authentication outcomes (B1b-1)', () => {
  it("'ok' for the right factor against this vault's session (positive control)", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await reauthenticate(env, {password: 'correct horse battery', kdf}, session)).toBe('ok');
  });

  it("'wrong' for a wrong password — a typo, not a reason to lock", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await reauthenticate(env, {password: 'nope nope nope nope', kdf}, session)).toBe('wrong');
  });

  it("'mismatch' when the session is not this vault's — the caller locks", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const foreign = await deriveSessionAccounts(OTHER, 'slip10', [0]);
    expect(await reauthenticate(env, {password: 'correct horse battery', kdf}, foreign)).toBe('mismatch');
    expect(await reauthenticate(env, {password: 'correct horse battery', kdf}, [])).toBe('mismatch');
  });

  it("'damaged' for a stored envelope that is not well formed", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await reauthenticate({...env, password: {wrapped: 'AAAA'}}, {password: 'correct horse battery', kdf}, session)).toBe('damaged');
    expect(new CorruptEnvelope('x')).toBeInstanceOf(Error);
  });

  it('openProven hands over the mnemonic and a live data key only on ok, and zeroes it otherwise', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    const ok = await openProven(env, {password: 'correct horse battery', kdf}, session);
    expect(ok.outcome).toBe('ok');
    if (ok.outcome === 'ok') {
      expect(ok.mnemonic).toBe(MNEMONIC);
      expect(ok.dataKey.some(b => b !== 0)).toBe(true);
      ok.dataKey.fill(0);
    }
    let captured: Uint8Array | undefined;
    const original = envelopeModule.unlockWithPassword;
    const spy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      captured = await original(...args);
      return captured;
    });
    try {
      const foreign = await deriveSessionAccounts(OTHER, 'slip10', [0]);
      expect((await openProven(env, {password: 'correct horse battery', kdf}, foreign)).outcome).toBe('mismatch');
      expect(captured?.every(b => b === 0)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
```

Append to `extension/src/__tests__/ext.test.ts`:
```ts
import {VAULT_PAGE_WRITABLE_KEY, writeLocal} from '../ext';

describe("writeLocal (the vault page's one storage write)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes the envelope key to storage.local and refuses every other key', async () => {
    const written: unknown[] = [];
    vi.stubGlobal('chrome', {storage: {local: {set: async (o: unknown) => void written.push(o)}}});
    await writeLocal('v1_vault', {v: 1});
    expect(written).toEqual([{v1_vault: {v: 1}}]);
    expect(VAULT_PAGE_WRITABLE_KEY).toBe('v1_vault');
    for (const key of ['v1_settings', 'v1_known_recipients', 'v1_session', 'x']) await expect(writeLocal(key, 1)).rejects.toThrow('the vault page may write v1_vault only');
    expect(written).toHaveLength(1);
  });
});
```

Append inside the `describe('vault isolation (storage, and what may import src/ext.ts)'` block of `extension/scripts/__tests__/check-vault-isolation.test.mjs`:
```js
  it('lets the vault page import writeLocal next to readLocal — and still nothing else', () => {
    expect(sourceViolations([
      f('src/unlock/main.ts', "import {readLocal, writeLocal} from '../ext';"),
      f('src/unlock/onboarding.ts', "import {writeLocal as write} from '../ext';"),
    ])).toEqual([]);
    const EXT = path => `${path}: imports src/ext.ts (storage.session) outside the background`;
    expect(sourceViolations([f('src/unlock/main.ts', "import {writeLocal, browserExt} from '../ext';")])).toEqual([EXT('src/unlock/main.ts')]);
    expect(sourceViolations([f('src/popup/main.ts', "import {writeLocal} from '../ext';")])).toEqual([EXT('src/popup/main.ts')]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd extension && npx vitest run envelope.test reauth.test ext.test check-vault-isolation`
Expected: FAIL — `reencryptForAccounts`, `reauthenticate`, `openProven`, `writeLocal` are not exported; the gate still refuses `writeLocal`.

- [ ] **Step 3: Write the implementations**

`extension/src/vault/envelope.ts` — append:
```ts
/**
 * The account list changed (an account added or removed, spec §2): re-encrypt the seed under the
 * SAME data key with the new header as its additionalData. The password and passkey wraps wrap the
 * data key, not the seed, so they stay valid; the IV is fresh (AES-GCM must never reuse an IV under
 * one key). Decrypting first proves `dataKey` and the current header before anything is written.
 * Names are copied but, as everywhere, not part of the AAD.
 */
export async function reencryptForAccounts(env: EnvelopeV1, dataKey: Uint8Array, accounts: EnvelopeV1['accounts']): Promise<EnvelopeV1> {
  checkEnvelope(env);
  assertArrayBufferBacked(dataKey);
  if (accounts.length === 0) throw new TypeError('an envelope needs at least one account');
  const seen = new Set<number>();
  for (const a of accounts) {
    if (!isIndex(a.index) || typeof a.name !== 'string' || typeof a.publicKey !== 'string' || seen.has(a.index)) throw new TypeError('malformed account');
    seen.add(a.index);
  }
  if (env.scheme === 'cli' && (accounts.length !== 1 || accounts[0]?.index !== 0)) throw new TypeError('a cli wallet has exactly one account');
  const mnemonic = await decryptMnemonic(env, dataKey);
  const clean = accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey}));
  const aad = headerAad({v: 1, scheme: env.scheme, kdf: env.kdf, accounts: clean});
  const iv = random(12);
  const encoded = utf8(mnemonic);
  try {
    const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['encrypt']);
    const ct = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv, additionalData: aad}, key, encoded));
    return {...env, seed: {iv: b64(iv), ct: b64(ct)}, accounts: clean};
  } finally {
    encoded.fill(0);
  }
}
```

`extension/src/vault/reauth.ts` — replace the whole file:
```ts
import {
  CorruptEnvelope, decryptMnemonic, unlockWithPassword, unlockWithPrf, UnsafeKdfParams, WrongPasskey, WrongPassword, type EnvelopeV1, type Kdf,
} from './envelope';
import {deriveSessionAccounts, type SessionAccount} from './accounts';

/**
 * Re-authentication proves the factor, not just that someone clicked (spec §2): unwrap the data
 * key, decrypt the seed, re-derive the session's accounts and require every public key to match
 * what the background holds.
 *
 * The outcomes are kept apart because the callers act on them differently: 'wrong' is a typo (retry,
 * with the wrong-password backoff); 'mismatch' means the session does not belong to this vault —
 * spec §2: "A mismatch locks the vault"; 'damaged' is a stored envelope this code could not have
 * written; 'failed' is anything else.
 *
 * An empty session fails ('mismatch'): `[].every(...)` is vacuously true, so without the length
 * guard a proof against no accounts would prove nothing. Every data key is zeroed on every path
 * except an 'ok' from openProven, which hands it to the caller.
 */
export type ReauthFactor = {password: string; kdf: Kdf} | {prfOutput: Uint8Array};
export type SessionKeys = Pick<SessionAccount, 'index' | 'publicKey'>[];
export type ReauthOutcome = 'ok' | 'wrong' | 'mismatch' | 'damaged' | 'failed';
export type Proven = {outcome: 'ok'; dataKey: Uint8Array; mnemonic: string} | {outcome: Exclude<ReauthOutcome, 'ok'>};

export function unwrapDataKey(env: EnvelopeV1, factor: ReauthFactor): Promise<Uint8Array> {
  return 'prfOutput' in factor ? unlockWithPrf(env, factor.prfOutput) : unlockWithPassword(env, factor.password, factor.kdf);
}

/** The proof, handing over the seed phrase and the data key on success (the caller zeroes the key). */
export async function openProven(env: EnvelopeV1, factor: ReauthFactor, session: SessionKeys): Promise<Proven> {
  let dataKey: Uint8Array;
  try {
    dataKey = await unwrapDataKey(env, factor);
  } catch (e) {
    if (e instanceof WrongPassword || e instanceof WrongPasskey) return {outcome: 'wrong'};
    if (e instanceof CorruptEnvelope || e instanceof UnsafeKdfParams) return {outcome: 'damaged'};
    return {outcome: 'failed'};
  }
  let handedOver = false;
  try {
    let mnemonic: string;
    try {
      mnemonic = await decryptMnemonic(env, dataKey);
    } catch {
      // The factor already unwrapped the key: a failure here is corruption, not a wrong guess.
      return {outcome: 'damaged'};
    }
    const derived = await deriveSessionAccounts(mnemonic, env.scheme, session.map(a => a.index));
    // every() walks derived, so a shorter derived would pass on a prefix: the lengths must match.
    const same = session.length > 0 && derived.length === session.length && derived.every((d, i) => d.publicKey === session[i]?.publicKey);
    if (!same) return {outcome: 'mismatch'};
    handedOver = true;
    return {outcome: 'ok', dataKey, mnemonic};
  } catch {
    return {outcome: 'failed'};
  } finally {
    if (!handedOver) dataKey.fill(0);
  }
}

export async function reauthenticate(env: EnvelopeV1, factor: ReauthFactor, session: SessionKeys): Promise<ReauthOutcome> {
  const proven = await openProven(env, factor, session);
  if (proven.outcome === 'ok') proven.dataKey.fill(0);
  return proven.outcome;
}

export async function proveWithPassword(env: EnvelopeV1, password: string, kdf: Kdf, session: SessionKeys): Promise<boolean> {
  return (await reauthenticate(env, {password, kdf}, session)) === 'ok';
}

export async function proveWithPrf(env: EnvelopeV1, prfOutput: Uint8Array, session: SessionKeys): Promise<boolean> {
  return (await reauthenticate(env, {prfOutput}, session)) === 'ok';
}
```

`extension/src/ext.ts` — add below `readLocal`:
```ts
/** The one storage.local key the vault page may write: the envelope (onboarding, adding or removing an account). */
export const VAULT_PAGE_WRITABLE_KEY = 'v1_vault';

/**
 * The vault page's one storage write. Refuses any other key at run time; the vault-isolation gate
 * lets src/unlock/ import exactly `readLocal` and `writeLocal` from this file.
 */
export async function writeLocal(key: string, value: unknown): Promise<void> {
  if (key !== VAULT_PAGE_WRITABLE_KEY) throw new Error(`the vault page may write ${VAULT_PAGE_WRITABLE_KEY} only`);
  await extensionApi().storage.local.set({[key]: value});
}
```

`extension/scripts/check-vault-isolation.mjs`:
- replace `const LOCAL_READER = 'readLocal';` with
```js
// The two ext.ts exports the vault page may import: read any storage.local key, write v1_vault only.
const VAULT_PAGE_EXT_EXPORTS = ['readLocal', 'writeLocal'];
```
- in `importsOnlyLocalReader`, replace the `values.every(…)` test with
```js
  return values.length > 0 && values.every(n => new RegExp(`^(${VAULT_PAGE_EXT_EXPORTS.join('|')})(\\s+as\\s+[\\w$]+)?$`).test(n));
```
- update the file's header comment sentence "the vault page may import exactly `readLocal` (LOCAL_READER), which reads storage.local only" to "the vault page may import exactly `readLocal` and `writeLocal` (VAULT_PAGE_EXT_EXPORTS), the latter writing `v1_vault` only".

- [ ] **Step 4: Run the tests, the build and the gates**

Run: `cd extension && npx vitest run && npx tsc --noEmit && npm run build && npm run gates`
Expected: PASS — B1a's existing `reauth.test.ts`, `unlockFlow.test.ts` and `ext.test.ts` cases pass unchanged.

- [ ] **Step 5: Mutation checks**

1. In `reencryptForAccounts`, reuse `unb64(env.seed.iv)` instead of `random(12)` → "uses a fresh IV" fails.
2. Build the AAD from `env.accounts` instead of `clean` → the positive control fails (the new header does not decrypt).
3. In `openProven`, return `{outcome: 'wrong'}` for the `same === false` case → "'mismatch' when the session is not this vault's" fails.
4. In `writeLocal`, delete the key check → "refuses every other key" fails.
5. In the gate, set `VAULT_PAGE_EXT_EXPORTS = ['readLocal']` → "lets the vault page import writeLocal" fails.

- [ ] **Step 6: Commit**

```bash
git add extension/src/vault extension/src/ext.ts extension/src/__tests__/ext.test.ts extension/scripts/check-vault-isolation.mjs extension/scripts/__tests__/check-vault-isolation.test.mjs
git commit -m "feat(extension): vault primitives for accounts and re-authentication

Re-encrypt the seed under the same data key when the account list changes; tell a wrong
factor from a proof mismatch; let the vault page write the envelope and nothing else.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 12: The vault page's modes — create, import, re-authenticate, add/remove accounts, reveal the phrase

**Files:**
- Create: `extension/src/unlock/types.ts`, `onboarding.ts`, `reauthFlow.ts`, `accountsFlow.ts`, `revealFlow.ts`, `mode.ts`, `modes.ts`
- Modify: `extension/src/unlock/main.ts` (start the mode), `extension/src/unlock/orchestrate.ts` (the backoff also serves re-authentication)
- Modify: `extension/unlock.html` (whole file: one section per mode)
- Modify: `extension/scripts/check-vault-isolation.mjs` (sixth bundle marker: the BIP-39 English wordlist)
- Test: `extension/src/unlock/__tests__/{onboarding,reauthFlow,accountsFlow,revealFlow,mode}.test.ts`; append to `orchestrate.test.ts` and `scripts/__tests__/check-vault-isolation.test.mjs`

**Interfaces:**
- Consumes: `reencryptForAccounts`, `openProven`, `reauthenticate`, `ReauthFactor`, `SessionKeys`, `writeLocal` (Task 11); `generateMnemonic`, `validateMnemonic`, `normalizeMnemonicInput`, `mnemonicToSeed` (`core/keys/mnemonic.ts`); `deriveTransparentKeypair` (`core/keys/transparent.ts`); `createEnvelope`, `addPasskeyWrap`, `unlockWithPassword` and the error classes; `deriveSessionAccounts`; `registerPasskey`, `evaluatePrf`; the background's `wallet.probeBalances`, `vault.status`, `vault.setKeys`, `vault.lock`, `vault.reauthOk` (Task 9).
- Produces:
  - `types.ts`: `type Send = (m: unknown) => Promise<{ok: boolean; error?: string; data?: unknown}>`; `interface VaultStore {readEnvelope(): Promise<unknown>; writeEnvelope(env: EnvelopeV1): Promise<void>}`
  - `onboarding.ts`: `MIN_PASSWORD_LENGTH = 12`, `SLIP10_ACCOUNTS_TO_SCAN = 5`; `newMnemonic(): string`; `interface Candidate {scheme: 'slip10' | 'cli'; index: number; publicKey: string}`; `importCandidates(mnemonic): Promise<Candidate[]>`; `interface ProbeResult {resolved: boolean; funded: ReadonlySet<string>}`; `probeCandidates(send, candidates): Promise<ProbeResult>`; `type SchemeChoice = {scheme: 'slip10' | 'cli'} | {choose: 'both-funded' | 'unresolved'}`; `chooseScheme(candidates, probe): SchemeChoice`; `indexesFor(scheme, candidates, probe): number[]`; `type FinishOutcome = 'created' | 'created-locked' | 'exists' | 'weak-password' | 'invalid-mnemonic' | 'failed'`; `finishOnboarding(deps: VaultStore & {send: Send; kdf: Kdf}, input: {mnemonic; password; scheme; indexes: number[]}): Promise<FinishOutcome>`; `type PasskeyOutcome = 'added' | 'unsupported' | 'wrong' | 'no-wallet' | 'damaged' | 'failed'`; `addPasskey(deps: VaultStore & {credentials: CredentialsApi; randomBytes(n: number): Uint8Array}, factor: {password: string; kdf: Kdf}): Promise<PasskeyOutcome>`
  - `reauthFlow.ts`: `sessionKeys(send): Promise<SessionKeys | null>`; `type ReauthPageOutcome = 'confirmed' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed'`; `runReauth(deps: {readEnvelope(): Promise<unknown>; send: Send}, challengeId: string, factor: ReauthFactor): Promise<ReauthPageOutcome>`
  - `accountsFlow.ts`: `type AccountsOutcome = 'done' | 'wrong' | 'mismatch-locked' | 'damaged' | 'not-unlocked' | 'no-wallet' | 'cli-single' | 'last-account' | 'no-such-account' | 'failed'`; `addAccount(deps: VaultStore & {send: Send}, factor: ReauthFactor)`; `removeAccount(deps, factor, index: number)`
  - `revealFlow.ts`: `type RevealOutcome = {outcome: 'shown'; words: string[]} | {outcome: 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed'}`; `runReveal(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RevealOutcome>`
  - `mode.ts`: `type PageMode = {mode: 'unlock'} | {mode: 'create'} | {mode: 'import'} | {mode: 'accounts'} | {mode: 'reveal'} | {mode: 'reauth'; challengeId: string}`; `pageMode(search: string): PageMode`
  - `modes.ts`: `startMode(mode: PageMode): void` (DOM wiring only)
  - `check-vault-isolation.mjs`: `WORDLIST_MARKER = 'abandon\nability\nable\nabout'`

**Seed reveal (spec §2 "Showing the seed phrase"; review M1).** `?mode=reveal`: the same proof as re-authentication (a mismatch locks the vault), the data key zeroed at once, the words rendered into the vault page and nowhere else — no copy button, no clipboard, never sent to the background, logged or stored; a "Hide" control clears them. The vault page is only ever a tab (the popup opens it with `tabs.create`). The screen's design is B1b-2.

**Backoff everywhere a password is proven (review M2).** The wrong-password backoff wraps unlock, re-authentication (password and passkey), account add/remove and the reveal; a proven outcome (`unlocked`, `confirmed`, `done`, `shown`) ends the streak.

**What this is, and what it is not.** The flows are pure functions with injected storage, messaging and KDF, fully tested here. The page modes are **thin**: fixed strings, bare inputs, no design — B1b-2 builds the owner's onboarding and security screens on these same functions. The vault page never touches the network: import asks the background (`wallet.probeBalances`, public keys only). **Stated gap:** adding a passkey has its tested flow (`addPasskey`) but no page control until B1b-2.

- [ ] **Step 1: Write the failing tests**

`extension/src/unlock/__tests__/mode.test.ts`:
```ts
import {pageMode} from '../mode';

describe('pageMode', () => {
  const id = 'ab'.repeat(16);
  it('reads the mode from the query string; anything unknown is the unlock page', () => {
    expect(pageMode('')).toEqual({mode: 'unlock'});
    expect(pageMode('?mode=create')).toEqual({mode: 'create'});
    expect(pageMode('?mode=import')).toEqual({mode: 'import'});
    expect(pageMode('?mode=accounts')).toEqual({mode: 'accounts'});
    expect(pageMode('?mode=reveal')).toEqual({mode: 'reveal'});
    expect(pageMode('?mode=export')).toEqual({mode: 'unlock'});
  });

  it('re-authentication needs a well-formed challenge id', () => {
    expect(pageMode(`?mode=reauth&challenge=${id}`)).toEqual({mode: 'reauth', challengeId: id});
    expect(pageMode('?mode=reauth&challenge=<b>')).toEqual({mode: 'unlock'});
    expect(pageMode('?mode=reauth')).toEqual({mode: 'unlock'});
  });
});
```

`extension/src/unlock/__tests__/onboarding.test.ts`:
```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {validateMnemonic} from '../../../../core/keys/mnemonic';
import {createEnvelope, decryptMnemonic, unlockWithPassword, unlockWithPrf, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import type {CredentialsApi} from '../../vault/passkey';
import {addPasskey, chooseScheme, finishOnboarding, importCandidates, indexesFor, newMnemonic, probeCandidates, type Candidate} from '../onboarding';
import type {Send} from '../types';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery';
// Declares production Argon2id (the envelope refuses less), computes a tiny cost: see envelope.test.ts.
let kdfCalls = 0;
const kdf: Kdf = (pw, salt) => (kdfCalls++, argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32}));

function memoryStore(initial: unknown = undefined) {
  const writes: EnvelopeV1[] = [];
  let env = initial;
  return {writes, readEnvelope: async () => env, writeEnvelope: async (e: EnvelopeV1) => void (writes.push(e), (env = e))};
}
function recorder(reply: (m: {type: string}) => {ok: boolean; data?: unknown} = () => ({ok: true})) {
  const sent: {type: string; [k: string]: unknown}[] = [];
  const send: Send = async m => {
    sent.push(m as {type: string});
    return reply(m as {type: string});
  };
  return {sent, send};
}

describe('create', () => {
  it('a new phrase is 24 valid words (256 bits)', () => {
    const m = newMnemonic();
    expect(m.split(' ')).toHaveLength(24);
    expect(validateMnemonic(m)).toBe(true);
  });
});

describe('import detection', () => {
  it('derives SLIP-0010 accounts 0–4 and cli locally — the app\'s vectors', async () => {
    const c = await importCandidates(MNEMONIC);
    expect(c).toHaveLength(6);
    expect(c[0]).toEqual({scheme: 'slip10', index: 0, publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'});
    expect(c[5]?.scheme).toBe('cli');
    expect(new Set(c.map(x => x.publicKey)).size).toBe(6);
  });

  it('asks the background for balances with public keys only, and reads funded from SOL or NOC', async () => {
    const c = await importCandidates(MNEMONIC);
    const {sent, send} = recorder(() => ({
      ok: true,
      data: {resolved: true, balances: [{publicKey: c[0]!.publicKey, lamports: '0', noc: '7'}, {publicKey: c[1]!.publicKey, lamports: '0', noc: '0'}]},
    }));
    const probe = await probeCandidates(send, c);
    expect(sent).toEqual([{type: 'wallet.probeBalances', publicKeys: c.map(x => x.publicKey)}]);
    expect([...probe.funded]).toEqual([c[0]!.publicKey]);
    expect(probe.resolved).toBe(true);
  });

  it('an unanswered or refused probe is "unresolved", never "nothing funded"', async () => {
    const c = await importCandidates(MNEMONIC);
    const failing: Send = async () => {
      throw new Error('gone');
    };
    expect((await probeCandidates(failing, c)).resolved).toBe(false);
    expect((await probeCandidates(recorder(() => ({ok: false})).send, c)).resolved).toBe(false);
    expect((await probeCandidates(recorder(() => ({ok: true, data: {resolved: false, balances: []}})).send, c)).resolved).toBe(false);
  });

  it('funded wins; both funded or unresolved means the user chooses', async () => {
    const c = await importCandidates(MNEMONIC);
    const funded = (...keys: Candidate[]) => ({resolved: true, funded: new Set(keys.map(k => k.publicKey))});
    expect(chooseScheme(c, funded())).toEqual({scheme: 'slip10'});
    expect(indexesFor('slip10', c, funded())).toEqual([0]);
    expect(chooseScheme(c, funded(c[2]!))).toEqual({scheme: 'slip10'});
    expect(indexesFor('slip10', c, funded(c[2]!))).toEqual([0, 1, 2]);
    expect(chooseScheme(c, funded(c[5]!))).toEqual({scheme: 'cli'});
    expect(indexesFor('cli', c, funded(c[5]!))).toEqual([0]);
    expect(chooseScheme(c, funded(c[0]!, c[5]!))).toEqual({choose: 'both-funded'});
    expect(chooseScheme(c, {resolved: false, funded: new Set()})).toEqual({choose: 'unresolved'});
  });
});

describe('finishOnboarding', () => {
  beforeEach(() => {
    kdfCalls = 0;
  });

  it('stores the envelope and hands the background the keys (positive control); the phrase is stored normalised', async () => {
    const store = memoryStore();
    const {sent, send} = recorder();
    const typed = `  ${MNEMONIC.toUpperCase().replace(/ /g, '  ')}.`;
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: typed, password: PASSWORD, scheme: 'slip10', indexes: [0, 1]})).toBe('created');
    const env = store.writes[0]!;
    expect(env.accounts.map(a => [a.index, a.name])).toEqual([[0, 'Account 1'], [1, 'Account 2']]);
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PASSWORD, kdf))).toBe(MNEMONIC);
    const setKeys = sent[0] as {type: string; accounts: {publicKey: string}[]};
    expect(setKeys.type).toBe('vault.setKeys');
    expect(setKeys.accounts.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
  });

  it('refuses a short password and an invalid phrase, and writes nothing', async () => {
    const store = memoryStore();
    const {send} = recorder();
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: MNEMONIC, password: 'x'.repeat(11), scheme: 'slip10', indexes: [0]})).toBe('weak-password');
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: 'abandon '.repeat(12).trim(), password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('invalid-mnemonic');
    expect(store.writes).toHaveLength(0);
  });

  it('never overwrites a vault — checked before the Argon2id run', async () => {
    const existing = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: 'x'}], kdf});
    kdfCalls = 0;
    const store = memoryStore(existing);
    expect(await finishOnboarding({...store, send: recorder().send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('exists');
    expect(kdfCalls).toBe(0);
    expect(store.writes).toHaveLength(0);
  });

  it('— and again after it, when another tab finished first', async () => {
    const store = memoryStore();
    let reads = 0;
    const racing = {...store, readEnvelope: async () => (reads++ === 0 ? undefined : {v: 1})};
    expect(await finishOnboarding({...racing, send: recorder().send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('exists');
    expect(store.writes).toHaveLength(0);
  });

  it('a refused hand-over still leaves the wallet created — to unlock normally', async () => {
    const store = memoryStore();
    expect(await finishOnboarding({...store, send: recorder(() => ({ok: false})).send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'cli', indexes: [0]})).toBe('created-locked');
    expect(store.writes[0]?.scheme).toBe('cli');
  });
});

describe('addPasskey', () => {
  function credentials(prf: Uint8Array | null): CredentialsApi {
    const cred = (withPrf: boolean) =>
      ({
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        getClientExtensionResults: () => (withPrf && prf !== null ? {prf: {results: {first: prf.slice().buffer}}} : {}),
      }) as unknown as Credential;
    return {create: async () => cred(false), get: async () => cred(true)};
  }
  const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

  it('wraps the data key for the passkey (positive control): the PRF output then unlocks it', async () => {
    const store = memoryStore(await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: 'x'}], kdf}));
    const prf = randomBytes(32);
    expect(await addPasskey({...store, credentials: credentials(prf), randomBytes}, {password: PASSWORD, kdf})).toBe('added');
    const env = store.writes[0]!;
    expect(await decryptMnemonic(env, await unlockWithPrf(env, prf))).toBe(MNEMONIC);
  });

  it('unsupported (no PRF), a wrong password and no wallet write nothing', async () => {
    const store = memoryStore(await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: 'x'}], kdf}));
    expect(await addPasskey({...store, credentials: credentials(null), randomBytes}, {password: PASSWORD, kdf})).toBe('unsupported');
    expect(await addPasskey({...store, credentials: credentials(randomBytes(32)), randomBytes}, {password: 'wrong wrong wrong', kdf})).toBe('wrong');
    expect(await addPasskey({...memoryStore(), credentials: credentials(null), randomBytes}, {password: PASSWORD, kdf})).toBe('no-wallet');
    expect(store.writes).toHaveLength(0);
  });
});
```

`extension/src/unlock/__tests__/reauthFlow.test.ts`:
```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {runReauth} from '../reauthFlow';
import type {Send} from '../types';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'correct horse battery';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const ID = 'cd'.repeat(16);

async function setup(sessionMnemonic: string | null) {
  const session = sessionMnemonic === null ? [] : await deriveSessionAccounts(sessionMnemonic, 'slip10', [0]);
  const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}], kdf});
  const sent: {type: string; challengeId?: string}[] = [];
  const send: Send = async m => {
    const msg = m as {type: string};
    sent.push(msg);
    if (msg.type === 'vault.status') return {ok: true, data: {unlocked: sessionMnemonic !== null, accounts: session.map(a => ({index: a.index, publicKey: a.publicKey}))}};
    return {ok: true};
  };
  return {deps: {readEnvelope: async () => env, send}, sent};
}

describe('runReauth (the vault page proves the factor, the background is told)', () => {
  it('confirmed: proves against the session\'s public keys, then sends vault.reauthOk (positive control)', async () => {
    const {deps, sent} = await setup(MNEMONIC);
    expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('confirmed');
    expect(sent.map(m => m.type)).toEqual(['vault.status', 'vault.reauthOk']);
    expect(sent[1]?.challengeId).toBe(ID);
  });

  it('a wrong password tells the background nothing', async () => {
    const {deps, sent} = await setup(MNEMONIC);
    expect(await runReauth(deps, ID, {password: 'nope nope nope nope', kdf})).toBe('wrong');
    expect(sent.map(m => m.type)).toEqual(['vault.status']);
  });

  it('a proof mismatch locks the vault (spec §2)', async () => {
    const {deps, sent} = await setup(OTHER);
    expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('mismatch-locked');
    expect(sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
  });

  it('a locked vault cannot be re-authenticated, and a passkey output is always zeroed', async () => {
    const {deps} = await setup(null);
    const prfOutput = crypto.getRandomValues(new Uint8Array(32));
    expect(await runReauth(deps, ID, {prfOutput})).toBe('not-unlocked');
    expect(prfOutput.every(b => b === 0)).toBe(true);
  });

  it('no wallet', async () => {
    const {sent, deps} = await setup(MNEMONIC);
    expect(await runReauth({...deps, readEnvelope: async () => undefined}, ID, {password: PASSWORD, kdf})).toBe('no-wallet');
    expect(sent).toHaveLength(0);
  });
});
```

`extension/src/unlock/__tests__/revealFlow.test.ts`:
```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../../vault/envelope';
import * as envelopeModule from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {runReveal} from '../revealFlow';
import type {Send} from '../types';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'correct horse battery';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});

async function setup(sessionMnemonic: string | null) {
  const session = sessionMnemonic === null ? [] : await deriveSessionAccounts(sessionMnemonic, 'slip10', [0]);
  const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}], kdf});
  const sent: {type: string}[] = [];
  const send: Send = async m => {
    const msg = m as {type: string};
    sent.push(msg);
    if (msg.type === 'vault.status') return {ok: true, data: {unlocked: sessionMnemonic !== null, accounts: session.map(a => ({index: a.index, publicKey: a.publicKey}))}};
    return {ok: true};
  };
  return {deps: {readEnvelope: async () => env, send}, sent};
}

describe('runReveal (spec §2: the phrase, only after a proof, only in the vault page)', () => {
  it('shows the words after a proof — and tells the background nothing (positive control)', async () => {
    const {deps, sent} = await setup(MNEMONIC);
    expect(await runReveal(deps, {password: PASSWORD, kdf})).toEqual({outcome: 'shown', words: MNEMONIC.split(' ')});
    expect(sent.map(m => m.type)).toEqual(['vault.status']);
  });

  it('zeroes the data key it unwrapped', async () => {
    const {deps} = await setup(MNEMONIC);
    let captured: Uint8Array | undefined;
    const original = envelopeModule.unlockWithPassword;
    const spy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      captured = await original(...args);
      return captured;
    });
    try {
      expect((await runReveal(deps, {password: PASSWORD, kdf})).outcome).toBe('shown');
      expect(captured?.every(b => b === 0)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('a wrong password shows nothing; a mismatch locks the vault; a locked vault shows nothing', async () => {
    expect((await runReveal((await setup(MNEMONIC)).deps, {password: 'nope nope nope nope', kdf})).outcome).toBe('wrong');
    const foreign = await setup(OTHER);
    expect(await runReveal(foreign.deps, {password: PASSWORD, kdf})).toEqual({outcome: 'mismatch-locked'});
    expect(foreign.sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
    const prfOutput = crypto.getRandomValues(new Uint8Array(32));
    expect(await runReveal((await setup(null)).deps, {prfOutput})).toEqual({outcome: 'not-unlocked'});
    expect(prfOutput.every(b => b === 0)).toBe(true);
  });
});
```

`extension/src/unlock/__tests__/accountsFlow.test.ts`:
```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {addAccount, removeAccount} from '../accountsFlow';
import type {Send} from '../types';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'correct horse battery';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});

async function wallet(indexes: number[], scheme: 'slip10' | 'cli' = 'slip10', sessionMnemonic = MNEMONIC) {
  const derived = await deriveSessionAccounts(MNEMONIC, scheme, indexes);
  const accounts = derived.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}));
  let env: EnvelopeV1 = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme, accounts, kdf});
  const session = await deriveSessionAccounts(sessionMnemonic, scheme, indexes);
  const writes: EnvelopeV1[] = [];
  const sent: {type: string; accounts?: {index: number; publicKey: string}[]}[] = [];
  const send: Send = async m => {
    const msg = m as {type: string};
    sent.push(msg);
    if (msg.type === 'vault.status') return {ok: true, data: {unlocked: true, accounts: session.map(a => ({index: a.index, publicKey: a.publicKey}))}};
    return {ok: true};
  };
  const deps = {readEnvelope: async () => env, writeEnvelope: async (e: EnvelopeV1) => void (writes.push(e), (env = e)), send};
  return {deps, writes, sent};
}

describe('accounts in the vault page', () => {
  it('adds the next SLIP-0010 account: re-encrypted under the same password, new keys handed over (positive control)', async () => {
    const {deps, writes, sent} = await wallet([0]);
    expect(await addAccount(deps, {password: PASSWORD, kdf})).toBe('done');
    const env = writes[0]!;
    const expected = await deriveSessionAccounts(MNEMONIC, 'slip10', [0, 1]);
    expect(env.accounts).toEqual([
      {index: 0, name: 'Account 1', publicKey: expected[0]!.publicKey},
      {index: 1, name: 'Account 2', publicKey: expected[1]!.publicKey},
    ]);
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PASSWORD, kdf))).toBe(MNEMONIC);
    const setKeys = sent.at(-1)!;
    expect(setKeys.type).toBe('vault.setKeys');
    expect(setKeys.accounts?.map(a => a.publicKey)).toEqual(expected.map(a => a.publicKey));
  });

  it('removes an account, and refuses the last one and an unknown one', async () => {
    const two = await wallet([0, 1]);
    expect(await removeAccount(two.deps, {password: PASSWORD, kdf}, 1)).toBe('done');
    expect(two.writes[0]?.accounts.map(a => a.index)).toEqual([0]);
    expect(await decryptMnemonic(two.writes[0]!, await unlockWithPassword(two.writes[0]!, PASSWORD, kdf))).toBe(MNEMONIC);
    const one = await wallet([0]);
    expect(await removeAccount(one.deps, {password: PASSWORD, kdf}, 0)).toBe('last-account');
    expect(await removeAccount(one.deps, {password: PASSWORD, kdf}, 5)).toBe('no-such-account');
    expect(one.writes).toHaveLength(0);
  });

  it('a cli wallet has exactly one account', async () => {
    const cli = await wallet([0], 'cli');
    expect(await addAccount(cli.deps, {password: PASSWORD, kdf})).toBe('cli-single');
    expect(cli.writes).toHaveLength(0);
  });

  it('a wrong password changes nothing; a proof mismatch locks the vault and changes nothing', async () => {
    const w = await wallet([0]);
    expect(await addAccount(w.deps, {password: 'nope nope nope nope', kdf})).toBe('wrong');
    expect(w.writes).toHaveLength(0);
    const foreign = await wallet([0], 'slip10', OTHER);
    expect(await addAccount(foreign.deps, {password: PASSWORD, kdf})).toBe('mismatch-locked');
    expect(foreign.sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
    expect(foreign.writes).toHaveLength(0);
  });
});
```

Append to `extension/src/unlock/__tests__/orchestrate.test.ts` (the `createWrongBackoff` import is already there; add it to the import if not):
```ts
describe('the wrong-password backoff also serves re-authentication, accounts and the reveal', () => {
  it.each(['confirmed', 'done', 'shown'])("a proven '%s' ends the streak, like 'unlocked'", async success => {
    const sleeps: number[] = [];
    const backoff = createWrongBackoff(async ms => void sleeps.push(ms));
    const run = (o: string) => backoff.run(async () => o, () => undefined);
    await run('wrong');
    await run('wrong');
    await run(success);
    await run('wrong');
    expect(sleeps).toEqual([1000]);
  });

  it('any other outcome leaves the streak as it is (negative control)', async () => {
    const sleeps: number[] = [];
    const backoff = createWrongBackoff(async ms => void sleeps.push(ms));
    const run = (o: string) => backoff.run(async () => o, () => undefined);
    await run('wrong');
    await run('wrong');
    await run('failed');
    await run('wrong');
    expect(sleeps).toEqual([1000, 2000]);
  });
});
```

In `extension/scripts/__tests__/check-vault-isolation.test.mjs`:
- add `WORDLIST_MARKER` to the import list from `'../check-vault-isolation.mjs'`;
- in `baseline()`, the `assets/unlock-1.js` line becomes:
```js
    write('assets/unlock-1.js', `import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
```
- in "does not follow imports out of the unlock bundle", the `assets/vault-1.js` line becomes:
```js
    write('assets/vault-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
```
- in "is INCONCLUSIVE — and fails — when any marker is in no built file", replace the first three lines of the test body with:
```js
    const all = {i: VAULT_MARKER, d: DERIVATION_MARKER, b: BIP39_MARKER, r: PASSKEY_MARKER, w: WORDLIST_MARKER};
    const without = k => Object.entries(all).filter(([n]) => n !== k).map(([n, m]) => `const ${n}=\`${m}\`;`).join('');
    for (const [k, name, marker] of [['i', 'envelope', VAULT_MARKER], ['d', 'derivation', DERIVATION_MARKER], ['b', 'bip39', BIP39_MARKER], ['r', 'passkey', PASSKEY_MARKER], ['w', 'wordlist', WORDLIST_MARKER]]) {
```
- in "does not count a marker found only in a non-JS file", the `assets/unlock-1.js` line becomes:
```js
    write('assets/unlock-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
```
- add, next to "fails on the KDF marker alone":
```js
  it('fails on the wordlist marker alone — generateMnemonic outside the vault page', () => {
    write('assets/send-1.js', `export const words=\`${WORDLIST_MARKER}\`;`);
    expect(bundleViolations(dir)).toEqual(['assets/send-1.js (reachable from assets/popup-1.js) contains vault code (wordlist)']);
  });

  it('the wordlist marker is how the real build spells the list: a template literal with newlines', () => {
    expect(WORDLIST_MARKER).toBe('abandon\nability\nable\nabout');
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd extension && npx vitest run src/unlock scripts/__tests__/check-vault-isolation`
Expected: FAIL — missing `../mode`, `../onboarding`, `../reauthFlow`, `../accountsFlow`, `WORDLIST_MARKER`; the backoff test sleeps `[1000, 2000]`.

- [ ] **Step 3: Write the implementations**

`extension/src/unlock/types.ts`:
```ts
import type {EnvelopeV1} from '../vault/envelope';

/** runtime.sendMessage to the background, typed as src/ui/send.ts returns it. */
export type Send = (m: unknown) => Promise<{ok: boolean; error?: string; data?: unknown}>;

/** The envelope in storage.local: read with readLocal, written with writeLocal (v1_vault only). */
export interface VaultStore {
  readEnvelope(): Promise<unknown>;
  writeEnvelope(env: EnvelopeV1): Promise<void>;
}
```

`extension/src/unlock/onboarding.ts`:
```ts
import {base58} from '@scure/base';
import {generateMnemonic, mnemonicToSeed, normalizeMnemonicInput, validateMnemonic} from '../../../core/keys/mnemonic';
import {deriveTransparentKeypair} from '../../../core/keys/transparent';
import {
  CorruptEnvelope, UnsafeKdfParams, WrongPassword, addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1, type Kdf,
} from '../vault/envelope';
import {deriveSessionAccounts} from '../vault/accounts';
import {registerPasskey, type CredentialsApi} from '../vault/passkey';
import type {Send, VaultStore} from './types';

/** Spec §2: at least 12 characters. Recovery is the seed phrase and nothing else. */
export const MIN_PASSWORD_LENGTH = 12;
/** The app's auto-detection scans SLIP-0010 accounts 0–4 (accountDetection.ts), plus cli. */
export const SLIP10_ACCOUNTS_TO_SCAN = 5;

/** Create: 24 words, 256 bits of entropy (spec §2; the app's generate(wordlist, 256)). */
export function newMnemonic(): string {
  return generateMnemonic();
}

export interface Candidate {
  scheme: 'slip10' | 'cli';
  index: number;
  publicKey: string;
}

/** Every address the phrase could mean, derived locally; the secret halves are zeroed at once. */
export async function importCandidates(mnemonic: string): Promise<Candidate[]> {
  const seed = await mnemonicToSeed(mnemonic);
  try {
    const out: Candidate[] = [];
    const add = (scheme: Candidate['scheme'], index: number, kp: {publicKey: Uint8Array; secretKey: Uint8Array}) => {
      out.push({scheme, index, publicKey: base58.encode(kp.publicKey)});
      kp.secretKey.fill(0);
    };
    for (let i = 0; i < SLIP10_ACCOUNTS_TO_SCAN; i++) add('slip10', i, deriveTransparentKeypair(seed, {kind: 'slip10', account: i}));
    add('cli', 0, deriveTransparentKeypair(seed, {kind: 'cli'}));
    return out;
  } finally {
    seed.fill(0);
  }
}

export interface ProbeResult {
  /** False when the balances could not be read: the user chooses, nothing is assumed empty. */
  resolved: boolean;
  funded: ReadonlySet<string>;
}

const positive = (x: unknown): boolean => typeof x === 'string' && /^\d+$/.test(x) && BigInt(x) > 0n;

/** The vault page never touches the network: it hands the background public keys and reads back numbers. */
export async function probeCandidates(send: Send, candidates: readonly Candidate[]): Promise<ProbeResult> {
  const unresolved: ProbeResult = {resolved: false, funded: new Set()};
  let reply: Awaited<ReturnType<Send>>;
  try {
    reply = await send({type: 'wallet.probeBalances', publicKeys: candidates.map(c => c.publicKey)});
  } catch {
    return unresolved;
  }
  const data = reply.ok && typeof reply.data === 'object' && reply.data !== null ? (reply.data as {resolved?: unknown; balances?: unknown}) : null;
  if (data === null || data.resolved !== true || !Array.isArray(data.balances)) return unresolved;
  const funded = new Set<string>();
  for (const b of data.balances as unknown[]) {
    if (typeof b !== 'object' || b === null) continue;
    const {publicKey, lamports, noc} = b as {publicKey?: unknown; lamports?: unknown; noc?: unknown};
    if (typeof publicKey === 'string' && (positive(lamports) || positive(noc))) funded.add(publicKey);
  }
  return {resolved: true, funded};
}

export type SchemeChoice = {scheme: 'slip10' | 'cli'} | {choose: 'both-funded' | 'unresolved'};

/** Spec §2: import picks the scheme detection finds funded; if both are funded the user chooses. */
export function chooseScheme(candidates: readonly Candidate[], probe: ProbeResult): SchemeChoice {
  if (!probe.resolved) return {choose: 'unresolved'};
  const slip10 = candidates.some(c => c.scheme === 'slip10' && probe.funded.has(c.publicKey));
  const cli = candidates.some(c => c.scheme === 'cli' && probe.funded.has(c.publicKey));
  if (slip10 && cli) return {choose: 'both-funded'};
  return {scheme: cli ? 'cli' : 'slip10'};
}

/** cli: its one account. slip10: accounts 0 … the highest funded (0 alone when none is funded). */
export function indexesFor(scheme: 'slip10' | 'cli', candidates: readonly Candidate[], probe: ProbeResult): number[] {
  if (scheme === 'cli') return [0];
  const funded = candidates.filter(c => c.scheme === 'slip10' && probe.funded.has(c.publicKey)).map(c => c.index);
  const top = funded.length > 0 ? Math.max(...funded) : 0;
  return Array.from({length: top + 1}, (_, i) => i);
}

export type FinishOutcome = 'created' | 'created-locked' | 'exists' | 'weak-password' | 'invalid-mnemonic' | 'failed';

const present = (x: unknown): boolean => x !== undefined && x !== null;

/**
 * Encrypt and store a new or imported wallet, then hand the background its signing keys. Never
 * overwrites a stored vault: checked before the seconds-long Argon2id run and again just before
 * writing (another tab may have finished first). The phrase is stored normalised — the exact
 * string that validated and that the seed is derived from.
 */
export async function finishOnboarding(
  deps: VaultStore & {send: Send; kdf: Kdf},
  input: {mnemonic: string; password: string; scheme: 'slip10' | 'cli'; indexes: number[]},
): Promise<FinishOutcome> {
  if (input.password.length < MIN_PASSWORD_LENGTH) return 'weak-password';
  if (!validateMnemonic(input.mnemonic)) return 'invalid-mnemonic';
  try {
    if (present(await deps.readEnvelope())) return 'exists';
    const mnemonic = normalizeMnemonicInput(input.mnemonic);
    const session = await deriveSessionAccounts(mnemonic, input.scheme, input.indexes);
    const accounts = session.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}));
    const env = await createEnvelope({mnemonic, password: input.password, scheme: input.scheme, accounts, kdf: deps.kdf});
    if (present(await deps.readEnvelope())) return 'exists';
    await deps.writeEnvelope(env);
    try {
      const r = await deps.send({type: 'vault.setKeys', accounts: session});
      return r.ok ? 'created' : 'created-locked';
    } catch {
      return 'created-locked';
    }
  } catch {
    return 'failed';
  }
}

export type PasskeyOutcome = 'added' | 'unsupported' | 'wrong' | 'no-wallet' | 'damaged' | 'failed';

/**
 * Add a passkey to a stored wallet (spec §2): the password unwraps the data key, the passkey is
 * created and proven with a get() (PRF), and the data key is wrapped a second time. Runs in a tab.
 */
export async function addPasskey(
  deps: VaultStore & {credentials: CredentialsApi; randomBytes(n: number): Uint8Array},
  factor: {password: string; kdf: Kdf},
): Promise<PasskeyOutcome> {
  const raw = await deps.readEnvelope();
  if (!present(raw)) return 'no-wallet';
  const env = raw as EnvelopeV1;
  let dataKey: Uint8Array;
  try {
    dataKey = await unlockWithPassword(env, factor.password, factor.kdf);
  } catch (e) {
    if (e instanceof WrongPassword) return 'wrong';
    if (e instanceof CorruptEnvelope || e instanceof UnsafeKdfParams) return 'damaged';
    return 'failed';
  }
  let prfOutput: Uint8Array | null = null;
  try {
    const reg = await registerPasskey(deps.credentials, deps.randomBytes(16));
    if ('unsupported' in reg) return 'unsupported';
    prfOutput = reg.prfOutput;
    await deps.writeEnvelope(await addPasskeyWrap(env, dataKey, reg.prfOutput, reg.credentialId, reg.prfSalt));
    return 'added';
  } catch {
    return 'failed';
  } finally {
    dataKey.fill(0);
    prfOutput?.fill(0);
  }
}
```

`extension/src/unlock/reauthFlow.ts`:
```ts
import {reauthenticate, type ReauthFactor, type SessionKeys} from '../vault/reauth';
import type {EnvelopeV1} from '../vault/envelope';
import type {Send} from './types';

export type ReauthPageOutcome = 'confirmed' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed';

/** The session's PUBLIC keys, from vault.status — never its secret keys. Null while locked. */
export async function sessionKeys(send: Send): Promise<SessionKeys | null> {
  const r = await send({type: 'vault.status'});
  const d = r.ok && typeof r.data === 'object' && r.data !== null ? (r.data as {unlocked?: unknown; accounts?: unknown}) : null;
  if (d === null || d.unlocked !== true || !Array.isArray(d.accounts)) return null;
  const out: SessionKeys = [];
  for (const a of d.accounts as unknown[]) {
    if (typeof a !== 'object' || a === null) return null;
    const {index, publicKey} = a as {index?: unknown; publicKey?: unknown};
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || typeof publicKey !== 'string') return null;
    out.push({index, publicKey});
  }
  return out.length > 0 ? out : null;
}

/**
 * Re-authentication in the vault page (brief decision 6): prove the factor against the session's
 * public keys, then tell the background which challenge was proven. A mismatch locks the vault.
 * A passkey PRF output is zeroed on every path.
 */
export async function runReauth(
  deps: {readEnvelope(): Promise<unknown>; send: Send},
  challengeId: string,
  factor: ReauthFactor,
): Promise<ReauthPageOutcome> {
  try {
    const raw = await deps.readEnvelope();
    if (raw === undefined || raw === null) return 'no-wallet';
    const session = await sessionKeys(deps.send);
    if (session === null) return 'not-unlocked';
    const outcome = await reauthenticate(raw as EnvelopeV1, factor, session);
    if (outcome === 'mismatch') {
      await deps.send({type: 'vault.lock'});
      return 'mismatch-locked';
    }
    if (outcome !== 'ok') return outcome;
    const r = await deps.send({type: 'vault.reauthOk', challengeId});
    return r.ok ? 'confirmed' : 'failed';
  } catch {
    return 'failed';
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}
```

`extension/src/unlock/accountsFlow.ts`:
```ts
import {reencryptForAccounts, type EnvelopeV1} from '../vault/envelope';
import {openProven, type ReauthFactor} from '../vault/reauth';
import {deriveSessionAccounts} from '../vault/accounts';
import {sessionKeys} from './reauthFlow';
import type {Send, VaultStore} from './types';

export type AccountsOutcome =
  | 'done'
  | 'wrong'
  | 'mismatch-locked'
  | 'damaged'
  | 'not-unlocked'
  | 'no-wallet'
  | 'cli-single'
  | 'last-account'
  | 'no-such-account'
  | 'failed';

type Deps = VaultStore & {send: Send};
type Accounts = EnvelopeV1['accounts'];

/**
 * Adding or removing an account (spec §2): re-authenticate (a proof against the session), decrypt,
 * derive the new set, re-encrypt the seed under the same data key with the new header, store the
 * envelope, and hand the background the new keys. `change` returns the new list (public keys are
 * filled in from the derivation) or an outcome that stops it.
 */
async function withProvenSeed(deps: Deps, factor: ReauthFactor, change: (env: EnvelopeV1) => Accounts | AccountsOutcome): Promise<AccountsOutcome> {
  try {
    const raw = await deps.readEnvelope();
    if (raw === undefined || raw === null) return 'no-wallet';
    const env = raw as EnvelopeV1;
    const session = await sessionKeys(deps.send);
    if (session === null) return 'not-unlocked';
    const proven = await openProven(env, factor, session);
    if (proven.outcome === 'mismatch') {
      await deps.send({type: 'vault.lock'});
      return 'mismatch-locked';
    }
    if (proven.outcome !== 'ok') return proven.outcome;
    try {
      const next = change(env);
      if (typeof next === 'string') return next;
      const derived = await deriveSessionAccounts(proven.mnemonic, env.scheme, next.map(a => a.index));
      const accounts = next.map((a, i) => ({index: a.index, name: a.name, publicKey: derived[i]?.publicKey ?? ''}));
      if (accounts.some(a => a.publicKey === '')) return 'failed';
      await deps.writeEnvelope(await reencryptForAccounts(env, proven.dataKey, accounts));
      const r = await deps.send({type: 'vault.setKeys', accounts: derived});
      return r.ok ? 'done' : 'failed';
    } finally {
      proven.dataKey.fill(0);
    }
  } catch {
    return 'failed';
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}

/** The next SLIP-0010 account (a cli wallet has exactly one). */
export function addAccount(deps: Deps, factor: ReauthFactor): Promise<AccountsOutcome> {
  return withProvenSeed(deps, factor, env => {
    if (env.scheme === 'cli') return 'cli-single';
    const next = Math.max(...env.accounts.map(a => a.index)) + 1;
    return [...env.accounts, {index: next, name: `Account ${next + 1}`, publicKey: ''}];
  });
}

export function removeAccount(deps: Deps, factor: ReauthFactor, index: number): Promise<AccountsOutcome> {
  return withProvenSeed(deps, factor, env => {
    if (!env.accounts.some(a => a.index === index)) return 'no-such-account';
    if (env.accounts.length === 1) return 'last-account';
    return env.accounts.filter(a => a.index !== index);
  });
}
```

`extension/src/unlock/revealFlow.ts`:
```ts
import {openProven, type ReauthFactor} from '../vault/reauth';
import type {EnvelopeV1} from '../vault/envelope';
import {sessionKeys} from './reauthFlow';
import type {Send} from './types';

export type RevealOutcome =
  | {outcome: 'shown'; words: string[]}
  | {outcome: 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed'};

/**
 * Spec §2 "Showing the seed phrase": only in the tab, only after re-authentication, in the vault
 * page, no copy to clipboard. The proof is re-authentication's (a mismatch locks the vault); the data
 * key is zeroed at once; the phrase leaves this function only as words for the page to render.
 */
export async function runReveal(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RevealOutcome> {
  try {
    const raw = await deps.readEnvelope();
    if (raw === undefined || raw === null) return {outcome: 'no-wallet'};
    const session = await sessionKeys(deps.send);
    if (session === null) return {outcome: 'not-unlocked'};
    const proven = await openProven(raw as EnvelopeV1, factor, session);
    if (proven.outcome === 'mismatch') {
      await deps.send({type: 'vault.lock'});
      return {outcome: 'mismatch-locked'};
    }
    if (proven.outcome !== 'ok') return {outcome: proven.outcome};
    proven.dataKey.fill(0);
    return {outcome: 'shown', words: proven.mnemonic.split(' ')};
  } catch {
    return {outcome: 'failed'};
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}
```

`extension/src/unlock/mode.ts`:
```ts
export type PageMode = {mode: 'unlock'} | {mode: 'create'} | {mode: 'import'} | {mode: 'accounts'} | {mode: 'reveal'} | {mode: 'reauth'; challengeId: string};

/** unlock.html?mode=…; anything unknown or malformed is the plain unlock page. */
export function pageMode(search: string): PageMode {
  const p = new URLSearchParams(search);
  const m = p.get('mode');
  if (m === 'create' || m === 'import' || m === 'accounts' || m === 'reveal') return {mode: m};
  if (m === 'reauth') {
    const id = p.get('challenge') ?? '';
    return /^[0-9a-f]{32}$/.test(id) ? {mode: 'reauth', challengeId: id} : {mode: 'unlock'};
  }
  return {mode: 'unlock'};
}
```

`extension/src/unlock/modes.ts`:
```ts
import {ENVELOPE_KEY} from './unlockFlow';
import {MIN_PASSWORD_LENGTH, chooseScheme, finishOnboarding, importCandidates, indexesFor, newMnemonic, probeCandidates, type Candidate, type FinishOutcome, type ProbeResult} from './onboarding';
import {addAccount, removeAccount, type AccountsOutcome} from './accountsFlow';
import {runReauth, type ReauthPageOutcome} from './reauthFlow';
import {runReveal, type RevealOutcome} from './revealFlow';
import {createWrongBackoff, runExclusive, type BusyGate} from './orchestrate';
import type {PageMode} from './mode';
import type {VaultStore} from './types';
import {validateMnemonic} from '../../../core/keys/mnemonic';
import {workerKdf} from '../vault/kdf';
import {evaluatePrf} from '../vault/passkey';
import {unb64} from '../vault/bytes';
import type {EnvelopeV1} from '../vault/envelope';
import {send} from '../ui/send';
import {readLocal, writeLocal} from '../ext';

// Thin page modes for B1b-1 (the owner's screens arrive in B1b-2). The vault page renders only its
// own fixed strings (spec §1): every status line is a literal below, and the only other text it
// ever shows is the new wallet's own 24 words.
const FINISH_WORDS: Record<FinishOutcome, string> = {
  created: 'Wallet created. You can close this tab.',
  'created-locked': 'Wallet created. Unlock it to use it.',
  exists: 'A wallet already exists in this browser. Nothing was changed.',
  'weak-password': 'The password must be at least 12 characters.',
  'invalid-mnemonic': 'That is not a valid 12- or 24-word recovery phrase.',
  failed: 'Something went wrong. Nothing was saved.',
};
const CHOOSE_WORDS = {
  'both-funded': 'Both address types on this phrase hold funds. Choose the one to use.',
  unresolved: 'Balances could not be checked. Choose the address type to use.',
} as const;
const REAUTH_WORDS: Record<ReauthPageOutcome | 'unavailable', string> = {
  confirmed: 'Confirmed. You can close this tab.',
  wrong: 'That did not confirm it.',
  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
  damaged: "This wallet's stored data is damaged.",
  'no-wallet': 'No wallet on this browser yet.',
  failed: 'Something went wrong. Try again.',
  unavailable: 'This device cannot confirm with a passkey; your password still works.',
};
const ACCOUNTS_WORDS: Record<AccountsOutcome, string> = {
  done: 'Done. The accounts are updated.',
  wrong: 'That did not confirm it.',
  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
  damaged: "This wallet's stored data is damaged.",
  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
  'no-wallet': 'No wallet on this browser yet.',
  'cli-single': 'A Solana CLI wallet has exactly one account.',
  'last-account': 'The last account cannot be removed.',
  'no-such-account': 'There is no account with that number.',
  failed: 'Something went wrong.',
};
const REVEAL_WORDS: Record<RevealOutcome['outcome'], string> = {
  shown: 'Write them down, in order, and keep them offline. Noctura never copies them anywhere.',
  wrong: 'That did not confirm it.',
  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
  damaged: "This wallet's stored data is damaged.",
  'no-wallet': 'No wallet on this browser yet.',
  failed: 'Something went wrong. Try again.',
};
const WAIT = 'That did not confirm it. Wait a moment before trying again.';
const SECTIONS = ['unlock-section', 'create', 'import', 'reauth', 'accounts', 'reveal'] as const;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const say = (text: string): void => {
  $('status').textContent = text;
};
const store: VaultStore = {readEnvelope: () => readLocal(ENVELOPE_KEY), writeEnvelope: env => writeLocal(ENVELOPE_KEY, env)};
// Cardinal rule 6: one busy flag for the page; runExclusive sets it before the first await.
let busy = false;
const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function startMode(mode: PageMode): void {
  const shown = mode.mode === 'unlock' ? 'unlock-section' : mode.mode;
  for (const id of SECTIONS) $(id).hidden = id !== shown;
  if (mode.mode === 'create') startCreate();
  if (mode.mode === 'import') startImport();
  if (mode.mode === 'reauth') startReauth(mode.challengeId);
  if (mode.mode === 'accounts') startAccounts();
  if (mode.mode === 'reveal') startReveal();
}

function startCreate(): void {
  let mnemonic: string | null = newMnemonic();
  const words = $('words');
  for (const w of mnemonic.split(' ')) {
    const li = document.createElement('li');
    li.textContent = w;
    words.append(li);
  }
  const button = $<HTMLButtonElement>('create-btn');
  button.addEventListener('click', () => {
    void runExclusive(gate, async () => {
      const pw = $<HTMLInputElement>('new-password');
      const pw2 = $<HTMLInputElement>('new-password2');
      const password = pw.value;
      const repeated = pw2.value;
      pw.value = '';
      pw2.value = '';
      if (mnemonic === null) return;
      if (!$<HTMLInputElement>('saved').checked) return say('Write the words down first, then tick the box.');
      if (password !== repeated) return say('The two passwords are not the same.');
      button.disabled = true;
      say('Creating the wallet…');
      try {
        const outcome = await finishOnboarding({...store, send, kdf: workerKdf}, {mnemonic, password, scheme: 'slip10', indexes: [0]});
        say(FINISH_WORDS[outcome]);
        if (outcome === 'created' || outcome === 'created-locked') {
          words.replaceChildren();
          mnemonic = null;
        }
      } finally {
        button.disabled = false;
      }
    });
  });
}

function startImport(): void {
  let pending: {mnemonic: string; password: string; candidates: Candidate[]; probe: ProbeResult} | null = null;
  const finish = async (scheme: 'slip10' | 'cli'): Promise<void> => {
    const p = pending;
    if (p === null) return;
    pending = null;
    $('choose').hidden = true;
    say('Importing…');
    const outcome = await finishOnboarding({...store, send, kdf: workerKdf}, {mnemonic: p.mnemonic, password: p.password, scheme, indexes: indexesFor(scheme, p.candidates, p.probe)});
    say(FINISH_WORDS[outcome]);
  };
  $('import-btn').addEventListener('click', () => {
    void runExclusive(gate, async () => {
      const phrase = $<HTMLTextAreaElement>('phrase');
      const pw = $<HTMLInputElement>('imp-password');
      const pw2 = $<HTMLInputElement>('imp-password2');
      const mnemonic = phrase.value;
      const password = pw.value;
      const repeated = pw2.value;
      pw.value = '';
      pw2.value = '';
      if (!validateMnemonic(mnemonic)) return say(FINISH_WORDS['invalid-mnemonic']);
      if (password.length < MIN_PASSWORD_LENGTH) return say(FINISH_WORDS['weak-password']);
      if (password !== repeated) return say('The two passwords are not the same.');
      phrase.value = '';
      say('Checking which addresses hold funds…');
      const candidates = await importCandidates(mnemonic);
      const probe = await probeCandidates(send, candidates);
      const choice = chooseScheme(candidates, probe);
      pending = {mnemonic, password, candidates, probe};
      if ('choose' in choice) {
        $('choose-why').textContent = CHOOSE_WORDS[choice.choose];
        $('choose').hidden = false;
        say('');
        return;
      }
      await finish(choice.scheme);
    });
  });
  $('choose-slip10').addEventListener('click', () => void runExclusive(gate, () => finish('slip10')));
  $('choose-cli').addEventListener('click', () => void runExclusive(gate, () => finish('cli')));
}

function startReauth(challengeId: string): void {
  const backoff = createWrongBackoff(sleep);
  $('reauth-form').addEventListener('submit', e => {
    e.preventDefault();
    const pw = $<HTMLInputElement>('reauth-password');
    const password = pw.value;
    pw.value = '';
    void runExclusive(gate, async () => {
      say('Checking…');
      const outcome = await backoff.run(() => runReauth({...store, send}, challengeId, {password, kdf: workerKdf}), () => say(WAIT));
      say(REAUTH_WORDS[outcome]);
    });
  });
  void store.readEnvelope().then(raw => {
    const pk = (raw as EnvelopeV1 | undefined)?.passkey;
    if (!pk) return;
    const button = $<HTMLButtonElement>('reauth-passkey');
    button.hidden = false;
    button.addEventListener('click', () => {
      void runExclusive(gate, async () => {
        let prfOutput: Uint8Array | null;
        try {
          prfOutput = await evaluatePrf(navigator.credentials, unb64(pk.credentialId), unb64(pk.prfSalt));
        } catch {
          prfOutput = null;
        }
        if (prfOutput === null) return say(REAUTH_WORDS.unavailable);
        const factor = {prfOutput};
        say(REAUTH_WORDS[await backoff.run(() => runReauth({...store, send}, challengeId, factor), () => say(WAIT))]);
      });
    });
  });
}

function startAccounts(): void {
  const backoff = createWrongBackoff(sleep);
  const factor = () => {
    const pw = $<HTMLInputElement>('acc-password');
    const password = pw.value;
    pw.value = '';
    return {password, kdf: workerKdf};
  };
  $('add-account').addEventListener('click', () => {
    void runExclusive(gate, async () => {
      const f = factor();
      say('Adding an account…');
      say(ACCOUNTS_WORDS[await backoff.run(() => addAccount({...store, send}, f), () => say(WAIT))]);
    });
  });
  $('remove-account').addEventListener('click', () => {
    void runExclusive(gate, async () => {
      const n = Number($<HTMLInputElement>('remove-index').value);
      if (!Number.isSafeInteger(n) || n < 1) return say('Enter the number of the account to remove (1, 2, …).');
      const f = factor();
      say('Removing the account…');
      say(ACCOUNTS_WORDS[await backoff.run(() => removeAccount({...store, send}, f, n - 1), () => say(WAIT))]);
    });
  });
}

function startReveal(): void {
  const backoff = createWrongBackoff(sleep);
  const list = $('reveal-words');
  $('reveal-form').addEventListener('submit', e => {
    e.preventDefault();
    const pw = $<HTMLInputElement>('reveal-password');
    const password = pw.value;
    pw.value = '';
    void runExclusive(gate, async () => {
      say('Checking…');
      const outcome = await backoff.run(async () => {
        const r = await runReveal({...store, send}, {password, kdf: workerKdf});
        if (r.outcome === 'shown') {
          list.replaceChildren(
            ...r.words.map(w => {
              const li = document.createElement('li');
              li.textContent = w;
              return li;
            }),
          );
        }
        return r.outcome;
      }, () => say(WAIT));
      say(REVEAL_WORDS[outcome]);
    });
  });
  $('reveal-hide').addEventListener('click', () => {
    list.replaceChildren();
    say('');
  });
}
```

`extension/src/unlock/orchestrate.ts` — in `interface WrongBackoff`, change the method to `run<T extends string>(action: () => Promise<T>, onWait: () => void): Promise<T>;`, and in `createWrongBackoff` replace `if (outcome === 'unlocked') streak = 0;` with:
```ts
      // A proven factor ends the streak — it unlocked the vault, confirmed a re-authentication,
      // changed the accounts or showed the phrase.
      if (outcome === 'unlocked' || outcome === 'confirmed' || outcome === 'done' || outcome === 'shown') streak = 0;
```

`extension/src/unlock/main.ts` — add to the imports:
```ts
import {pageMode} from './mode';
import {startMode} from './modes';
```
and directly below the imports:
```ts
// unlock.html?mode=create|import|reauth&challenge=…|accounts shows that mode's section; no mode
// is the unlock page below, whose handlers stay registered either way (on a hidden section).
startMode(pageMode(location.search));
```

`extension/unlock.html` — replace the whole file:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Noctura — unlock</title>
  </head>
  <body>
    <main>
      <section id="unlock-section">
        <h1>Unlock Noctura</h1>
        <form id="pw">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="current-password" minlength="12" required />
          <button id="unlock" type="submit">Unlock</button>
        </form>
        <button id="passkey" type="button" hidden>Unlock with passkey</button>
      </section>
      <section id="create" hidden>
        <h1>Create a wallet</h1>
        <p>Write these 24 words down, in order. They are the only way to recover this wallet.</p>
        <ol id="words"></ol>
        <label><input id="saved" type="checkbox" /> I wrote the words down</label>
        <label for="new-password">Password (at least 12 characters)</label>
        <input id="new-password" type="password" autocomplete="new-password" minlength="12" />
        <label for="new-password2">Repeat the password</label>
        <input id="new-password2" type="password" autocomplete="new-password" minlength="12" />
        <button id="create-btn" type="button">Create wallet</button>
      </section>
      <section id="import" hidden>
        <h1>Import a wallet</h1>
        <label for="phrase">Recovery phrase (12 or 24 words)</label>
        <textarea id="phrase" autocomplete="off" autocapitalize="none" spellcheck="false"></textarea>
        <label for="imp-password">Password (at least 12 characters)</label>
        <input id="imp-password" type="password" autocomplete="new-password" minlength="12" />
        <label for="imp-password2">Repeat the password</label>
        <input id="imp-password2" type="password" autocomplete="new-password" minlength="12" />
        <button id="import-btn" type="button">Import</button>
        <div id="choose" hidden>
          <p id="choose-why"></p>
          <button id="choose-slip10" type="button">Standard (Phantom/Solflare)</button>
          <button id="choose-cli" type="button">Solana CLI (solana-keygen)</button>
        </div>
      </section>
      <section id="reauth" hidden>
        <h1>Confirm it is you</h1>
        <form id="reauth-form">
          <label for="reauth-password">Password</label>
          <input id="reauth-password" type="password" autocomplete="current-password" minlength="12" required />
          <button id="reauth-btn" type="submit">Confirm</button>
        </form>
        <button id="reauth-passkey" type="button" hidden>Confirm with passkey</button>
      </section>
      <section id="accounts" hidden>
        <h1>Accounts</h1>
        <label for="acc-password">Password</label>
        <input id="acc-password" type="password" autocomplete="current-password" minlength="12" />
        <button id="add-account" type="button">Add an account</button>
        <label for="remove-index">Account number to remove</label>
        <input id="remove-index" type="number" min="1" />
        <button id="remove-account" type="button">Remove the account</button>
      </section>
      <section id="reveal" hidden>
        <h1>Your recovery phrase</h1>
        <p>Anyone who sees these words can take everything in this wallet. There is no copy button, on purpose.</p>
        <form id="reveal-form">
          <label for="reveal-password">Password</label>
          <input id="reveal-password" type="password" autocomplete="current-password" minlength="12" required />
          <button id="reveal-btn" type="submit">Show the phrase</button>
        </form>
        <ol id="reveal-words"></ol>
        <button id="reveal-hide" type="button">Hide</button>
      </section>
      <p id="status" role="status"></p>
    </main>
    <script type="module" src="./src/unlock/main.ts"></script>
  </body>
</html>
```

`extension/scripts/check-vault-isolation.mjs` — below `KDF_MARKER` add:
```js
// The BIP-39 English wordlist, as the build emits it (a template literal with real newlines —
// checked against a real Vite build): generateMnemonic and validateMnemonic carry it into the vault
// page, and nothing else may carry it.
export const WORDLIST_MARKER = 'abandon\nability\nable\nabout';
```
and add `['wordlist', WORDLIST_MARKER],` as the last entry of `MARKERS`.

- [ ] **Step 4: Run the tests, the build and every gate**

Run: `cd extension && npx vitest run && npx tsc --noEmit && npm run build && npm run gates`
Expected: PASS — the wordlist marker is now found (INCONCLUSIVE does not fire) and only inside the unlock bundle.
Run: `npm run e2e`
Expected: B1a's `unlock.spec.ts` still passes (the unlock section is shown when there is no mode).

- [ ] **Step 5: Mutation checks**

1. In `finishOnboarding`, delete the first `present(await deps.readEnvelope())` check → "checked before the Argon2id run" fails (`kdfCalls` is 1).
2. Delete the second check → "— and again after it" fails (a write happens).
3. In `runReauth`, delete `await deps.send({type: 'vault.lock'});` → "a proof mismatch locks the vault" fails.
4. In `withProvenSeed`, call `reencryptForAccounts` with `env.accounts` instead of `accounts` → the add-account test fails (the stored accounts list is the old one).
5. In `chooseScheme`, return `{scheme: 'slip10'}` when both are funded → "funded wins; both funded … the user chooses" fails.
6. In `orchestrate.ts`, reset only on `'unlocked'` → the new backoff test fails (`[1000, 2000]`).
7. Remove `['wordlist', WORDLIST_MARKER]` from `MARKERS` → "fails on the wordlist marker alone" fails.
8. In `runReveal`, delete `proven.dataKey.fill(0);` → "zeroes the data key it unwrapped" fails; delete its `vault.lock` send → "a mismatch locks the vault" fails.
9. In `orchestrate.ts`, drop `'done'` from the reset condition → the `it.each` case for `'done'` fails.

- [ ] **Step 6: Commit**

```bash
git add extension/src/unlock extension/unlock.html extension/scripts/check-vault-isolation.mjs extension/scripts/__tests__/check-vault-isolation.test.mjs
git commit -m "feat(extension): vault-page modes — create, import, re-authenticate, accounts, seed reveal

Pure, tested flows behind thin page modes (the screens are B1b-2): 24-word creation, the
app's import detection through the background, re-authentication that locks on a mismatch,
and account changes that re-encrypt the seed. The wordlist becomes the sixth bundle marker.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 13: End to end — create, unlock, re-authenticate, send; and an expiry — against a simulated coordinator

**Files:**
- Create: `extension/e2e/fakeCoordinator.ts`, `extension/e2e/wallet.spec.ts`
- Modify: `extension/playwright.config.ts`

**Interfaces:**
- Consumes: the built extension (`dist/chrome`), the message API (Task 9), the vault-page modes (Task 12), `makeEnvelope`/`E2E_PASSWORD` (B1a `e2e/makeEnvelope.ts`), `ALLOWED_RPC_METHODS` (Task 1).
- Produces: `installFakeCoordinator(ctx): Promise<FakeCoordinator>` with `{mode: 'confirm' | 'expire'; hits: {url; rpcMethod: string | null}[]; broadcasts: string[]; unexpected: string[]}`.

**No request may reach the real host.** Two layers: `ctx.route('https://api.noc-tura.io/**', …)` answers every request the extension makes (the RPC proxy, the broadcast route, prices); and Chromium is launched with `--host-resolver-rules` mapping every `noc-tura.io` name to `~NOTFOUND`, so a request the route did not catch fails to resolve locally instead of leaving the machine. The test then asserts that the route saw the service worker's requests at all (`hits > 0`), that nothing unexpected was asked, and that every RPC method was an allowed one.

- [ ] **Step 1: Route service-worker requests in Playwright**

`extension/playwright.config.ts`:
```ts
import {defineConfig} from '@playwright/test';

// Every coordinator request is made by the extension's service worker. Chromium reports and routes
// service-worker requests to BrowserContext.route only with this set; e2e/wallet.spec.ts routes
// them to a fake coordinator (e2e/fakeCoordinator.ts).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

export default defineConfig({testDir: 'e2e', timeout: 120_000, workers: 1});
```

- [ ] **Step 2: Write the fake coordinator**

`extension/e2e/fakeCoordinator.ts`:
```ts
import type {BrowserContext, Route} from '@playwright/test';
import {base58, base64} from '@scure/base';

/** Any 32-byte base58 value serves as the fake blockhash. */
export const FAKE_BLOCKHASH = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
export const FAKE_LAST_VALID_BLOCK_HEIGHT = 1000;
const RPC = 'https://api.noc-tura.io/api/v1/rpc';
const BROADCAST = 'https://api.noc-tura.io/api/v1/tx/broadcast';
const PRICES = 'https://api.noc-tura.io/api/v1/wallet/prices';
const STATS = 'https://api.noc-tura.io/api/v1/stats';

export interface FakeCoordinator {
  /** 'confirm': a signature is confirmed at its second status check. 'expire': never seen, and the chain is past every blockhash. */
  mode: 'confirm' | 'expire';
  hits: {url: string; rpcMethod: string | null}[];
  /** Signatures, in the order the broadcast route received them. */
  broadcasts: string[];
  /** Anything the fake was asked that it does not implement. */
  unexpected: string[];
}

/**
 * A simulated coordinator: the read proxy for the methods the engine uses, the broadcast route
 * with the contract this plan defines (docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md),
 * and prices. 10 SOL, no token accounts, quiet fees, simulation always passes.
 */
export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeCoordinator> {
  const fake: FakeCoordinator = {mode: 'confirm', hits: [], broadcasts: [], unexpected: []};
  const statusChecks = new Map<string, number>();
  const ctxSlot = {slot: 1};

  const rpcResult = (method: string, params: unknown[]): unknown => {
    switch (method) {
      case 'getBalance':
        return {context: ctxSlot, value: 10_000_000_000};
      case 'getLatestBlockhash':
        return {context: ctxSlot, value: {blockhash: FAKE_BLOCKHASH, lastValidBlockHeight: FAKE_LAST_VALID_BLOCK_HEIGHT}};
      case 'getRecentPrioritizationFees':
        return [];
      case 'simulateTransaction':
        return {context: ctxSlot, value: {err: null, logs: [], unitsConsumed: 450}};
      case 'getTokenAccountsByOwner':
        return {context: ctxSlot, value: []};
      case 'getMultipleAccounts':
        return {context: ctxSlot, value: (params[0] as unknown[]).map(() => null)};
      case 'getAccountInfo':
        return {context: ctxSlot, value: null};
      case 'getBlockHeight':
        return fake.mode === 'confirm' ? FAKE_LAST_VALID_BLOCK_HEIGHT - 100 : FAKE_LAST_VALID_BLOCK_HEIGHT + 1000;
      case 'getSignatureStatuses':
        return {
          context: ctxSlot,
          value: (params[0] as string[]).map(signature => {
            if (fake.mode === 'expire') return null;
            const seen = (statusChecks.get(signature) ?? 0) + 1;
            statusChecks.set(signature, seen);
            return seen >= 2 ? {slot: 1, confirmations: 1, err: null, confirmationStatus: 'confirmed'} : null;
          }),
        };
      default:
        fake.unexpected.push(`rpc ${method}`);
        return null;
    }
  };

  const json = (route: Route, status: number, body: unknown) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});

  await ctx.route('https://api.noc-tura.io/**', async route => {
    const req = route.request();
    const url = req.url();
    if (url === RPC && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}') as {id?: number; method?: string; params?: unknown[]};
      const method = body.method ?? '';
      fake.hits.push({url, rpcMethod: method});
      return json(route, 200, {jsonrpc: '2.0', id: body.id ?? 0, result: rpcResult(method, body.params ?? [])});
    }
    fake.hits.push({url, rpcMethod: null});
    if (url === BROADCAST && req.method() === 'POST') {
      const {transaction} = JSON.parse(req.postData() ?? '{}') as {transaction?: string};
      const wire = base64.decode(transaction ?? '');
      // One signature: a one-byte count, then the 64-byte signature.
      const signature = base58.encode(wire.subarray(1, 65));
      fake.broadcasts.push(signature);
      return json(route, 200, {signature});
    }
    if (url.startsWith(PRICES)) {
      return json(route, 200, {success: true, data: {solana: {usd: 150}, 'usd-coin': {usd: 1}, tether: {usd: 1}}});
    }
    if (url === STATS) {
      // The presale stage, for NOC's value in the dollar re-auth rule (owner decision B).
      return json(route, 200, {success: true, data: {currentStage: 0, totalNocSold: 0, isPaused: false}});
    }
    fake.unexpected.push(url);
    return json(route, 404, {error: 'not in the fake coordinator'});
  });
  return fake;
}
```

- [ ] **Step 3: Write the E2E**

`extension/e2e/wallet.spec.ts`:
```ts
import {test, expect, chromium, type Page} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installFakeCoordinator, type FakeCoordinator} from './fakeCoordinator';
import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';
import {ALLOWED_RPC_METHODS} from '../../core/solana/rpc';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
};

// The package is an ES module ("type": "module"), where __dirname does not exist.
const EXT = fileURLToPath(new URL('../dist/chrome', import.meta.url));
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
/** makeEnvelope's wallet: the ABANDON phrase, SLIP-0010 account 0. */
const E2E_ACCOUNT = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const NEW_PASSWORD = 'a long enough e2e password';
type Reply = {ok: boolean; error?: string; data?: unknown};

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'noctura-e2e-wallet-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      // The safety net under ctx.route: a request the route does not catch fails to resolve here
      // instead of reaching the real host.
      '--host-resolver-rules=MAP *.noc-tura.io ~NOTFOUND, MAP noc-tura.io ~NOTFOUND',
    ],
  });
  const fake = await installFakeCoordinator(ctx);
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const id = new URL(sw.url()).host;
  // An extension page (own origin), so its messages are privileged — it stands in for the B1b-2 popup screens.
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  return {ctx, fake, sw, id, popup, profile};
}

const msg = async (page: Page, m: unknown): Promise<Reply> => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as Reply;

async function pendingState(page: Page, signature: string): Promise<string | undefined> {
  const r = await msg(page, {type: 'wallet.pending'});
  return (r.data as {signature: string; state: string}[]).find(p => p.signature === signature)?.state;
}

function onlyTheSimulatedCoordinator(fake: FakeCoordinator): void {
  // Not vacuous: the route really saw the service worker's requests.
  expect(fake.hits.length).toBeGreaterThan(0);
  expect(fake.unexpected).toEqual([]);
  for (const h of fake.hits) {
    expect(h.url.startsWith('https://api.noc-tura.io/api/v1/')).toBe(true);
    if (h.rpcMethod !== null) expect(ALLOWED_RPC_METHODS as readonly string[]).toContain(h.rpcMethod);
  }
}

test('create a wallet, unlock it, re-authenticate a first send, send SOL: pending → confirmed', async () => {
  const {ctx, fake, id, popup, sw, profile} = await launch();
  try {
    // 1. Onboarding: the vault page's create mode.
    const vault = await ctx.newPage();
    await vault.goto(`chrome-extension://${id}/unlock.html?mode=create`);
    await expect(vault.locator('#words li')).toHaveCount(24);
    await vault.check('#saved');
    await vault.fill('#new-password', NEW_PASSWORD);
    await vault.fill('#new-password2', NEW_PASSWORD);
    await vault.click('#create-btn');
    await expect(vault.locator('#status')).toHaveText('Wallet created. You can close this tab.', {timeout: 60_000});

    // 2. Lock, then unlock with the password (B1a's unlock mode).
    expect((await msg(popup, {type: 'vault.lock'})).ok).toBe(true);
    await vault.goto(`chrome-extension://${id}/unlock.html`);
    await vault.fill('#password', NEW_PASSWORD);
    await vault.click('#unlock');
    await expect(vault.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});
    const state = (await msg(popup, {type: 'wallet.state'})).data as {unlocked: boolean; accounts: {publicKey: string}[]};
    expect(state.unlocked).toBe(true);
    const account = state.accounts[0]!.publicKey;

    // 3. Prepare: fee lines up front; a first send to a new address needs re-authentication.
    const prep = await msg(popup, {type: 'wallet.prepareSend', account, intent: {token: 'SOL', recipient: RECIPIENT, amount: '10000000'}});
    expect(prep.ok).toBe(true);
    const view = prep.data as {id: string; fees: Record<string, string>; reauth: {challengeId: string; reasons: string[]} | null};
    expect(view.fees).toMatchObject({networkLamports: '5050', markupLamports: '0', markupReason: 'status-unknown'});
    expect(view.reauth?.reasons).toEqual(['first-send']);
    expect(await msg(popup, {type: 'wallet.send', id: view.id})).toEqual({ok: false, error: 'reauth-required', data: {challengeId: view.reauth!.challengeId}});
    expect(fake.broadcasts).toEqual([]);

    // 4. Re-authenticate in the vault page's reauth mode.
    await vault.goto(`chrome-extension://${id}/unlock.html?mode=reauth&challenge=${view.reauth!.challengeId}`);
    await vault.fill('#reauth-password', NEW_PASSWORD);
    await vault.click('#reauth-btn');
    await expect(vault.locator('#status')).toHaveText('Confirmed. You can close this tab.', {timeout: 60_000});

    // 5. Send → pending → confirmed; the recipient becomes known.
    const sent = await msg(popup, {type: 'wallet.send', id: view.id});
    expect(sent.ok).toBe(true);
    const {signature} = sent.data as {signature: string};
    await expect.poll(() => pendingState(popup, signature), {timeout: 30_000, intervals: [1_000]}).toBe('confirmed');
    expect(fake.broadcasts).toEqual([signature]);
    expect(await sw.evaluate(() => chrome.storage.local.get('v1_known_recipients'))).toEqual({v1_known_recipients: [RECIPIENT]});
    // Owner decision A: the record lives in storage.local, where a lock or a restart cannot drop it.
    const stored = (await sw.evaluate(() => chrome.storage.local.get('v1_pending'))) as {v1_pending?: {signature: string; state: string}[]};
    expect(stored.v1_pending?.map(r => [r.signature, r.state])).toEqual([[signature, 'confirmed']]);
    onlyTheSimulatedCoordinator(fake);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});

test('an unconfirmed send expires: "no funds moved", nothing re-sent, and only then a new transaction', async () => {
  const {ctx, fake, id, popup, sw, profile} = await launch();
  try {
    fake.mode = 'expire';
    await sw.evaluate(({env, recipient}) => chrome.storage.local.set({v1_vault: env, v1_known_recipients: [recipient]}), {env: await makeEnvelope(), recipient: RECIPIENT});
    const vault = await ctx.newPage();
    await vault.goto(`chrome-extension://${id}/unlock.html`);
    await vault.fill('#password', E2E_PASSWORD);
    await vault.click('#unlock');
    await expect(vault.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});

    const intent = {token: 'SOL', recipient: RECIPIENT, amount: '1000000'};
    const prep = await msg(popup, {type: 'wallet.prepareSend', account: E2E_ACCOUNT, intent});
    const view = prep.data as {id: string; reauth: unknown};
    expect(view.reauth).toBeNull(); // known recipient, small amount, priced
    const sent = await msg(popup, {type: 'wallet.send', id: view.id});
    const {signature, id: pendingId} = sent.data as {signature: string; id: string};
    // While it is pending, no new transaction for the account.
    expect(await msg(popup, {type: 'wallet.prepareSend', account: E2E_ACCOUNT, intent})).toMatchObject({ok: false, error: 'in-flight'});

    await expect.poll(() => pendingState(popup, signature), {timeout: 30_000, intervals: [1_000]}).toBe('expired');
    const record = ((await msg(popup, {type: 'wallet.pending'})).data as {signature: string; detail: string}[]).find(p => p.signature === signature);
    expect(record?.detail).toBe('Not confirmed — no funds moved.');
    expect(await msg(popup, {type: 'wallet.resend', id: pendingId})).toEqual({ok: false, error: 'not-open'});
    expect(fake.broadcasts).toEqual([signature]);

    // Only after expiry may a new transaction be built for the same intent.
    expect((await msg(popup, {type: 'wallet.prepareSend', account: E2E_ACCOUNT, intent})).ok).toBe(true);
    onlyTheSimulatedCoordinator(fake);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
```

**Timing (PREPARED_TTL_MS).** In the first test, prepare → re-authentication (a full-cost Argon2id run) → send must complete within `PREPARED_TTL_MS` (30 s); it takes about 5 s locally. If a slow runner exceeds it, `wallet.send` answers `{ok: false, error: 'prepared-expired'}` — the engine's typed error, on which a caller prepares again — and the test fails at `expect(sent.ok)`; that is a runner-speed problem, not a reason to raise the TTL.

- [ ] **Step 4: Build and run the E2E**

Run: `cd extension && npm run verify && npx playwright install chromium && npm run e2e`
Expected: 3 passed (B1a's `unlock.spec.ts` and the two above).
If the first test fails at `expect(prep.ok).toBe(true)` with `error: 'failed'` and `fake.hits` empty, Playwright is not routing the service worker's requests (the `~NOTFOUND` guard is doing its job): STOP and report to the controller — do not remove the guard, and do not point the extension at any other host.

- [ ] **Step 5: Negative controls**

1. In `fakeCoordinator.ts`, make the broadcast route answer `json(route, 400, {error: 'rejected', message: 'test'})` → the first test fails with the send `failed` ("The network refused this transaction … No funds moved.") — the route's answer really reaches the engine through the real bundle. Revert.
2. Temporarily set `fake.mode = 'expire'` in the first test before step 5 → it fails with `expired`, not `confirmed` — the expiry path is really exercised by the fake. Revert.

- [ ] **Step 6: Commit**

```bash
git add extension/e2e/fakeCoordinator.ts extension/e2e/wallet.spec.ts extension/playwright.config.ts
git commit -m "test(extension): E2E of the wallet engine against a simulated coordinator

Create → unlock → re-authenticate → send → confirmed, and an expiry that moves no funds and
is never re-sent with a new signature. Every request is routed to a fake; an unrouted one
fails to resolve locally instead of reaching the real host.

Co-Authored-By: <the executing model's own line>"
```

---
### Task 14: The ask for the coordinator (ICO Claude)

**Files:**
- Create: `docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md`

**Interfaces:**
- Consumes: the broadcast contract (Global Constraints), `core/solana/broadcast.ts` (Task 5), `feePolicy.ts` (Task 7), spec §5 "Needed from the coordinator" asks 2–5.
- Produces: the document the controller forwards to the coordinator's owner. No code in the coordinator repository.

- [ ] **Step 1: Write the document**

`docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md`:
````markdown
# Coordinator asks from the Noctura browser extension (B1) — the broadcast-only route and five more

**From:** the wallet side (Noctura extension, plan B1b-1). **To:** the coordinator's owner (ICO Claude).
**Date:** 2026-09-29. **Status:** the extension's engine is built and tested against a simulated
version of this route; nothing on the coordinator exists yet. Nothing here asks for a key, a
secret or a new host.

**Why.** An extension always sends an `Origin` (`chrome-extension://<id>`, or a random
per-install `moz-extension://<uuid>` on Firefox). The public Solana RPC hosts answer any POST
carrying such an Origin with **403** (measured 2026-09-28 against `api.mainnet.solana.com` and
`api.mainnet-beta.solana.com`; only the preflight passes). So a signed transaction from the
extension reaches the chain through the coordinator or not at all. The owner decided: a
**broadcast-only route** on the coordinator (extension spec
`docs/superpowers/specs/2026-09-27-extension-b1-design.md` §4, §5).

## 1. The broadcast-only route

**Request.** `POST https://api.noc-tura.io/api/v1/tx/broadcast`, `content-type: application/json`,
body `{"transaction": "<base64 of the fully signed wire bytes>"}`. No other field. No cookies
(`credentials: 'omit'`).

**What the route checks, in order, before forwarding:**
1. The body is JSON with a string `transaction` that is valid base64 of at most 1 232 bytes (the
   Solana packet limit) — else `400 {"error": "malformed", …}`.
2. The bytes deserialize as a legacy or v0 transaction — else `400 malformed`.
3. **Every required signature is present and verifies** (Ed25519 over the serialized message, for
   each of the first `numRequiredSignatures` account keys) — else `400 {"error": "unsigned", …}`.
   The route never signs, never adds a fee payer, never rewrites a byte: it cannot author a
   transaction, only forward one.
4. Forward with the coordinator's own RPC (`sendTransaction`, `encoding: base64`, preflight on,
   `preflightCommitment: confirmed`). The Helius key stays on the server. No retry loop of the
   route's own; the RPC's default rebroadcast is fine.

**Responses:**

| case | status | body |
|---|---|---|
| forwarded (or the RPC says it is already processed) | `200` | `{"signature": "<base58 of the FIRST signature of the bytes received>"}` |
| not base64 / too long / does not deserialize | `400` | `{"error": "malformed", "message": "<short reason>"}` |
| a required signature missing or invalid | `400` | `{"error": "unsigned", "message": "<short reason>"}` |
| the RPC's preflight refused it (e.g. blockhash not found, insufficient funds) | `400` | `{"error": "rejected", "message": "<the RPC's message>"}` |
| the RPC could not be reached | `502` | anything |
| rate limited | `429` | anything — **never 403** |

- The wallet computes the first signature of the bytes it sent and **refuses any other value** in
  a `200`: a route that answered with another transaction's signature would have the wallet watch
  the wrong thing. Return exactly that signature, base58.
- **The same bytes may arrive more than once.** "Send again" in the wallet re-sends the identical
  signed transaction (same signature — it can land at most once). Treat repeats as normal, answer
  them the same way, and never count them as abuse. An RPC "already processed" answer is a `200`
  with the signature.
- **A `400` MUST mean "not forwarded".** The wallet marks the send failed ("no funds moved") on a
  `400` to a first broadcast. If the route has already handed the bytes to the RPC, the answer must
  not be `400` — use `200` (forwarded) or `502` (unknown). Any status other than `200`/`400` is "not
  acknowledged", and the wallet keeps watching the signature until its blockhash expires.
- Keep no transaction bodies beyond what operations need; the wallet's privacy disclosure already
  says every signed transaction goes to the coordinator.

**Acceptance checks the wallet side will run once it is deployed** (from a machine, not in CI):
```bash
# A malformed body → 400 malformed (never 403), with an extension-like Origin.
curl -sS -o /dev/stderr -w '%{http_code}\n' -X POST https://api.noc-tura.io/api/v1/tx/broadcast \
  -H 'content-type: application/json' -H 'origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop' \
  --data '{"transaction":"not base64"}'
# An unsigned but well-formed v0 transfer → 400 unsigned.
# A signed transfer with a stale blockhash → 400 rejected.
```

## 2. Never 403 on an unknown `Origin`

On every route the extension uses — `/api/v1/rpc`, `/api/v1/tx/broadcast`, `/api/v1/wallet/prices`,
`/api/v1/stats`, `/api/v1/geo/check`, the presale routes — an unrecognised `Origin` must not produce a 403. The
extension has host permissions and needs no CORS headers, but a 403 on the Origin would, through
CrowdSec, ban every extension user's IP. (Firefox's Origin is a random per-install UUID, so it
cannot be allow-listed; do not try.)

## 3. Refused JSON-RPC methods: HTTP 200 with a JSON-RPC error

The read proxy answers a method outside its allowlist with HTTP 403 today. Please answer it with
**HTTP 200 and a JSON-RPC error** (`{"jsonrpc":"2.0","id":…,"error":{"code":-32601,"message":"Method not allowed"}}`).
The extension never calls one (a compile-time list, a run-time refusal and a build gate), but a
403 is what CrowdSec counts.

## 4. The read allowlist

- Please re-confirm `getBlockHeight` stays allowed: the extension's pending-transaction expiry
  check depends on it (as `web/src/presale/useBuy.ts` does).
- A decision on `getFeeForMessage` and `getMinimumBalanceForRentExemption`. The extension does
  not need them today — it computes the fee locally (5 000 lamports per signature plus a bounded
  priority fee) and uses the fixed rent for a 165-byte token account (2 039 280 lamports) — so
  "stay refused" is an acceptable answer. Say which, so the spec can record it.

## 5. `/geo/check` when it cannot geolocate

What does the route return when it cannot place an IP (a VPN, CGNAT, a missing database entry)?
The extension's presale gate closes on an unknown or empty country either way; the answer decides
only which words the wallet shows.

## 6. New: the fee status for an address

The transparent-send fee policy (owner, 2026-09-28) is the app's: no Noctura markup before TGE;
after TGE a markup of 20 000 lamports to the fee vault unless the user is zero-fee eligible, minus
any staking discount. The wallet has **no trustworthy source** for either input: the app's own
TGE status is never updated and its eligibility is hard-coded to false, and the wallet will not
embed a date. Until a source exists **the extension charges no markup** and says so on the fee
line ("status unknown") — in the user's favour.

Please consider:
```
GET /api/v1/wallet/fee-status?address=<base58>
200 → {"tgeStatus": "pre_tge" | "claimable" | "claimed",
       "zeroFeeEligible": true | false,
       "stakingDiscountBps": 0..10000}
```
Derived by the coordinator from chain state and its purchase records; no date in the response.
The wallet would switch to it only after the owner confirms the eligibility rule (the post-TGE
free period for presale buyers is recorded as unverified).

**For information — no change needed on your side:** the owner decided (2026-09-29) that the
extension values NOC at the current presale stage price (from `/api/v1/stats`, as `web/` reads it)
for its "$100 re-authentication" rule; if `/stats` cannot be read, the NOC amount counts as above
the threshold. `/stats` is therefore one more route the extension calls — ask 2 covers it.

## What happens meanwhile

The extension's send engine, pending/expiry handling and re-authentication are built and tested
against a simulated version of §1 (`extension/e2e/fakeCoordinator.ts`). No extension build is
published before the route exists and passes the checks in §1.
````

- [ ] **Step 2: Check the document against the rules**

Run: `grep -nE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md`
Expected: only `2026-09-29` (this document's date) and `2026-09-28` (the measurement and the owner decision) — **no TGE date**.
Run: `grep -niE 'tge' docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md`
Expected: every match is about the TGE *status*; none carries a date.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md
git commit -m "docs(coordinator): the broadcast-only route contract and the extension's other asks

For ICO Claude: the route's request, checks and responses; never 403 on an unknown Origin;
refused RPC methods as JSON-RPC errors; the allowlist decisions; /geo/check on unknown; and a
fee-status endpoint so the extension can apply the app's markup policy without a date.

Co-Authored-By: <the executing model's own line>"
```

---

## Self-review

### Spec coverage for B1b-1

| spec / brief requirement | where |
|---|---|
| §4 RPC — reads: compile-time list, 403 terminal, no retry, endpoint; one request in flight per latch; persisted cool-down | Task 1 (+ the shared, persisted latch in Task 9) |
| §5 gate "RPC method list" | Task 10 |
| §4 Broadcast through the coordinator; contract; signature check; §5 ask 1 | Tasks 5, 14 |
| §4 Moves into core: transfer building with holding-account selection | Task 3 |
| §4 Moves into core: balance reads, history decoding | Task 4 (history is new code — "Scope" item 4) |
| Owner decision "Transparent send fee": policy in core, one disclosed line | Tasks 2, 7 (reason carried to the fee line) |
| §4 Send: amounts BigInt, fee shown, SOL-short warning (refusal with amounts), ATA rent up front, non-canonical accounts | Task 7 |
| §4 No double spend: pending (storage.local), same bytes on resend, expiry via getBlockHeight with a 32-block margin and two null full-history rounds, stuck > 90 s, "no funds moved", new tx only after expiry, 30 s alarm | Task 8 (+ E2E Task 13) |
| §2 Showing the seed phrase: tab only, after re-authentication, no clipboard | Task 12 (`?mode=reveal`) |
| §4 History: paced ≤ 2 getTransaction/s, cached | Task 9 |
| §2/§3 Re-authentication as a proof; triggers; mismatch locks | Tasks 6, 11, 12 (+ E2E) |
| §2 Accounts: slip10 many / cli one, re-encrypt on add/remove, names outside AAD | Tasks 6 (rename), 11, 12 |
| §1 settings.* privileged; weakening needs re-auth | Tasks 6, 9 |
| §2 Seed and derivation: create 24 words; import 12/24 with auto-detection; funded wins; both → user chooses | Task 12 |
| §2 password ≥ 12; passkey add | Task 12 (`addPasskey` flow; page control deferred) |
| §1 message partitions, each with a mutation | Task 9 |
| §5 vault isolation: sixth marker (wordlist); storage ownership | Tasks 6, 11, 12 |
| §5 Tests: moved code gets an app-side jest test | Tasks 2, 3, 4 |
| §5 E2E against a simulated RPC and broadcast route, in CI | Task 13 (CI already runs `npm run e2e`) |
| §5 coordinator asks 2–5 | Task 14 |

### Deferred to B1b-2 (screens, from the owner's `index.html` / `screen.md`)

#11 dashboard, #12 send, #13 receive (QR, groups of four, the "clipboard is not cleared" note), #19 tx-simulate, #20 tx-confirm, #21 tx-status, #26 activity (with explorer links — "Scope" item 8), #27 tx-detail, #41 empty activity, #43 token selector, #44 tx-failed, #54 stuck-tx, the onboarding screens (create, back-up confirmation, import, the scheme choice, the phone-seed warning of spec "Not in B1"), the settings screens (auto-lock, dollar threshold, accounts, add passkey), the address labels and first-send warning of §3, cardinal rule 6's 500 ms lock on every send/confirm control, the seed-reveal screen's design (the flow is Task 12), MAX-send math using `SYSTEM_ACCOUNT_RENT_LAMPORTS`, and — **required** — rendering `markupReason: 'status-unknown'` as a visible fee line, "No Noctura fee (status unknown)", never as an absent line. **Flag for B1b-2:** the design's #54 offers "speed up" and "cancel". The engine offers exactly one action there — re-send the same signed bytes (`wallet.resend`, at most every 2 s). A faster fee needs a new signature, and Solana has no cancel; either would be a second transaction while the first may still land, which spec §4 forbids. B1b-2 must map "speed up" to the re-send and leave "cancel" out, or bring the conflict to the owner.

### Deferred to later phases

- B1c: connection to sites, page message types, grants, confirmations, the red-flag table, dApp simulation and re-simulation after 30 s.
- B1d: presale in the extension with the jurisdiction gate.
- B1e: drainer list, anti-phishing phrase, the DNR spike, Firefox packaging, the Chrome `key`, the host-allowlist gate, store release.
- Owner/coordinator decisions this plan cannot take: the fee-status source ("Scope" item 6, Task 14 ask 6). (NOC's valuation and where pending records live were decided by the owner on 2026-09-29 — "Scope" items 7 and 1.)

### Placeholder and consistency scan

- No "TBD"/"TODO"/"similar to Task N" in any step; every code step carries the code. The only `TODO_…` strings are the app's existing devnet sentinels, quoted where Task 2 edits around them.
- Names used across tasks were checked against their defining task: `SolanaReader` methods (Task 1) as used in Tasks 4, 7, 8, 9; `WalletDeps` (Task 6, completed in Task 9); `PendingRecord`/`updatePending` (Task 7) in Task 8; `SendRefused` codes (Task 7) in Tasks 8, 9; `openProven`/`reauthenticate`/`ReauthFactor`/`SessionKeys` (Task 11) in Task 12; `WORDLIST_MARKER` (Task 12); `PREPARED_KEY`/`REAUTH_KEY` (Task 6); `PENDING_KEY` (Task 7, `pendingStore.ts`, storage.local); `ForbiddenLatch.request`/`LatchStore` (Task 1) in Tasks 5, 9; `stagePrice` (Task 6 interface, Task 9 implementation, Task 7 use).

### Revision 2 — where each item landed

| item | change | task |
|---|---|---|
| Owner A | `v1_pending` in storage.local, background-owned (gate); `lock()` untouched; lock test | 6, 7, 8, 13 |
| Owner B | `WalletDeps.stagePrice` from `fetchPresaleStats`; unknown → above the threshold; 403 not swallowed; noted in the ICO doc | 6, 7, 9, 13, 14 |
| H1 | broadcast test signs with `@noble` + `addSignature`; `npm run build && npm run scan` in web verification | 1, 3, 4, 5 |
| H2 | `ForbiddenLatch.request`: one request in flight, queued ones refused after a 403 (3 concurrent → 1 request); `estimatePriorityFee` rethrows `RpcForbidden` | 1, 5, 9 |
| H3 | `EXPIRY_MARGIN_BLOCKS = 32`; `expiryNullSeenAt`; expired only after two null full-history rounds ≥ 2 s apart | 7, 8 |
| H4/H5 | resolved by A: no read-clear-rewrite; every change through `updatePending`'s mutex | 7, 8 |
| M1 | `?mode=reveal`, `runReveal` | 12 |
| M2 | backoff on accounts add/remove, passkey re-auth and reveal; `done`/`shown` end the streak | 12 |
| M3 | `LatchStore` + `v1_forbidden_until`; a fresh `browserDeps(ext)` still refuses | 1, 6, 9 |
| M4 | `SYSTEM_ACCOUNT_RENT_LAMPORTS`; `sender-below-rent`, `recipient-below-rent` | 3, 7 |
| M5 | `PENDING_ALARM` every 30 s while open | 8, 9 |
| M6 | `wallet.history` `before` must be base58 of 64 bytes | 9 |
| M7 | `npx eslint src/modules/solana src/modules/fees src/constants` | 2, 3, 4 |
| L1 | trailer: the executing model's own line | all |
| L2 | `SPL_TOKEN_PROGRAM` imported from `core/presale/buyInstructions.ts` | 4 |
| L3 | bidi characters written as `\u` escapes (revision 1 had literal characters — the review was right) | 6, 9 |
| L4 | import mode repeats the password | 12 |
| L5 | `PREPARED_TTL_MS = 30_000` | 7 |
| L6 | the doc: a 400 MUST mean not forwarded | 14 |
| L7 | `REAUTH_USD_CENTS_RANGE.max = 100_000` ($1 000) | 6 |
| L8 | classic SPL Token only, stated and tested | 4, Scope 11 |
| L9 | the RPC gate is pinned not to read itself | 10 |
| L10 | a mixed transaction reports its token leg only | 4, Scope 12 |
| extra | feeEngine clamp case; `status-unknown` rendering required of B1b-2; NOC stage price in the ICO doc | 2, self-review, 14 |
