#!/usr/bin/env node
// B1e §5.1: `npm run release:chrome` — the Chrome Web Store package, made only after everything that must hold does.
//
//   0. preflight: no NODE_ENV and no VITE_USER_NODE_ENV in the environment, no env file (`.env`, `.env.*`) in
//      extension/, the working tree clean (untracked files listed one by one, whatever git's config says), this
//      version's zip and notes not written yet and no `.partial` an interrupted run left (any under release/out/, this
//      version's notes'), the lockfile present and node_modules its tree as npm recorded it (the notes name a commit
//      and the lockfile's hash; a dirty tree would make that commit a lie, another installed tree that hash, and a
//      written release is never overwritten);
//   0a. the live pre-check (§6.5, E26): the three pages, before anything is built — a page that is not live fails the
//      run in seconds, not after verify;
//   1. `npm run verify` (clean; both builds, every test, CSP, secrets, every gate, the four reproducible builds);
//   2. the third witness (R10): `node scripts/build.mjs <tmp> --no-presale`, its chrome/ file digest equal to verify's
//      dist-nopresale/chrome — the package itself is verify's, no fifth build is packed;
//   3. the RP-ID record (§5.6, E17): release/rp-id.json is exactly {rpId, confirmedBy: 'owner', decision: 'E17'} with
//      rpId 'wallet.noc-tura.io', equal to src/vault/passkey.ts's RP_ID;
//   4. the live check (§6.5): the three GETs again, one at a time, each with a timeout — no skip flag, no retry;
//   5. the STORE zip (§5.4) of dist-nopresale/chrome made twice, one sha256; its entries, read back from the bytes, one
//      for one the witnessed files (path and sha256); the package digest still the witnessed one;
//   6. the tree re-checked (still clean, the same HEAD), then release/out/noctura-chrome-<version>.zip (git-ignored) and
//      release/notes-<version>.md (the owner commits it), each written under a temporary name beside it and moved into
//      place only when both are written — nothing is written before this step, and nothing is ever overwritten.
//
// The orchestrator is pure (`runRelease(steps)`): each step answers {problems, value?, line?, written?}; the first step
// with a problem (or that throws) stops the run, so a refusal can never be followed by a pack. `releaseSteps(io)` builds
// the steps over an injected io, so the order and every refusal are unit-tested without running verify, building or
// reaching the network (scripts/__tests__/release-chrome.test.mjs); `realIo()` is the only place they touch the world.
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MANIFEST_NAME, buildManifest} from '../../web/scripts/build-manifest.mjs';
import {packageVersion} from '../manifest/source.mjs';
import {readStoreZip} from './__tests__/storeZipReader.mjs';
import {ENV_FILE, VITE_NODE_ENV_VAR} from './buildEnv.mjs';
import {isMain} from './isMain.mjs';
import {liveCheck} from './live-check.mjs';
import {zipStore} from './zip-store.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const STEPS = Object.freeze(['preflight', 'livePrecheck', 'verify', 'witness', 'rpId', 'liveCheck', 'zip', 'write']);
/** What is packed: verify's own store build (E2, R10). Paths are extension-relative. */
export const PACKAGE = 'dist-nopresale/chrome';
export const RP_ID_FILE = 'release/rp-id.json';
export const RP_ID_SOURCE = 'src/vault/passkey.ts';
/** The dependency set the zip is built from; its sha256 goes into the notes. */
export const LOCKFILE = 'package-lock.json';
/** npm's own record of the tree it installed, written by every `npm ci` / `npm install` (npm 7 and later). */
export const INSTALLED_LOCKFILE = 'node_modules/.package-lock.json';
/** The fields of a package entry that name what was installed: the same in both files, or another tree was built. */
export const INSTALLED_FIELDS = Object.freeze(['version', 'resolved', 'integrity', 'link']);
/** The owner's decision E17 (2026-10-30), frozen by 1.0.0: the record must be exactly this. */
export const RP_ID_RECORD = Object.freeze({rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'});
export const OUT_DIR = 'release/out';
/** Per live-check request (connect, headers and body): a hung noc-tura.io must not hang the release. */
export const LIVE_TIMEOUT_MS = 15_000;
export const USAGE = 'usage: npm run release:chrome (no arguments — every step runs, the live check included; B1e §5.1, §6.5)';

export const zipPath = version => `${OUT_DIR}/noctura-chrome-${version}.zip`;
export const notesPath = version => `release/notes-${version}.md`;
/** Where a file is written before it is moved into place: beside it, so the move is a link on one file system. */
export const partialPath = path => `${path}.partial`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const message = e => (e instanceof Error ? e.message : String(e));

/** The CLI takes no argument at all: there is no flag that skips a step. */
export const cliProblem = argv => (argv.length === 0 ? null : USAGE);

/**
 * The environment every command the release runs gets: the release's own, without NODE_ENV (B1e-2, review C1). Vite
 * keeps a NODE_ENV it finds, and NODE_ENV=development or test builds React's development bundle — verify, the third
 * witness and the zip would all agree on it. The preflight refuses a NODE_ENV; this is the second wall.
 */
export const childEnv = env => Object.fromEntries(Object.entries(env).filter(([name]) => name !== 'NODE_ENV' && name !== VITE_NODE_ENV_VAR));

export function nodeEnvProblem(value) {
  return (
    `NODE_ENV is set (to ${JSON.stringify(value)}) — the store build is made with none: Vite keeps a NODE_ENV it finds, ` +
    'and development or test builds React\'s development bundle, which verify, the third witness and the zip would all ' +
    'agree on. Any value is refused, production included: the notes record "NODE_ENV: unset", one condition a ' +
    'reproducer can meet. Run `env -u NODE_ENV npm run release:chrome`, or unset it.'
  );
}

export function viteNodeEnvProblem(value) {
  return (
    `${VITE_NODE_ENV_VAR} is set (to ${JSON.stringify(value)}) — with NODE_ENV unset, Vite turns ${VITE_NODE_ENV_VAR}=development ` +
    "into NODE_ENV=development and builds React's development bundle, which verify, the third witness and the zip would " +
    `all agree on. Run \`env -u ${VITE_NODE_ENV_VAR} npm run release:chrome\`, or unset it.`
  );
}

export function envFileProblem(name) {
  return (
    `extension/${name} exists — Vite reads a NODE_ENV=development in an env file as a development build, and git ignores ` +
    'env files, so the clean-tree check cannot see it; the extension build reads none: remove it.'
  );
}

/**
 * The tree check (fix round 1, review I2): every untracked file listed one by one whatever the user's
 * status.showUntrackedFiles says (`no` hides them all from plain porcelain), and submodules never ignored by config.
 */
export const GIT_STATUS = Object.freeze(['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none']);

/**
 * RP_ID as src/vault/passkey.ts spells it, read without a TypeScript loader: exactly one `RP_ID =` in the file, and it
 * is the plain line `export const RP_ID = '<host>';`. Anything else throws — a reformatted line refuses the release
 * (and turns release-chrome.test.mjs red) rather than being guessed at.
 */
export function readRpId(text) {
  const declarations = text.match(/\bRP_ID\s*=/g) ?? [];
  const line = /^export const RP_ID = '([a-z0-9.-]+)';$/m.exec(text);
  if (declarations.length !== 1 || line === null)
    throw new Error(`${RP_ID_SOURCE}: no single plain \`export const RP_ID = '<host>';\` line — the RP ID cannot be read without a TypeScript loader`);
  return line[1];
}

/** [] iff `value` is exactly RP_ID_RECORD (no other field) and its rpId is `rpId` (passkey.ts's). */
export function rpIdProblems(value, rpId) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [`${RP_ID_FILE} is not a JSON object`];
  const out = [];
  const names = Object.keys(value).sort();
  const want = Object.keys(RP_ID_RECORD).sort();
  if (names.join(',') !== want.join(','))
    out.push(`${RP_ID_FILE}: fields are ${names.join(', ')} — want exactly ${want.join(', ')}`);
  for (const [field, expected] of Object.entries(RP_ID_RECORD))
    if (value[field] !== expected) out.push(`${RP_ID_FILE}: ${field} is ${JSON.stringify(value[field])}, want ${JSON.stringify(expected)} (E17)`);
  if (value.rpId !== rpId) out.push(`${RP_ID_FILE}: rpId is ${JSON.stringify(value.rpId)}, but ${RP_ID_SOURCE} says RP_ID = ${JSON.stringify(rpId)}`);
  return out;
}

/** `git status --porcelain --untracked-files=all` → [] when empty, else the status lines under one heading. */
export function treeProblems(status) {
  const lines = status.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  return [
    'the working tree is not clean — the notes would name a commit that is not what was packed (git status --porcelain ' +
      '--untracked-files=all; ' +
      'the paths are relative to the repository root, not to extension/):',
    ...lines.map(l => `  ${l}`),
  ];
}

/**
 * The zip bound to the witness (B1e-2, review I1): its entries (`{path, sha256}`, read back from the zip's own bytes)
 * one for one the witnessed files — the same paths, the same hashes, the same count. [] iff they are.
 */
export function zipWitnessProblems(entries, witnessed) {
  const zipped = new Map(entries.map(e => [e.path, e.sha256]));
  const seen = new Map(witnessed.map(f => [f.path, f.sha256]));
  const out = [];
  for (const [path, hash] of zipped) {
    if (!seen.has(path)) out.push(`the zip holds ${path}, which the witness did not see`);
    else if (seen.get(path) !== hash) out.push(`the zip's ${path} is sha256 ${hash}, the witness saw ${seen.get(path)}`);
  }
  for (const path of seen.keys()) if (!zipped.has(path)) out.push(`the witness saw ${path}, which the zip does not hold`);
  if (out.length === 0 && (entries.length !== zipped.size || entries.length !== witnessed.length))
    out.push(`the zip has ${entries.length} entries, the witness ${witnessed.length} files`);
  return out;
}

/**
 * The final review's I3: node_modules is the lockfile's tree, as npm recorded it. [] iff `installedText`
 * (node_modules/.package-lock.json) parses, has the lockfile's lockfileVersion, records only packages the lockfile has,
 * each with the lockfile's INSTALLED_FIELDS, and records every package of the lockfile but the optional ones (npm skips
 * an optional package built for another platform). What it reads is npm's record, not the installed files; that npm ran
 * with --ignore-scripts is not recorded anywhere, so the notes do not claim it. `lockText` absent is the preflight's own
 * refusal; here it is []. At most `limit` differences are named, then their count.
 */
export function installedTreeProblems(lockText, installedText, limit = 10) {
  if (lockText === undefined) return [];
  if (installedText === undefined)
    return [`${INSTALLED_LOCKFILE} is absent — node_modules was not installed by npm from ${LOCKFILE}: run \`npm ci --ignore-scripts\` first`];
  const parse = (text, name) => {
    try {
      const value = JSON.parse(text);
      return value !== null && typeof value === 'object' && value.packages !== null && typeof value.packages === 'object' ? value : `${name} holds no "packages" object`;
    } catch (e) {
      return `${name} is not JSON (${message(e)})`;
    }
  };
  const lock = parse(lockText, LOCKFILE);
  const installed = parse(installedText, INSTALLED_LOCKFILE);
  const broken = [lock, installed].filter(v => typeof v === 'string');
  if (broken.length > 0) return broken;
  const head = `node_modules is not the tree ${LOCKFILE} names (${INSTALLED_LOCKFILE} disagrees) — the package would be built from other dependencies than the notes record: run \`npm ci --ignore-scripts\` first:`;
  const out = [];
  if (lock.lockfileVersion !== installed.lockfileVersion)
    out.push(`lockfileVersion ${JSON.stringify(installed.lockfileVersion)} installed, ${JSON.stringify(lock.lockfileVersion)} in ${LOCKFILE}`);
  for (const [name, entry] of Object.entries(installed.packages)) {
    if (name === '') continue;
    const want = lock.packages[name];
    if (want === undefined) {
      out.push(`${name} is installed, and ${LOCKFILE} has no such package`);
      continue;
    }
    for (const field of INSTALLED_FIELDS)
      if (JSON.stringify(entry?.[field]) !== JSON.stringify(want[field]))
        out.push(`${name}: ${field} ${JSON.stringify(entry?.[field])} installed, ${JSON.stringify(want[field])} in ${LOCKFILE}`);
  }
  for (const [name, entry] of Object.entries(lock.packages))
    if (name !== '' && !(name in installed.packages) && entry?.optional !== true) out.push(`${name} is in ${LOCKFILE} and not installed`);
  if (out.length === 0) return [];
  return [head, ...out.slice(0, limit).map(p => `  ${p}`), ...(out.length > limit ? [`  … and ${out.length - limit} more`] : [])];
}

/** A fetch whose every request is aborted after `ms` (AbortSignal.timeout covers the body read too). */
export const timedFetch = (fetch, ms) => (url, init) => fetch(url, {...init, signal: AbortSignal.timeout(ms)});

export function releaseNotes({version, sha256: zipSha, bytes, entries, digest, files, commit, lockfile, node}) {
  return [
    `# Noctura for Chrome ${version} — release notes`,
    '',
    'Written by `npm run release:chrome` (B1e §5.1) after verify, the third witness, the RP-ID record and the live check',
    'passed. The zip is the one uploaded to the Chrome Web Store; anyone can rebuild it from the commit and compare.',
    '',
    `- Version: ${version}`,
    `- Zip: \`${zipPath(version)}\` (${bytes} bytes, ${entries} entries, not committed)`,
    `- Zip sha256: \`${zipSha}\``,
    `- Package file digest: \`sha256:${digest}\` (${files} files of \`extension/${PACKAGE}\`, web/scripts/build-manifest.mjs;`,
    '  each zip entry is one of these files, its path and sha256 compared)',
    `- Commit: \`${commit}\`, working tree clean`,
    `- Lockfile: \`extension/${LOCKFILE}\` sha256 \`${lockfile}\`; \`${INSTALLED_LOCKFILE}\` (npm's record of the installed`,
    `  tree) agreed with it: every package's ${INSTALLED_FIELDS.join(', ')}`,
    '- NODE_ENV: unset',
    `- Passkey RP ID: ${RP_ID_RECORD.rpId} (release/rp-id.json, E17)`,
    `- Node: ${node}`,
    '',
    'To reproduce: check out the commit, then `cd extension && npm ci --ignore-scripts && env -u NODE_ENV npm run build`.',
    '`node ../web/scripts/build-manifest.mjs dist-nopresale/chrome --print-only` prints the same file count and package',
    'file digest (without `--print-only` it writes build-manifest.json into the package, which the zip would then hold);',
    `\`node scripts/zip-store.mjs dist-nopresale/chrome <out.zip>\` prints ${entries} entries and the same sha256.`,
    '',
  ].join('\n');
}

/** The steps over `io` (see realIo for its members). */
export function releaseSteps(io) {
  const version = io.version;
  const head = () => {
    const commit = io.git(['rev-parse', 'HEAD']).trim();
    return /^[0-9a-f]{40}$/.test(commit) ? {commit} : {problem: `git rev-parse HEAD answered ${JSON.stringify(commit)} — no commit to record`};
  };
  const live = async final => {
    const {ok, problems} = await liveCheck({fetch: io.fetch});
    return {
      problems: ok ? [] : problems.length > 0 ? problems : ['the live check failed without naming a problem'],
      line: final ? 'the three pages answer 200 and carry their text' : 'the three pages answer 200 and carry their text (checked again after verify)',
    };
  };
  /** Removes each path; answers the ones it could not remove. */
  const removeAll = paths =>
    paths.filter(path => {
      try {
        io.remove(path);
        return false;
      } catch {
        return true;
      }
    });
  return {
    preflight: async () => {
      const problems = [];
      if (io.env.NODE_ENV !== undefined) problems.push(nodeEnvProblem(io.env.NODE_ENV));
      // Fix round 1 (review I1): Vite's two other doors to a development bundle while NODE_ENV is unset.
      if (io.env[VITE_NODE_ENV_VAR] !== undefined) problems.push(viteNodeEnvProblem(io.env[VITE_NODE_ENV_VAR]));
      for (const name of io.list('.').filter(n => ENV_FILE.test(n)).sort()) problems.push(envFileProblem(name));
      for (const path of [zipPath(version), notesPath(version)])
        if (io.exists(path))
          problems.push(`${path} exists — version ${version} was packed already: bump extension/package.json's version, or remove the file if that pack was abandoned`);
      // B1e-2 (review 2 M2): a `.partial` an interrupted run left — any version's under release/out/, this version's
      // notes' — is refused here, before verify, not after it at the write.
      const leftovers = [
        ...io
          .list(OUT_DIR)
          .filter(name => name.endsWith('.partial'))
          .sort()
          .map(name => `${OUT_DIR}/${name}`),
        ...[partialPath(notesPath(version))].filter(path => io.exists(path)),
      ];
      for (const path of leftovers)
        problems.push(`${path} exists — left by an interrupted run (a .partial is never moved into place by a later one): remove it, and anything else that run left, before running again`);
      problems.push(...treeProblems(io.git(GIT_STATUS)));
      const {commit, problem} = head();
      if (problem) problems.push(problem);
      const lockfile = io.hashFile(LOCKFILE);
      if (lockfile === undefined) problems.push(`${LOCKFILE} is absent — the notes record the dependency set the zip is built from`);
      problems.push(...installedTreeProblems(io.read(LOCKFILE), io.read(INSTALLED_LOCKFILE)));
      return {problems, value: {commit, lockfile}, line: `version ${version}, commit ${commit}, working tree clean, NODE_ENV unset`};
    },
    livePrecheck: () => live(false),
    verify: async () => {
      const status = io.run('npm', ['run', 'verify']);
      return {problems: status === 0 ? [] : [`npm run verify exited ${status}`], line: 'npm run verify exited 0'};
    },
    witness: async () => {
      if (io.exists(`${PACKAGE}/${MANIFEST_NAME}`))
        return {
          problems: [
            `${PACKAGE}/${MANIFEST_NAME} exists — the file digest skips that name, so the witness cannot see it and the zip ` +
              'would pack it; no build writes it (build-manifest.mjs run there without --print-only does): run verify again',
          ],
        };
      const dir = io.tempDir();
      try {
        const status = io.run('node', ['scripts/build.mjs', dir, '--no-presale']);
        if (status !== 0) return {problems: [`the third build (node scripts/build.mjs ${dir} --no-presale) exited ${status}`]};
        const third = io.digest(join(dir, 'chrome'));
        const verified = io.digest(PACKAGE);
        if (third.files.length === 0 || verified.files.length === 0)
          return {problems: [`INCONCLUSIVE: the third build's chrome/ or verify's ${PACKAGE} holds no file`]};
        if (third.digest !== verified.digest)
          return {problems: [`the third build's chrome/ is sha256:${third.digest}, verify's ${PACKAGE} is sha256:${verified.digest} — not the package verify checked`]};
        return {problems: [], value: verified, line: `${verified.files.length} files, sha256:${verified.digest} — the third build agrees`};
      } finally {
        io.removeDir(dir);
      }
    },
    rpId: async () => {
      const text = io.read(RP_ID_FILE);
      if (text === undefined)
        return {problems: [`${RP_ID_FILE} is absent — the owner's confirmation of the passkey RP ID (E17, B1e §5.6) is recorded before upload`]};
      let value;
      try {
        value = JSON.parse(text);
      } catch (e) {
        return {problems: [`${RP_ID_FILE} is not JSON (${message(e)})`]};
      }
      let rpId;
      try {
        rpId = readRpId(io.read(RP_ID_SOURCE) ?? '');
      } catch (e) {
        return {problems: [message(e)]};
      }
      return {problems: rpIdProblems(value, rpId), line: `${RP_ID_FILE} records ${rpId}, confirmed by the owner (E17)`};
    },
    liveCheck: () => live(true),
    zip: async done => {
      const first = io.zip(PACKAGE);
      const second = io.zip(PACKAGE);
      const [a, b] = [sha256(first), sha256(second)];
      if (a !== b) return {problems: [`the two zips of ${PACKAGE} differ: sha256 ${a} vs ${b}`]};
      const entries = readStoreZip(first).map(e => ({path: e.path, sha256: sha256(e.bytes)}));
      const unbound = zipWitnessProblems(entries, done.witness.files);
      if (unbound.length > 0) return {problems: ['the zip is not the package the witness saw:', ...unbound.map(p => `  ${p}`)]};
      const now = io.digest(PACKAGE);
      if (now.digest !== done.witness.digest)
        return {problems: [`${PACKAGE} changed after the witness: sha256:${now.digest}, was sha256:${done.witness.digest}`]};
      return {
        problems: [],
        value: {bytes: first, sha256: a, entries: entries.length},
        line: `${first.length} bytes, ${entries.length} entries (each a witnessed file, path and sha256), sha256 ${a}, twice`,
      };
    },
    write: async done => {
      const problems = treeProblems(io.git(GIT_STATUS));
      const {commit, problem} = head();
      if (problem) problems.push(problem);
      else if (commit !== done.preflight.commit) problems.push(`HEAD moved during the run: ${done.preflight.commit} → ${commit}`);
      const finals = [zipPath(version), notesPath(version)];
      const partials = finals.map(partialPath);
      for (const path of [...finals, ...partials]) if (io.exists(path)) problems.push(`${path} exists — appeared during the run, or left by an earlier one; never overwritten`);
      if (problems.length > 0) return {problems};
      const {bytes, sha256: zipSha, entries} = done.zip;
      const notes = releaseNotes({
        version,
        sha256: zipSha,
        bytes: bytes.length,
        entries,
        digest: done.witness.digest,
        files: done.witness.files.length,
        commit,
        lockfile: done.preflight.lockfile,
        node: io.node,
      });
      const contents = [bytes, notes];
      try {
        partials.forEach((path, i) => io.write(path, contents[i]));
      } catch (e) {
        return {problems: [`writing failed (${message(e)})`], written: removeAll(partials.filter(path => io.exists(path)))};
      }
      try {
        finals.forEach((path, i) => io.place(partials[i], path));
      } catch (e) {
        // The final review's ledger line 23: a move can fail after its link was made (the unlink of the temporary name
        // failed), so what is left is read from the disk, not from the moves that returned — every final file there is
        // this run's (both were absent above), and every temporary one it could not remove.
        const left = removeAll(partials.filter(path => io.exists(path)));
        return {problems: [`moving into place failed (${message(e)})`], written: [...finals.filter(path => io.exists(path)), ...left]};
      }
      return {problems: [], value: {zip: finals[0], notes: finals[1], sha256: zipSha}, line: `${finals[0]} and ${finals[1]}`};
    },
  };
}

/**
 * Runs STEPS in order. Returns {ok: true, ...the write step's value} or {ok: false, stoppedAt, problems, written?} —
 * `written` only when the refusing step left files on disk; never runs a step after one that refused, threw, is
 * missing or answered no problem list.
 */
export async function runRelease(steps, log = console.log) {
  const done = {};
  for (const name of STEPS) {
    const step = steps[name];
    let result;
    if (typeof step !== 'function') result = {problems: [`${name}: no such step`]};
    else {
      try {
        result = await step(done);
      } catch (e) {
        result = {problems: [`${name}: ${message(e)}`]};
      }
      if (result === null || typeof result !== 'object' || !Array.isArray(result.problems))
        result = {problems: [`${name}: answered no problem list`]};
    }
    if (result.problems.length > 0) {
      const left = Array.isArray(result.written) ? result.written : [];
      return {ok: false, stoppedAt: name, problems: result.problems, ...(left.length > 0 ? {written: left} : {})};
    }
    done[name] = result.value;
    log(`release: ${name} ok${result.line ? ` — ${result.line}` : ''}`);
  }
  return {ok: true, ...done.write};
}

/** What the CLI prints for a refusal: "nothing was written" only when nothing was (review M1). */
export function refusalLines(result) {
  const left = result.written ?? [];
  const head =
    left.length === 0
      ? `release: refused at ${result.stoppedAt} — nothing was written`
      : `release: refused at ${result.stoppedAt} — the write failed part-way: remove ${left.join(', ')} (in extension/) before running again`;
  return [head, ...result.problems.map(p => `  ${p}`)];
}

/** The world: commands, git, the file system under `root`, the network (timed) — used only by the CLI. */
export function realIo(root = ROOT) {
  const at = path => resolve(root, path);
  return {
    version: packageVersion(),
    node: process.version,
    env: process.env,
    run: (cmd, args) => spawnSync(cmd, args, {cwd: root, stdio: 'inherit', env: childEnv(process.env)}).status ?? 1,
    git: args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}),
    tempDir: () => mkdtempSync(join(tmpdir(), 'noctura-release-witness-')),
    removeDir: dir => rmSync(dir, {recursive: true, force: true}),
    digest: dir => buildManifest(at(dir)),
    exists: path => existsSync(at(path)),
    list: dir => (existsSync(at(dir)) ? readdirSync(at(dir)) : []),
    read: path => (existsSync(at(path)) ? readFileSync(at(path), 'utf8') : undefined),
    hashFile: path => (existsSync(at(path)) ? sha256(readFileSync(at(path))) : undefined),
    fetch: timedFetch(globalThis.fetch, LIVE_TIMEOUT_MS),
    zip: dir => zipStore(at(dir)),
    write: (path, bytes) => {
      mkdirSync(dirname(at(path)), {recursive: true});
      writeFileSync(at(path), bytes, {flag: 'wx'});
    },
    // A hard link refuses an existing target (EEXIST): moved into place, never over anything.
    place: (from, to) => {
      linkSync(at(from), at(to));
      unlinkSync(at(from));
    },
    remove: path => unlinkSync(at(path)),
  };
}

if (isMain(import.meta.url)) {
  const problem = cliProblem(process.argv.slice(2));
  if (problem !== null) {
    console.error(problem);
    process.exit(2);
  }
  const result = await runRelease(releaseSteps(realIo()));
  if (result.ok) console.log(`release: done — ${result.zip}, sha256 ${result.sha256}; ${result.notes} is for the owner to commit`);
  else {
    for (const line of refusalLines(result)) console.error(line);
    process.exitCode = 1;
  }
}
