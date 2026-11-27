/**
 * post-M1d spec §5, R9, R11, R12: #27's parser against REAL devnet getTransaction (jsonParsed) responses —
 * fixtures/*.json are the verbatim RPC responses (see the plan's Task 8 Step 1 for how they were fetched).
 * Derived cases (no owner, a plain `transfer`) are made from a real response by removing exactly the
 * fields a node may omit; each says what it removed.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {parseTxDetail} from '../txDetail';
import type {RawParsedTx} from '../txDetail';
import {A0_TOKEN} from '../../shielded/a0/screenSupport';
import {NOCTURA_FEE_TREASURY} from '../../../constants/programs';

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as {result: RawParsedTx}).result;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const ACC_9Y = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const OUTSIDE = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const SOL_SENDER = '5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7';
const SRC_TA = '3WzwveDj8C6AGyiq5T13SeffM6HaP2zuc4rH1oW6QNu2';
const OUTSIDE_TA = '75wGzeQ18yn9Jyf9EhoXjPG4ry9xFni38RcJxScGVoqT';
const MAIN_TA = 'A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7';
const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const DELEGATE = 'DELEGATExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // any other key: it is only compared

/** the symbol source is injected: these tests pin the parser, trustedSymbol.test.ts pins the symbols */
const symbolOf = (mint: string): string => (mint === TEST_MINT ? 'TEST' : mint === 'native' ? 'SOL' : `short(${mint.slice(0, 4)})`);

// P1
it('the fixtures\' mint is the pool token', () => {
  expect(A0_TOKEN.mint).toBe(TEST_MINT);
});

// P2
it('a SOL transfer (2HWCCJQd…): amount, sender = the transfer\'s source, recipient wallet', () => {
  const d = parseTxDetail(load('tx-sol-transfer.json'), 'SIG', symbolOf);
  expect(d.transfer).toEqual({
    mint: 'native', symbol: 'SOL', amount: '0.000005',
    from: SOL_SENDER, authority: null, fromTokenAccount: null,
    to: OUTSIDE, toIsTokenAccount: false, toTokenAccount: null,
  });
  expect(d).toMatchObject({signature: 'SIG', status: 'confirmed', feeLamports: 5050n, slot: 525082222, feePayer: SOL_SENDER, signers: [SOL_SENDER], memo: null});
  expect(d.blockTime).toEqual(expect.any(Number));
});

// P3
it('an SPL send with the owner present (5i53q9tR…): the symbol, and the recipient WALLET — not the token account', () => {
  const d = parseTxDetail(load('tx-test-to-outside.json'), 'SIG', symbolOf);
  expect(d.transfer).toEqual({
    mint: TEST_MINT, symbol: 'TEST', amount: '0.0005',
    from: ACC_9Y, authority: ACC_9Y, fromTokenAccount: SRC_TA, // the owner of 3Wzwve… and the signer are one key here
    to: OUTSIDE, toIsTokenAccount: false, toTokenAccount: OUTSIDE_TA,
  });
  expect(d.feeLamports).toBe(7000n);
});

it('the phone-pass transaction (QAgzVzY6…): 0.0002 TEST, TO = the main wallet', () => {
  const d = parseTxDetail(load('tx-test-to-main.json'), 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({symbol: 'TEST', amount: '0.0002', from: ACC_9Y, to: MAIN, toIsTokenAccount: false, toTokenAccount: MAIN_TA});
});

// P4 (Review Focus 2)
it('R11: no owner in the response → the token account, flagged — never passed off as the wallet', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
    delete b.owner; // removed: `owner` (older nodes omit it)
  }
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({to: OUTSIDE_TA, toIsTokenAccount: true, toTokenAccount: OUTSIDE_TA, symbol: 'TEST', amount: '0.0005'});
  // review r1-10: with no owner the sender WALLET is not known either — the authority is shown as what it is
  expect(d.transfer).toMatchObject({from: null, authority: ACC_9Y});
});

// P5 (Review Focus 2)
it('R11: a plain `transfer` carries no mint and a RAW amount → mint and decimals from postTokenBalances by account index', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {type: string; info: Record<string, unknown>}}>).find(i => i.parsed?.type === 'transferChecked')!;
  ix.parsed!.type = 'transfer'; // the shape of spl-token `transfer`: {amount, authority, destination, source}
  ix.parsed!.info = {amount: '500000', authority: ACC_9Y, destination: OUTSIDE_TA, source: SRC_TA};
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({mint: TEST_MINT, symbol: 'TEST', amount: '0.0005', to: OUTSIDE, toIsTokenAccount: false});
});

// P7 (Review Focus 2)
it('a plain `transfer` with no token balances at all → no mint, no symbol, NO amount (never "500000" as a human figure)', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {type: string; info: Record<string, unknown>}}>).find(i => i.parsed?.type === 'transferChecked')!;
  ix.parsed!.type = 'transfer';
  ix.parsed!.info = {amount: '500000', authority: ACC_9Y, destination: OUTSIDE_TA, source: SRC_TA};
  tx.meta!.postTokenBalances = []; // removed: every token balance
  tx.meta!.preTokenBalances = [];
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({mint: null, symbol: '', amount: null, to: OUTSIDE_TA, toIsTokenAccount: true, from: null, authority: ACC_9Y});
});

it('R12: the sender is the owner of the source token account, never the fee payer (a relayed transaction)', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  const RELAYER = 'RELAYERxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // any other key: it is only compared
  const keys = tx.transaction!.message!.accountKeys!;
  keys.unshift({pubkey: RELAYER, signer: true, writable: true}); // a relayer pays the fee: it becomes key 0
  for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
    b.accountIndex = (b.accountIndex ?? 0) + 1; // every index moves by one
  }
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.feePayer).toBe(RELAYER);
  expect(d.transfer!.from).toBe(ACC_9Y);
  expect(d.transfer!.to).toBe(OUTSIDE); // still matched by the (moved) account index
  expect(d.signers).toEqual([RELAYER, ACC_9Y]);
});

it('R12: no authority in the instruction → the owner is still the sender; a multisigAuthority is read as the authority', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {info: Record<string, unknown>}}>).find(i => i.parsed?.info?.authority)!;
  delete ix.parsed!.info.authority; // removed: `authority`
  expect(parseTxDetail(tx, 'SIG', symbolOf).transfer).toMatchObject({from: ACC_9Y, authority: null});
  ix.parsed!.info.multisigAuthority = 'MULTISIGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // the multisig shape names this instead
  expect(parseTxDetail(tx, 'SIG', symbolOf).transfer).toMatchObject({from: ACC_9Y, authority: 'MULTISIGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'});
});

/**
 * review r1-10 — the DELEGATED variant, derived from the real 5i53q9tR… response by changing exactly what a
 * delegated transfer changes: the instruction's `authority` is the delegate, the delegate signs (and pays), and
 * the owner 9Y7Ftt… does not sign. The token balances — and so the owner of the source account — are untouched.
 */
function delegated(): RawParsedTx {
  const tx = clone(load('tx-test-to-outside.json'));
  const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {info: Record<string, unknown>}}>).find(i => i.parsed?.info?.authority)!;
  ix.parsed!.info.authority = DELEGATE;
  const keys = tx.transaction!.message!.accountKeys!;
  keys.find(k => k.pubkey === ACC_9Y)!.signer = false; // the owner did not sign
  keys.unshift({pubkey: DELEGATE, signer: true, writable: true}); // the delegate signs and pays: key 0
  for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
    b.accountIndex = (b.accountIndex ?? 0) + 1;
  }
  return tx;
}

it('review r1-10: a delegated transfer — From is the OWNER of the source account, not the authority', () => {
  const d = parseTxDetail(delegated(), 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({from: ACC_9Y, authority: DELEGATE, fromTokenAccount: SRC_TA, to: OUTSIDE, amount: '0.0005'});
  expect(d.signers).toEqual([DELEGATE]);
});

it('review r1-10: the owner is read from preTokenBalances when the post entry is missing (a source account closed in the same transaction)', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  tx.meta!.postTokenBalances = (tx.meta!.postTokenBalances ?? []).filter(b => b.accountIndex !== 1); // removed: the source's post entry
  expect(parseTxDetail(tx, 'SIG', symbolOf).transfer!.from).toBe(ACC_9Y);
});

it('account keys given as PublicKey-like objects (what web3.js returns) are read by toString', () => {
  const tx = clone(load('tx-sol-transfer.json'));
  const keys = tx.transaction!.message!.accountKeys! as Array<{pubkey: unknown}>;
  for (const k of keys) {
    const s = k.pubkey as string;
    k.pubkey = {toString: () => s};
  }
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.feePayer).toBe(SOL_SENDER);
  expect(d.signers).toEqual([SOL_SENDER]);
});

it('the Noctura fee-markup transfer is skipped; a failed transaction is "failed"; no transfer → transfer null', () => {
  const tx = clone(load('tx-sol-transfer.json'));
  const ixs = tx.transaction!.message!.instructions as unknown[];
  ixs.unshift({program: 'system', parsed: {type: 'transfer', info: {source: SOL_SENDER, destination: NOCTURA_FEE_TREASURY, lamports: 20000}}});
  expect(parseTxDetail(tx, 'SIG', symbolOf).transfer!.to).toBe(OUTSIDE);
  tx.meta!.err = {InstructionError: [0, 'X']};
  expect(parseTxDetail(tx, 'SIG', symbolOf).status).toBe('failed');
  tx.transaction!.message!.instructions = [];
  const none = parseTxDetail(tx, 'SIG', symbolOf);
  expect(none.transfer).toBeNull();
  expect(none.feePayer).toBe(SOL_SENDER);
});

// review r1-2 (kept from the removed txDirection block, final review 12): a failed transaction still parses its transfer
it('a FAILED transaction is "failed", and its transfer is still parsed (only a claim about it would go)', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  tx.meta!.err = {InstructionError: [2, {Custom: 1}]}; // changed: `meta.err` only
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.status).toBe('failed');
  expect(d.transfer).not.toBeNull();
});

it('the memo: a string `parsed` is the memo; an object is never put on screen as one', () => {
  const tx = clone(load('tx-sol-transfer.json'));
  const ixs = tx.transaction!.message!.instructions as unknown[];
  ixs.push({program: 'spl-memo', parsed: 'hello'}); // added: a memo instruction in the jsonParsed shape
  expect(parseTxDetail(tx, 'SIG', symbolOf).memo).toBe('hello');
  ixs[ixs.length - 1] = {program: 'spl-memo', parsed: {info: {text: 'hello'}}}; // an unexpected shape
  expect(parseTxDetail(tx, 'SIG', symbolOf).memo).toBeNull();
});

describe('fix round 1', () => {
  type Ix = {program?: string; parsed?: {type: string; info: Record<string, unknown>}};
  const ixsOf = (tx: RawParsedTx) => tx.transaction!.message!.instructions as Ix[];

  /**
   * Important: the wrap step of a SOL→X swap. Derived from the real 5i53q9tR… response: its transferChecked is
   * REPLACED by a system transfer of 100000000 lamports from 9Y7Ftt… to its own token account 3Wzwve… (index 1,
   * whose postTokenBalances owner is 9Y7Ftt…). Nothing else is changed.
   */
  function wrap(): RawParsedTx {
    const tx = clone(load('tx-test-to-outside.json'));
    const ixs = ixsOf(tx);
    const i = ixs.findIndex(x => x.parsed?.type === 'transferChecked');
    ixs[i] = {program: 'system', parsed: {type: 'transfer', info: {source: ACC_9Y, destination: SRC_TA, lamports: 100000000}}};
    return tx;
  }

  it('a SOL transfer INTO a token account names its owner wallet and the token account apart — never the token account as a wallet', () => {
    const d = parseTxDetail(wrap(), 'SIG', symbolOf);
    expect(d.transfer).toEqual({
      mint: 'native', symbol: 'SOL', amount: '0.1',
      from: ACC_9Y, authority: null, fromTokenAccount: null,
      to: ACC_9Y, toIsTokenAccount: false, toTokenAccount: SRC_TA,
    });
  });

  it('a SOL transfer into a token account whose entry names no owner → the token account, flagged', () => {
    const tx = wrap();
    for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
      delete b.owner; // removed: `owner`
    }
    const d = parseTxDetail(tx, 'SIG', symbolOf);
    expect(d.transfer).toMatchObject({to: SRC_TA, toIsTokenAccount: true, toTokenAccount: SRC_TA, from: ACC_9Y});
  });

  it('a SOL transfer to a plain wallet (no token-balance entry) is unchanged: toTokenAccount null', () => {
    expect(parseTxDetail(load('tx-sol-transfer.json'), 'SIG', symbolOf).transfer).toMatchObject({to: OUTSIDE, toIsTokenAccount: false, toTokenAccount: null});
  });

  it('the POST owner wins over the PRE owner (changed: the pre entries\' owners only)', () => {
    const tx = clone(load('tx-test-to-outside.json'));
    for (const b of tx.meta!.preTokenBalances ?? []) {
      b.owner = 'PREOWNERxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // changed: the pre owner differs from the post one
    }
    const d = parseTxDetail(tx, 'SIG', symbolOf);
    expect(d.transfer).toMatchObject({from: ACC_9Y, to: OUTSIDE});
  });

  it('a transfer to the fee treasury is skipped as markup only when another transfer exists', () => {
    const tx = clone(load('tx-sol-transfer.json'));
    const ix = ixsOf(tx).find(x => x.parsed?.type === 'transfer')!;
    ix.parsed!.info.destination = NOCTURA_FEE_TREASURY; // changed: the only transfer goes to the treasury
    const only = parseTxDetail(tx, 'SIG', symbolOf);
    expect(only.transfer).toMatchObject({to: NOCTURA_FEE_TREASURY, from: SOL_SENDER, amount: '0.000005'});
    // with a real transfer AFTER it, the treasury leg is the markup and the real one is shown
    ixsOf(tx).push({program: 'system', parsed: {type: 'transfer', info: {source: SOL_SENDER, destination: OUTSIDE, lamports: 5000}}});
    expect(parseTxDetail(tx, 'SIG', symbolOf).transfer).toMatchObject({to: OUTSIDE});
  });

  it('Token-2022: the same transferChecked under program "spl-token-2022" is read (changed: the program name only)', () => {
    const tx = clone(load('tx-test-to-outside.json'));
    ixsOf(tx).find(x => x.parsed?.type === 'transferChecked')!.program = 'spl-token-2022';
    expect(parseTxDetail(tx, 'SIG', symbolOf).transfer).toMatchObject({mint: TEST_MINT, symbol: 'TEST', amount: '0.0005', from: ACC_9Y, to: OUTSIDE, toTokenAccount: OUTSIDE_TA});
  });

  it('Token-2022: a plain `transfer` under "spl-token-2022" is read too', () => {
    const tx = clone(load('tx-test-to-outside.json'));
    const ix = ixsOf(tx).find(x => x.parsed?.type === 'transferChecked')!;
    ix.program = 'spl-token-2022';
    ix.parsed!.type = 'transfer';
    ix.parsed!.info = {amount: '500000', authority: ACC_9Y, destination: OUTSIDE_TA, source: SRC_TA};
    expect(parseTxDetail(tx, 'SIG', symbolOf).transfer).toMatchObject({mint: TEST_MINT, amount: '0.0005', to: OUTSIDE});
  });
});
