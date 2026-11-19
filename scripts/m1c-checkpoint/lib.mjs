/**
 * The M1c checkpoint's desk logic (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1c", §6.0):
 * Task 1 — the `pinnedFetch` on-device control's readout lines parsed and judged, and the APKs'
 * BuildConfig read with the API base the relayer URLs are built from; Task 9 — the unshield readout
 * events (`unshield-submitting` / `-outcome` / `-reconcile`, `startup-accounts`, `submit-hold`), the
 * two checkpoints' judge over them and the desk's OWN reading of each relayed transaction
 * (`chain.mjs`), the wipe and restore, the chain facts (R1′ binary, R1-I6 wchange_vk), the launches
 * and the phone's API level.
 *
 * THE ANTI-CIRCULARITY BOUNDARY (as M1b's). Nothing here imports the app (src/): the phone REPORTS
 * (`checkpointReadout.ts` `readA0PinnedControl`), the desk DECIDES against its own pinned facts
 * (the A0 pool from the program side's deployment, the relayer fee payer of the controller's
 * ruling 9, the API base read off the devnet APK). M1b's parser and BuildConfig reader are reused
 * (`../m1b-checkpoint/lib.mjs`), with this file's event schema.
 *
 * Pure functions only (no network, no adb): m1c-checkpoint.mjs does the I/O. Tested by
 * lib.test.mjs (`node --test scripts/m1c-checkpoint/*.test.mjs`).
 */
import * as B from '../m1b-checkpoint/lib.mjs';
import * as C from './chain.mjs';

export const DEVNET = B.DEVNET;
export const DEVNET_PACKAGE = B.DEVNET_PACKAGE;
export const PRODUCTION_PACKAGE = B.PRODUCTION_PACKAGE;
export const READOUT_TAG = B.READOUT_TAG;

/** The relayer's fee payer, pinned (controller ruling 9, 2026-11-17; spec §1 "Relayer"). */
export const RELAYER_FEE_PAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
/** The deep link the desk sends to the devnet app (`pinnedControl.ts` A0_PINNED_CONTROL_LINK). */
export const PINNED_CONTROL_LINK = 'noctura://a0-pinned-control';
export const PINNED_PROBES = ['submit', 'quote', 'submit-prefix'];
/** The submit hold's deep link (`submitHold.ts` A0_SUBMIT_HOLD_LINK) and the instrumentation APK's package. */
export const SUBMIT_HOLD_LINK = 'noctura://a0-hold-next-submit';
export const TEST_PACKAGE = 'com.nocturawallet.devnet.test';
/** M1b's BuildConfig fields + the API base (public: the relayer URLs are built from it). */
export const BUILD_CONFIG_FIELDS = [...B.BUILD_CONFIG_FIELDS, 'API_BASE'];

const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEC = /^(0|[1-9][0-9]{0,19})$/;
const bool = v => v === true || v === false;
const QUOTE_KEYS = ['programId', 'pool', 'mint', 'feePayer', 'maxFee', 'minFeeTransfer', 'minFeeWithdrawChange', 'gasGrantLamports', 'validForSeconds'];

const SIG = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const CODE = /^E_[A-Z0-9_]{1,48}$/;
const ROLES = ['main', 'fresh-pending', 'fresh-exit'];
const DESTINATIONS = ['fresh', 'main', 'external'];
const BASE_KEYS = ['schema', 'event', 'session', 'seq', 'at'];
const UNSHIELD_KEYS = ['owner', 'ata', 'amount', 'fee', 'destination'];
const isInt = (v, min = 0) => Number.isInteger(v) && v >= min;
const str = (re, v) => typeof v === 'string' && re.test(v);
const keysAre = (r, extra) => Object.keys(r).sort().join() === [...BASE_KEYS, ...extra].sort().join();
const registryOk = list =>
  Array.isArray(list) &&
  list.length <= 100 &&
  list.every(e => e && typeof e === 'object' && Object.keys(e).join() === 'address,role,linked' && str(ADDR, e.address) && ROLES.includes(e.role) && bool(e.linked));

/** M1c Task 9's events (checkpointReadout.ts): exact key sets, every value of its shape. */
function m1cEventRefusal(r) {
  const e = r.event;
  const unshieldOk = () =>
    str(ADDR, r.owner) && str(ADDR, r.ata) && str(DEC, r.amount) && str(DEC, r.fee) && DESTINATIONS.includes(r.destination);
  if (e === 'unshield-submitting') {
    if (keysAre(r, [...UNSHIELD_KEYS, 'contextError'])) {
      return unshieldOk() && str(CODE, r.contextError) ? null : `${e}: a field is not of its shape`;
    }
    // R2-N3: no seed-key set on this line (it is on startup-accounts); the registry stays
    if (!keysAre(r, [...UNSHIELD_KEYS, 'feePayer', 'gasGrantLamports', 'walletKind', 'registry', 'heldMs'])) {
      return `${e}: fields ${Object.keys(r).join(',')}`;
    }
    const ok =
      unshieldOk() &&
      str(ADDR, r.feePayer) &&
      (r.gasGrantLamports === null || str(DEC, r.gasGrantLamports)) &&
      ['slip10', 'cli'].includes(r.walletKind) &&
      registryOk(r.registry) &&
      isInt(r.heldMs);
    return ok ? null : `${e}: a field is not of its shape`;
  }
  if (e === 'unshield-outcome') {
    const per = {
      spent: ['signature', 'changeLeafIndex', 'grantLamports', 'destinationWithoutSol'],
      'landed-unverified': ['signature', 'code', 'note', 'changeRecorded', 'linked'],
      pending: ['signature', 'reason'],
      'not-sent': ['outcome'],
    }[r.status];
    if (!per || !keysAre(r, [...UNSHIELD_KEYS, 'status', ...per]) || !unshieldOk()) {
      return `${e}: status ${r.status} / fields ${Object.keys(r).join(',')}`;
    }
    const ok = {
      spent: () => str(SIG, r.signature) && isInt(r.changeLeafIndex) && (r.grantLamports === null || str(DEC, r.grantLamports)) && bool(r.destinationWithoutSol),
      'landed-unverified': () => str(SIG, r.signature) && str(/^E_A0_VERIFY_[A-Z_]{1,40}$/, r.code) && ['spent', 'pending'].includes(r.note) && bool(r.changeRecorded) && bool(r.linked),
      pending: () => (r.signature === null || str(SIG, r.signature)) && ['unconfirmed', 'already_spent', 'relay_failed', 'unknown', 'not-in-sync'].includes(r.reason),
      'not-sent': () => str(/^[a-z_]{1,32}$/, r.outcome),
    }[r.status]();
    return ok ? null : `${e}: a ${r.status} field is not of its shape`;
  }
  if (e === 'unshield-reconcile') {
    const ok =
      keysAre(r, ['settled', 'reverted', 'stillPending', 'skipped', 'released', 'promoted']) &&
      Array.isArray(r.settled) &&
      r.settled.every(x => x && Object.keys(x).join() === 'signature,verified,code,changeRecorded' && str(SIG, x.signature) && bool(x.verified) && (x.code === null || str(CODE, x.code)) && bool(x.changeRecorded)) &&
      Array.isArray(r.stillPending) &&
      r.stillPending.every(x => x && Object.keys(x).join() === 'reason' && ['in-window', 'no-clock', 'not-ours'].includes(x.reason)) &&
      [r.reverted, r.skipped, r.released, r.promoted].every(v => isInt(v));
    return ok ? null : `${e}: a field is not of its shape`;
  }
  if (e === 'startup-accounts') {
    const RESTORE = 'changeNotes,unmatchedChangeLeaves,attributionCalls,accountIndicesTried,exitAccounts';
    const ok =
      keysAre(r, ['restoredBecause', 'restore', 'accounts', 'accountsError', 'seedKeys', 'seedKeysError']) &&
      [null, 'no-record', 'corrupt-record'].includes(r.restoredBecause) &&
      (r.restore === null || (r.restore && Object.keys(r.restore).join() === RESTORE && Object.values(r.restore).every(v => isInt(v)))) &&
      (r.accounts === null || registryOk(r.accounts)) &&
      (r.accountsError === null || str(CODE, r.accountsError)) &&
      !(r.accounts !== null && r.accountsError !== null) &&
      // R2-N3: the seed's public keys (registry ∪ cli ∪ slip10:0), or null (+ the code of a failed derivation)
      (r.seedKeys === null || (Array.isArray(r.seedKeys) && r.seedKeys.length >= 1 && r.seedKeys.length <= 103 && r.seedKeys.every(k => str(ADDR, k)))) &&
      (r.seedKeysError === null || str(CODE, r.seedKeysError)) &&
      !(r.seedKeys !== null && r.seedKeysError !== null);
    return ok ? null : `${e}: a field is not of its shape`;
  }
  if (e === 'submit-hold') {
    // m-4: an arm the next unshield found older than ten minutes is read out `expired`
    return keysAre(r, ['state', 'heldMs']) && ['armed', 'taken', 'expired'].includes(r.state) && isInt(r.heldMs, 1) ? null : `${e}: a field is not of its shape`;
  }
  return undefined;
}

/** Why a parsed readout is not one the app writes, or null — M1b's events plus `pinned-control` and M1c Task 9's. */
export function readoutRefusal(r, id) {
  const why = B.readoutRefusal(r, id);
  if (why !== null && why.startsWith('event ') && r && typeof r === 'object') {
    const m1c = m1cEventRefusal(r);
    if (m1c !== undefined) {
      return m1c;
    }
  }
  if (why !== 'event pinned-control') {
    return why;
  }
  if (!Number.isInteger(r.run) || r.run < 1) {
    return 'pinned-control: run';
  }
  if (!PINNED_PROBES.includes(r.probe)) {
    return `pinned-control: probe ${r.probe}`;
  }
  if (typeof r.url !== 'string') {
    return 'pinned-control: url';
  }
  if (!(r.status === null || Number.isInteger(r.status))) {
    return 'pinned-control: status';
  }
  if (!(r.outcome === null || (typeof r.outcome === 'string' && /^[a-z_]{1,32}$/.test(r.outcome)))) {
    return 'pinned-control: outcome';
  }
  if (!bool(r.threw) || !bool(r.lostStatus) || !bool(r.pinFailure)) {
    return 'pinned-control: a flag is not a boolean';
  }
  if (r.quote !== null) {
    const q = r.quote;
    if (!q || typeof q !== 'object' || Object.keys(q).join() !== QUOTE_KEYS.join()) {
      return 'pinned-control: quote fields';
    }
    // strings only: RegExp#test would coerce a number (100000 → "100000") and pass it
    const str = (re, v) => typeof v === 'string' && re.test(v);
    if (![q.programId, q.pool, q.mint, q.feePayer].every(k => str(ADDR, k)) ||
        ![q.maxFee, q.minFeeTransfer, q.minFeeWithdrawChange].every(v => str(DEC, v)) ||
        !(q.gasGrantLamports === null || str(DEC, q.gasGrantLamports)) ||
        !Number.isInteger(q.validForSeconds)) {
      return 'pinned-control: a quote field is not of its shape';
    }
  }
  return null;
}

/** The readouts in a log text, with this file's schema (M1b's chunk parser). */
export function readoutsFromLog(text) {
  return B.readoutsFromLog(text, readoutRefusal);
}

/** The app's own BuildConfig (incl. API_BASE) from `dexdump -f` output of one classes*.dex. */
export function buildConfigFromDexdump(text) {
  return B.buildConfigFromDexdump(text, BUILD_CONFIG_FIELDS);
}

/**
 * The control's runs in recorded readouts: one entry per (session, run), its probes by name, and
 * whether it is complete (each probe exactly once). Ordered by the first probe's `at`, then seq —
 * the last complete one is the run the checkpoint judges.
 */
export function pinnedRuns(readouts) {
  const runs = new Map();
  for (const r of readouts) {
    if (r.event !== 'pinned-control') {
      continue;
    }
    const key = `${r.session}#${r.run}`;
    const e = runs.get(key) ?? { key, session: r.session, run: r.run, at: r.at, seq: r.seq, probes: {}, duplicate: false };
    if (e.probes[r.probe]) {
      e.duplicate = true;
    }
    e.probes[r.probe] = r;
    if (Date.parse(r.at) < Date.parse(e.at) || (r.at === e.at && r.seq < e.seq)) {
      e.at = r.at;
      e.seq = r.seq;
    }
    runs.set(key, e);
  }
  return [...runs.values()]
    .map(e => ({ ...e, complete: !e.duplicate && PINNED_PROBES.every(p => e.probes[p]) }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.seq - b.seq);
}

/**
 * Which readouts `pinned-control` judges (review C1, 2026-11-18: the gate must follow the run it
 * just triggered, never a stale earlier one on record). `--judge-only` judges everything recorded
 * — the whole point of that flag is to re-judge without sending anything. Otherwise ONLY the
 * triggered run's own three probes are judged: a null `trigger.run` (the devnet app never answered
 * with a NEW complete run — it may not have started, or it may have crashed partway) judges an
 * EMPTY list, so every M1c.P* line FAILS instead of silently passing on whatever was already on
 * record from an earlier invocation or an older APK.
 */
export function judgedReadouts({ judgeOnly, trigger, recorded }) {
  if (judgeOnly) {
    return recorded;
  }
  return trigger && trigger.run ? Object.values(trigger.run.probes) : [];
}

/**
 * §6.0's phone line, judged on the LAST complete run of the recorded readouts. `apiBase` is the
 * devnet APK's API_BASE (BuildConfig, `check-apks`). One PASS / FAIL per line:
 *   M1c.P0  the URLs are the API base + bare paths (the base ends in exactly one /v1)
 *   M1c.P1  the malformed submit RESOLVED with HTTP 400 and outcome invalid_request
 *   M1c.P2  the quote: HTTP 200, the pinned pool / program / mint, the pinned relayer fee payer,
 *           minFee.withdraw_change ≤ maxFee
 *   M1c.P3  NEGATIVE CONTROL: the same submit through the pre-fix mapping THREW with its status lost
 */
export function judgePinnedControl({ readouts, apiBase, noRunDetail = 'no complete pinned-control run recorded (run `pinned-control`)' }) {
  const lines = [];
  const add = (id, text, pass, detail) => lines.push({ id, text, pass, detail });
  const T = {
    P0: 'the relayer URLs are the devnet APK\'s API_BASE + /relayer/{submit,quote} (API_BASE ends in exactly one /v1; never /v1/v1/)',
    P1: 'the malformed POST /relayer/submit through pinnedFetch RESOLVED (did not throw) with HTTP 400 and body outcome invalid_request (§6.0)',
    P2: 'GET /relayer/quote through pinnedFetch: HTTP 200 and a parseable quote of the pinned A0 pool, program and mint, from the pinned relayer fee payer',
    P3: 'NEGATIVE CONTROL: the same malformed submit through the pre-fix rejection mapping THREW with its status lost — the P1 line can fail',
  };
  const complete = pinnedRuns(readouts).filter(r => r.complete);
  const last = complete[complete.length - 1];
  if (!last) {
    for (const k of ['P0', 'P1', 'P2', 'P3']) {
      add(`M1c.${k}`, T[k], false, noRunDetail);
    }
    return lines;
  }
  const { submit: s, quote: q, 'submit-prefix': x } = last.probes;
  const fmt = p => `status ${p.status} outcome ${p.outcome} threw ${p.threw} lostStatus ${p.lostStatus} pinFailure ${p.pinFailure}`;
  const baseOk = typeof apiBase === 'string' && /^https:\/\/[^/?#\s]+\/(?:[^?#\s]*\/)?v1$/.test(apiBase) && !/\/v1\/v1$/.test(apiBase);
  const urlsOk = baseOk && s.url === `${apiBase}/relayer/submit` && x.url === `${apiBase}/relayer/submit` && q.url === `${apiBase}/relayer/quote` &&
    ![s.url, q.url, x.url].some(u => u.includes('/v1/v1/'));
  add('M1c.P0', T.P0, urlsOk, `run ${last.key}; API_BASE ${apiBase ?? 'not read (check-apks)'}; submit ${s.url}; quote ${q.url}`);
  add('M1c.P1', T.P1, s.threw === false && s.status === 400 && s.outcome === 'invalid_request', `run ${last.key}: ${fmt(s)}`);
  const qq = q.quote;
  const quoteOk = q.threw === false && q.status === 200 && qq !== null &&
    qq.programId === DEVNET.programId && qq.pool === DEVNET.pool && qq.mint === DEVNET.mint &&
    qq.feePayer === RELAYER_FEE_PAYER && BigInt(qq.minFeeWithdrawChange) <= BigInt(qq.maxFee);
  add('M1c.P2', T.P2, quoteOk, `run ${last.key}: ${fmt(q)}${qq ? `; programId ${qq.programId} pool ${qq.pool} mint ${qq.mint} feePayer ${qq.feePayer} maxFee ${qq.maxFee} minFee.withdraw_change ${qq.minFeeWithdrawChange} gasGrantLamports ${qq.gasGrantLamports ?? 'absent'} validForSeconds ${qq.validForSeconds}` : '; no parseable quote'}`);
  add('M1c.P3', T.P3, x.threw === true && x.lostStatus === true && x.pinFailure === false && x.status === null, `run ${last.key}: ${fmt(x)}`);
  return lines;
}

/** The release APKs' config: M1b's two lines (renamed M1c.A1 / A2) + the devnet API base. */
export function judgeApkConfig({ devnet, production }) {
  const lines = B.judgeApkConfig({ devnet, production }).map(l => ({ ...l, id: l.id.replace('M1b.', 'M1c.') }));
  const base = devnet?.API_BASE;
  lines.push({
    id: 'M1c.A3',
    text: 'the devnet APK\'s API_BASE is https and ends in exactly one /v1 (the relayer URLs append bare paths to it)',
    pass: typeof base === 'string' && /^https:\/\/[^/?#\s]+\/(?:[^?#\s]*\/)?v1$/.test(base) && !/\/v1\/v1$/.test(base),
    detail: `API_BASE=${base ?? 'not read'}`,
  });
  return lines;
}

// ------------------------------------------------------------------------ M1c Task 9: the unshields

/** The phone's API level → the native confirmation's authenticator row (Task 6's measured matrix). */
export function authenticatorRow(sdk) {
  if (!Number.isInteger(sdk) || sdk < 24) {
    return null;
  }
  return sdk >= 30 ? 'API 30+: BIOMETRIC_STRONG | DEVICE_CREDENTIAL' : `API ${sdk} (24–29): BIOMETRIC_STRONG only`;
}

/**
 * Every unshield the phone read out: an `unshield-submitting` line and the FIRST `unshield-outcome`
 * after it in the same process with the same public part (owner, ata, amount, fee, destination);
 * `out` null when the process ended before an outcome (the kill). In recording order. Each carries
 * `seedKeys`, the desk's seed-key set for that line (`seedKeysOf`).
 *   entries: [{seenAt, readout}] (readouts.jsonl)
 */
export function unshieldsOf(entries) {
  const same = (a, b) => UNSHIELD_KEYS.every(k => a[k] === b[k]);
  const subs = entries.filter(x => x.readout.event === 'unshield-submitting' && !('contextError' in x.readout));
  return subs.map(s => {
    const o = entries.find(x => x.readout.event === 'unshield-outcome' && x.readout.session === s.readout.session && x.readout.seq > s.readout.seq && same(x.readout, s.readout));
    return { sub: s.readout, subSeenAt: s.seenAt, out: o?.readout ?? null, outSeenAt: o?.seenAt ?? null, seedKeys: seedKeysOf(entries, s) };
  });
}

/**
 * R2-N3: the seed-key set the desk holds a submitting line to — the seed keys of the latest
 * `startup-accounts` line of THE SAME PROCESS before it (registry ∪ cli ∪ slip10:0, once per start),
 * united with the line's own registry addresses (a reservation made since the start). null when
 * that process read out no seed keys (no line, or a failed derivation): "no key of this seed
 * signed" then cannot pass — it passes only on a set it read.
 */
export function seedKeysOf(entries, subEntry) {
  const i = entries.indexOf(subEntry);
  const starts = entries
    .slice(0, i < 0 ? entries.length : i)
    .filter(x => x.readout.event === 'startup-accounts' && x.readout.session === subEntry.readout.session);
  const keys = starts[starts.length - 1]?.readout.seedKeys;
  if (!Array.isArray(keys) || keys.length === 0) {
    return null;
  }
  return [...new Set([...keys, ...(subEntry.readout.registry ?? []).map(e => e.address)])];
}

/**
 * Every signature any readout names (R1-I1 / R2-I1): each `unshield-outcome`'s (any status) and
 * each `unshield-reconcile.settled[]` one. A line without a signature names nothing — the desk
 * accounts by signature, never by a `reason` (carry 8).
 */
export function namedSignatures(entries) {
  const out = [];
  for (const { readout: r } of entries) {
    if (r.event === 'unshield-outcome' && typeof r.signature === 'string') {
      out.push(r.signature);
    } else if (r.event === 'unshield-reconcile') {
      out.push(...r.settled.map(x => x.signature));
    }
  }
  return [...new Set(out)];
}

/** The signatures `verify` reads from devnet: every one a readout names. */
export function unshieldSignatures(entries) {
  return namedSignatures(entries);
}

/** The relayer fee payer's window (R2-I1): the first `unshield-submitting` line's `at` − 2 min, in unix seconds; null without one. */
export function feePayerWindowStart(entries) {
  const first = entries.find(x => x.readout.event === 'unshield-submitting');
  return first ? Math.floor(Date.parse(first.readout.at) / 1000) - 120 : null;
}

/**
 * The landings the desk judges (R1-I1 / R2-I1 / R3), each joined to the `unshield-submitting` line
 * it settles:
 *   - every `unshield-outcome` naming a signature (any status), joined to the last submitting line
 *     before it in the same process with the same public part; a `pending` one whose signature is
 *     not on devnet (or failed there) is not a landing (`notLanded`, listed, never a failure);
 *   - every `unshield-reconcile.settled[]` signature no outcome named, joined by the (destination
 *     ATA, amount, fee) read from ITS decoded tx to the last submitting line before the reconcile
 *     line (any process — the reconcile runs at a later start); no such line, or no decodable
 *     relayed withdraw on devnet → `unjoined` (a FAIL of M1c.V).
 * Returns {landings: [{via, signature, sub, subEntry, out, outSeenAt, verified, code, seedKeys,
 * tx}], unjoined: [{signature, why}], notLanded: [signature]}.
 */
export function landingsOf(entries, txs) {
  const same = (a, b) => UNSHIELD_KEYS.every(k => a[k] === b[k]);
  const isSub = x => x.readout.event === 'unshield-submitting' && !('contextError' in x.readout);
  const landings = [];
  const unjoined = [];
  const notLanded = [];
  const byOutcome = new Set();
  entries.forEach((x, i) => {
    const r = x.readout;
    if (r.event !== 'unshield-outcome' || typeof r.signature !== 'string') {
      return;
    }
    byOutcome.add(r.signature);
    const tx = C.decodeAnyTx(txs[r.signature] ?? null);
    if (r.status === 'pending' && (!tx || !tx.ok)) {
      notLanded.push(r.signature);
      return;
    }
    const subs = entries.slice(0, i).filter(y => isSub(y) && y.readout.session === r.session && same(y.readout, r));
    const subEntry = subs[subs.length - 1];
    if (!subEntry) {
      unjoined.push({ signature: r.signature, why: `named by an unshield-outcome (${r.status}): no unshield-submitting line before it in its process` });
      return;
    }
    landings.push({ via: 'outcome', signature: r.signature, sub: subEntry.readout, subEntry, out: r, outSeenAt: x.seenAt, verified: r.status !== 'landed-unverified', code: r.code ?? null, seedKeys: seedKeysOf(entries, subEntry), tx });
  });
  entries.forEach((x, i) => {
    const r = x.readout;
    if (r.event !== 'unshield-reconcile') {
      return;
    }
    for (const s of r.settled) {
      if (byOutcome.has(s.signature) || landings.some(l => l.signature === s.signature) || unjoined.some(u => u.signature === s.signature)) {
        continue;
      }
      const tx = C.decodeAnyTx(txs[s.signature] ?? null);
      const key = C.relayedWithdrawKey(tx);
      if (!key) {
        unjoined.push({ signature: s.signature, why: 'named by a reconcile: no relayed withdraw_with_change of this signature on devnet to join' });
        continue;
      }
      const subs = entries
        .slice(0, i)
        .filter(y => isSub(y) && y.readout.ata === key.ata && y.readout.amount === key.amount.toString() && y.readout.fee === key.fee.toString());
      const subEntry = subs[subs.length - 1];
      if (!subEntry) {
        unjoined.push({ signature: s.signature, why: `named by a reconcile: no unshield-submitting line before it for (${key.ata}, ${key.amount}, ${key.fee})` });
        continue;
      }
      landings.push({ via: 'settled', signature: s.signature, sub: subEntry.readout, subEntry, out: null, outSeenAt: x.seenAt, verified: s.verified, code: s.code, seedKeys: seedKeysOf(entries, subEntry), tx });
    }
  });
  return { landings, unjoined, notLanded };
}

/**
 * R1-I1: the relayed FeGSS `withdraw_with_change` txs the relayer fee payer landed in the session's
 * window to an (ATA, amount, fee) this session submitted that NO readout names. `feePayerTxs`:
 * {signature: getTransaction result}, the fee payer's listing as `verify` read it (other programs',
 * other testers' and failed txs are skipped without throwing). null when the listing was not read.
 */
export function unaccountedLandings(entries, feePayerTxs) {
  if (!feePayerTxs || typeof feePayerTxs !== 'object') {
    return null;
  }
  const start = feePayerWindowStart(entries);
  const submitted = entries.filter(x => x.readout.event === 'unshield-submitting').map(x => x.readout);
  const named = new Set(namedSignatures(entries));
  const out = [];
  for (const [signature, result] of Object.entries(feePayerTxs)) {
    const tx = C.decodeAnyTx(result);
    if (!tx || !tx.ok || start === null || !Number.isInteger(tx.blockTime) || tx.blockTime < start) {
      continue;
    }
    const key = C.relayedWithdrawKey(tx);
    if (!key || !submitted.some(s => s.ata === key.ata && s.amount === key.amount.toString() && s.fee === key.fee.toString())) {
      continue;
    }
    if (!named.has(signature)) {
      out.push({ signature, ...key });
    }
  }
  return out;
}

/**
 * One PASS / FAIL per §16 M1c line (both checkpoints), from the recorded readouts and the desk's
 * own chain reads.
 *   readouts: [{seenAt, readout}]
 *   chain: {txs: {sig: getTransaction | null}, histories: {address: [sig…]}, feePayerTxs: {sig: getTransaction} (R1-I1)}
 *   facts: {binary: programDataBinary() | null, binaryAddress, vk: judgeWchangeVk() checks | null}
 *   wipe: {at, pkg, answer} | null                kill: {at, session, owner, heldMs} | null
 *   launches: [{id, text, pass, detail}]          apkLines: judgeApkConfig()     commit: {head, apks}
 *   phone: {sdk, model, instrument: {pass, detail}} | null
 */
export function judgeM1c({ readouts, chain, facts, wipe, kill, launches = [], apkLines = [], commit, phone }) {
  const lines = [];
  const info = [];
  const add = (id, text, pass, detail = '') => lines.push({ id, text, pass: Boolean(pass), detail });
  const all = unshieldsOf(readouts);
  const { landings, unjoined, notLanded } = landingsOf(readouts, chain.txs ?? {});
  const unaccounted = unaccountedLandings(readouts, chain.feePayerTxs);
  const verdictOf = l => C.judgeRelayedUnshield({ tx: l.tx, sub: { ...l.sub, seedKeys: l.seedKeys }, out: l.out });
  const fails = j => j.checks.filter(c => !c.pass);
  const fmt = j => (fails(j).length ? `FAILED: ${fails(j).map(c => `${c.name} (${c.detail})`).join('; ')}` : `all ${j.checks.length} §6.8 checks pass`);
  const verdicts = new Map(landings.map(l => [l, verdictOf(l)]));
  const passes = l => l.verified && fails(verdicts.get(l)).length === 0;
  /** an unshield of `all` whose own outcome said spent and whose landing passes every check */
  const landingOf = u => (u.out ? landings.find(l => l.via === 'outcome' && l.out === u.out) ?? null : null);
  const ok = u => u.out?.status === 'spent' && landingOf(u) !== null && passes(landingOf(u));
  const verdictOfUnshield = u => (landingOf(u) ? verdicts.get(landingOf(u)) : null);
  const last = xs => xs[xs.length - 1] ?? null;
  const registryAfter = (address, afterSeenAt) =>
    readouts
      .filter(x => x.seenAt >= afterSeenAt && (x.readout.event === 'startup-accounts' || x.readout.event === 'unshield-submitting'))
      .map(x => (x.readout.event === 'startup-accounts' ? x.readout.accounts : x.readout.registry) ?? [])
      .map(list => list.find(e => e.address === address)?.role ?? null);

  // M1c.V — EVERY landed signature any readout names (R1-I1 / R2-I1), and nothing landed unnamed
  const vParts = landings.map(
    l =>
      `${l.signature.slice(0, 10)}… ${l.sub.destination}${l.via === 'settled' ? ' (settled by a reconcile)' : ''}${l.verified ? '' : ` (the app's verifier REFUSED it: ${l.code})`}${l.via === 'outcome' && l.out.status !== 'spent' ? ` (the app said ${l.out.status})` : ''}: ${fmt(verdicts.get(l))}`,
  );
  for (const u of unjoined) {
    vParts.push(`${u.signature.slice(0, 10)}… ${u.why}`);
  }
  if (unaccounted === null) {
    vParts.push('the relayer fee payer\'s signatures were not read (`verify` reads them): an unaccounted landing cannot be excluded');
  } else {
    for (const u of unaccounted) {
      vParts.push(`UNACCOUNTED landing ${u.signature}: a relayed withdraw to (${u.ata}, ${u.amount}, ${u.fee}) this session submitted, named by no readout`);
    }
  }
  if (notLanded.length) {
    vParts.push(`named, not on devnet: ${notLanded.map(s => `${s.slice(0, 6)}…`).join(', ')} (a pending outcome whose tx never landed — not judged)`);
  }
  add(
    'M1c.V',
    'EVERY relayed unshield the phone recorded passes every §6.8 condition on its own devnet transaction (the desk\'s decoder), above all: the only signer is the pinned relayer fee payer and no key of this seed signed',
    landings.length >= 1 && landings.every(passes) && unjoined.length === 0 && unaccounted !== null && unaccounted.length === 0,
    vParts.length ? vParts.join(' | ') : 'no landed unshield recorded (run `collect` after each unshield)',
  );
  const refused = landings.filter(l => !l.verified);
  if (refused.length) {
    info.push(`THE APP'S VERIFIER REFUSED ${refused.length} landed unshield(s): ${refused.map(l => `${l.signature} ${l.code}`).join(', ')} — report it with the signature; do not repeat the unshield`);
  }

  // CP1
  const c1 = last(all.filter(u => u.sub.walletKind === 'slip10' && u.sub.destination === 'external' && u.out?.status === 'spent'));
  const v1 = c1 ? verdictOfUnshield(c1) : null;
  add(
    'M1c.C1',
    'CP1: an unshield to "Another address" (a devnet address outside this seed): every §6.8 condition, the address is no key of this seed, no grant (it holds SOL)',
    c1 && ok(c1) && Array.isArray(c1.seedKeys) && !c1.seedKeys.includes(c1.sub.owner) && v1.grant === null && v1.ownerPreLamports !== null && v1.ownerPreLamports > 0n,
    c1 ? `${c1.out.signature}: ${fmt(v1)}; owner ${c1.sub.owner} pre-balance ${v1.ownerPreLamports} lamports; grant ${v1.grant ? v1.grant.lamports : 'none'}` : 'no spent unshield to "Another address" from the slip10 wallet recorded',
  );
  const c2 = last(all.filter(u => u.sub.walletKind === 'slip10' && u.sub.destination === 'main' && u.out?.status === 'spent'));
  const v2 = c2 ? verdictOfUnshield(c2) : null;
  const mainOf = u => u.sub.registry.find(e => e.role === 'main')?.address ?? null;
  add(
    'M1c.C2',
    'CP1: an unshield to "My main account" (after its warning): every §6.8 condition, the owner is the registry\'s main, no grant, the create-ATA a no-op (its token account existed)',
    c2 && ok(c2) && c2.sub.owner === mainOf(c2) && v2.grant === null && v2.ownerPreLamports > 0n && v2.ataPreTokens !== null,
    c2 ? `${c2.out.signature}: ${fmt(v2)}; owner ${c2.sub.owner} (main ${mainOf(c2)}), pre-balance ${v2.ownerPreLamports}; token account before the tx ${v2.ataPreTokens ?? 'ABSENT (created)'}` : 'no spent unshield to "My main account" recorded',
  );
  const c3 = last(all.filter(u => u.sub.walletKind === 'cli' && u.sub.destination === 'external' && u.out?.status === 'spent'));
  const v3 = c3 ? verdictOfUnshield(c3) : null;
  add(
    'M1c.C3',
    'CP1: the cli wallet (a second phrase) unshields to "Another address": every §6.8 condition; its registry is the main alone (no fresh accounts, S9)',
    c3 && ok(c3) && c3.sub.registry.length === 1 && c3.sub.registry[0].role === 'main' && Array.isArray(c3.seedKeys) && !c3.seedKeys.includes(c3.sub.owner),
    c3 ? `${c3.out.signature}: ${fmt(v3)}; registry ${c3.sub.registry.map(e => e.role).join(',')}` : 'no spent unshield from a cli wallet recorded (the second phrase, README CP1c)',
  );

  // CP2
  const freshLanded = all.filter(u => u.sub.destination === 'fresh' && u.out?.status === 'spent');
  const f1 = freshLanded[0] ?? null;
  const fv = f1 ? verdictOfUnshield(f1) : null;
  const roleAt = (u, a) => u.sub.registry.find(e => e.address === a)?.role ?? null;
  const tx1 = f1 ? C.decodeRelayedTx(chain.txs[f1.out.signature] ?? null) : null;
  const promoted = f1 ? registryAfter(f1.sub.owner, f1.outSeenAt).includes('fresh-exit') : false;
  add(
    'M1c.F1',
    'CP2: an unshield to a fresh account: every §6.8 condition; the owner\'s pre-balance 0; exactly one grant of gasGrantLamports from the relayer\'s fee payer reached it; its token account holds the amount; reserved fresh-pending, then fresh-exit',
    f1 &&
      ok(f1) &&
      fv.grant !== null &&
      fv.grant.lamports === BigInt(f1.sub.gasGrantLamports) &&
      fv.ownerPreLamports === 0n &&
      tx1.postLamports(f1.sub.owner) === fv.grant.lamports &&
      fv.ataPreTokens === null &&
      fv.ataPostTokens === BigInt(f1.sub.amount) &&
      roleAt(f1, f1.sub.owner) === 'fresh-pending' &&
      promoted,
    f1
      ? `${f1.out.signature}: ${fmt(fv)}; owner ${f1.sub.owner} ${fv.ownerPreLamports} → ${tx1?.postLamports(f1.sub.owner)} lamports (grant ${fv.grant?.lamports ?? 'none'}, quote ${f1.sub.gasGrantLamports}); token account ${fv.ataPreTokens ?? 'absent'} → ${fv.ataPostTokens}; role at submit ${roleAt(f1, f1.sub.owner)}, later fresh-exit ${promoted}`
      : 'no spent unshield to a fresh account recorded',
  );

  // F2 / F3 — the held, killed unshield and the one started while it was pending
  const held = kill ? all.find(u => u.sub.session === kill.session && u.sub.owner === kill.owner && u.sub.heldMs > 0 && u.sub.destination === 'fresh') : null;
  const afterKill = x => kill && x.seenAt > kill.at && x.readout.session !== kill.session;
  const pendingAtStart = held ? readouts.find(x => afterKill(x) && x.readout.event === 'unshield-reconcile' && x.readout.stillPending.some(p => p.reason === 'in-window')) : null;
  const second = held
    ? all.find(u => u.subSeenAt > kill.at && u.sub.session !== kill.session && u.sub.destination === 'fresh' && roleAt(u, held.sub.owner) === 'fresh-pending')
    : null;
  const secondNew = second && second.sub.owner !== held.sub.owner && Array.isArray(held.seedKeys) && !held.seedKeys.includes(second.sub.owner) && !held.sub.registry.some(e => e.address === second.sub.owner);
  let f2Detail;
  if (!kill) {
    f2Detail = 'no kill recorded (README CP2b: `hold-kill`, then the unshield)';
  } else if (!held) {
    f2Detail = `the kill (${kill.owner} in ${kill.session}) names no held fresh unshield (heldMs > 0) of the readouts`;
  } else if (held.out) {
    f2Detail = `the held unshield read out an outcome (${held.out.status}) before the kill: not exercised — repeat CP2b`;
  } else if (!pendingAtStart) {
    f2Detail = 'no "unshield-reconcile" with an in-window pending unshield after the kill (reopen + unlock the devnet app within 5 min of the kill, then `collect`)';
  } else if (!second) {
    f2Detail = `no later fresh unshield whose registry still held ${held.sub.owner} as fresh-pending (start it within 5 min of the kill)`;
  } else {
    f2Detail = `held ${held.sub.owner} (killed ${kill.at}); next start: pending in-window; the second reserved ${second.sub.owner} (new: ${Boolean(secondNew)}) while the first was fresh-pending; the second ${second.out?.status ?? 'has no outcome'}${second.out?.signature ? ` ${second.out.signature}` : ''}${ok(second) ? ', all §6.8 checks pass' : ''}`;
  }
  add(
    'M1c.F2',
    'CP2: a second unshield started while the first was pending picked the next index — its fresh account is a new one, reserved while the first\'s was still fresh-pending (the readout carries no index, by design)',
    held && !held.out && pendingAtStart && second && secondNew && ok(second),
    f2Detail,
  );
  const reverted = held && second ? readouts.find(x => x.seenAt > second.subSeenAt && x.readout.event === 'unshield-reconcile' && x.readout.reverted >= 1 && x.readout.released >= 1) : null;
  const history = held ? chain.histories?.[held.sub.owner] : undefined;
  const gone = reverted ? !registryAfter(held.sub.owner, reverted.seenAt).some(r => r !== null) : false;
  add(
    'M1c.F3',
    'CP2: the held unshield never reached the chain: its fresh account has no history on devnet, and once the chain\'s clock passed submit + 300 s the reconciliation put the note back (reverted) and released the reservation',
    held && !held.out && Array.isArray(history) && history.length === 0 && reverted && gone,
    held
      ? `history of ${held.sub.owner}: ${Array.isArray(history) ? `${history.length} signature(s)` : 'not read'}; reconcile with reverted + released after the second: ${reverted ? reverted.readout.at : 'NONE yet (wait ≥ 5 min after the kill, then "Check again" or restart, then `collect`)'}; absent from later registries: ${gone}`
      : 'no held unshield',
  );

  // R — the wipe and the restore
  const firstAfter = wipe ? readouts.find(x => x.seenAt > wipe.at && x.readout.event === 'startup') : null;
  const restoredStart = firstAfter?.readout ?? null;
  const restoredAccounts = firstAfter
    ? readouts.find(x => x.readout.event === 'startup-accounts' && x.readout.session === restoredStart.session && x.readout.seq === restoredStart.seq + 1)?.readout ?? null
    : null;
  const wipeOk = wipe && wipe.pkg === DEVNET_PACKAGE && (/^Success\s*$/m.test(wipe.answer ?? '') || /^manual: \S/.test(wipe.answer ?? ''));
  add(
    'M1c.R1',
    `wipe and restore: ONLY the devnet app's wallet wiped (pm clear ${DEVNET_PACKAGE}, or by the owner's hand, recorded), then the first start found no record and restored from the phrase`,
    wipeOk && restoredStart?.phase === 'ready' && restoredStart.restoredBecause === 'no-record' && restoredStart.restore,
    !wipe ? 'no wipe recorded (`wipe`, or `wipe --manual <how>`)' : !restoredStart ? `wipe "${wipe.answer}" at ${wipe.at}; no "startup" readout after it (import the phrase, then \`collect\`)` : `wipe "${wipe.answer}"; first start: phase ${restoredStart.phase}${restoredStart.code ? ` ${restoredStart.code}` : ''}, restoredBecause ${restoredStart.restoredBecause}`,
  );
  const beforeWipe = wipe ? last(readouts.filter(x => x.seenAt < wipe.at && x.readout.event === 'startup' && x.readout.phase === 'ready' && x.readout.notes)) : null;
  const lastUnshieldEvent = wipe ? last(readouts.filter(x => x.seenAt < wipe.at && x.readout.event.startsWith('unshield-'))) : null;
  const key = n => `${n.commitment}@${n.leafIndex}:${n.amount}`;
  const pre = beforeWipe ? beforeWipe.readout.notes.unspentNotes.map(key).sort() : null;
  const post = restoredStart?.notes ? restoredStart.notes.unspentNotes.map(key).sort() : null;
  // the change leaves of EVERY judged landing that passed (R1-I1: one settled after a pending outcome too)
  const changeLeaves = landings
    .filter(passes)
    .map(l => l.tx.leafInserted[0])
    .filter(Boolean);
  const changeBack = restoredStart?.notes ? changeLeaves.filter(l => restoredStart.notes.unspentNotes.some(n => n.commitment === l.commitment && n.leafIndex === l.leafIndex)) : [];
  const fresh = beforeWipe && lastUnshieldEvent && beforeWipe.seenAt > lastUnshieldEvent.seenAt;
  add(
    'M1c.R2',
    'wipe and restore: the change notes come back — the restored unspent notes are exactly those before the wipe (commitment, leaf, amount), among them the change leaves of this checkpoint\'s unshields',
    fresh && pre && post && pre.join() === post.join() && changeBack.length >= 1,
    !beforeWipe
      ? 'no "startup" readout with notes before the wipe'
      : !fresh
        ? 'the last startup before the wipe is OLDER than the last unshield: restart the devnet app (unlock) before the wipe, so its notes are read out — then wipe again'
        : `before ${pre.length} unspent, after ${post ? post.length : 'not read'} (${pre && post && pre.join() === post.join() ? 'the same set' : 'DIFFERENT'}); change leaves of this checkpoint among them: ${changeBack.map(l => l.leafIndex).join(',') || 'none'} (of ${changeLeaves.length} landed)`,
  );
  // m-10: the exits of EVERY judged fresh landing that passed (a landing after a pending outcome included)
  const exits = [...new Set(landings.filter(l => l.sub.destination === 'fresh' && passes(l)).map(l => l.sub.owner))];
  const accounts = restoredAccounts?.accounts ?? null;
  add(
    'M1c.R3',
    'wipe and restore: the fresh accounts come back — every fresh account an unshield of this checkpoint landed on is fresh-exit in the restored registry, and nothing is fresh-pending',
    accounts && exits.length >= 1 && exits.every(a => accounts.some(e => e.address === a && e.role === 'fresh-exit')) && !accounts.some(e => e.role === 'fresh-pending'),
    !restoredAccounts
      ? 'no "startup-accounts" readout of the restored start'
      : `restored registry: ${accounts ? accounts.map(e => `${e.address.slice(0, 6)}… ${e.role}`).join(', ') : `unreadable ${restoredAccounts.accountsError}`}; expected fresh-exit: ${exits.map(a => `${a.slice(0, 6)}…`).join(', ') || 'none'}; the restore's counters: ${JSON.stringify(restoredAccounts.restore)}`,
  );

  // K — the chain facts (one devnet read each)
  add(
    'M1c.K1',
    `the deployed A0 program: the programData's ELF has sha256 ${C.DEPLOYED_BINARY_SHA256.slice(0, 16)}… (the upgrade of 2026-11-17, R1′)`,
    facts?.binary?.sha256 === C.DEPLOYED_BINARY_SHA256,
    facts?.binary ? (facts.binary.error ? `programData ${facts.binaryAddress}: ${facts.binary.error}` : `programData ${facts.binaryAddress}: ELF ${facts.binary.elfBytes} bytes + ${facts.binary.paddingBytes} zero bytes, sha256 ${facts.binary.sha256}, upgrade authority ${facts.binary.authority}`) : 'not read (`verify` reads it)',
  );
  add(
    'M1c.K2',
    'the withdraw_change VK read from chain (wchange_vk, PDA ["wchange_vk", pool]) equals the pinned withdraw_change_vk.json (R1-I6)',
    Array.isArray(facts?.vk) && facts.vk.length >= 6 && facts.vk.every(c => c.pass),
    Array.isArray(facts?.vk) ? facts.vk.map(c => `${c.pass ? 'ok' : 'FAIL'} ${c.name}: ${c.detail}`).join('; ') : 'not read',
  );

  // A / L / N
  for (const l of apkLines) {
    add(l.id, l.text, l.pass, l.detail);
  }
  add('M1c.A4', 'the APKs are of the commit checked (apks/COMMIT = HEAD, tree clean)', commit && commit.apks === commit.head && !/dirty/.test(commit.head ?? ''), `apks ${commit?.apks}, HEAD ${commit?.head}`);
  for (const [id, text] of [
    ['M1c.L1', 'the devnet release APK launches on the phone'],
    ['M1c.L2', 'the production APK of the same commit launches on the phone; no readout line in its log'],
    ['M1c.L3', 'the production app after the owner\'s unlock: alive, no crash, no readout line'],
  ]) {
    const l = launches.find(x => x.id === id);
    add(id, l?.text ?? text, l?.pass, l?.detail ?? 'not run');
  }
  const row = authenticatorRow(phone?.sdk);
  add('M1c.N1', 'the phone\'s API level is recorded; it decides which row of the authenticator matrix this checkpoint proved', row !== null, phone ? `${phone.model} API ${phone.sdk}: ${row ?? 'below minSdk 24'}` : 'not read (`phone`)');
  add('M1c.N2', 'the native confirmation\'s window on the phone: A0ConfirmWindowTest passed (FLAG_SECURE, overlay hiding on API 31+, obscured taps, the refusal rows)', phone?.instrument?.pass, phone?.instrument?.detail ?? 'not run (`phone --instrument`)');
  return { lines, info };
}
