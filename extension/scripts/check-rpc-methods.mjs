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
