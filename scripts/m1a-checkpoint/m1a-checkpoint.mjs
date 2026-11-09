#!/usr/bin/env node
/**
 * The M1a checkpoint, desk side (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1a").
 * The owner runs it with the phone plugged in; README.md next to this file is the checklist.
 *
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs desk
 *       the desk values of the checkpoint's deposit, computed from the test mnemonic, and their
 *       match with the committed offline fixture
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs vk [--rpc URL] [--out DIR]
 *       ONE devnet request (a JSON-RPC batch: getGenesisHash + getAccountInfo of the Pool): the
 *       deposit VK the chain holds, compared with the pinned deposit_vk.json → DIR/chain-pool.json
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs phone --apks DIR [--out DIR] [--serial S] [--allow-fresh-production]
 *       installs the devnet release APK + the checkpoint test APK, runs the instrumentation,
 *       collects its report; installs the production APK; launches both apps
 *       → DIR/phone-report.json, DIR/launches.json, DIR/instrument.txt, DIR/installs.json
 *       Before ANY install, for each of the three packages: every APK of the installed app is
 *       pulled (DIR/rollback-<pkg>-<sha>/ — the rollback, never overwritten) and its signer
 *       compared with the new APK's (install.mjs). A different / unreadable signer, a failed pull or an install
 *       answering INSTALL_FAILED_* → STOP (exit 3), no further adb call. Never uninstalls,
 *       never clears app data. No wallet installed (com.nocturawallet absent) → a LOUD line and
 *       STOP, unless --allow-fresh-production. Each app is force-stopped before it is launched.
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs verify [--out DIR] [--report F] [--chain F] [--rehearsal]
 *       verifies the proofs, compares the public inputs, prints PASS / FAIL per §16 line;
 *       exit 0 only if every line passed (with --rehearsal: every line a desk can check)
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs all --apks DIR [--out DIR] [--rpc URL] [--allow-fresh-production]
 *       vk, phone, verify
 *
 * Never contacts *.noc-tura.io, never mainnet: the RPC must answer devnet's genesis hash.
 * The default RPC is the public https://api.devnet.solana.com.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import * as I from './install.mjs';
import * as L from './lib.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const flag = name => argv.includes(`--${name}`);
const OUT = resolve(opt('out', join(L.ROOT, 'build/m1a-checkpoint')));
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const die = msg => {
  console.error(`m1a-checkpoint: ${msg}`);
  process.exit(2);
};

// ------------------------------------------------------------------------------------- desk

function desk() {
  const d = L.deskValues();
  const keys = L.fixture('a0-key-vectors.json');
  const proves = L.fixture('a0-prove-vectors.json');
  const sc = proves.scenarios.find(s => s.circuit === 'deposit');
  const problems = [];
  if (keys.seeds[0].seed !== d.seedHex) {
    problems.push(
      "the fixture's seeds[0] is not BIP-39 of the test mnemonic — the phone would open another seed",
    );
  }
  if (
    sc.witness.amount !== d.amount ||
    sc.witness.depositIndex !== d.depositIndex
  ) {
    problems.push(
      "the fixture's deposit scenario is not the checkpoint's deposit",
    );
  }
  if (JSON.stringify(sc.publicInputs) !== JSON.stringify(d.publicInputs)) {
    problems.push("the fixture's deposit public inputs differ from the desk's");
  }
  return { d, problems };
}

// --------------------------------------------------------------------------------------- vk

function assertDevnetUrl(url) {
  const why = L.rpcRefusal(url);
  if (why) {
    die(why);
  }
  return new URL(url);
}

async function readChainVk(rpc) {
  const u = assertDevnetUrl(rpc);
  const body = [
    { jsonrpc: '2.0', id: 1, method: 'getGenesisHash' },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'getAccountInfo',
      params: [L.DEVNET.pool, { encoding: 'base64', commitment: 'finalized' }],
    },
  ];
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    die(`RPC ${u.hostname} answered HTTP ${res.status}`);
  }
  const out = await res.json();
  const byId = Object.fromEntries(out.map(r => [r.id, r]));
  if (byId[1]?.result !== L.DEVNET.genesisHash) {
    die(
      `RPC ${u.hostname} is not devnet (genesis ${byId[1]?.result ?? JSON.stringify(byId[1]?.error)})`,
    );
  }
  const acc = byId[2]?.result;
  if (!acc?.value) {
    die(
      `the Pool account ${L.DEVNET.pool} was not returned: ${JSON.stringify(byId[2]?.error ?? acc)}`,
    );
  }
  return {
    rpcHost: u.hostname,
    slot: acc.context.slot,
    fetchedAt: new Date().toISOString(),
    pool: L.DEVNET.pool,
    owner: acc.value.owner,
    lamports: acc.value.lamports,
    dataBase64: acc.value.data[0],
  };
}

function chainVkFrom(chain) {
  const pool = L.decodePoolAccount({
    owner: chain.owner,
    data: Buffer.from(chain.dataBase64, 'base64'),
  });
  if (pool.errs.length) {
    return { errs: pool.errs };
  }
  return { errs: [], vk: L.vkFromBlob(pool.blob), pool };
}

const pinnedVks = () => ({
  deposit: L.vkFromSnarkjs(L.fixture('a0-vk/deposit_vk.json')),
  withdrawChange: L.vkFromSnarkjs(L.fixture('a0-vk/withdraw_change_vk.json')),
});

// ------------------------------------------------------------------------------------ phone

function adbPath() {
  const sdk = process.env.ANDROID_HOME ?? join(homedir(), 'Android/Sdk');
  const p = join(sdk, 'platform-tools/adb');
  return existsSync(p) ? p : 'adb';
}
function aapt2Path() {
  const sdk = process.env.ANDROID_HOME ?? join(homedir(), 'Android/Sdk');
  const bt = join(sdk, 'build-tools');
  const v = existsSync(bt)
    ? readdirSync(bt)
        .sort()
        .reverse()
        .find(d => existsSync(join(bt, d, 'aapt2')))
    : null;
  return v ? join(bt, v, 'aapt2') : null;
}
function apksignerPath() {
  const sdk = process.env.ANDROID_HOME ?? join(homedir(), 'Android/Sdk');
  const bt = join(sdk, 'build-tools');
  const v = existsSync(bt)
    ? readdirSync(bt)
        .sort()
        .reverse()
        .find(d => existsSync(join(bt, d, 'apksigner')))
    : null;
  return v ? join(bt, v, 'apksigner') : null;
}
/** The APK's signer certificates (SHA-256), [] when apksigner cannot read them. */
function apkSigners(apk) {
  const a = apksignerPath();
  if (!a) {
    die(
      "apksigner not found (ANDROID_HOME/build-tools/*/apksigner) — needed to compare the APKs' signers with the installed apps'",
    );
  }
  try {
    return I.signerDigests(
      execFileSync(a, ['verify', '--print-certs', apk], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch {
    return [];
  }
}
const sha256File = f =>
  createHash('sha256').update(readFileSync(f)).digest('hex');

function badging(apk) {
  const a = aapt2Path();
  if (!a) {
    die(
      "aapt2 not found (ANDROID_HOME/build-tools/*/aapt2) — needed to read the APKs' package names",
    );
  }
  const out = execFileSync(a, ['dump', 'badging', apk], { encoding: 'utf8' });
  const pkg = out.match(/^package: name='([^']+)'/m)?.[1];
  return { pkg, out };
}

function phone() {
  const apks = opt('apks');
  if (!apks) {
    die(
      'phone needs --apks DIR (devnet.apk, devnet-androidTest.apk, production.apk — build-apks.sh writes them)',
    );
  }
  const devnetApk = join(apks, 'devnet.apk');
  const testApk = join(apks, 'devnet-androidTest.apk');
  const prodApk = join(apks, 'production.apk');
  for (const f of [devnetApk, testApk, prodApk]) {
    if (!existsSync(f)) {
      die(`missing ${f}`);
    }
  }
  const devnetPkg = badging(devnetApk).pkg;
  const prodPkg = badging(prodApk).pkg;
  const testB = badging(testApk);
  const testPkg = testB.pkg;
  if (
    !devnetPkg?.endsWith('.devnet') ||
    prodPkg !== 'com.nocturawallet' ||
    testPkg !== `${devnetPkg}.test`
  ) {
    die(
      `unexpected packages: devnet=${devnetPkg} production=${prodPkg} test=${testPkg}`,
    );
  }
  const serial = opt('serial');
  const adbArgs = serial ? ['-s', serial] : [];
  const adb = (args, { allowFail = false, timeout = 120000 } = {}) => {
    const why = I.adbRefusal(args);
    if (why) {
      throw new I.CheckpointStop(why);
    }
    const r = spawnSync(adbPath(), [...adbArgs, ...args], {
      encoding: 'utf8',
      timeout,
      maxBuffer: 64 << 20,
    });
    if (r.status !== 0 && !allowFail) {
      die(`adb ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
    }
    return (r.stdout ?? '') + (r.stderr ?? '');
  };
  const devices = adb(['devices'])
    .split('\n')
    .filter(l => /\tdevice$/.test(l));
  if (!serial && devices.length !== 1) {
    die(
      `expected exactly one device, adb sees ${devices.length} (use --serial)`,
    );
  }
  mkdirSync(OUT, { recursive: true });
  const abi = adb(['shell', 'getprop', 'ro.product.cpu.abi']).trim();
  console.log(
    `device ${devices[0]?.split('\t')[0] ?? serial}: ${adb(['shell', 'getprop', 'ro.product.model']).trim()}, abi ${abi}`,
  );

  // Every install's signer check (and the rollback pull) BEFORE the first install: a STOP on
  // any of the three leaves the phone exactly as it was.
  const rawAdb = I.guarded(args => {
    const r = spawnSync(adbPath(), [...adbArgs, ...args], {
      encoding: 'utf8',
      timeout: 300000,
      maxBuffer: 64 << 20,
    });
    return { status: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  });
  const pre = I.preflightAll({
    adb: rawAdb,
    apkSigners,
    sha256File,
    outDir: OUT,
    allowFreshProduction: flag(I.ALLOW_FRESH_PRODUCTION.slice(2)),
    targets: [
      { pkg: devnetPkg, apk: devnetApk },
      { pkg: testPkg, apk: testApk },
      { pkg: prodPkg, apk: prodApk },
    ],
  });
  // installs.json is this run's; installs.log.jsonl is append-only, so the FIRST rollback (taken
  // before any branch APK was installed) stays on record across re-runs.
  const at = new Date().toISOString();
  writeFileSync(
    join(OUT, 'installs.json'),
    JSON.stringify({ at, packages: pre }, null, 2) + '\n',
  );
  appendFileSync(
    join(OUT, 'installs.log.jsonl'),
    JSON.stringify({ at, packages: pre }) + '\n',
  );
  for (const p of pre) {
    console.log(
      p.installed
        ? `${p.pkg}: installed, same signer ${p.apkSigners.join(',')}; rollback ${p.rollback.dir}${p.rollback.keptExisting ? ' (already there, identical — kept, not rewritten)' : ''}\n  restore with: ${serial ? p.rollback.command.replace(/^adb /, `adb -s ${serial} `) : p.rollback.command}`
        : `${p.pkg}: not installed (a first install${p.fresh ? `, allowed by ${I.ALLOW_FRESH_PRODUCTION}` : ''}), signer ${p.apkSigners.join(',')}`,
    );
  }
  console.log(
    `installing ${devnetPkg} (devnet release) and ${testPkg} (the checkpoint) …`,
  );
  I.installApk({ adb: rawAdb, pkg: devnetPkg, apk: devnetApk });
  I.installApk({ adb: rawAdb, pkg: testPkg, apk: testApk, extra: ['-t'] });
  adb(['logcat', '-c'], { allowFail: true });
  console.log(
    'running the checkpoint on the phone (two proofs — may take a few minutes) …',
  );
  const inst = adb(
    [
      'shell',
      'am',
      'instrument',
      '-w',
      '-r',
      '-e',
      'class',
      'com.nocturawallet.prover.M1aCheckpointTest',
      `${testPkg}/androidx.test.runner.AndroidJUnitRunner`,
    ],
    { allowFail: true, timeout: 1500000 },
  );
  writeFileSync(join(OUT, 'instrument.txt'), inst);
  let report = L.reportFromInstrumentOutput(inst);
  if (!report) {
    report = L.reportFromLogcat(
      adb(['logcat', '-d', '-s', 'M1aCheckpoint:I'], { allowFail: true }),
    );
  }
  if (!report) {
    die(`no report from the phone — see ${join(OUT, 'instrument.txt')}`);
  }
  writeFileSync(
    join(OUT, 'phone-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );

  const launches = [];
  const testPassed =
    /^OK \(1 test\)/m.test(inst) && /INSTRUMENTATION_CODE: -1/.test(inst);
  launches.push({
    id: 'S16.D',
    text: 'the device-side assertions of the checkpoint test passed',
    pass: testPassed,
    detail: testPassed
      ? 'OK (1 test)'
      : (inst.match(/^(FAILURES!!!.*|.*Error.*)$/m)?.[1] ??
        'see instrument.txt'),
  });
  const launch = (pkg, id, text) => {
    // A cold start is what is measured, so the app is force-stopped first — for the production
    // package that is the owner's wallet: a restart, no data touched (README "What it does").
    adb(['shell', 'am', 'force-stop', pkg], { allowFail: true });
    adb(['logcat', '-b', 'crash', '-c'], { allowFail: true });
    const start = adb(
      [
        'shell',
        'am',
        'start',
        '-W',
        '-n',
        `${pkg}/com.nocturawallet.MainActivity`,
      ],
      { allowFail: true },
    );
    spawnSync('sleep', ['10']);
    const pid = adb(['shell', 'pidof', pkg], { allowFail: true }).trim();
    const crash = adb(['logcat', '-b', 'crash', '-d'], { allowFail: true });
    const crashed =
      crash.includes(pkg) || /UnsatisfiedLinkError|FATAL EXCEPTION/.test(crash);
    const pass = /Status: ok/.test(start) && /^\d+$/.test(pid) && !crashed;
    launches.push({
      id,
      text,
      pass,
      detail: `am start: ${start.match(/Status: \w+/)?.[0] ?? 'no status'}; pid after 10 s: ${pid || 'none'}; crash buffer: ${crashed ? 'CRASH' : 'clean'}`,
    });
    if (crashed) {
      writeFileSync(join(OUT, `crash-${pkg}.txt`), crash);
    }
  };
  launch(devnetPkg, 'S16.10', 'the devnet release APK launches on the phone');
  if (pre.find(p => p.pkg === prodPkg)?.fresh) {
    // Again, right before it happens, with time to Ctrl-C (final review Minor 5).
    const bar = '!'.repeat(100);
    console.error(`${bar}\n${I.noWalletLine(prodPkg)}\n${bar}`);
    spawnSync('sleep', ['15']);
    console.log(
      `installing ${prodPkg} (production) fresh — no wallet was installed …`,
    );
  } else {
    console.log(
      `installing ${prodPkg} (production) over the installed one — its data is kept …`,
    );
  }
  // An install that fails here STOPs (no further adb call); launches.json is written first so
  // the devnet half of the run is kept.
  writeFileSync(
    join(OUT, 'launches.json'),
    JSON.stringify(launches, null, 2) + '\n',
  );
  I.installApk({ adb: rawAdb, pkg: prodPkg, apk: prodApk });
  launch(
    prodPkg,
    'S16.9',
    'the production APK of the same commit launches on the phone',
  );
  writeFileSync(
    join(OUT, 'launches.json'),
    JSON.stringify(launches, null, 2) + '\n',
  );
  console.log(
    `phone: wrote ${join(OUT, 'phone-report.json')} and ${join(OUT, 'launches.json')}`,
  );
}

// ----------------------------------------------------------------------------------- verify

function verify({ reportPath, chainPath, launchesPath, rehearsal }) {
  const { d, problems } = desk();
  if (problems.length) {
    die(`the desk values are not the fixture's: ${problems.join('; ')}`);
  }
  if (!existsSync(reportPath)) {
    die(`no report at ${reportPath}`);
  }
  const report = L.readJson(reportPath);
  let chainVk = null;
  let chainVkSource = '';
  if (existsSync(chainPath)) {
    const chain = L.readJson(chainPath);
    const c = chainVkFrom(chain);
    if (c.errs.length) {
      die(`the chain read is not the pinned devnet pool: ${c.errs.join('; ')}`);
    }
    chainVk = c.vk;
    chainVkSource = `Pool ${chain.pool} at slot ${chain.slot} via ${chain.rpcHost} (${chain.fetchedAt})`;
  }
  const launches =
    launchesPath && existsSync(launchesPath) ? L.readJson(launchesPath) : [];
  const proves = L.fixture('a0-prove-vectors.json');
  const lines = L.judge({
    report,
    desk: d,
    chainVk,
    chainVkSource,
    pinned: pinnedVks(),
    withdrawScenario: proves.scenarios.find(
      s => s.label === report.withdrawScenario,
    ),
    rehearsal,
    launches,
  });
  console.log(`M1a checkpoint — ${reportPath}`);
  let failed = 0;
  for (const l of lines) {
    const expectedRehearsalFail =
      rehearsal && L.PHONE_ONLY.has(l.id) && !l.pass;
    const tag = l.pass
      ? 'PASS'
      : expectedRehearsalFail
        ? 'N/A (phone only)'
        : 'FAIL';
    if (!l.pass && !expectedRehearsalFail) {
      failed++;
    }
    console.log(
      `${tag.padEnd(16)} ${l.id.padEnd(7)} ${l.text}${l.detail ? `\n${' '.repeat(25)}${l.detail}` : ''}`,
    );
  }
  const verdict =
    failed === 0
      ? rehearsal
        ? 'REHEARSAL PASSED (not a checkpoint: no phone)'
        : 'CHECKPOINT PASSED'
      : `FAILED (${failed} line${failed > 1 ? 's' : ''})`;
  console.log(verdict);
  return failed === 0 ? 0 : 1;
}

// ------------------------------------------------------------------------------------- main

/** A STOP (install.mjs) halts the checkpoint: printed, exit 3, nothing after it runs. */
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

const reportPath = resolve(opt('report', join(OUT, 'phone-report.json')));
const chainPath = resolve(opt('chain', join(OUT, 'chain-pool.json')));
const launchesPath = resolve(opt('launches', join(OUT, 'launches.json')));

if (cmd === 'desk') {
  const { d, problems } = desk();
  const { seedHex, ...shown } = d;
  console.log(
    JSON.stringify(
      {
        seed: `${seedHex.slice(0, 8)}… (BIP-39 of the repo test mnemonic)`,
        ...shown,
      },
      null,
      2,
    ),
  );
  console.log(
    problems.length
      ? `FIXTURE MISMATCH: ${problems.join('; ')}`
      : 'the committed fixture agrees with the desk values',
  );
  process.exit(problems.length ? 1 : 0);
} else if (cmd === 'vk' || cmd === 'all') {
  const chain = await readChainVk(opt('rpc', DEFAULT_RPC));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(chainPath, JSON.stringify(chain, null, 2) + '\n');
  const c = chainVkFrom(chain);
  if (c.errs.length) {
    die(`not the pinned pool: ${c.errs.join('; ')}`);
  }
  const diff = L.vkDiff(c.vk, pinnedVks().deposit);
  console.log(
    `read ${chain.pool} at slot ${chain.slot} via ${chain.rpcHost}: owner ${chain.owner}, ${Buffer.from(chain.dataBase64, 'base64').length} bytes, max_fee ${c.pool.maxFee}, deposits_paused ${c.pool.depositsPaused}`,
  );
  console.log(
    diff.length
      ? `deposit VK on chain DIFFERS from deposit_vk.json at ${diff.join(', ')}`
      : 'deposit VK on chain = deposit_vk.json (alpha, beta, gamma, delta, 5 IC points)',
  );
  console.log(`wrote ${chainPath}`);
  if (cmd === 'vk') {
    process.exit(diff.length ? 1 : 0);
  }
  stopping(phone);
  process.exit(
    verify({ reportPath, chainPath, launchesPath, rehearsal: false }),
  );
} else if (cmd === 'phone') {
  stopping(phone);
} else if (cmd === 'verify') {
  process.exit(
    verify({
      reportPath,
      chainPath,
      launchesPath: flag('rehearsal') ? null : launchesPath,
      rehearsal: flag('rehearsal'),
    }),
  );
} else {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(1, 30)
      .join('\n'),
  );
  process.exit(2);
}
