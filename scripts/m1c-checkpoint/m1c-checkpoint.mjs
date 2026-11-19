#!/usr/bin/env node
/**
 * The M1c checkpoint, desk side (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1c", both;
 * §6.0). README.md next to this file is the owner's checklist; the owner drives the app by hand,
 * this script installs, arms the hold, kills, wipes (or records the owner's wipe), reads the
 * phone's readout lines and judges them against devnet.
 *
 *   check-apks --apks DIR                  the two release APKs' BuildConfig (dexdump, incl. API_BASE)
 *                                          → DIR/CONFIG.json; the readout gate open in devnet.apk, closed
 *                                          in production.apk (with its negative control), the devnet API
 *                                          base ending in exactly one /v1
 *   install --apks DIR [--allow-fresh-production]
 *                                          M1a's preflight for BOTH packages (signer, rollback, STOP; M1a's
 *                                          install.mjs unchanged), then installs devnet.apk only and
 *                                          cold-launches it (M1c.L1)
 *   collect                                one `adb logcat -d`: new readouts → OUT/readouts.jsonl
 *   watch                                  streams the log into OUT/readouts.jsonl (Ctrl-C to end)
 *   pinned-control --apks DIR [--judge-only]
 *                                          sends `noctura://a0-pinned-control` to the DEVNET app, waits for
 *                                          its three readout lines, judges §6.0 (M1c.P0–P3) against the API
 *                                          base of DIR/CONFIG.json → OUT/pinned-control.json; exit 0 only
 *                                          if every line passed. Judges ONLY the run this invocation
 *                                          triggered (review C1): a run that never appears judges NOTHING,
 *                                          never a stale earlier run already on record. --judge-only is the
 *                                          one path that re-judges the whole record, without sending anything.
 *   balances --address A [--address B …] [--rpc URL]
 *                                          devnet SOL and test-token balances of the named addresses
 *   hold-kill                              CP2b: arms the devnet app's one-shot submit hold
 *                                          (`noctura://a0-hold-next-submit`), then streams the log and
 *                                          force-stops the DEVNET app the moment a held "unshield-submitting"
 *                                          line appears (→ OUT/kill.json)
 *   wipe --apks DIR --confirm-wipe com.nocturawallet.devnet
 *                                          M1b's one clear: `pm clear com.nocturawallet.devnet` (exact
 *                                          package, typed confirmation, the checkpoint's signer) → OUT/wipe.json
 *   wipe --apks DIR --confirm-wipe com.nocturawallet.devnet --manual clear-data|in-app|reinstall
 *                                          the phone refuses `pm clear`: the desk sends NO clear, prints the
 *                                          owner's steps, waits for Enter, records "manual: <how>"
 *                                          (either form: [--label NAME] records a wipe that is NOT the judged
 *                                          one into OUT/wipe-NAME.json — the cli wallet's switch)
 *   prod --apks DIR [--allow-fresh-production]
 *                                          force-stops the devnet app, installs production.apk over the wallet
 *                                          (M1a's rules), cold-launches it: no crash, NO readout line (M1c.L2)
 *   prod-check                             after the owner unlocked the production wallet (M1c.L3)
 *   phone [--apks DIR --instrument]        the phone's model and API level (M1c.N1); with --instrument the
 *                                          test APK DIR/devnet-androidTest.apk installed (M1a's rules) and
 *                                          A0ConfirmWindowTest run (M1c.N2) → OUT/phone.json
 *   chain-facts [--rpc URL] [--record FILE]
 *                                          ONE devnet batch: the A0 program's programData (its ELF's sha256,
 *                                          M1c.K1) and the wchange_vk account against the pinned VK (M1c.K2);
 *                                          --record writes the program and wchange_vk answers as a fixture
 *   verify --apks DIR [--rpc URL]          reads every landed unshield's transaction, the held account's
 *                                          history and the chain facts from devnet; prints PASS / FAIL per
 *                                          §16 line; exit 0 only if every line passed
 *   common: [--out DIR] (default build/m1c-checkpoint) [--serial S]
 *
 * Never uninstalls; never clears anything but the devnet app's data in `wipe` (and nothing at all
 * with --manual); never signs or sends a transaction; never contacts *.noc-tura.io, solscan.io or
 * mainnet itself — the PHONE talks to the relayer; the desk reads devnet (genesis-checked) and the
 * phone's log.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { base58, base64 } from '@scure/base';
import * as I from '../m1a-checkpoint/install.mjs';
import * as M1B from '../m1b-checkpoint/device.mjs';
import * as C from './chain.mjs';
import * as D from './device.mjs';
import * as L from './lib.mjs';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '../..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const opts = name => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));
const flag = name => argv.includes(`--${name}`);
const OUT = resolve(opt('out', join(ROOT, 'build/m1c-checkpoint')));
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const die = msg => {
  console.error(`m1c-checkpoint: ${msg}`);
  process.exit(2);
};
const json = (f, v) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, f), JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2) + '\n');
};
const readJson = (f, dflt = null) => (existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : dflt);
const printLine = l => console.log(`${(l.pass ? 'PASS' : 'FAIL').padEnd(5)} ${l.id.padEnd(7)} ${l.text}${l.detail ? `\n${' '.repeat(14)}${l.detail}` : ''}`);

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
/** The raw adb: {status, out}. Every caller passes it through I.guarded — except M1b's one clear. */
const rawAdb = args => {
  const r = spawnSync(adbPath(), [...serialArgs(), ...args], { encoding: 'utf8', timeout: 1500000, maxBuffer: 64 << 20 });
  return { status: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
};
const adb = I.guarded(rawAdb);
function oneDevice() {
  const devices = adb(['devices']).out.split('\n').filter(l => /\tdevice$/.test(l));
  if (!opt('serial') && devices.length !== 1) {
    die(`expected exactly one device, adb sees ${devices.length} (use --serial; wireless adb drops when the phone locks — unlock it, \`adb pair\` / \`adb connect\` again)`);
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
  return { dir, devnet, production, test: join(dir, 'devnet-androidTest.apk') };
}
const sleep = s => spawnSync('sleep', [String(s)]);

// ------------------------------------------------------------------------------ the RPC (devnet only)

function rpcRefusal(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return `not a URL: ${url}`;
  }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:') {
    return `the RPC must be https: ${u.origin}`;
  }
  if (h === 'noc-tura.io' || h.endsWith('.noc-tura.io') || h === 'solscan.io' || h.endsWith('.solscan.io') || h.includes('mainnet')) {
    return `refusing ${h}: the desk reads devnet only, never noc-tura.io, solscan.io or mainnet`;
  }
  return null;
}
/**
 * The genesis hash first (devnet's, or die), then each call as its OWN request — the public devnet
 * RPC answers a batch holding getAccountInfo with 429 "Too many requests for a specific RPC call"
 * (measured 2026-11-18) — with up to 5 tries 2 s apart on a 429. The answers in order.
 */
async function devnetBatch(url, calls) {
  const why = rpcRefusal(url);
  if (why) {
    die(why);
  }
  const one = async (method, params) => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }) });
      const body = res.status === 429 ? null : res.ok ? await res.json() : die(`RPC ${new URL(url).hostname} answered HTTP ${res.status} to ${method}`);
      if (body && body.error?.code !== 429) {
        if (body.error) {
          die(`${method}: ${JSON.stringify(body.error)}`);
        }
        return body.result;
      }
      if (attempt >= 5) {
        die(`RPC ${new URL(url).hostname}: ${method} rate-limited (429) 5 times — wait a minute and run again`);
      }
      sleep(2);
    }
  };
  const genesis = await one('getGenesisHash');
  if (genesis !== L.DEVNET.genesisHash) {
    die(`the RPC is not devnet (genesis ${genesis})`);
  }
  const out = [];
  for (const c of calls) {
    out.push(await one(c.method, c.params));
  }
  return out;
}
const B64 = { encoding: 'base64', commitment: 'confirmed' };

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
    const what = [r.probe && `${r.probe} run ${r.run}`, r.phase, r.restoredBecause && `restored (${r.restoredBecause})`, r.destination, r.status, r.state, r.heldMs ? `held ${r.heldMs} ms` : null]
      .filter(Boolean)
      .join(' ');
    console.log(`readout ${r.session}-${r.seq} ${r.event}${what ? ` ${what}` : ''}`);
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
const knownIds = () => recorded().map(x => `${x.readout.session}-${x.readout.seq}`);

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

function saveLaunch(l) {
  const launches = readJson('launches.json', []).filter(x => x.id !== l.id);
  launches.push({ id: l.id, text: l.text, pass: l.pass, detail: l.detail, at: new Date().toISOString() });
  json('launches.json', launches);
  if (l.crash) {
    writeFileSync(join(OUT, `crash-${l.id}.txt`), l.crash);
  }
  console.log(`${l.pass ? 'PASS' : 'FAIL'}  ${l.id}  ${l.text}\n        ${l.detail}`);
  return l.pass;
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
  json('launch-devnet.json', { ...l, at: new Date().toISOString() });
  process.exit(saveLaunch(l) ? 0 : 1);
}

function watch() {
  oneDevice();
  collect();
  const known = new Set(knownIds());
  const child = spawn(adbPath(), [...serialArgs(), 'logcat'], { stdio: ['ignore', 'pipe', 'inherit'] });
  console.log('watching the phone\'s log (Ctrl-C to end)');
  child.stdout.setEncoding('utf8');
  let text = '';
  child.stdout.on('data', chunk => {
    text += chunk;
    const cut = text.lastIndexOf('\n');
    if (cut < 0) {
      return;
    }
    const fresh = L.readoutsFromLog(text.slice(0, cut + 1)).readouts.filter(r => !known.has(`${r.session}-${r.seq}`));
    for (const r of fresh) {
      known.add(`${r.session}-${r.seq}`);
    }
    record(fresh);
  });
  process.on('SIGINT', () => {
    child.kill();
    process.exit(0);
  });
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

async function balances() {
  const addresses = opts('address');
  addresses.length || die('needs --address A [--address B …]');
  for (const a of addresses) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) || base58.decode(a).length !== 32) {
      die(`not an address: ${a}`);
    }
  }
  const answers = await devnetBatch(
    opt('rpc', DEFAULT_RPC),
    addresses.flatMap(a => [
      { method: 'getBalance', params: [a, { commitment: 'confirmed' }] },
      { method: 'getTokenAccountsByOwner', params: [a, { mint: L.DEVNET.mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }] },
    ]),
  );
  addresses.forEach((a, i) => {
    const lamports = answers[2 * i].value;
    const units = answers[2 * i + 1].value.reduce((s, t) => s + BigInt(t.account.data.parsed.info.tokenAmount.amount), 0n);
    console.log(`${a}: ${lamports} lamports (${lamports / 1e9} SOL), test token ${units} base units`);
  });
}

async function holdKill() {
  oneDevice();
  collect();
  console.log(`arming the next unshield's submit hold: ${L.SUBMIT_HOLD_LINK} → ${L.DEVNET_PACKAGE} …`);
  const armed = D.armSubmitHold({ adb: rawAdb, sleep, knownIds: knownIds() });
  record(armed.readouts);
  if (!armed.armed) {
    die(`no new "submit-hold armed" readout within 30 s (${armed.started ? 'the app started' : `the app did not start: ${armed.startOutput.trim()}`}) — is the installed devnet app this commit's? the phone unlocked?`);
  }
  const w = new D.HeldSubmitKiller({ known: knownIds(), kill: () => D.killDevnetApp(rawAdb) });
  const child = spawn(adbPath(), [...serialArgs(), 'logcat'], { stdio: ['ignore', 'pipe', 'inherit'] });
  console.log(`ARMED (${armed.armed.heldMs} ms). Now, on the phone: Make public → "A new account" (preselected) → amount → approve the two prompts. The desk force-stops the DEVNET app on its held "unshield-submitting" line. (Ctrl-C to give up.)`);
  child.stdout.setEncoding('utf8');
  await new Promise(done => {
    child.stdout.on('data', chunk => {
      record(w.push(chunk).map(f => f.readout));
      if (w.killed) {
        json('kill.json', w.killed);
        appendFileSync(join(OUT, 'kills.log.jsonl'), JSON.stringify(w.killed) + '\n');
        console.log(`KILLED ${L.DEVNET_PACKAGE} at ${w.killed.at}, inside the hold of the unshield to ${w.killed.owner} (nothing was sent).`);
        console.log('Within 5 minutes: reopen the devnet app, unlock, and start the SECOND unshield to "A new account" (README CP2b). Then `collect`.');
        child.kill();
        done();
      } else if (w.expired) {
        child.kill();
        die(`the arm LAPSED (submit-hold expired at ${w.expired.at}: more than 10 minutes between ARMED and the unshield) — that unshield is an ordinary one and was not killed. Run \`hold-kill\` again and start the unshield at once.`);
      }
    });
    process.on('SIGINT', () => {
      child.kill();
      process.exit(1);
    });
  });
}

async function wipe() {
  const a = apks();
  const confirm = opt(M1B.CONFIRM_WIPE.slice(2));
  const why = M1B.wipeRefusal(L.DEVNET_PACKAGE, confirm);
  if (why) {
    throw new I.CheckpointStop(why);
  }
  const how = opt('manual');
  // a wipe that is not the judged one (the cli wallet's switch, README CP1c) never replaces wipe.json
  const label = opt('label');
  if (label !== undefined && !/^[a-z0-9-]{1,20}$/.test(label)) {
    throw new I.CheckpointStop(`--label must be a short lowercase name (got ${JSON.stringify(label)})`);
  }
  const wipeFile = label ? `wipe-${label}.json` : 'wipe.json';
  if (flag('manual') && D.manualWipeRefusal(how)) {
    throw new I.CheckpointStop(D.manualWipeRefusal(how));
  }
  oneDevice();
  collect(); // every readout of before the wipe is recorded as before it
  const bar = '!'.repeat(100);
  if (flag('manual')) {
    // the installed devnet app must be this checkpoint's (the signer check; nothing is installed or cleared)
    const pre = I.preflightInstall({ adb, pkg: L.DEVNET_PACKAGE, apk: a.devnet, apkSigners, sha256File, outDir: OUT });
    if (!pre.installed) {
      throw new I.CheckpointStop(`${L.DEVNET_PACKAGE} is not installed — nothing to wipe (run \`install\` first)`);
    }
    console.error(`${bar}\nMANUAL WIPE of ${L.DEVNET_PACKAGE} (the DEVNET app's wallet) — never ${L.PRODUCTION_PACKAGE}. The desk sends nothing.\n${bar}`);
    D.MANUAL_WIPES[how].forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Press Enter once that is done (BEFORE you import the phrase), or type "abort": ');
    rl.close();
    if (answer.trim().toLowerCase() === 'abort') {
      throw new I.CheckpointStop('the manual wipe was aborted by the owner — nothing recorded');
    }
    const w = D.manualWipeRecord(how, new Date().toISOString());
    collect(); // anything written since is recorded AFTER the wipe (a restore that already ran is judged)
    adb(['logcat', '-c']);
    json(wipeFile, { ...w, signer: pre.apkSigners, rollback: pre.rollback });
    appendFileSync(join(OUT, 'installs.log.jsonl'), JSON.stringify({ at: w.at, step: 'wipe', file: wipeFile, pkg: w.pkg, answer: w.answer }) + '\n');
    console.log(`recorded "${w.answer}" at ${w.at}: now open the devnet app${how === 'reinstall' ? ' (after `install`)' : ''}, IMPORT the phrase, unlock, wait for the balance; then \`collect\``);
    return;
  }
  console.error(`${bar}\nWIPING ${L.DEVNET_PACKAGE} (the DEVNET app's data, its devnet wallet) — never ${L.PRODUCTION_PACKAGE}. Ctrl-C within 10 s to stop.\n${bar}`);
  sleep(10);
  let r;
  try {
    r = M1B.clearDevnetAppData({ adb: rawAdb, pkg: L.DEVNET_PACKAGE, confirm, apk: a.devnet, apkSigners, sha256File, outDir: OUT });
  } catch (e) {
    const hint = e instanceof I.CheckpointStop ? D.wipeRefusedHint(e.message) : null;
    if (hint) {
      throw new I.CheckpointStop(`${e.message}\n  ${hint}`);
    }
    throw e;
  }
  adb(['logcat', '-c']);
  const w = { at: new Date().toISOString(), ...r };
  json(wipeFile, w);
  appendFileSync(join(OUT, 'installs.log.jsonl'), JSON.stringify({ at: w.at, step: 'wipe', file: wipeFile, pkg: w.pkg, answer: w.answer }) + '\n');
  console.log(`wiped ${w.pkg} (${w.answer}) at ${w.at}: open the devnet app, IMPORT the phrase, unlock, wait for the balance; then \`collect\``);
}

function prod() {
  const a = apks();
  oneDevice();
  collect();
  adb(['shell', 'am', 'force-stop', L.DEVNET_PACKAGE]); // only the production app may run (the readout check)
  const [p] = I.preflightAll({
    adb: rawAdb,
    apkSigners,
    sha256File,
    outDir: OUT,
    allowFreshProduction: flag(I.ALLOW_FRESH_PRODUCTION.slice(2)),
    targets: [{ pkg: L.PRODUCTION_PACKAGE, apk: a.production }],
  });
  appendFileSync(join(OUT, 'installs.log.jsonl'), JSON.stringify({ at: new Date().toISOString(), step: 'prod', packages: [p] }) + '\n');
  if (p.fresh) {
    const bar = '!'.repeat(100);
    console.error(`${bar}\n${I.noWalletLine(L.PRODUCTION_PACKAGE)}\n${bar}`);
    sleep(15);
  } else {
    console.log(`${L.PRODUCTION_PACKAGE}: same signer; rollback ${p.rollback.dir}\n  restore with: ${p.rollback.command}\ninstalling production.apk over the installed wallet — its data is kept …`);
  }
  I.installApk({ adb: rawAdb, pkg: L.PRODUCTION_PACKAGE, apk: a.production });
  saveLaunch(
    M1B.launchCheck({
      adb: rawAdb,
      pkg: L.PRODUCTION_PACKAGE,
      id: 'M1c.L2',
      text: 'the production APK of the same commit launches on the phone; no readout line in its log',
      wait: () => sleep(10),
      expectNoReadout: true,
    }),
  );
  console.log('now UNLOCK the production wallet on the phone (do not open the devnet app), then run `prod-check`');
}

function prodCheck() {
  oneDevice();
  const devnetPid = adb(['shell', 'pidof', L.DEVNET_PACKAGE]).out.trim();
  const l = M1B.afterCheck({
    adb: rawAdb,
    pkg: L.PRODUCTION_PACKAGE,
    id: 'M1c.L3',
    text: "the production app after the owner's unlock: alive, no crash, no readout line",
    expectNoReadout: true,
  });
  if (devnetPid) {
    l.pass = false;
    l.detail += `; the devnet app is RUNNING (pid ${devnetPid}) — its lines would be indistinguishable: run \`prod\` again`;
  }
  saveLaunch(l);
}

function phone() {
  oneDevice();
  const p = D.readPhone(rawAdb);
  const prev = readJson('phone.json', {});
  let instrument = prev.instrument ?? null;
  if (flag('instrument')) {
    const a = apks();
    existsSync(a.test) || die(`missing ${a.test} — build it with NOCTURA_A0_KEYS_DIR set (README "Build")`);
    const pre = I.preflightAll({
      adb: rawAdb,
      apkSigners,
      sha256File,
      outDir: OUT,
      targets: [
        { pkg: L.DEVNET_PACKAGE, apk: a.devnet },
        { pkg: L.TEST_PACKAGE, apk: a.test },
      ],
    });
    appendFileSync(join(OUT, 'installs.log.jsonl'), JSON.stringify({ at: new Date().toISOString(), step: 'phone', packages: pre }) + '\n');
    I.installApk({ adb: rawAdb, pkg: L.TEST_PACKAGE, apk: a.test, extra: ['-t'] });
    console.log('running A0ConfirmWindowTest on the phone (keep it unlocked; ≈ 1 min) …');
    const out = adb([...D.INSTRUMENT_ARGS]).out;
    writeFileSync(join(OUT, 'instrument-confirm.txt'), out);
    instrument = { ...D.instrumentVerdict(out), at: new Date().toISOString() };
  }
  json('phone.json', { ...p, row: L.authenticatorRow(p.sdk), instrument, at: new Date().toISOString() });
  console.log(`${p.model} (Android ${p.release}, API ${p.sdk}): ${L.authenticatorRow(p.sdk) ?? 'below minSdk 24'}${instrument ? `; A0ConfirmWindowTest: ${instrument.pass ? 'PASS' : 'FAIL'} ${instrument.detail}` : ''}`);
}

/** The chain facts in ONE batch: the program, its programData, the wchange_vk account. */
async function readChainFacts(url) {
  const programData = C.findPda([base58.decode(C.A0.programId)], C.PROGRAMS.bpfUpgradeable).address;
  const vkAddress = C.wchangeVkAddress();
  const [slot, program, data, vk] = await devnetBatch(url, [
    { method: 'getSlot', params: [{ commitment: 'confirmed' }] },
    { method: 'getAccountInfo', params: [C.A0.programId, B64] },
    { method: 'getAccountInfo', params: [programData, B64] },
    { method: 'getAccountInfo', params: [vkAddress, B64] },
  ]);
  const pointer = program?.value ? C.programDataAddressOf(base64.decode(program.value.data[0])) : null;
  let binary;
  if (!program?.value || program.value.owner !== C.PROGRAMS.bpfUpgradeable || !program.value.executable) {
    binary = { error: `the program account is not an executable of the upgradeable loader (owner ${program?.value?.owner})` };
  } else if (pointer !== programData) {
    binary = { error: `the program points at ${pointer}, its derived programData is ${programData}` };
  } else if (!data?.value || data.value.owner !== C.PROGRAMS.bpfUpgradeable) {
    binary = { error: 'no programData account owned by the upgradeable loader' };
  } else {
    binary = C.programDataBinary(base64.decode(data.value.data[0]));
  }
  const pinnedVk = JSON.parse(readFileSync(join(ROOT, 'native/noctura-prover/tests/fixtures/a0-vk/withdraw_change_vk.json'), 'utf8'));
  return {
    slot,
    readAt: new Date().toISOString(),
    rpcHost: new URL(url).hostname,
    binaryAddress: programData,
    binary,
    vk: C.judgeWchangeVk({ address: vkAddress, account: vk?.value ?? null, pinnedVk }),
    raw: { program, vkAccount: vk, vkAddress },
  };
}

async function chainFacts() {
  const url = opt('rpc', DEFAULT_RPC);
  const f = await readChainFacts(url);
  const lines = L.judgeM1c({ readouts: [], chain: { txs: {}, histories: {} }, facts: f }).lines.filter(l => l.id === 'M1c.K1' || l.id === 'M1c.K2');
  console.log(`devnet via ${f.rpcHost} at slot ${f.slot} (${f.readAt})`);
  lines.forEach(printLine);
  const file = opt('record');
  if (file) {
    // the fixture: the two small accounts as the RPC answered them (never the 446 KB programData)
    writeFileSync(
      resolve(file),
      JSON.stringify(
        {
          schema: 'noctura.a0.devnet-chain-facts/1',
          cluster: 'devnet',
          genesisHash: L.DEVNET.genesisHash,
          rpc: new URL(url).origin,
          fetchedAt: f.readAt,
          slot: f.slot,
          program: { address: C.A0.programId, answer: f.raw.program },
          wchangeVk: { address: f.raw.vkAddress, answer: f.raw.vkAccount },
          programData: { address: f.binaryAddress, binary: f.binary },
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`recorded → ${resolve(file)}`);
  }
  process.exit(lines.every(l => l.pass) ? 0 : 1);
}

/**
 * The relayer fee payer's signatures from `start` (unix s; the first submitting line − 2 min) to
 * now, page by page (newest first, 1,000 a page, through the one-at-a-time devnet reader with its
 * 429 backoff), and the transaction of each one that did not fail — those already read reused.
 * {signature: getTransaction result}; {} without a submitting line.
 */
async function readFeePayerWindow(url, start, known) {
  if (start === null) {
    return {};
  }
  const listed = [];
  let before;
  for (;;) {
    const [page] = await devnetBatch(url, [
      { method: 'getSignaturesForAddress', params: [L.RELAYER_FEE_PAYER, { limit: 1000, commitment: 'confirmed', ...(before ? { before } : {}) }] },
    ]);
    const list = page ?? [];
    for (const e of list) {
      if (e.blockTime === null || e.blockTime === undefined || e.blockTime >= start) {
        if (e.err === null) {
          listed.push(e.signature);
        }
      }
    }
    const tail = list[list.length - 1];
    if (list.length < 1000 || !tail || (Number.isInteger(tail.blockTime) && tail.blockTime < start)) {
      break;
    }
    before = tail.signature;
  }
  const missing = listed.filter(s => !(s in known));
  const answers = missing.length
    ? await devnetBatch(url, missing.map(s => ({ method: 'getTransaction', params: [s, { encoding: 'base64', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] })))
    : [];
  const fetched = Object.fromEntries(missing.map((s, i) => [s, answers[i] ?? null]));
  return Object.fromEntries(listed.map(s => [s, s in known ? known[s] : fetched[s]]));
}

async function verify() {
  const url = opt('rpc', DEFAULT_RPC);
  mkdirSync(OUT, { recursive: true });
  const readouts = recorded();
  const kill = readJson('kill.json');
  const wipeRec = readJson('wipe.json');
  const sigs = L.unshieldSignatures(readouts);
  const txAnswers = sigs.length
    ? await devnetBatch(url, sigs.map(s => ({ method: 'getTransaction', params: [s, { encoding: 'base64', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] })))
    : [];
  const txs = Object.fromEntries(sigs.map((s, i) => [s, txAnswers[i] ?? null]));
  // R1-I1 / R2-I1: every relayed tx the relayer fee payer landed in this session's window, so that a
  // landing no readout names is seen (the judge skips other programs' and other testers' txs)
  const feePayerTxs = await readFeePayerWindow(url, L.feePayerWindowStart(readouts), txs);
  // the held unshield's account: no history at all means nothing of it ever reached the chain
  const held = kill ? [kill.owner] : [];
  const histAnswers = held.length ? await devnetBatch(url, held.map(a => ({ method: 'getSignaturesForAddress', params: [a, { limit: 10, commitment: 'confirmed' }] }))) : [];
  const histories = Object.fromEntries(held.map((a, i) => [a, (histAnswers[i] ?? []).map(s => s.signature)]));
  const facts = await readChainFacts(url);
  json('chain.json', { txs, histories, feePayerTxs, facts: { ...facts, raw: undefined }, readAt: facts.readAt, rpcHost: facts.rpcHost });

  const apkDir = opt('apks', join(ROOT, 'build/m1c-checkpoint/apks'));
  const config = existsSync(join(apkDir, 'CONFIG.json')) ? JSON.parse(readFileSync(join(apkDir, 'CONFIG.json'), 'utf8')) : {};
  const apksCommit = existsSync(join(apkDir, 'COMMIT')) ? readFileSync(join(apkDir, 'COMMIT'), 'utf8').trim() : null;
  const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
  const pinned = L.judgePinnedControl({ readouts: readouts.map(x => x.readout), apiBase: config.devnet?.API_BASE });
  const { lines, info } = L.judgeM1c({
    readouts,
    chain: { txs, histories, feePayerTxs },
    facts,
    wipe: wipeRec,
    kill,
    launches: readJson('launches.json', []),
    apkLines: L.judgeApkConfig(config),
    commit: { head: dirty ? `${head} (dirty)` : head, apks: apksCommit },
    phone: readJson('phone.json'),
  });
  const every = [...pinned, ...lines];
  console.log(`M1c checkpoint — ${OUT} (devnet via ${facts.rpcHost}, slot ${facts.slot}, ${facts.readAt})`);
  every.forEach(printLine);
  for (const i of info) {
    console.log(`\n${'!'.repeat(100)}\n${i}\n${'!'.repeat(100)}`);
  }
  const failed = every.filter(l => !l.pass).length;
  console.log(failed ? `FAILED (${failed} line${failed > 1 ? 's' : ''})` : 'CHECKPOINT PASSED');
  return failed ? 1 : 0;
}

/** A STOP halts the checkpoint: printed, exit 3, nothing after it runs. */
async function stopping(f) {
  try {
    return await f();
  } catch (e) {
    if (e instanceof I.CheckpointStop) {
      console.error(`STOP: ${e.message}`);
      process.exit(3);
    }
    throw e;
  }
}

const commands = {
  'check-apks': checkApks,
  install: () => stopping(install),
  collect: () => stopping(() => {
    oneDevice();
    collect();
  }),
  watch: () => stopping(watch),
  'pinned-control': () => stopping(pinnedControl),
  balances,
  'hold-kill': () => stopping(holdKill),
  wipe: () => stopping(wipe),
  prod: () => stopping(prod),
  'prod-check': () => stopping(prodCheck),
  phone: () => stopping(phone),
  'chain-facts': chainFacts,
  verify: async () => process.exit(await verify()),
};
if (!commands[cmd]) {
  console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 55).join('\n'));
  process.exit(2);
}
await commands[cmd]();
