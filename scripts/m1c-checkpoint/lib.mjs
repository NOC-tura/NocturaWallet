/**
 * The M1c checkpoint's desk logic (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1c", §6.0):
 * Task 1's skeleton — the `pinnedFetch` on-device control's readout lines parsed and judged, and the
 * APKs' BuildConfig read with the API base the relayer URLs are built from. Task 9 extends it with
 * the unshield lines, the desk's own decoder and the wipe.
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

export const DEVNET = B.DEVNET;
export const DEVNET_PACKAGE = B.DEVNET_PACKAGE;
export const PRODUCTION_PACKAGE = B.PRODUCTION_PACKAGE;
export const READOUT_TAG = B.READOUT_TAG;

/** The relayer's fee payer, pinned (controller ruling 9, 2026-11-17; spec §1 "Relayer"). */
export const RELAYER_FEE_PAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
/** The deep link the desk sends to the devnet app (`pinnedControl.ts` A0_PINNED_CONTROL_LINK). */
export const PINNED_CONTROL_LINK = 'noctura://a0-pinned-control';
export const PINNED_PROBES = ['submit', 'quote', 'submit-prefix'];
/** M1b's BuildConfig fields + the API base (public: the relayer URLs are built from it). */
export const BUILD_CONFIG_FIELDS = [...B.BUILD_CONFIG_FIELDS, 'API_BASE'];

const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEC = /^(0|[1-9][0-9]{0,19})$/;
const bool = v => v === true || v === false;
const QUOTE_KEYS = ['programId', 'pool', 'mint', 'feePayer', 'maxFee', 'minFeeTransfer', 'minFeeWithdrawChange', 'gasGrantLamports', 'validForSeconds'];

/** Why a parsed readout is not one the app writes, or null — M1b's events plus `pinned-control`. */
export function readoutRefusal(r, id) {
  const why = B.readoutRefusal(r, id);
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
