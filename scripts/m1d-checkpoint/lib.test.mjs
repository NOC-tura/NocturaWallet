/**
 * The M1d desk's judge (spec 2026-11-08 §16 M1d): every line on synthetic devnet answers built
 * from the repo's vector addresses (real base58, so ataOf derives real token accounts), each line
 * shown to FAIL on a one-field mutation, and the two readout readers. No network, no device:
 * node --no-warnings --test scripts/m1d-checkpoint/*.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ataOf, RELAYER_FEE_PAYER } from '../m1c-checkpoint/chain.mjs';
import { freshUnshieldOf, judgeM1d, seedFromReadouts, txKeys } from './lib.mjs';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const FRESH = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const CLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const EXT = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const POOL = '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT';
const SYS = '11111111111111111111111111111111';
const U_SIG = 'U'.repeat(87) + '1';
const S_SIG = 'S'.repeat(87) + '1';
const SEED = { seedKeys: [MAIN, FRESH, CLI], main: MAIN, registry: [] };

const tx = ({ sig, keys, signers, pre, post, err = null }) => ({
  slot: 1,
  transaction: { signatures: [sig], message: { accountKeys: keys, header: { numRequiredSignatures: signers } } },
  meta: { err, preBalances: pre, postBalances: post, loadedAddresses: { writable: [], readonly: [] } },
});
const UNSHIELD = () =>
  tx({ sig: U_SIG, keys: [RELAYER_FEE_PAYER, POOL, ataOf(FRESH), FRESH, SYS], signers: 1, pre: [9_000_000, 1, 0, 0, 1], post: [3_960_000, 1, 2_039_280, 3_000_000, 1] });
const SEND = () => tx({ sig: S_SIG, keys: [FRESH, EXT, SYS], signers: 1, pre: [3_000_000, 5, 1], post: [1_995_000, 1_000_005, 1] });
const base = () => ({
  fresh: FRESH,
  external: EXT,
  unshieldSig: U_SIG,
  sendSig: S_SIG,
  seed: SEED,
  history: { owner: [{ signature: S_SIG }, { signature: U_SIG }], ata: [{ signature: U_SIG }] },
  txs: { unshield: UNSHIELD(), send: SEND() },
});
const failing = r => r.lines.filter(l => !l.pass).map(l => l.id);

test('positive control: the honest checkpoint passes every line, D0 … D6', () => {
  const r = judgeM1d(base());
  assert.deepEqual(r.lines.map(l => l.id), ['M1d.D0', 'M1d.D1', 'M1d.D2', 'M1d.D3', 'M1d.D4', 'M1d.D5', 'M1d.D6']);
  assert.deepEqual(failing(r), []);
  assert.equal(r.pass, true);
});

test('D0: a recipient inside the seed, or the fresh account outside it, fails', () => {
  assert.deepEqual(failing(judgeM1d({ ...base(), external: CLI })).includes('M1d.D0'), true);
  assert.deepEqual(failing(judgeM1d({ ...base(), fresh: EXT })).includes('M1d.D0'), true);
  assert.ok(failing(judgeM1d({ ...base(), fresh: MAIN })).includes('M1d.D0'));
});

test('D1: a third transaction in the history, or the send missing from it, fails', () => {
  const extra = base();
  extra.history.ata.push({ signature: 'X'.repeat(88) });
  assert.ok(failing(judgeM1d(extra)).includes('M1d.D1'));
  // D6 (cancelled, not sent) is evidence only on a complete history: a third transaction fails it too, with its reason
  const third = base();
  third.history.owner.push({ signature: 'Y'.repeat(88) });
  const t = judgeM1d(third);
  assert.ok(failing(t).includes('M1d.D1') && failing(t).includes('M1d.D6'));
  assert.match(t.lines.find(l => l.id === 'M1d.D6').detail, /holds 3 transactions/);
  const missing = base();
  missing.history.owner = [{ signature: U_SIG }];
  assert.ok(failing(judgeM1d(missing)).includes('M1d.D1'));
});

test('D2: the unshield signed by a key of this seed, or funding a non-empty account, fails', () => {
  const signed = base();
  signed.txs.unshield = tx({ sig: U_SIG, keys: [RELAYER_FEE_PAYER, FRESH, POOL, ataOf(FRESH), SYS], signers: 2, pre: [9, 0, 1, 0, 1], post: [3, 3_000_000, 1, 2, 1] });
  assert.ok(failing(judgeM1d(signed)).includes('M1d.D2'));
  const funded = base();
  funded.txs.unshield.meta.preBalances[3] = 5;
  assert.ok(failing(judgeM1d(funded)).includes('M1d.D2'));
  const failedU = base();
  failedU.txs.unshield.meta.err = { InstructionError: [0, 'Custom'] };
  assert.ok(failing(judgeM1d(failedU)).includes('M1d.D2'));
});

test('D3: a send paid by the main account, or a failed send, fails', () => {
  const paid = base();
  paid.txs.send = tx({ sig: S_SIG, keys: [MAIN, FRESH, EXT, SYS], signers: 2, pre: [5, 3_000_000, 5, 1], post: [0, 1_000_000, 1_000_005, 1] });
  const ids = failing(judgeM1d(paid));
  assert.ok(ids.includes('M1d.D3') && ids.includes('M1d.D5') && ids.includes('M1d.D6'));
  const failed = base();
  failed.txs.send.meta.err = { InstructionError: [0, 'Custom'] };
  assert.ok(failing(judgeM1d(failed)).includes('M1d.D3'));
});

test('the checkpoint\'s TEST send (plan A11): fresh token account → the recipient\'s token account, fee from the grant — every line passes', () => {
  const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const b = base();
  b.txs.send = tx({ sig: S_SIG, keys: [FRESH, ataOf(FRESH), ataOf(EXT), TOKEN], signers: 1, pre: [3_000_000, 2_039_280, 2_039_280, 1], post: [2_995_000, 2_039_280, 2_039_280, 1] });
  b.history.ata.push({ signature: S_SIG });
  assert.deepEqual(failing(judgeM1d(b)), []);
  // control: neither the recipient nor its token account in the send → D3 fails
  b.txs.send.transaction.message.accountKeys[2] = SYS;
  assert.ok(failing(judgeM1d(b)).includes('M1d.D3'));
});

test('D4: SOL from anywhere but the grant (a balance at the send that is not what the unshield left) fails', () => {
  const topped = base();
  topped.txs.send.meta.preBalances[0] = 4_000_000;
  assert.ok(failing(judgeM1d(topped)).includes('M1d.D4'));
  // an empty account that sends is not "paid from the grant": equal balances of 0 must still fail
  const zero = base();
  zero.txs.unshield.meta.postBalances[3] = 0;
  zero.txs.send.meta.preBalances[0] = 0;
  assert.ok(failing(judgeM1d(zero)).includes('M1d.D4'));
});

test('D5 / D6: another seed key or its token account in either transaction fails; the main account fails D6 too', () => {
  const cli = base();
  cli.txs.send.transaction.message.accountKeys.push(CLI);
  cli.txs.send.meta.preBalances.push(1);
  cli.txs.send.meta.postBalances.push(1);
  const c = failing(judgeM1d(cli));
  assert.ok(c.includes('M1d.D5') && !c.includes('M1d.D6'));
  const mainAta = base();
  mainAta.txs.unshield.transaction.message.accountKeys.push(ataOf(MAIN));
  mainAta.txs.unshield.meta.preBalances.push(0);
  mainAta.txs.unshield.meta.postBalances.push(0);
  const m = failing(judgeM1d(mainAta));
  assert.ok(m.includes('M1d.D5') && m.includes('M1d.D6'));
});

test('D5 (m2): a token account of another seed key at ANY address, or of another mint, fails', () => {
  const b = base();
  b.txs.send.meta.postTokenBalances = [{ accountIndex: 1, mint: SYS, owner: CLI, uiTokenAmount: { amount: '1' } }];
  assert.ok(failing(judgeM1d(b)).includes('M1d.D5'));
  const own = base();
  own.txs.send.meta.postTokenBalances = [{ accountIndex: 1, mint: SYS, owner: EXT, uiTokenAmount: { amount: '1' } }];
  assert.deepEqual(failing(judgeM1d(own)), []);
});

test('a transaction that was not read never passes a line', () => {
  const unread = base();
  unread.txs.send = null;
  const ids = failing(judgeM1d(unread));
  for (const id of ['M1d.D3', 'M1d.D4', 'M1d.D5', 'M1d.D6']) assert.ok(ids.includes(id), id);
});

test('txKeys: static keys then loaded addresses; the first numRequiredSignatures are the signers', () => {
  const t = tx({ sig: S_SIG, keys: [FRESH, EXT], signers: 1, pre: [1, 2, 3], post: [1, 2, 3] });
  t.meta.loadedAddresses = { writable: [SYS], readonly: [] };
  const k = txKeys(t);
  assert.deepEqual(k.keys, [FRESH, EXT, SYS]);
  assert.deepEqual(k.signers, [FRESH]);
  assert.equal(k.feePayer, FRESH);
  assert.equal(txKeys(null), null);
});

test('seedFromReadouts: the LAST startup-accounts line with keys; its registry joined; null without one', () => {
  const line = (seq, seedKeys, accounts) => ({ seenAt: 't', readout: { event: 'startup-accounts', session: 's', seq, seedKeys, accounts } });
  const lines = [
    line(1, [MAIN], [{ address: MAIN, role: 'main', linked: false }]),
    line(2, [MAIN, CLI], [{ address: MAIN, role: 'main', linked: false }, { address: FRESH, role: 'fresh-exit', linked: false }]),
    line(3, null, null),
  ];
  const s = seedFromReadouts(lines);
  assert.equal(seedFromReadouts(lines.slice(0, 2)).isLatest, true);
  assert.equal(s.main, MAIN);
  assert.deepEqual([...s.seedKeys].sort(), [CLI, FRESH, MAIN].sort());
  assert.equal(s.seenAt, 't');
  assert.equal(s.isLatest, false); // the newest start (seq 3) carried no keys: an older set was used
  assert.equal(seedFromReadouts([line(1, null, null)]), null);
  assert.equal(seedFromReadouts([]), null);
});

test('freshUnshieldOf: the one spent unshield to the fresh account; none or two different → null', () => {
  const out = (owner, signature, status = 'spent') => ({ seenAt: 't', readout: { event: 'unshield-outcome', owner, signature, status } });
  assert.equal(freshUnshieldOf([out(FRESH, U_SIG), out(MAIN, S_SIG)], FRESH), U_SIG);
  assert.equal(freshUnshieldOf([out(FRESH, U_SIG), out(FRESH, U_SIG)], FRESH), U_SIG);
  assert.equal(freshUnshieldOf([out(FRESH, U_SIG), out(FRESH, S_SIG)], FRESH), null);
  assert.equal(freshUnshieldOf([out(FRESH, U_SIG, 'pending')], FRESH), null);
});
