#!/usr/bin/env node
// Spec §4/§5: every JSON-RPC method the extension can call is on the coordinator proxy's
// allowlist. A refused method is answered with HTTP 403, and a few 403s in a burst get the user's
// IP banned from the whole domain by the host's CrowdSec bouncer. The TypeScript type (RpcMethod)
// and createRpc's run-time check cover calls through the client; this gate covers what they do
// not see: a method name spelled as a string in any file the extension bundles — its own sources
// and every core/ file they reach, followed import by import — a web3.js Connection (which can call
// any method), a raw fetch of the coordinator that never goes through createRpc/broadcastSigned at
// all, and drift between core/solana/rpc.ts's list and the spec's.
//
// Fix round 1 (review found two exit-0 bypasses): a web3.js Connection reached through a namespace
// import (`import * as web3 …; new web3.Connection(...)`) or `require('@solana/web3.js').Connection`
// was invisible to the original check, which only matched `import {Connection} from …` and a bare
// `new Connection(`. And a raw `fetch()` of the RPC endpoint with a computed method name reached the
// network without ever calling `createRpc` — outside its typed, allowlist-checked, latched path
// entirely. Fixed (round 1) by narrowing to a `.Connection` property access or an import/export
// clause member, conditioned on the file referencing '@solana/web3.js' at all; and by forbidding a
// direct call to the global fetch and to XMLHttpRequest/sendBeacon/WebSocket anywhere except
// extension/src/background/deps.ts, plus the literal RPC endpoint path string outside
// core/solana/rpc.ts.
//
// Fix round 2 (review found the round-1 narrowing still had a hole): `const {Connection} = await
// import('@solana/web3.js')` and `const {Connection: C} = web3` are destructuring, not a `.`
// access or a clause member, so round 1 missed both. Round 2's fix stripped comments first (a small
// tokenizer), then applied the Connection/fetch rules blunt on the stripped text.
//
// Fix round 3 (re-review found round 2's stripComments itself was unsound, and two more fetch
// bypasses): the tokenizer misread a regex literal — `const re = /foo/*2;` opens what it thinks is
// a `/* … */` block comment and swallows the rest of the file, so every LATER Connection or fetch
// use became invisible to the gate; `/\/\//` (a regex matching two literal slashes) ate a line the
// same way. And `const {fetch: f} = globalThis` / `globalThis['fe' + 'tch']` bypassed the fetch
// rule, which only matched a direct `.fetch` property access or call. Controller ruling: REMOVE
// stripComments — it is gone from this file. The Connection and fetch rules are blunt on RAW text
// instead: any `Connection` word token in a file that references '@solana/web3.js' at all is a
// violation (same as round 2, minus the comment-stripping step), and outside
// extension/src/background/deps.ts, a bare `fetch(` call, a bare `globalThis.fetch`/`self.fetch`/
// `window.fetch` property access, a destructure of `fetch` off globalThis/self/window
// (`{fetch …} = globalThis`), or ANY computed property access on globalThis/self/window
// (`globalThis[`/`self[`/`window[`, unreadable statically, so every form is a violation, no
// usage-site matching) is a violation too. Being blunt on raw text means a file's own COMMENT that
// happens to mention "Connection" or "globalThis.fetch" trips this gate now, same as a refused RPC
// method name always has (see Limits below) — so instead of teaching the gate about comments again,
// the three real files that had such a comment (core/solana/transfer.ts, core/presale/allocation.ts,
// core/solana/rpc.ts) were REWORDED to say the same thing without the trigger word. And this text
// check is no longer the only thing standing between a bypass and the network: manifest/source.mjs's
// EXTENSION_CSP now declares `connect-src https://api.noc-tura.io`, so even a Connection or fetch
// this gate still cannot see is refused by the browser itself at the point it tries to reach any
// other host — checked by check-permissions.mjs's connectSrcViolations, independent of this file.
//
// Limits, deliberate: it reads text, so a refused method name — or, as of round 3, a mention of
// "Connection" or a global fetch form — inside a quoted comment fails the gate (fail-closed); a name
// assembled at run time is out of its reach — createRpc refuses that one, and the CSP above refuses
// the resulting network request regardless. A file that assigns `web3['Connection']` (bracket
// notation) to a differently-named local, or destructures `fetch` from something other than a
// literal `globalThis`/`self`/`window` (e.g. an intermediate variable: `const g = globalThis; const
// {fetch} = g;`), is out of reach the same way a cast past RpcMethod is — the CSP is the backstop
// for exactly this gap. CONNECTION_ONLY matches `.methodName(` on any receiver, so an unrelated
// object with a same-named method is a possible false positive — left as is, fail-closed, per the
// controller's round-1 ruling (ex: `.getParsedTransaction(` on a non-Connection reader).
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
// The one place allowed to call the global fetch (extension-relative, / separators — see deps.ts).
export const DEPS_FILE = 'src/background/deps.ts';
// The RPC route's path, exactly as spelled in core/solana/rpc.ts's RPC_ENDPOINT (built there from
// API_BASE + '/rpc', never as this literal contiguous string — so this check is on a COPY elsewhere,
// never on rpc.ts itself composing it).
export const RPC_PATH_LITERAL = '/api/v1/rpc';

const EXTENSIONS = ['', '.ts', '.mts', '.mjs', '.js', '/index.ts'];
const FROM_SPEC = /\bfrom\s*(['"`])([^'"`]+)\1/g;
const CALL_SPEC = /\bimport\s*\(?\s*(['"`])([^'"`$]+)\1/g;

// Any reference to '@solana/web3.js' at all: a `from` clause (covers both `import … from` and
// `export … from`), a dynamic `import(...)`, or a `require(...)`.
const WEB3JS_REF =
  /\bfrom\s*(['"`])@solana\/web3\.js\1|\bimport\s*\(\s*(['"`])@solana\/web3\.js\2|\brequire\s*\(\s*(['"`])@solana\/web3\.js\3/;

/**
 * A web3.js Connection reached by any form at all, on RAW text (round 3: no comment-stripping —
 * see the header). Blunt: any `Connection` word token in a file that references web3.js at all, no
 * usage-site matching, so a comment mentioning it trips this too (fail-closed; the three real files
 * that had such a comment were reworded instead of taught around — see the header).
 */
function namesWeb3jsConnection(text) {
  if (WEB3JS_REF.test(text) && /\bConnection\b/.test(text)) return true;
  // A bare `new Connection(` with no web3.js reference visible in this same file at all (e.g. a
  // Connection destructured from an object built elsewhere) — kept from the original check.
  return /\bnew\s+Connection\s*\(/.test(text);
}

// The global fetch, on RAW text (round 3: no comment-stripping) — every form the controller named:
//  - a bare call, not preceded by `.`/an identifier char, so `opts.fetch(` and `deps.fetch(` (the
//    injected form) are spared;
//  - a bare globalThis/self/window.fetch property access, called or not;
//  - a destructure of `fetch` off a literal globalThis/self/window (`{fetch` … `} = globalThis`,
//    `{fetch: f} = self`, any name list, any renaming);
//  - ANY computed property access on globalThis/self/window (`globalThis[`, `self[`, `window[`) —
//    the accessed name cannot be read statically (`globalThis['fe' + 'tch']`), so every computed
//    access on these three is a violation, no usage-site matching.
const GLOBAL_FETCH =
  /(?<![.\w$])fetch\s*\(|\bglobalThis\.fetch\b|\bself\.fetch\b|\bwindow\.fetch\b|\{[^}]*\bfetch\b[^}]*\}\s*=\s*(?:globalThis|self|window)\b|\b(?:globalThis|self|window)\s*\[/;
// Other network primitives no core/ or extension file should reach directly — the coordinator
// client (rpc.ts, broadcast.ts, deps.ts) is the only path to the network.
const OTHER_NETWORK_PRIMITIVES = [
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['navigator.sendBeacon', /\bnavigator\.sendBeacon\b/],
  ['new WebSocket', /\bnew\s+WebSocket\b/],
];

/** Every raw-network violation: a direct global fetch / XHR / sendBeacon / WebSocket outside
 * DEPS_FILE, and the RPC endpoint path spelled outside RPC_FILE. All on raw text (see the header). */
export function networkViolations(files) {
  const out = [];
  for (const {path, text} of files) {
    if (path !== DEPS_FILE) {
      if (GLOBAL_FETCH.test(text)) {
        out.push(`${path}: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`);
      }
      for (const [name, re] of OTHER_NETWORK_PRIMITIVES) {
        if (re.test(text)) out.push(`${path}: uses ${name}, bypassing the coordinator client`);
      }
    }
    if (path !== RPC_FILE && text.includes(RPC_PATH_LITERAL)) {
      out.push(`${path}: names the RPC endpoint path (${RPC_PATH_LITERAL}), which only ${RPC_FILE} may`);
    }
  }
  return out;
}

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
    if (namesWeb3jsConnection(text)) out.push(`${path}: uses a web3.js Connection, which bypasses the RPC allowlist`);
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
  return [...problems, ...methodViolations(texts, allowed), ...networkViolations(texts)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkRepo(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('rpc methods ok: every method name the extension bundles is on the proxy allowlist, and the list equals the spec');
}
