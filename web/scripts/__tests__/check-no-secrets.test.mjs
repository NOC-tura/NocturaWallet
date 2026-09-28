import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Vitest already runs with web/ as cwd, so the script path is relative to that.
function run(...dirs) {
  try {
    execFileSync(process.execPath, ['scripts/check-no-secrets.mjs', ...dirs], {stdio: 'pipe'});
    return 0;
  } catch (e) {
    return e.status ?? -1;
  }
}

// Same as run(), but also returns stderr so a test can assert the failure is named,
// not just that the exit code is non-zero.
function runCaptured(...dirs) {
  try {
    execFileSync(process.execPath, ['scripts/check-no-secrets.mjs', ...dirs], {stdio: 'pipe'});
    return {status: 0, stderr: ''};
  } catch (e) {
    return {status: e.status ?? -1, stderr: String(e.stderr ?? '')};
  }
}

it('passes on a clean tree (positive control — the gate can say yes)', () => {
  const d = mkdtempSync(join(tmpdir(), 'clean-'));
  writeFileSync(join(d, 'a.ts'), 'export const x = 1;\n');
  expect(run(d)).toBe(0);
});

it.each([
  ['Keypair.fromSecretKey', 'const k = Keypair.fromSecretKey(b);'],
  ['Keypair.generate', 'const k = Keypair.generate();'],
  ['mnemonic', 'const mnemonic = generateMnemonic();'],
  ['privateKey', 'const privateKey = x;'],
  ['signAllTransactions', 'await wallet.signAllTransactions(txs);'],
])('fails on %s', (_label, source) => {
  const d = mkdtempSync(join(tmpdir(), 'dirty-'));
  writeFileSync(join(d, 'b.ts'), source);
  expect(run(d)).toBe(1);
});

it('fails on a credential in a built bundle, chosen by --bundle not by path', () => {
  const d = mkdtempSync(join(tmpdir(), 'bundle-'));
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'assets', 'index.js'), 'fetch("https://x/?api-key=abc")');
  expect(run('--bundle', d)).toBe(1);
});

it('a bundle without a credential passes (positive control for --bundle)', () => {
  const d = mkdtempSync(join(tmpdir(), 'ok-'));
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'assets', 'index.js'), 'fetch("/rpc")');
  expect(run('--bundle', d)).toBe(0);
});

// A root can be a single file, not only a directory — web/package.json's scan script
// passes ../core/ports.ts directly, alongside directory roots.
it('a clean file root passes', () => {
  const d = mkdtempSync(join(tmpdir(), 'file-clean-'));
  const f = join(d, 'ports.ts');
  writeFileSync(f, 'export const x = 1;\n');
  expect(run(f)).toBe(0);
});

it('a file root with a forbidden pattern fails', () => {
  const d = mkdtempSync(join(tmpdir(), 'file-dirty-'));
  const f = join(d, 'leaky.ts');
  writeFileSync(f, 'const privateKey = x;\n');
  expect(run(f)).toBe(1);
});

it('a file root with a non-matching extension fails loudly, naming the root', () => {
  const d = mkdtempSync(join(tmpdir(), 'file-wrong-ext-'));
  const f = join(d, 'notes.md');
  writeFileSync(f, 'nothing forbidden here\n');
  const {status, stderr} = runCaptured(f);
  expect(status).toBe(1);
  expect(stderr).toContain(f);
});
