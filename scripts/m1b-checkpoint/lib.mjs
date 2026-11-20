/**
 * The M1b checkpoint's desk logic (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1b"): the
 * phone's readout lines parsed, the devnet transactions they name decoded, the APKs' BuildConfig
 * read, and the judge that turns all of it into one PASS / FAIL per §16 line.
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Nothing here imports the app (src/): the phone REPORTS values
 * (checkpointReadout.ts), the chain DECIDES them. The deposit instruction and the `LeafInserted`
 * event are decoded here from the program side's layout (spec §1: `deposit` = f223c68952e1f2b6 +
 * amount u64 LE + commitment[32] + rho[32] + proof; `LeafInserted` = 59f3d408d7bfbb98 +
 * commitment[32] + leaf_index u64 LE + root[32], 80 bytes) with a log-frame walk of our own — not
 * with the app's `syncedTx.ts` — and held in lib.test.mjs to the program side's landed public
 * inputs and to the recorded tree's 17 leaves.
 *
 * Pure functions only (no network, no adb): m1b-checkpoint.mjs does the I/O. Tested by
 * lib.test.mjs and device.test.mjs (`node --test scripts/m1b-checkpoint/*.test.mjs`).
 */
import { base58, base64 } from '@scure/base';

/** spec §1 — the deployed devnet A0 pool (facts). */
export const DEVNET = {
  genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
  pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
  mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
  mintDecimals: 9,
  merkleTree: '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc',
  /** the mint authority of ERkp… (read from devnet at slot 522688040, 2026-11-15) */
  mintAuthority: 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd',
};
export const DEVNET_PACKAGE = 'com.nocturawallet.devnet';
export const PRODUCTION_PACKAGE = 'com.nocturawallet';
/** spec R13: more than 5,000 tree transactions or more than 60 s makes an indexer pre-mainnet. */
export const R13_TRIGGER = { treeTransactions: 5000, durationMs: 60000 };
/**
 * spec §7: the restore's deposit-counter walk stops after this many consecutive misses (recorded
 * with M1b.5, R1-m4). S15 (lands with M1c): 100, was 20 — the app's `A0_DEPOSIT_GAP_LIMIT`.
 */
export const A0_GAP_LIMIT = 100;
export const READOUT_TAG = 'NOCTURA-A0-READOUT';
export const READOUT_SCHEMA = 'noctura.a0.readout/1';

const DEPOSIT_DISC = 'f223c68952e1f2b6';
const DEPOSIT_DATA_BYTES = 8 + 8 + 32 + 32 + 4 + 256; // 340
const DEPOSIT_ACCOUNTS = [
  'pool',
  'merkle_tree',
  'vault',
  'depositor',
  'depositor_token_account',
  'rho_marker',
  'token_program',
  'system_program',
];
const LEAF_DISC = '59f3d408d7bfbb98';
const LEAF_BYTES = 80;

const hex = b => Buffer.from(b).toString('hex');
const u64le = b => Buffer.from(b).readBigUInt64LE(0);

// ------------------------------------------------------------------------------- the readout

/**
 * The readouts in a log text (logcat output: any prefix before the tag is ignored). Lines are
 * `NOCTURA-A0-READOUT <id> <i>/<n> <chunk>`; one id's chunks, all present, re-joined in order,
 * are one JSON object. Returns `{readouts, incomplete, invalid}` in first-seen order; a chunk
 * seen twice (two dumps of one buffer) counts once, a chunk seen twice with OTHER text makes
 * the id invalid (never guessed). `refuse` is the schema check (default: M1b's events; the M1c desk
 * passes its own, which adds the `pinned-control` event and delegates the rest here).
 */
export function readoutsFromLog(text, refuse = readoutRefusal) {
  const ids = new Map();
  const re = new RegExp(`${READOUT_TAG} (\\S+) (\\d+)/(\\d+) (.*?)\\s*$`);
  for (const line of String(text).split('\n')) {
    const m = re.exec(line);
    if (!m) {
      continue;
    }
    const [, id, i, n, chunk] = m;
    const e = ids.get(id) ?? { n: Number(n), parts: new Map(), conflict: false };
    if (e.n !== Number(n)) {
      e.conflict = true;
    }
    const had = e.parts.get(Number(i));
    if (had !== undefined && had !== chunk) {
      e.conflict = true;
    }
    e.parts.set(Number(i), chunk);
    ids.set(id, e);
  }
  const readouts = [];
  const incomplete = [];
  const invalid = [];
  for (const [id, e] of ids) {
    if (e.conflict) {
      invalid.push({ id, why: 'two different texts for one chunk' });
      continue;
    }
    if (e.parts.size !== e.n || ![...Array(e.n).keys()].every(k => e.parts.has(k + 1))) {
      incomplete.push(id);
      continue;
    }
    let r;
    try {
      r = JSON.parse([...Array(e.n).keys()].map(k => e.parts.get(k + 1)).join(''));
    } catch (err) {
      invalid.push({ id, why: `not JSON: ${err.message}` });
      continue;
    }
    const why = refuse(r, id);
    if (why) {
      invalid.push({ id, why });
      continue;
    }
    readouts.push(r);
  }
  return { readouts, incomplete, invalid };
}

const HEX64 = /^[0-9a-f]{64}$/;
const SIG = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEC = /^(0|[1-9][0-9]*)$/;

/** Why a parsed readout is not one the app writes, or null (the schema of checkpointReadout.ts). */
export function readoutRefusal(r, id) {
  if (!r || typeof r !== 'object' || r.schema !== READOUT_SCHEMA) {
    return `schema ${r?.schema}`;
  }
  if (`${r.session}-${r.seq}` !== id || !Number.isInteger(r.seq) || r.seq < 1) {
    return `id ${id} is not session-seq of the payload`;
  }
  if (Number.isNaN(Date.parse(r.at))) {
    return 'no time';
  }
  if (r.event === 'deposit-submitted' || r.event === 'deposit-outcome') {
    if (!SIG.test(r.signature ?? '') || !ADDR.test(r.depositor ?? '') || !DEC.test(r.amount ?? '') || !HEX64.test(r.commitment ?? '')) {
      return `${r.event}: a field is not of its shape`;
    }
    if (r.event === 'deposit-outcome') {
      if (!['unspent', 'pending', 'dropped'].includes(r.status)) {
        return `deposit-outcome: status ${r.status}`;
      }
      if (r.status === 'unspent' && (!Number.isInteger(r.leafIndex) || !HEX64.test(r.root ?? ''))) {
        return 'deposit-outcome: unspent without leafIndex / root';
      }
    }
    return null;
  }
  if (r.event === 'startup') {
    if (r.phase === 'error') {
      return null;
    }
    if (r.phase !== 'ready' || !r.reconcile) {
      return `startup: phase ${r.phase}`;
    }
    // R1-m4 / R2-N4: the restore's highest counter hit (a number, or null when none) is part of
    // the record; the reconciliation's `skipped` count accounts for a note in none of its lists
    if (r.restore !== null && !(r.restore?.highestHit === null || Number.isInteger(r.restore?.highestHit))) {
      return 'startup: restore without highestHit';
    }
    if (!Number.isInteger(r.reconcile.skipped) || r.reconcile.skipped < 0) {
      return 'startup: reconcile without skipped';
    }
    return null;
  }
  return `event ${r.event}`;
}

// ------------------------------------------------------------------------- the devnet tx

/**
 * A `getTransaction` answer (encoding json, maxSupportedTransactionVersion 0) decoded for the
 * checkpoint: success, signers, fee payer, every top-level `deposit` of the pool program (by its
 * IDL account order) and every `LeafInserted` the pool program emitted in its OWN top-level frame
 * (a `Program data:` line while the invoke stack is exactly [FeGSS…]).
 */
export function decodeDevnetTx(tx) {
  if (!tx) {
    return null;
  }
  const msg = tx.transaction.message;
  const keys = [
    ...msg.accountKeys,
    ...(tx.meta?.loadedAddresses?.writable ?? []),
    ...(tx.meta?.loadedAddresses?.readonly ?? []),
  ];
  const signers = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
  const deposits = [];
  for (const ix of msg.instructions) {
    if (keys[ix.programIdIndex] !== DEVNET.programId) {
      continue;
    }
    const data = base58.decode(ix.data);
    if (hex(data.subarray(0, 8)) !== DEPOSIT_DISC) {
      continue;
    }
    if (data.length !== DEPOSIT_DATA_BYTES || ix.accounts.length !== DEPOSIT_ACCOUNTS.length) {
      deposits.push({ malformed: true });
      continue;
    }
    const acc = Object.fromEntries(DEPOSIT_ACCOUNTS.map((n, i) => [n, keys[ix.accounts[i]]]));
    deposits.push({
      amount: u64le(data.subarray(8, 16)),
      commitment: hex(data.subarray(16, 48)),
      rho: hex(data.subarray(48, 80)),
      ...acc,
    });
  }
  const leafInserted = [];
  const stack = [];
  for (const line of tx.meta?.logMessages ?? []) {
    let m = /^Program (\S+) invoke \[(\d+)\]$/.exec(line);
    if (m) {
      stack.push(m[1]);
      continue;
    }
    m = /^Program (\S+) (success|failed: .*)$/.exec(line);
    if (m) {
      stack.pop();
      continue;
    }
    m = /^Program data: (\S+)$/.exec(line);
    if (m && stack.length === 1 && stack[0] === DEVNET.programId) {
      const b = base64.decode(m[1]);
      if (hex(b.subarray(0, 8)) === LEAF_DISC) {
        leafInserted.push(
          b.length === LEAF_BYTES
            ? { commitment: hex(b.subarray(8, 40)), leafIndex: Number(u64le(b.subarray(40, 48))), root: hex(b.subarray(48, 80)) }
            : { malformed: true },
        );
      }
    }
  }
  return {
    ok: tx.meta?.err === null,
    err: tx.meta?.err ?? null,
    slot: tx.slot,
    blockTime: tx.blockTime,
    signers,
    feePayer: msg.accountKeys[0],
    deposits,
    leafInserted,
  };
}

/** The counts of a `getSignaturesForAddress` page walk (each page newest first). */
export function treeSignatureCounts(pages, upToBlockTime = Infinity) {
  const all = pages.flat();
  const ok = all.filter(s => s.err === null);
  return {
    listed: all.length,
    successful: ok.length,
    failed: all.length - ok.length,
    successfulUpTo: ok.filter(s => s.blockTime !== null && s.blockTime <= upToBlockTime).length,
  };
}

// ------------------------------------------------------------------------- the APKs

/** The BuildConfig fields the checkpoint reads — never the RPC URLs (they carry the API key). */
export const BUILD_CONFIG_FIELDS = ['APPLICATION_ID', 'BUILD_TYPE', 'DEBUG', 'NETWORK', 'FEATURES_SHIELDED', 'LOCAL_PROVING'];

/**
 * The app's own BuildConfig static fields from `dexdump -f` output of one classes*.dex
 * (react-native-config writes the env file's keys there; `build_config_package`
 * com.nocturawallet). Only `fields` (default BUILD_CONFIG_FIELDS); a dex without the class → null.
 */
export function buildConfigFromDexdump(text, fields = BUILD_CONFIG_FIELDS) {
  const start = text.indexOf("Class descriptor  : 'Lcom/nocturawallet/BuildConfig;'");
  if (start < 0) {
    return null;
  }
  const rest = text.slice(start);
  const end = rest.indexOf('Instance fields');
  const block = end >= 0 ? rest.slice(0, end) : rest;
  const out = {};
  // one entry per field ("#N : (in L…;)"), its own name and value only — a field without a
  // value line never borrows the next field's
  for (const field of block.split(/^\s+#\d+\s+: \(in /m).slice(1)) {
    const name = /^\s+name\s+: '([A-Za-z0-9_]+)'\s*$/m.exec(field)?.[1];
    const value = /^\s+value\s+: (.*)$/m.exec(field)?.[1]?.trim();
    if (name && value !== undefined && fields.includes(name)) {
      out[name] = /^".*"$/.test(value) ? value.slice(1, -1) : value;
    }
  }
  return out;
}

/** The release APKs' config as the readout's gate reads it (one line each, and a control). */
export function judgeApkConfig({ devnet, production }) {
  const lines = [];
  const add = (id, text, pass, detail) => lines.push({ id, text, pass, detail });
  const fmt = c => (c ? BUILD_CONFIG_FIELDS.filter(k => k in c).map(k => `${k}=${c[k]}`).join(' ') : 'no BuildConfig read');
  const gateOpen = c => c?.FEATURES_SHIELDED === 'true' && c?.NETWORK === 'devnet';
  add(
    'M1b.A1',
    'the devnet APK is the shielded devnet build (the readout gate open: FEATURES_SHIELDED=true, NETWORK=devnet)',
    devnet?.APPLICATION_ID === DEVNET_PACKAGE && devnet?.BUILD_TYPE === 'release' && gateOpen(devnet) && devnet?.LOCAL_PROVING === 'true',
    fmt(devnet),
  );
  add(
    'M1b.A2',
    'the production APK cannot read out (FEATURES_SHIELDED not true, NETWORK=mainnet-beta): the gate is closed there',
    production?.APPLICATION_ID === PRODUCTION_PACKAGE && production?.BUILD_TYPE === 'release' && production?.NETWORK === 'mainnet-beta' && !gateOpen(production) && production?.FEATURES_SHIELDED !== 'true',
    fmt(production),
  );
  return lines;
}

// ------------------------------------------------------------------------- the I-3 run

/**
 * The I-3 Jest run's evidence for M1b.7 (review I-2). `verify` removes the result file, reads HEAD
 * and the tree state, notes the time, spawns `npx jest --json --outputFile`, reads HEAD again:
 *   spawn: spawnSync's {status, error}   json: the result file parsed, or null   startedAt: ms
 *   head: {before, after}   dirty: `git status --porcelain --untracked-files=no` before the run
 * It is evidence only if the process ran and exited 0, the file is THIS run's (written, and its
 * `startTime` not before the spawn), HEAD did not move and the tree was clean; otherwise
 * `ran: false` with the reason — never a PASS from a stale file or a jest that did not start.
 */
export function readI3({ spawn, json, startedAt, head, dirty }) {
  const commit = head?.before ?? null;
  const base = j => ({
    passed: j?.numPassedTests ?? 0,
    failed: j?.numFailedTests ?? 0,
    pending: j?.numPendingTests ?? 0,
    file: j?.testResults?.[0]?.name ?? null,
    commit: dirty ? `${commit} (dirty)` : commit,
  });
  const no = why => ({ ran: false, ...base(json), why });
  if (spawn?.error) {
    return no(`jest did not start: ${spawn.error.message ?? spawn.error}`);
  }
  if (spawn?.status === null || spawn?.status === undefined) {
    return no('jest gave no exit status (killed)');
  }
  if (spawn.status !== 0) {
    return no(`jest exited ${spawn.status}`);
  }
  if (!json) {
    return no('jest wrote no result file');
  }
  if (!Number.isFinite(json.startTime) || json.startTime < startedAt) {
    return no(`the result file is not this run's (startTime ${json.startTime} < ${startedAt})`);
  }
  if (!head?.before || head.before !== head.after) {
    return no(`HEAD moved during the run (${head?.before} → ${head?.after})`);
  }
  if (dirty) {
    return no('the tree has uncommitted changes');
  }
  return { ran: true, ...base(json), why: null };
}

// ------------------------------------------------------------------------- the judge

const sum = xs => xs.reduce((s, x) => s + x, 0n);

/**
 * One PASS / FAIL per §16 M1b line.
 *   readouts: [{seenAt, readout}] (desk time, first seen)      wipe: {at, pkg, answer} | null
 *   kill: {at, signature, session} | null                       main: the main account (base58)
 *   chain: {txs: {sig: getTransaction | null}, tree: {pages, readAt}}
 *   launches: [{id, text, pass, detail}]   apkLines: judgeApkConfig()   i3: {ran, passed, failed, pending, file, commit} | null
 *   commit: {head, apks}
 */
export function judge({ readouts, wipe, kill, main, chain, launches = [], apkLines = [], i3, commit }) {
  const lines = [];
  const add = (id, text, pass, detail = '') => lines.push({ id, text, pass: Boolean(pass), detail });
  const info = [];
  const before = t => !wipe || t < wipe.at;
  const ofEvent = (e, f = () => true) => readouts.filter(x => x.readout.event === e && f(x));
  const decoded = sig => decodeDevnetTx(chain.txs[sig] ?? null);

  // M1b.1 / M1b.2 — the first deposit that settled unspent in the app, before the wipe, not the killed one.
  const dep = ofEvent('deposit-outcome', x => x.readout.status === 'unspent' && before(x.seenAt) && x.readout.signature !== kill?.signature)[0]?.readout;
  const dtx = dep ? decoded(dep.signature) : null;
  const dIx = dtx?.deposits.filter(d => !d.malformed) ?? [];
  add(
    'M1b.1',
    'a deposit from the main account landed on devnet, signed by it (the only signer, the fee payer, the deposit\'s depositor)',
    dep &&
      dtx?.ok &&
      dep.depositor === main &&
      dtx.signers.length === 1 &&
      dtx.signers[0] === main &&
      dtx.feePayer === main &&
      dIx.length === 1 &&
      dIx[0].depositor === main &&
      dIx[0].pool === DEVNET.pool &&
      dIx[0].merkle_tree === DEVNET.merkleTree &&
      dIx[0].amount === BigInt(dep.amount) &&
      dIx[0].commitment === dep.commitment,
    !dep
      ? 'no "deposit-outcome" unspent readout before the wipe (run `collect` after the deposit)'
      : !dtx
        ? `${dep.signature}: not found on devnet`
        : `${dep.signature} slot ${dtx.slot}: ok=${dtx.ok} signers=${dtx.signers.join(',')} depositor=${dIx[0]?.depositor} amount=${dIx[0]?.amount} (readout ${dep.amount})`,
  );
  const leaves = dtx ? dtx.leafInserted.filter(l => !l.malformed && l.commitment === dep.commitment) : [];
  add(
    'M1b.2',
    'the note shows unspent with the leaf index of its LeafInserted (readout = chain: commitment, leaf index, root)',
    dep && leaves.length === 1 && leaves[0].leafIndex === dep.leafIndex && leaves[0].root === dep.root && dIx[0]?.commitment === dep.commitment,
    dep ? `phone leaf ${dep.leafIndex}, chain ${leaves.map(l => l.leafIndex).join(',') || 'none'} (LeafInserted of ${dep.commitment.slice(0, 12)}… in FeGSS's frame)` : 'no deposit',
  );

  // M1b.6 — the kill.
  const killed = kill ? ofEvent('deposit-submitted', x => x.readout.signature === kill.signature)[0]?.readout : null;
  const killedOutcome = kill ? ofEvent('deposit-outcome', x => x.readout.signature === kill.signature && x.readout.session === killed?.session) : [];
  const nextStart = kill
    ? ofEvent('startup', x => x.seenAt > kill.at && x.readout.session !== killed?.session && x.readout.phase === 'ready')[0]?.readout
    : null;
  const ktx = kill ? decoded(kill.signature) : null;
  let killPass = false;
  let killDetail = 'no kill recorded (run `watch --kill-after-submit` during the second deposit)';
  if (kill) {
    if (!killed) {
      killDetail = `the kill names ${kill.signature}, but no "deposit-submitted" readout of it`;
    } else if (killedOutcome.length) {
      killDetail = 'the killed session read out an outcome: the app saw the confirmation before the kill — not exercised, repeat';
    } else if (!nextStart) {
      killDetail = 'no "startup" readout of a NEW session after the kill (reopen and unlock the devnet app, then `collect`)';
    } else if (ktx?.ok) {
      const kd = ktx.deposits.find(d => !d.malformed && d.commitment === killed.commitment);
      const kl = ktx.leafInserted.find(l => !l.malformed && l.commitment === killed.commitment);
      const c = nextStart.reconcile.confirmed.find(x => x.signature === kill.signature);
      const listed = (nextStart.notes?.unspentNotes ?? []).find(n => n.commitment === killed.commitment);
      killPass = Boolean(kd && kl && c && c.leafIndex === kl.leafIndex && listed && listed.leafIndex === kl.leafIndex && nextStart.notes.pending === 0);
      killDetail = `landed (slot ${ktx.slot}); next start: confirmed ${c ? `leaf ${c.leafIndex}` : 'NOT'}, chain leaf ${kl?.leafIndex}, unspent ${listed ? 'yes' : 'NO'}, pending ${nextStart.notes?.pending}, skipped ${nextStart.reconcile.skipped ?? '?'}`;
    } else if (ktx === null) {
      const dropped = nextStart.reconcile.dropped.filter(d => d.reason === 'expired').length;
      const still = nextStart.reconcile.stillPending.length;
      killPass = dropped === 1 && still === 0 && nextStart.notes?.pending === 0;
      killDetail = still
        ? `not landed and still undecided (${nextStart.reconcile.stillPending.map(p => p.reason).join(',')}): wait ~4 min (the blockhash expiry + the 300-block margin), restart the devnet app, collect, verify again`
        : `not landed on devnet; next start dropped ${dropped} expired pending deposit(s) — nothing left the account`;
    } else {
      killDetail = `the killed deposit FAILED on chain (${JSON.stringify(ktx.err)}); next start must have dropped it`;
      killPass = nextStart.reconcile.dropped.length >= 1 && nextStart.notes?.pending === 0;
    }
  }

  // M1b.3 / M1b.4 / M1b.5 — the wipe and the restore.
  const restored = wipe ? ofEvent('startup', x => x.seenAt > wipe.at)[0]?.readout : null;
  add(
    'M1b.3',
    `wipe: ONLY the devnet app's data cleared (pm clear ${DEVNET_PACKAGE}), restored from the phrase: the next start found no record and restored`,
    wipe && wipe.pkg === DEVNET_PACKAGE && /^Success\s*$/m.test(wipe.answer ?? '') && restored?.phase === 'ready' && restored.restoredBecause === 'no-record' && restored.restore,
    !wipe ? 'no wipe recorded (`wipe`)' : !restored ? 'no "startup" readout after the wipe (import the phrase, then `collect`)' : `phase ${restored.phase}${restored.code ? ` ${restored.code}` : ''}, restoredBecause ${restored.restoredBecause}`,
  );
  const expected = [dep, killed]
    .filter(Boolean)
    .map(r => {
      const t = decoded(r.signature);
      const l = t?.ok ? t.leafInserted.find(x => !x.malformed && x.commitment === r.commitment) : null;
      return l ? { commitment: r.commitment, amount: BigInt(r.amount), leafIndex: l.leafIndex } : null;
    })
    .filter(Boolean);
  const back = restored?.notes?.unspentNotes ?? [];
  const found = expected.filter(e => back.some(n => n.commitment === e.commitment && n.leafIndex === e.leafIndex && BigInt(n.amount) === e.amount));
  add(
    'M1b.4',
    'the shielded balance returns from the chain: every deposit of this checkpoint that landed is unspent again at its chain leaf',
    restored?.notes &&
      expected.length >= 1 &&
      found.length === expected.length &&
      BigInt(restored.notes.unspentBalance) === sum(back.map(n => BigInt(n.amount))) &&
      BigInt(restored.notes.unspentBalance) >= sum(expected.map(e => e.amount)) &&
      (restored.restore?.ownNotes ?? -1) >= expected.length,
    restored?.notes
      ? `back ${found.length}/${expected.length} (leaves ${expected.map(e => e.leafIndex).join(',')}); balance ${restored.notes.unspentBalance} base units, ${restored.notes.unspent} unspent note(s)`
      : restored?.notesError
        ? `the store did not read: ${restored.notesError}`
        : 'no restore readout',
  );
  const r = restored?.restore;
  const tree = chain.tree ? treeSignatureCounts(chain.tree.pages, r ? Date.parse(r.finishedAt) / 1000 : Infinity) : null;
  const reached = r ? r.treeTransactions > R13_TRIGGER.treeTransactions || r.durationMs > R13_TRIGGER.durationMs : null;
  // The phone's count is of successful tree txs at its run (confirmed reads); the desk's walk
  // came later: ≤ the desk's total, ≥ the desk's count of those at least 60 s older than the run.
  const lower = chain.tree && r ? treeSignatureCounts(chain.tree.pages, Date.parse(r.finishedAt) / 1000 - 60).successfulUpTo : null;
  add(
    'M1b.5',
    `R13 recorded: the restore's tree-transaction count and duration on the phone, against the trigger (${R13_TRIGGER.treeTransactions} txs, ${R13_TRIGGER.durationMs / 1000} s)`,
    r && tree && Number.isInteger(r.treeTransactions) && Number.isInteger(r.durationMs) && r.treeTransactions <= tree.successful && r.treeTransactions >= lower && r.r13TriggerReached === reached,
    r
      ? `${r.treeTransactions} tree txs, ${r.durationMs} ms (sync ${r.syncDurationMs} ms), ${r.depositIndicesTried} counters tried, highest counter hit ${r.highestHit ?? 'none'} (gap limit ${A0_GAP_LIMIT}); desk walk: ${tree?.successful} successful (${tree?.failed} failed) at ${chain.tree?.readAt}; trigger ${reached ? 'REACHED' : 'not reached'}`
      : 'no restore readout',
  );
  if (reached) {
    info.push(
      `R13 TRIGGER REACHED (${r.treeTransactions} txs, ${r.durationMs} ms): a coordinator tree indexer is now a PRE-MAINNET item (spec §13) — record it`,
    );
  }
  add('M1b.6', 'killed between the deposit\'s submit and its confirmation: at the next start the note is reconciled, not lost', killPass, killDetail);

  // M1b.7 — I-3.
  add(
    'M1b.7',
    'I-3: the recording-Connection test (restoreRequests.test.ts) passes at this commit',
    i3?.ran && i3.failed === 0 && i3.pending === 0 && i3.passed >= 5 && /restoreRequests\.test\.ts$/.test(i3.file ?? '') && i3.commit === commit?.head && !/dirty/.test(i3.commit),
    !i3 ? 'not run' : !i3.ran ? `not run: ${i3.why ?? 'no evidence'}` : `${i3.passed} passed, ${i3.failed} failed, ${i3.pending} skipped at ${i3.commit}`,
  );
  for (const l of apkLines) {
    add(l.id, l.text, l.pass, l.detail);
  }
  add(
    'M1b.A3',
    'the APKs are of the commit checked (apks/COMMIT = HEAD, tree clean)',
    commit && commit.apks === commit.head && !/dirty/.test(commit.head ?? ''),
    `apks ${commit?.apks}, HEAD ${commit?.head}`,
  );
  for (const id of ['M1b.8', 'M1b.9', 'M1b.10']) {
    const l = launches.find(x => x.id === id);
    add(
      id,
      l?.text ??
        {
          'M1b.8': 'the devnet release APK launches on the phone',
          'M1b.9': 'the production APK of the same commit launches on the phone; no readout line in its log',
          'M1b.10': 'the production app after the owner\'s unlock (the A0 modules loaded): alive, no crash, no readout line',
        }[id],
      l?.pass,
      l?.detail ?? 'not run',
    );
  }
  return { lines, info };
}
