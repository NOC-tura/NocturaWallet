#!/usr/bin/env node
/**
 * The M1b checkpoint, desk side (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1b").
 * README.md next to this file is the owner's checklist; the owner drives the app by hand, this
 * script installs, wipes, kills, reads the phone's readout lines and judges them against devnet.
 *
 *   check-apks --apks DIR                  the two release APKs' BuildConfig (dexdump) → DIR/CONFIG.json
 *   fund --main ADDR [--rpc URL]           the main account's devnet SOL and test-token balance (+ what to ask for)
 *   install --apks DIR [--allow-fresh-production]
 *                                          M1a's preflight for BOTH packages (signer, rollback, STOP), then installs
 *                                          devnet.apk only and launches it (M1b.8)
 *   collect                                one `adb logcat -d`: new readouts → OUT/readouts.jsonl
 *   watch [--kill-after-submit]            streams the log into OUT/readouts.jsonl; with the flag, force-stops the
 *                                          DEVNET app the moment a "deposit-submitted" readout appears (→ OUT/kill.json)
 *   wipe --apks DIR --confirm-wipe com.nocturawallet.devnet
 *                                          collects, then `pm clear com.nocturawallet.devnet` — the ONE clear, only
 *                                          that package, only with the typed confirmation, only if it is signed by
 *                                          DIR/devnet.apk's key (→ OUT/wipe.json), then clears the log
 *   prod --apks DIR [--allow-fresh-production]
 *                                          force-stops the devnet app, installs production.apk over the wallet
 *                                          (M1a's rules), cold-launches it: alive, no crash, NO readout line (M1b.9)
 *   prod-check                             after the owner unlocked the production wallet: alive, no crash, no
 *                                          readout line since the launch (M1b.10)
 *   verify --main ADDR [--apks DIR] [--rpc URL]
 *                                          runs the I-3 Jest test, reads the named transactions and the tree's
 *                                          signature list from devnet, prints PASS / FAIL per §16 line; exit 0 only
 *                                          if every line passed
 *   common: [--out DIR] (default build/m1b-checkpoint) [--serial S]
 *
 * Never uninstalls; never clears anything but the devnet app's data in `wipe`; never contacts
 * *.noc-tura.io, solscan.io or mainnet (the RPC must answer devnet's genesis hash).
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as I from '../m1a-checkpoint/install.mjs';
import { rpcRefusal } from '../m1a-checkpoint/lib.mjs';
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
const OUT = resolve(opt('out', join(ROOT, 'build/m1b-checkpoint')));
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const die = msg => {
  console.error(`m1b-checkpoint: ${msg}`);
  process.exit(2);
};
const json = (f, v) => writeFileSync(join(OUT, f), JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2) + '\n');
const readJson = (f, dflt = null) => (existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : dflt);

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
/** The raw adb: {status, out}. Callers pass it through I.guarded — except clearDevnetAppData's one clear. */
const rawAdb = args => {
  const r = spawnSync(adbPath(), [...serialArgs(), ...args], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 << 20 });
  return { status: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
};
const adb = I.guarded(rawAdb);
function oneDevice() {
  const devices = adb(['devices']).out.split('\n').filter(l => /\tdevice$/.test(l));
  if (!opt('serial') && devices.length !== 1) {
    die(`expected exactly one device, adb sees ${devices.length} (use --serial)`);
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

// ------------------------------------------------------------------------------ the RPC

async function rpc(url, body) {
  const why = rpcRefusal(url);
  if (why) {
    die(why);
  }
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    die(`RPC ${new URL(url).hostname} answered HTTP ${res.status}`);
  }
  return res.json();
}
/** One batch with getGenesisHash first: the answers by id, or die if the RPC is not devnet. */
async function devnetBatch(url, calls) {
  const out = await rpc(url, [{ jsonrpc: '2.0', id: 0, method: 'getGenesisHash' }, ...calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, ...c }))]);
  const byId = Object.fromEntries(out.map(r => [r.id, r]));
  if (byId[0]?.result !== L.DEVNET.genesisHash) {
    die(`the RPC is not devnet (genesis ${byId[0]?.result ?? JSON.stringify(byId[0]?.error)})`);
  }
  return calls.map((_, i) => {
    const r = byId[i + 1];
    if (r?.error) {
      die(`${calls[i].method}: ${JSON.stringify(r.error)}`);
    }
    return r.result;
  });
}

// ------------------------------------------------------------------------------ readouts

const READOUTS = 'readouts.jsonl';
const recorded = () =>
  existsSync(join(OUT, READOUTS))
    ? readFileSync(join(OUT, READOUTS), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    : [];
function record(readouts) {
  const { added } = D.mergeReadouts(recorded(), readouts, new Date().toISOString());
  for (const a of added) {
    appendFileSync(join(OUT, READOUTS), JSON.stringify(a) + '\n');
    const r = a.readout;
    console.log(`readout ${r.session}-${r.seq} ${r.event}${r.status ? ` ${r.status}` : ''}${r.phase ? ` ${r.phase}` : ''}${r.leafIndex !== undefined ? ` leaf ${r.leafIndex}` : ''}${r.restoredBecause ? ` restored (${r.restoredBecause})` : ''}`);
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
    const tmp = mkdtempSync(join(tmpdir(), 'm1b-dex-'));
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
  // NEGATIVE CONTROL: the same reading, handed the devnet APK as "production", must refuse it.
  const control = L.judgeApkConfig({ devnet: config.devnet, production: config.devnet }).find(l => l.id === 'M1b.A2');
  for (const l of lines) {
    console.log(`${l.pass ? 'PASS' : 'FAIL'}  ${l.id}  ${l.text}\n        ${l.detail}`);
  }
  console.log(control.pass ? 'CONTROL FAILED: the production check passes the devnet APK' : 'control OK: the production check refuses the devnet APK');
  process.exit(lines.every(l => l.pass) && !control.pass ? 0 : 1);
}

async function fund() {
  const main = opt('main') ?? die('needs --main <the devnet app\'s main account, from its Receive screen>');
  const [lamports, tokens] = await devnetBatch(opt('rpc', DEFAULT_RPC), [
    { method: 'getBalance', params: [main, { commitment: 'confirmed' }] },
    { method: 'getTokenAccountsByOwner', params: [main, { mint: L.DEVNET.mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }] },
  ]);
  const units = tokens.value.map(t => BigInt(t.account.data.parsed.info.tokenAmount.amount));
  const total = units.reduce((s, x) => s + x, 0n);
  console.log(`main ${main} on devnet: ${lamports.value} lamports (${lamports.value / 1e9} SOL); test token ${L.DEVNET.mint}: ${total} base units in ${units.length} account(s)`);
  const needUnits = 1_500_000n; // deposit 1: 1,000,000 + deposit 2 (the kill): 500,000
  const needLamports = 20_000_000; // two deposits ≈ 2 × (5,000 fee + 695,960 rho-marker rent) + margin
  if (lamports.value < needLamports) {
    console.log(`NEED SOL: ask the devnet faucet (https://faucet.solana.com, devnet) for 1 SOL to ${main}`);
  }
  if (total < needUnits) {
    console.log(
      [
        `NEED TEST TOKENS: no faucet exists for this custom mint; its mint authority is ${L.DEVNET.mintAuthority} (the program side's devnet key). Send them:`,
        `  "Please mint 10,000,000 base units (0.01 TEST) of the devnet A0 test mint ${L.DEVNET.mint} to the devnet`,
        `   wallet ${main} (its associated token account, created idempotently, paid by ${L.DEVNET.mintAuthority}).`,
        '   Devnet only, for the wallet\'s M1b checkpoint. Reply with the signature."',
        '  (or see README "Test tokens" for the owner-run alternative with the devnet key on this laptop)',
      ].join('\n'),
    );
  }
  process.exit(lamports.value >= needLamports && total >= needUnits ? 0 : 1);
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
  json('installs.json', { at, step: 'install', packages: pre });
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
  const l = D.launchCheck({ adb: rawAdb, pkg: L.DEVNET_PACKAGE, id: 'M1b.8', text: 'the devnet release APK launches on the phone', wait: () => sleep(10) });
  saveLaunch(l);
}
function saveLaunch(l) {
  const launches = readJson('launches.json', []).filter(x => x.id !== l.id);
  launches.push({ id: l.id, text: l.text, pass: l.pass, detail: l.detail, at: new Date().toISOString() });
  json('launches.json', launches);
  if (l.crash) {
    writeFileSync(join(OUT, `crash-${l.id}.txt`), l.crash);
  }
  console.log(`${l.pass ? 'PASS' : 'FAIL'}  ${l.id}  ${l.text}\n        ${l.detail}`);
}

function watch() {
  oneDevice();
  const killAfterSubmit = flag('kill-after-submit');
  // review I-1: `adb logcat` replays the buffer, which still holds the earlier deposits'
  // "deposit-submitted" lines — record them first, so only a readout new on the stream can kill
  collect();
  const w = new D.KillWatcher({ killAfterSubmit, known: D.readoutIdsOf(recorded()), kill: () => D.killDevnetApp(rawAdb) });
  const child = spawn(adbPath(), [...serialArgs(), 'logcat'], { stdio: ['ignore', 'pipe', 'inherit'] });
  console.log(`watching the phone's log${killAfterSubmit ? ' — the DEVNET app is force-stopped at the first NEW "deposit-submitted" (those already recorded are ignored)' : ''} (Ctrl-C to end)`);
  child.stdout.setEncoding('utf8');
  let written = false;
  child.stdout.on('data', chunk => {
    const fresh = w.push(chunk);
    record(fresh.map(f => f.readout));
    if (w.killed && !written) {
      // this run's kill is THE kill (a repeat replaces kill.json; every kill stays in kills.log.jsonl)
      written = true;
      json('kill.json', w.killed);
      appendFileSync(join(OUT, 'kills.log.jsonl'), JSON.stringify(w.killed) + '\n');
      console.log(`KILLED ${L.DEVNET_PACKAGE} at ${w.killed.at}, after the submit of ${w.killed.signature} — reopen the devnet app and unlock it; leave this running`);
    }
  });
  process.on('SIGINT', () => {
    child.kill();
    process.exit(0);
  });
}

function wipe() {
  const a = apks();
  const confirm = opt(D.CONFIRM_WIPE.slice(2));
  const why = D.wipeRefusal(L.DEVNET_PACKAGE, confirm);
  if (why) {
    throw new I.CheckpointStop(why);
  }
  oneDevice();
  collect(); // every readout of before the wipe is recorded as before it
  const bar = '!'.repeat(100);
  console.error(`${bar}\nWIPING ${L.DEVNET_PACKAGE} (the DEVNET app's data, its devnet wallet) — never ${L.PRODUCTION_PACKAGE}. Ctrl-C within 10 s to stop.\n${bar}`);
  sleep(10);
  const r = D.clearDevnetAppData({ adb: rawAdb, pkg: L.DEVNET_PACKAGE, confirm, apk: a.devnet, apkSigners, sha256File, outDir: OUT });
  adb(['logcat', '-c']);
  const w = { at: new Date().toISOString(), ...r };
  json('wipe.json', w);
  appendFileSync(join(OUT, 'installs.log.jsonl'), JSON.stringify({ at: w.at, step: 'wipe', pkg: w.pkg, answer: w.answer }) + '\n');
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
  const at = new Date().toISOString();
  appendFileSync(join(OUT, 'installs.log.jsonl'), JSON.stringify({ at, step: 'prod', packages: [p] }) + '\n');
  if (p.fresh) {
    const bar = '!'.repeat(100);
    console.error(`${bar}\n${I.noWalletLine(L.PRODUCTION_PACKAGE)}\n${bar}`);
    sleep(15);
  } else {
    console.log(`${L.PRODUCTION_PACKAGE}: same signer; rollback ${p.rollback.dir}\n  restore with: ${p.rollback.command}\ninstalling production.apk over the installed wallet — its data is kept …`);
  }
  I.installApk({ adb: rawAdb, pkg: L.PRODUCTION_PACKAGE, apk: a.production });
  saveLaunch(
    D.launchCheck({
      adb: rawAdb,
      pkg: L.PRODUCTION_PACKAGE,
      id: 'M1b.9',
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
  const l = D.afterCheck({
    adb: rawAdb,
    pkg: L.PRODUCTION_PACKAGE,
    id: 'M1b.10',
    text: "the production app after the owner's unlock (the A0 modules loaded): alive, no crash, no readout line",
    expectNoReadout: true,
  });
  if (devnetPid) {
    l.pass = false;
    l.detail += `; the devnet app is RUNNING (pid ${devnetPid}) — its lines would be indistinguishable: run \`prod\` again`;
  }
  saveLaunch(l);
}

async function verify() {
  const main = opt('main') ?? die('needs --main <the devnet app\'s main account>');
  const url = opt('rpc', DEFAULT_RPC);
  mkdirSync(OUT, { recursive: true });
  const readouts = recorded();
  const kill = readJson('kill.json');
  const wipeRec = readJson('wipe.json');
  const sigs = [...new Set([...readouts.filter(x => x.readout.signature).map(x => x.readout.signature), kill?.signature].filter(Boolean))];
  const answers = sigs.length
    ? await devnetBatch(url, sigs.map(s => ({ method: 'getTransaction', params: [s, { encoding: 'json', maxSupportedTransactionVersion: 1, commitment: 'confirmed' }] })))
    : [];
  const txs = Object.fromEntries(sigs.map((s, i) => [s, answers[i] ?? null]));
  const pages = [];
  let before;
  for (;;) {
    const [page] = await devnetBatch(url, [{ method: 'getSignaturesForAddress', params: [L.DEVNET.merkleTree, { limit: 1000, commitment: 'confirmed', ...(before ? { before } : {}) }] }]);
    pages.push(page);
    if (page.length < 1000) {
      break;
    }
    before = page[page.length - 1].signature;
  }
  const chain = { txs, tree: { pages, readAt: new Date().toISOString(), rpcHost: new URL(url).hostname } };
  json('chain.json', chain);

  // I-3 (§14): the recording-Connection test, run here at this commit. Its evidence is THIS run
  // only (review I-2): the old result file removed first, HEAD and the tree read before, HEAD read
  // after, the spawn's own status — a stale file or a jest that did not start is "not run".
  const gitHead = () => execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const head = gitHead();
  const dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
  const jestOut = join(OUT, 'i3-jest.json');
  rmSync(jestOut, { force: true });
  const startedAt = Date.now();
  const spawned = spawnSync('npx', ['jest', '--ci', '--json', '--outputFile', jestOut, 'src/modules/shielded/a0/__tests__/restoreRequests.test.ts'], { cwd: ROOT, stdio: 'inherit' });
  let j = null;
  try {
    j = existsSync(jestOut) ? JSON.parse(readFileSync(jestOut, 'utf8')) : null;
  } catch {
    j = null;
  }
  const i3 = L.readI3({ spawn: { status: spawned.status, error: spawned.error }, json: j, startedAt, head: { before: head, after: gitHead() }, dirty });
  json('i3-run.json', { ...i3, startedAt: new Date(startedAt).toISOString(), status: spawned.status });

  const apkDir = opt('apks', join(ROOT, 'build/m1b-checkpoint/apks'));
  const config = existsSync(join(apkDir, 'CONFIG.json')) ? JSON.parse(readFileSync(join(apkDir, 'CONFIG.json'), 'utf8')) : {};
  const apksCommit = existsSync(join(apkDir, 'COMMIT')) ? readFileSync(join(apkDir, 'COMMIT'), 'utf8').trim() : null;
  const { lines, info } = L.judge({
    readouts,
    wipe: wipeRec,
    kill,
    main,
    chain,
    launches: readJson('launches.json', []),
    apkLines: L.judgeApkConfig(config),
    i3,
    commit: { head: dirty ? `${head} (dirty)` : head, apks: apksCommit },
  });
  console.log(`M1b checkpoint — ${OUT} (devnet via ${chain.tree.rpcHost}, ${chain.tree.readAt})`);
  for (const l of lines) {
    console.log(`${(l.pass ? 'PASS' : 'FAIL').padEnd(5)} ${l.id.padEnd(7)} ${l.text}${l.detail ? `\n${' '.repeat(14)}${l.detail}` : ''}`);
  }
  for (const i of info) {
    console.log(`\n${'!'.repeat(100)}\n${i}\n${'!'.repeat(100)}`);
  }
  const failed = lines.filter(l => !l.pass).length;
  console.log(failed ? `FAILED (${failed} line${failed > 1 ? 's' : ''})` : 'CHECKPOINT PASSED');
  return failed ? 1 : 0;
}

/** A STOP halts the checkpoint: printed, exit 3, nothing after it runs. */
function stopping(f) {
  try {
    return f();
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
  fund,
  install: () => stopping(install),
  collect: () => stopping(() => {
    oneDevice();
    collect();
  }),
  watch: () => stopping(watch),
  wipe: () => stopping(wipe),
  prod: () => stopping(prod),
  'prod-check': () => stopping(prodCheck),
  verify: async () => process.exit(await verify()),
};
if (!commands[cmd]) {
  console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 33).join('\n'));
  process.exit(2);
}
await commands[cmd]();
