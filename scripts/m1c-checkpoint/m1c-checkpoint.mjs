#!/usr/bin/env node
/**
 * The M1c checkpoint, desk side (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1c", §6.0).
 * README.md next to this file is the owner's checklist. Task 1's skeleton — the GATE before any
 * outcome logic: the `pinnedFetch` on-device control. Task 9 adds the unshield lines, `verify`,
 * the wipe and the production launch.
 *
 *   check-apks --apks DIR                  the two release APKs' BuildConfig (dexdump, incl. API_BASE)
 *                                          → DIR/CONFIG.json; the readout gate open in devnet.apk, closed
 *                                          in production.apk (with its negative control), the devnet API
 *                                          base ending in exactly one /v1
 *   install --apks DIR [--allow-fresh-production]
 *                                          M1a's preflight for BOTH packages (signer, rollback, STOP; M1a's
 *                                          install.mjs unchanged), then installs devnet.apk only and
 *                                          cold-launches it
 *   collect                                one `adb logcat -d`: new readouts → OUT/readouts.jsonl
 *   pinned-control --apks DIR [--judge-only]
 *                                          sends `noctura://a0-pinned-control` to the DEVNET app, waits for
 *                                          its three readout lines, judges §6.0 (M1c.P0–P3) against the API
 *                                          base of DIR/CONFIG.json → OUT/pinned-control.json; exit 0 only
 *                                          if every line passed. Judges ONLY the run this invocation
 *                                          triggered (review C1): a run that never appears judges NOTHING,
 *                                          never a stale earlier run already on record. --judge-only is the
 *                                          one path that re-judges the whole record, without sending anything.
 *   common: [--out DIR] (default build/m1c-checkpoint) [--serial S]
 *
 * Never uninstalls, never clears data (every adb call goes through M1a's guard); never contacts
 * *.noc-tura.io, solscan.io or mainnet itself — the PHONE talks to the relayer, the desk reads the
 * phone's log.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as I from '../m1a-checkpoint/install.mjs';
import * as M1B from '../m1b-checkpoint/device.mjs';
import * as D from './device.mjs';
import * as L from './lib.mjs';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '../..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const flag = name => argv.includes(`--${name}`);
const OUT = resolve(opt('out', join(ROOT, 'build/m1c-checkpoint')));
const die = msg => {
  console.error(`m1c-checkpoint: ${msg}`);
  process.exit(2);
};
const json = (f, v) => writeFileSync(join(OUT, f), JSON.stringify(v, null, 2) + '\n');

// ------------------------------------------------------------------------------ tools / adb

const sdk = () => process.env.ANDROID_HOME ?? join(homedir(), 'Android/Sdk');
function buildTool(name) {
  const bt = join(sdk(), 'build-tools');
  const v = existsSync(bt)
    ? readdirSync(bt)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .reverse()
        .find(d => existsSync(join(bt, d, name)))
    : null;
  return v ? join(bt, v, name) : die(`${name} not found under ${bt} (ANDROID_HOME)`);
}
const adbPath = () => (existsSync(join(sdk(), 'platform-tools/adb')) ? join(sdk(), 'platform-tools/adb') : 'adb');
const serialArgs = () => (opt('serial') ? ['-s', opt('serial')] : []);
const rawAdb = args => {
  const r = spawnSync(adbPath(), [...serialArgs(), ...args], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 << 20 });
  return { status: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
};
const adb = I.guarded(rawAdb);
function oneDevice() {
  const devices = adb(['devices']).out.split('\n').filter(l => /\tdevice$/.test(l));
  if (!opt('serial') && devices.length !== 1) {
    die(`expected exactly one device, adb sees ${devices.length} (use --serial; wireless adb drops when the phone locks — re-pair)`);
  }
  mkdirSync(OUT, { recursive: true });
}
function apkSigners(apk) {
  try {
    return I.signerDigests(execFileSync(buildTool('apksigner'), ['verify', '--print-certs', apk], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch {
    return [];
  }
}
const sha256File = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const badgingPkg = apk => execFileSync(buildTool('aapt2'), ['dump', 'badging', apk], { encoding: 'utf8' }).match(/^package: name='([^']+)'/m)?.[1];
function apks() {
  const dir = opt('apks') ?? die('needs --apks DIR (build-apks.sh writes devnet.apk, production.apk)');
  const devnet = join(dir, 'devnet.apk');
  const production = join(dir, 'production.apk');
  for (const f of [devnet, production]) {
    existsSync(f) || die(`missing ${f}`);
  }
  if (badgingPkg(devnet) !== L.DEVNET_PACKAGE || badgingPkg(production) !== L.PRODUCTION_PACKAGE) {
    die(`unexpected packages: devnet.apk=${badgingPkg(devnet)} production.apk=${badgingPkg(production)}`);
  }
  return { dir, devnet, production };
}
const sleep = s => spawnSync('sleep', [String(s)]);

// ------------------------------------------------------------------------------ readouts

const READOUTS = 'readouts.jsonl';
const recorded = () =>
  existsSync(join(OUT, READOUTS))
    ? readFileSync(join(OUT, READOUTS), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    : [];
function record(readouts) {
  mkdirSync(OUT, { recursive: true });
  const { added } = M1B.mergeReadouts(recorded(), readouts, new Date().toISOString());
  for (const a of added) {
    appendFileSync(join(OUT, READOUTS), JSON.stringify(a) + '\n');
    const r = a.readout;
    console.log(`readout ${r.session}-${r.seq} ${r.event}${r.probe ? ` ${r.probe} run ${r.run}` : ''}${r.status !== undefined ? ` status ${r.status}` : ''}`);
  }
  return added;
}
function collect() {
  const { readouts, incomplete, invalid } = L.readoutsFromLog(adb(['logcat', '-d']).out);
  const added = record(readouts);
  if (incomplete.length) {
    console.log(`incomplete readouts (chunks missing — the log rotated?): ${incomplete.join(', ')}`);
  }
  for (const v of invalid) {
    console.log(`INVALID readout ${v.id}: ${v.why}`);
  }
  console.log(`collect: ${added.length} new readout(s), ${recorded().length} recorded in ${join(OUT, READOUTS)}`);
}

// ------------------------------------------------------------------------------ commands

function checkApks() {
  const a = apks();
  const config = {};
  for (const [k, f] of [['devnet', a.devnet], ['production', a.production]]) {
    const tmp = mkdtempSync(join(tmpdir(), 'm1c-dex-'));
    try {
      execFileSync('unzip', ['-q', '-o', f, 'classes*.dex', '-d', tmp]);
      for (const dex of readdirSync(tmp).filter(n => /^classes\d*\.dex$/.test(n))) {
        const c = L.buildConfigFromDexdump(execFileSync(buildTool('dexdump'), ['-f', join(tmp, dex)], { encoding: 'utf8', maxBuffer: 1 << 30 }));
        if (c) {
          config[k] = c;
        }
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  writeFileSync(join(a.dir, 'CONFIG.json'), JSON.stringify(config, null, 2) + '\n');
  const lines = L.judgeApkConfig(config);
  const control = L.judgeApkConfig({ devnet: config.devnet, production: config.devnet }).find(l => l.id === 'M1c.A2');
  for (const l of lines) {
    console.log(`${l.pass ? 'PASS' : 'FAIL'}  ${l.id}  ${l.text}\n        ${l.detail}`);
  }
  console.log(control.pass ? 'CONTROL FAILED: the production check passes the devnet APK' : 'control OK: the production check refuses the devnet APK');
  process.exit(lines.every(l => l.pass) && !control.pass ? 0 : 1);
}

function install() {
  const a = apks();
  oneDevice();
  const pre = I.preflightAll({
    adb: rawAdb,
    apkSigners,
    sha256File,
    outDir: OUT,
    allowFreshProduction: flag(I.ALLOW_FRESH_PRODUCTION.slice(2)),
    targets: [
      { pkg: L.DEVNET_PACKAGE, apk: a.devnet },
      { pkg: L.PRODUCTION_PACKAGE, apk: a.production },
    ],
  });
  const at = new Date().toISOString();
  appendFileSync(join(OUT, 'installs.log.jsonl'), JSON.stringify({ at, step: 'install', packages: pre }) + '\n');
  for (const p of pre) {
    console.log(
      p.installed
        ? `${p.pkg}: installed, same signer; rollback ${p.rollback.dir}\n  restore with: ${p.rollback.command}`
        : `${p.pkg}: not installed (a first install${p.fresh ? `, allowed by ${I.ALLOW_FRESH_PRODUCTION}` : ''})`,
    );
  }
  console.log(`installing ${L.DEVNET_PACKAGE} (devnet release; its data is kept) …`);
  I.installApk({ adb: rawAdb, pkg: L.DEVNET_PACKAGE, apk: a.devnet });
  const l = M1B.launchCheck({ adb: rawAdb, pkg: L.DEVNET_PACKAGE, id: 'M1c.L1', text: 'the devnet release APK launches on the phone', wait: () => sleep(10) });
  console.log(`${l.pass ? 'PASS' : 'FAIL'}  ${l.id}  ${l.text}\n        ${l.detail}`);
  json('launch-devnet.json', { ...l, at: new Date().toISOString() });
  process.exit(l.pass ? 0 : 1);
}

function pinnedControl() {
  const dir = opt('apks') ?? die('needs --apks DIR (its CONFIG.json, written by check-apks, holds the devnet API_BASE)');
  const cfgFile = join(dir, 'CONFIG.json');
  existsSync(cfgFile) || die(`missing ${cfgFile} — run check-apks first`);
  const apiBase = JSON.parse(readFileSync(cfgFile, 'utf8')).devnet?.API_BASE;
  mkdirSync(OUT, { recursive: true });
  let trigger = null;
  if (!flag('judge-only')) {
    oneDevice();
    collect();
    const knownRunKeys = L.pinnedRuns(recorded().map(x => x.readout)).map(r => r.key);
    console.log(`sending ${L.PINNED_CONTROL_LINK} to ${L.DEVNET_PACKAGE} and waiting for its three readout lines (≤ 150 s) …`);
    trigger = D.triggerPinnedControl({ adb: rawAdb, sleep, knownRunKeys });
    record(trigger.readouts);
    if (!trigger.started) {
      console.log(`the devnet app did not start on the link: ${trigger.startOutput.trim()}`);
    }
    if (!trigger.run) {
      console.log(
        'no new complete pinned-control run appeared (is the installed devnet app this commit\'s? is the phone ' +
          'unlocked? it may also have crashed partway — check `adb logcat -d -b crash`)',
      );
    }
  }
  // review C1: a run on record from an earlier invocation (or an older APK) is NEVER judged here —
  // only --judge-only re-judges the record; a triggered run with `trigger.run === null` judges
  // NOTHING, so a stale PASS can never stand in for the run this invocation actually produced.
  const readouts = L.judgedReadouts({ judgeOnly: flag('judge-only'), trigger, recorded: recorded().map(x => x.readout) });
  const lines = L.judgePinnedControl({
    readouts,
    apiBase,
    ...(trigger && !trigger.run ? { noRunDetail: 'no NEW complete run after the trigger (a stale earlier run is never judged)' } : {}),
  });
  for (const l of lines) {
    console.log(`${l.pass ? 'PASS' : 'FAIL'}  ${l.id}  ${l.text}\n        ${l.detail}`);
  }
  const judgedRun = L.pinnedRuns(readouts).filter(r => r.complete).pop()?.key ?? null;
  json('pinned-control.json', {
    at: new Date().toISOString(),
    apiBase,
    triggered: trigger ? { started: trigger.started, run: trigger.run?.key ?? null, polls: trigger.polls } : null,
    judgedRun,
    lines,
  });
  const pass = lines.every(l => l.pass);
  console.log(pass ? 'GATE PASSED: outcome logic may be written (§6.0).' : 'GATE NOT PASSED: no outcome logic is written before this line passes (§6.0) — report the FAIL lines.');
  process.exit(pass ? 0 : 1);
}

try {
  switch (cmd) {
    case 'check-apks':
      checkApks();
      break;
    case 'install':
      install();
      break;
    case 'collect':
      oneDevice();
      collect();
      break;
    case 'pinned-control':
      pinnedControl();
      break;
    default:
      die(`unknown command ${cmd ?? '(none)'} — see the header of ${new URL(import.meta.url).pathname}`);
  }
} catch (e) {
  if (e instanceof I.CheckpointStop) {
    console.error(`STOP: ${e.message}`);
    process.exit(3);
  }
  throw e;
}
