/**
 * History spec (2026-11-26) §4, §8 "Classifier": `classifyActivity` against REAL getTransaction
 * (jsonParsed) responses — fixtures/*.json are verbatim RPC answers (plan Task 1 names each signature
 * and its cluster). A DERIVED case is made from a real response by changing exactly the fields it
 * names; no transaction of that shape was found on chain (or none can exist yet: the fee markup).
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {classifyActivity, JUPITER_V6_PROGRAM_ID, WSOL_MINT} from '../activity';
import type {ActivityContext, ActivityRow} from '../activity';
import type {RawInstruction, RawParsedTx} from '../txDetail';
import {A0, A0_RELAYER} from '../../shielded/a0/constants';

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as {result: RawParsedTx}).result;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// devnet (the wallet's own accounts)
const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const MAIN_TA = 'A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const ACC_3 = '5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7';
const ACC_4 = 'AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR';
const OUTSIDE = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
const EMPTY_WALLET = '2ixJm1hh6Ff8KuUCoaAe1myqKAT2PimVJ3B6ubuYQMr9';
const ATA_PAYER = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const RELAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
const POOL = '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT';
// mainnet (strangers' public transactions)
const WRAPPER = 'G1k6vgWH6REJUYHQBDri9r6KPryX61keqTgHfp8Exb8n';
const WRAPPER_ATA = 'Dmug1GgWHMenk7vQhax6QDdBUz99KNaa5vHFxqaDBEEw';
const UNWRAPPER = '5kbvumhoPqt1gVeUEBBZXzeAwCMQCYowYeZK9NxNyfYZ';
const UNWRAP_FEE_PAYER = 'ASL88oP9PX1MVN9LMFQ4toBpX9atqtyuKnwB2rLUn8dN';
const CLOSER = '75WVLpo9gkf2NqS5Nkie5756gQvroheM3UWERruoxKH8';
const ATA_OWNER = 'BUpWiWy8Tqed4jy86dr7ZpoaE747DpQsrGnwmtpMwfBr';
const USDT_SENDER = 'BxrXKJrpxyshyFdZwojGzRD2PL3ujf51tCJw7aYHSuwi';
const USDT_RECIPIENT = 'GATBj87hLwH2jYePNvD7qsCDT9roKiJsHhdJVvPK1ggP';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const FAILED_PAYER = '4Qun7nwV14Tp46QP1f9tURB1vGi6Wr4x8PNmhQA7M9r7';
const FAILED_RECIPIENT = 'G9X7F4JzLzbSGMCndiBdWNi5YzZZakmtkdwq7xS3Q3FE';
const T22_SENDER = 'DDegarugVZTEWWfniZrgz3oemqjaMTPXeBGoyXXrwbjm';
const T22_RECIPIENT = 'AExZRpYWDQvpHKjp2fkUEDrS8LFCgiXgvkr1jPyzWhJy';
const T22_MINT = '3jAB5ksB13Kgm2Q39NU6d2USUxBy2f9LaTvyay6Gpump';
const SELLER = '4wK1vV3d1ZoZvYED9RafrDAS1XvsvkYJuLN3XxSHTpd5';
const SOLD_MINT = '3gmFG4sFDJErDV8pacFrL2uUPXeGJTYLjfRy4hFypump';
const BUYER = 'F1hVXLM73vvUUi55wFdUuBr8grSrrf9BDFVy35UwcFQK';
const BOUGHT_MINT = '5yC9BM8KUsJTPbWPLfA2N8qH1s9V8DQ3Vcw1G6Jdpump';
// mainnet, version 1 (plan review r2 V1; owner decision 2026-11-27)
const V1_SENDER = 'FQmfF49eSNg5PiWdCovBQ4GDe7FKcMyz9ygB275A4bdj';
const V1_RECIPIENT = '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5';
const V1_SELLER = 'CkZk4czG9RsXhLvw14fJWD3VypM7E9ZXG88QRtKvjgmb';
const TREASURY = 'TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // any key that is in no fixture: it is only compared

const symbolOf = (mint: string): string => (mint === 'native' ? 'SOL' : mint === TEST_MINT ? 'TEST' : mint === WSOL_MINT ? 'wSOL' : `short(${mint.slice(0, 4)})`);
const ctx = (over: Partial<ActivityContext> = {}): ActivityContext => ({
  symbolOf,
  cluster: 'devnet',
  a0: A0,
  feeTreasury: TREASURY,
  relayerFeePayer: A0_RELAYER.feePayer,
  jupiterProgramId: JUPITER_V6_PROGRAM_ID,
  ownTokenAccounts: new Set(),
  ...over,
});
/** mainnet fixtures are classified as the mainnet build does: rule 2 is off */
const MAINNET = {cluster: 'mainnet-beta'};
const classify = (fixture: string | RawParsedTx, account: string, over: Partial<ActivityContext> = {}): ActivityRow =>
  classifyActivity(typeof fixture === 'string' ? load(fixture) : fixture, account, 'finalized', ctx(over));
/** role:symbol:raw, in the row's order */
const deltas = (r: ActivityRow): string[] => r.deltas.map(d => `${d.role}:${d.symbol}:${d.raw}`);

it('the fixtures match the constants they are classified with', () => {
  expect(A0.mint).toBe(TEST_MINT);
  expect(A0.pool).toBe(POOL);
  expect(A0_RELAYER.feePayer).toBe(RELAYER);
});

describe('sent / received (§4.3 rules 5–6, §4.5)', () => {
  // A1
  it('a SOL send (2HWCCJQd…): the fee is not part of the delta; the recipient is named', () => {
    const r = classify('tx-sol-transfer.json', ACC_3);
    expect(r).toMatchObject({kind: 'sent', counterparty: OUTSIDE, feePaidByAccount: 5050n, extraAssets: 0, incomplete: false, via: null, secondary: null});
    expect(r.primary).toEqual({mint: 'native', symbol: 'SOL', raw: -5000n, decimals: 9, role: 'moved'}); // not −10050
    expect(deltas(r)).toEqual(['moved:SOL:-5000']);
    expect(r).toMatchObject({signature: '2HWCCJQdfzmmgaw77i9JtXmVpjPTGxUqiZt9hkmFiMuCSMWtdtyToSobGbEhvsUbaSNEJtARq96GQFisvThYJWni', slot: 525082222, blockTime: 1795353101, status: 'finalized'});
  });

  // A2
  it('a received SOL transfer names its sender — the fee payer — and this account paid no fee', () => {
    const r = classify('tx-sol-transfer.json', OUTSIDE);
    expect(r).toMatchObject({kind: 'received', counterparty: ACC_3, feePaidByAccount: null});
    expect(deltas(r)).toEqual(['moved:SOL:5000']);
  });

  // A3 (r2 N4)
  it('a SOL send to a wallet with 0 lamports before it (2bGSoVSG…) names that wallet', () => {
    const r = classify('tx-sol-to-empty-2bGSoVSG.json', MAIN);
    expect(r).toMatchObject({kind: 'sent', counterparty: EMPTY_WALLET});
    expect(deltas(r)).toEqual(['moved:SOL:-1000000']);
    expect(classify('tx-sol-to-empty-2bGSoVSG.json', EMPTY_WALLET)).toMatchObject({kind: 'received', counterparty: MAIN});
  });

  // A4 (r2 N4) — DERIVED from 2HWCCJQd…: the sender's post balance set to 0 (a wallet emptied by the send)
  it('a receive from a wallet left at 0 names it', () => {
    const tx = load('tx-sol-transfer.json');
    tx.meta!.postBalances![0] = 0;
    expect(classify(tx, OUTSIDE)).toMatchObject({kind: 'received', counterparty: ACC_3});
  });

  // A5
  it('a token send (QAgzVzY6…): the sender sees Sent to main; main — absent from the account keys — sees Received from Account 2', () => {
    const sent = classify('tx-test-to-main.json', ACC_2);
    expect(sent).toMatchObject({kind: 'sent', counterparty: MAIN, feePaidByAccount: 7000n, extraAssets: 0});
    expect(sent.primary).toEqual({mint: TEST_MINT, symbol: 'TEST', raw: -200000n, decimals: 9, role: 'moved'});
    expect(deltas(sent)).toEqual(['moved:TEST:-200000']); // the fee is no SOL delta
    const received = classify('tx-test-to-main.json', MAIN);
    expect(received).toMatchObject({kind: 'received', counterparty: ACC_2, feePaidByAccount: null});
    expect(deltas(received)).toEqual(['moved:TEST:200000']);
  });

  // A6
  it('Account 4 → main (2XgjNKS8…)', () => {
    expect(classify('tx-test-acc4-to-main-2XgjNKS8.json', ACC_4)).toMatchObject({kind: 'sent', counterparty: MAIN});
    const r = classify('tx-test-acc4-to-main-2XgjNKS8.json', MAIN);
    expect(r).toMatchObject({kind: 'received', counterparty: ACC_4});
    expect(deltas(r)).toEqual(['moved:TEST:10000']);
  });

  // A7 (review C3)
  it("a token send that creates the recipient's ATA (4M9L6DFb…) names the recipient WALLET and shows the token, not the rent", () => {
    const r = classify('tx-send-new-ata-4M9L6DFb.json', USDT_SENDER, MAINNET);
    expect(r).toMatchObject({kind: 'sent', counterparty: USDT_RECIPIENT, extraAssets: 0, feePaidByAccount: 5000n});
    expect(r.primary).toMatchObject({mint: USDT, raw: -48288911n, decimals: 6, role: 'moved'});
    expect(deltas(r)).toEqual(['moved:short(Es9v):-48288911', 'rent:SOL:-1488440']);
    expect(classify('tx-send-new-ata-4M9L6DFb.json', USDT_RECIPIENT, MAINNET)).toMatchObject({kind: 'received', counterparty: USDT_SENDER});
  });

  // A8
  it('a Token-2022 transfer (2j54z2QC…) is read like a classic one', () => {
    const r = classify('tx-token2022-transfer-2j54z2QC.json', T22_SENDER, MAINNET);
    expect(r).toMatchObject({kind: 'sent', counterparty: T22_RECIPIENT, feePaidByAccount: 232500n});
    expect(r.primary).toMatchObject({mint: T22_MINT, raw: -1181313382n, decimals: 6});
    expect(deltas(r)).toEqual(['moved:short(3jAB):-1181313382']); // the idempotent create of an EXISTING account is no rent
    expect(classify('tx-token2022-transfer-2j54z2QC.json', T22_RECIPIENT, MAINNET)).toMatchObject({kind: 'received', counterparty: T22_SENDER});
  });

  // A9 (r2 N3) — DERIVED from 5i53q9tR… (a token send): a top-level system transfer of 20000 lamports from the
  // sender to the fee treasury is added, with the treasury as a new account key and the sender's post balance 20000 lower
  it('a token send with the markup shows the recipient and the token; the markup is its own role and no "+1 more"', () => {
    const tx = load('tx-test-to-outside.json');
    tx.transaction!.message!.accountKeys!.push({pubkey: TREASURY, signer: false, writable: true});
    tx.meta!.preBalances!.push(900_000);
    tx.meta!.postBalances!.push(920_000);
    tx.meta!.postBalances![0]! -= 20_000;
    tx.transaction!.message!.instructions!.push({
      program: 'system', programId: '11111111111111111111111111111111',
      parsed: {type: 'transfer', info: {source: ACC_2, destination: TREASURY, lamports: 20_000}},
    });
    const r = classify(tx, ACC_2);
    expect(r).toMatchObject({kind: 'sent', counterparty: OUTSIDE, extraAssets: 0});
    expect(r.primary).toMatchObject({symbol: 'TEST', raw: -500000n});
    expect(deltas(r)).toEqual(['moved:TEST:-500000', 'markup:SOL:-20000']);
  });

  // A10 (r2 N3) — DERIVED from 2HWCCJQd… (a SOL send) in the same way
  it('a SOL send with the markup: the recipient, not the treasury; the amount without the markup', () => {
    const tx = load('tx-sol-transfer.json');
    tx.transaction!.message!.accountKeys!.push({pubkey: TREASURY, signer: false, writable: true});
    tx.meta!.preBalances!.push(900_000);
    tx.meta!.postBalances!.push(920_000);
    tx.meta!.postBalances![0]! -= 20_000;
    tx.transaction!.message!.instructions!.push({
      program: 'system', programId: '11111111111111111111111111111111',
      parsed: {type: 'transfer', info: {source: ACC_3, destination: TREASURY, lamports: 20_000}},
    });
    const r = classify(tx, ACC_3);
    expect(r).toMatchObject({kind: 'sent', counterparty: OUTSIDE, extraAssets: 0});
    expect(deltas(r)).toEqual(['moved:SOL:-5000', 'markup:SOL:-20000']);
  });

  // A11 (PR 1) — 2HWCCJQd… read with its recipient AS the treasury: a transfer to the treasury alone is deliberate
  it('a transfer to the treasury with nothing else moved stays "moved", and the treasury is the counter-party', () => {
    const r = classify('tx-sol-transfer.json', ACC_3, {feeTreasury: OUTSIDE});
    expect(r).toMatchObject({kind: 'sent', counterparty: OUTSIDE});
    expect(deltas(r)).toEqual(['moved:SOL:-5000']);
  });

  // A12 — 2HWCCJQd… read with its sender AS the relayer's fee payer
  it("the relayer's fee payer is never the counter-party", () => {
    expect(classify('tx-sol-transfer.json', OUTSIDE, {relayerFeePayer: ACC_3})).toMatchObject({kind: 'received', counterparty: null});
  });

  // A13 (r2 N7) — DERIVED from 5i53q9tR…: a second recipient entry (another owner, +100) is added
  it('a send to two recipients names neither', () => {
    const tx = load('tx-test-to-outside.json');
    const second = {accountIndex: 3, mint: TEST_MINT, owner: MAIN, uiTokenAmount: {amount: '0', decimals: 9}};
    tx.meta!.preTokenBalances!.push(second);
    tx.meta!.postTokenBalances!.push({...second, uiTokenAmount: {amount: '100', decimals: 9}});
    expect(classify(tx, ACC_2)).toMatchObject({kind: 'sent', counterparty: null});
  });

  // A13b — DERIVED from 5i53q9tR…: a second recipient entry WITHOUT an owner (+100) is added
  it('one named recipient and one entry with no owner: still nobody is named', () => {
    const tx = load('tx-test-to-outside.json');
    tx.meta!.preTokenBalances!.push({accountIndex: 3, mint: TEST_MINT, uiTokenAmount: {amount: '0', decimals: 9}});
    tx.meta!.postTokenBalances!.push({accountIndex: 3, mint: TEST_MINT, uiTokenAmount: {amount: '100', decimals: 9}});
    expect(classify(tx, ACC_2)).toMatchObject({kind: 'sent', counterparty: null});
  });

  // A14 — DERIVED from 5i53q9tR…: the recipient's entries lose their `owner` (a node may omit it)
  it('a recipient entry with no owner: no counter-party, never the token account', () => {
    const tx = load('tx-test-to-outside.json');
    delete tx.meta!.preTokenBalances![1]!.owner;
    delete tx.meta!.postTokenBalances![1]!.owner;
    const r = classify(tx, ACC_2);
    expect(r).toMatchObject({kind: 'sent', counterparty: null, incomplete: false});
  });
});

describe('the SOL counter-party is a wallet the response proves (§4.5)', () => {
  // A14b — DERIVED from 2HWCCJQd…: a separate fee payer is put at index 0 (balance 1000000, paying the 5050 fee);
  // the sender, now index 1, no longer pays it
  it('a fee payer who only paid the fee is not the sender: the fee is added back to index 0', () => {
    const tx = load('tx-sol-transfer.json');
    const FEE_PAYER = 'FeePayerXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    tx.transaction!.message!.accountKeys!.unshift({pubkey: FEE_PAYER, signer: true, writable: true});
    tx.meta!.preBalances!.unshift(1_000_000);
    tx.meta!.postBalances!.unshift(1_000_000 - 5050);
    tx.meta!.postBalances![1]! += 5050;
    expect(classify(tx, OUTSIDE)).toMatchObject({kind: 'received', counterparty: ACC_3});
    const sender = classify(tx, ACC_3);
    expect(sender).toMatchObject({kind: 'sent', counterparty: OUTSIDE, feePaidByAccount: null});
    expect(deltas(sender)).toEqual(['moved:SOL:-5000']);
  });

  // A14c — DERIVED from 63fU5RvD… (a payer creates main's ATA): the payer also sends main 1000 lamports
  // (a top-level system transfer; the payer's post balance 1000 lower, main's 1000 higher)
  it('an account created in the transaction is never the counter-party, whichever way it is proven', () => {
    const derive = (): RawParsedTx => {
      const tx = load('tx-ata-for-main-63fU5RvD.json');
      const mainAt = tx.transaction!.message!.accountKeys!.findIndex(k => k.pubkey === MAIN);
      tx.meta!.postBalances![0]! -= 1000;
      tx.meta!.postBalances![mainAt]! += 1000;
      tx.transaction!.message!.instructions!.push({
        program: 'system', programId: '11111111111111111111111111111111',
        parsed: {type: 'transfer', info: {source: ATA_PAYER, destination: MAIN, lamports: 1000}},
      });
      return tx;
    };
    // the new ATA gained lamports too: it is a token account AND proven created
    const r = classify(derive(), ATA_PAYER);
    expect(r).toMatchObject({kind: 'sent', counterparty: MAIN});
    expect(deltas(r)).toEqual(['moved:SOL:-1000', 'rent:SOL:-1488440']);
    // …proven created only (the response lists no token balance for it)
    const noEntry = derive();
    noEntry.meta!.postTokenBalances = [];
    expect(classify(noEntry, ATA_PAYER)).toMatchObject({kind: 'sent', counterparty: MAIN});
    // …a token account only (no instruction proves the creation)
    const noProof = derive();
    noProof.transaction!.message!.instructions = (noProof.transaction!.message!.instructions as RawInstruction[]).filter(x => x.program !== 'spl-associated-token-account');
    noProof.meta!.innerInstructions = [];
    expect(classify(noProof, ATA_PAYER)).toMatchObject({kind: 'sent', counterparty: MAIN});
  });

  // A14d — DERIVED from 33qVTEpP…: the wSOL account belongs to ANOTHER wallet (its owner is changed in both entries)
  it("SOL sent into someone else's token account names nobody — never the token account", () => {
    const tx = load('tx-wrap-existing-33qVTEpP.json');
    tx.meta!.preTokenBalances![0]!.owner = OUTSIDE;
    tx.meta!.postTokenBalances![0]!.owner = OUTSIDE;
    const r = classify(tx, WRAPPER, MAINNET);
    expect(r).toMatchObject({kind: 'sent', counterparty: null});
    expect(deltas(r)).toEqual(['moved:SOL:-59167663567']);
  });
});

describe('the pool (§4.3 rule 2)', () => {
  // A15 (review C5, r2 N3)
  it('a deposit from main (3d31ATap…) is Made private: the token, not the rho rent; no "+1 more"', () => {
    const r = classify('tx-deposit-3d31ATap.json', MAIN);
    expect(r).toMatchObject({kind: 'made-private', counterparty: null, extraAssets: 0, feePaidByAccount: 5000n});
    expect(r.primary).toEqual({mint: TEST_MINT, symbol: 'TEST', raw: -100000n, decimals: 9, role: 'moved'});
    expect(deltas(r)).toEqual(['moved:TEST:-100000', 'rent:SOL:-695960']);
  });

  // A16 (r2 N3) — DERIVED from 3d31ATap…: the inner instructions are removed, so no system instruction names the rho marker
  it('the rho marker is the depositor\'s rent even when no system instruction is parsed for it', () => {
    const tx = load('tx-deposit-3d31ATap.json');
    tx.meta!.innerInstructions = [];
    expect(deltas(classify(tx, MAIN))).toEqual(['moved:TEST:-100000', 'rent:SOL:-695960']);
  });

  // A17 (review C5, r2 N3)
  it('the relayed unshield into Account 3 (54J9kjQ8…) is Made public: the token, not the gas grant; no "+1 more"', () => {
    const r = classify('tx-unshield-relayed-54J9kjQ8.json', ACC_3);
    expect(r).toMatchObject({kind: 'made-public', counterparty: null, extraAssets: 0, feePaidByAccount: null});
    expect(r.primary).toEqual({mint: TEST_MINT, symbol: 'TEST', raw: 10000n, decimals: 9, role: 'moved'});
    // the relayer paid for the new token account (an idempotent create of a NEW account): no rent of this account
    expect(deltas(r)).toEqual(['moved:TEST:10000', 'grant:SOL:3000000']);
  });

  // A17b (plan review r1 m5) — 54J9kjQ8… read by a build whose relayer is ANOTHER key, so that this transaction's
  // fee payer (index 0) is not the relayer; the transaction itself is unchanged
  it('SOL received on a Make public whose fee payer is not the relayer is not called a gas grant', () => {
    const r = classify('tx-unshield-relayed-54J9kjQ8.json', ACC_3, {relayerFeePayer: TREASURY});
    expect(r.kind).toBe('made-public');
    expect(r.deltas.some(d => d.role === 'grant')).toBe(false);
    expect(deltas(r)).toEqual(['moved:TEST:10000', 'moved:SOL:3000000']);
    expect(r.extraAssets).toBe(1); // it is a second asset that moved: "+1 more", never a labelled grant
  });

  // A17c (Task 2 re-review n5): the grant gate — 54J9kjQ8… unchanged, with 'failed' HANDED IN as its status (a body
  // that succeeded): a failed row splits no roles, so the relayer's SOL is not labelled a grant either
  it('a Make public handed in as failed claims no gas grant: its deltas are only what the balances show', () => {
    const r = classifyActivity(load('tx-unshield-relayed-54J9kjQ8.json'), ACC_3, 'failed', ctx());
    expect(r.kind).toBe('failed');
    expect(r.deltas.some(d => d.role === 'grant')).toBe(false);
    expect(deltas(r)).toEqual(['moved:TEST:10000', 'moved:SOL:3000000']);
  });

  // A18
  it("a relayed unshield into main's existing token account (3tPxm8Ph…): Made public, no grant", () => {
    const r = classify('tx-unshield-relayed-main-3tPxm8Ph.json', MAIN);
    expect(r).toMatchObject({kind: 'made-public', extraAssets: 0});
    expect(deltas(r)).toEqual(['moved:TEST:20000']);
  });

  // A19
  it('a pool instruction that is neither this account\'s deposit nor a withdrawal into it → unknown, no amount', () => {
    expect(classify('tx-unshield-relayed-54J9kjQ8.json', MAIN)).toMatchObject({kind: 'unknown', primary: null});
    expect(classify('tx-deposit-3d31ATap.json', ACC_2)).toMatchObject({kind: 'unknown', primary: null});
  });

  // A20
  it('rule 2 applies only on the pool\'s own cluster: a mainnet build never calls anything Made private', () => {
    const r = classify('tx-deposit-3d31ATap.json', MAIN, MAINNET);
    expect(r.kind).toBe('sent');
    expect(deltas(r)).toEqual(['moved:TEST:-100000', 'rent:SOL:-695960']); // the inner createAccount still proves the rent
  });

  // A21 — DERIVED from 3d31ATap…: the pool instruction's account 1 (the merkle tree) is replaced by another key
  it('an instruction of the program on another tree is not ours (isOurA0Ix)', () => {
    const tx = load('tx-deposit-3d31ATap.json');
    const ix = (tx.transaction!.message!.instructions as RawInstruction[]).find(x => x.programId === A0.programId)!;
    ix.accounts![1] = OUTSIDE;
    expect(classify(tx, MAIN).kind).toBe('sent');
  });
});

describe('wrap / unwrap (§4.3 rule 3, §4.2 rent)', () => {
  // A22 (r2 N2)
  it('a wrap into an EXISTING wSOL account (33qVTEpP…): wrap — not swap, not sent; the idempotent create is no rent', () => {
    const r = classify('tx-wrap-existing-33qVTEpP.json', WRAPPER, MAINNET);
    expect(r).toMatchObject({kind: 'wrap', counterparty: null, extraAssets: 0, secondary: null});
    expect(r.primary).toEqual({mint: 'native', symbol: 'SOL', raw: -59167663567n, decimals: 9, role: 'moved'});
    expect(deltas(r)).toEqual(['moved:wSOL:59167663567', 'moved:SOL:-59167663567']);
  });

  // A23 (r2 N1) — DERIVED from 33qVTEpP…: the wSOL account did not exist before — its pre lamports are 0, its pre
  // token entry is removed, and the payer's post balance is 1488440 lower (the rent it now pays)
  it('a wrap into a NEW wSOL account: the exact rent is split out and the row is still a wrap of the wrapped amount', () => {
    const tx = load('tx-wrap-existing-33qVTEpP.json');
    const at = tx.transaction!.message!.accountKeys!.findIndex(k => k.pubkey === WRAPPER_ATA);
    tx.meta!.preBalances![at] = 0;
    tx.meta!.preTokenBalances = [];
    tx.meta!.postBalances![0]! -= 1_488_440;
    const r = classify(tx, WRAPPER, MAINNET);
    expect(r.kind).toBe('wrap');
    expect(r.primary).toMatchObject({mint: 'native', raw: -59167663567n});
    expect(deltas(r)).toEqual(['moved:wSOL:59167663567', 'moved:SOL:-59167663567', 'rent:SOL:-1488440']);
  });

  // A23r (r2 N1; owner decision Q3b): a REAL wrap into a new wSOL account (3K3duJXA…, mainnet)
  it('a real wrap into a NEW wSOL account: the rent is post − pre − the wrapped amount', () => {
    const FILE = 'tx-wrap-new-3K3duJXA.json';
    const PAYER = 'FN1xtTLB8fnb6gr5bXxnHc5m9Masm1oRecRLSGooQyxH';
    const tx = load(FILE);
    const entry = tx.meta!.postTokenBalances!.find(b => b.mint === WSOL_MINT && b.owner === PAYER)!;
    const j = entry.accountIndex!;
    const wrapped = BigInt(entry.uiTokenAmount!.amount!);
    const rent = BigInt(tx.meta!.postBalances![j]!) - BigInt(tx.meta!.preBalances![j]!) - wrapped;
    expect(tx.meta!.preBalances![j]).toBe(0);
    expect(rent).toBe(1_488_440n);
    const r = classify(tx, PAYER, MAINNET);
    expect(r.kind).toBe('wrap');
    expect(deltas(r)).toEqual([`moved:wSOL:${wrapped}`, `moved:SOL:${-wrapped}`, `rent:SOL:${-rent}`]);
  });

  // A24 (r2 N1)
  it('an unwrap by close (3MGayyac…): unwrap; the exact rent refund is split out; someone else paid the fee', () => {
    const r = classify('tx-unwrap-close-3MGayyac.json', UNWRAPPER, MAINNET);
    expect(r).toMatchObject({kind: 'unwrap', counterparty: null, extraAssets: 0, feePaidByAccount: null});
    expect(r.primary).toEqual({mint: 'native', symbol: 'SOL', raw: 13229146n, decimals: 9, role: 'moved'});
    expect(deltas(r)).toEqual(['moved:wSOL:-13229146', 'moved:SOL:13229146', 'rent:SOL:1488440']);
    // the fee payer moved nothing of its own
    expect(classify('tx-unwrap-close-3MGayyac.json', UNWRAP_FEE_PAYER, MAINNET)).toMatchObject({kind: 'no-funds-moved', feePaidByAccount: 15000n, deltas: []});
  });
});

describe('swap (§4.3 rule 4)', () => {
  // A25
  it('a Jupiter v6 swap, token → SOL (2FSgk4Ge…): the outgoing leg first, the SOL received, via Jupiter', () => {
    const r = classify('tx-jupiter-token-to-sol-2FSgk4Ge.json', SELLER, MAINNET);
    expect(r).toMatchObject({kind: 'swap', via: 'Jupiter', counterparty: null, extraAssets: 0, feePaidByAccount: 8128n});
    expect(r.primary).toMatchObject({mint: SOLD_MINT, raw: -135435988491n, decimals: 6});
    expect(r.secondary).toMatchObject({mint: 'native', symbol: 'SOL', raw: 4668480n});
    // the temporary wSOL account, created and closed in the transaction, contributes nothing
    expect(deltas(r)).toEqual(['moved:short(3gmF):-135435988491', 'moved:SOL:4668480']);
  });

  // A26
  it('a Jupiter v6 swap, SOL → token (4C4tZgit…): the SOL leg is the swapped amount, the new token account\'s rent apart', () => {
    const r = classify('tx-jupiter-sol-to-token-4C4tZgit.json', BUYER, MAINNET);
    expect(r).toMatchObject({kind: 'swap', via: 'Jupiter', extraAssets: 0});
    expect(r.primary).toMatchObject({mint: 'native', raw: -1851208n});
    expect(r.secondary).toMatchObject({mint: BOUGHT_MINT, raw: 179355920n, decimals: 6});
    expect(deltas(r)).toEqual(['moved:short(5yC9):179355920', 'moved:SOL:-1851208', 'rent:SOL:-1513840']);
  });

  // A26b (r2 N2) — DERIVED from 2FSgk4Ge…: the wSOL account the swap closes EXISTED before (empty, 1488440 lamports of
  // rent): its pre balance is 1488440, the idempotent create's inner instructions (top-level index 2) are removed —
  // it creates nothing — and the close refunds that rent to the seller (post +1488440)
  it('a swap that closes a wSOL account which already existed: the refund is rent, not part of the SOL received', () => {
    const tx = load('tx-jupiter-token-to-sol-2FSgk4Ge.json');
    tx.meta!.preBalances![1] = 1_488_440;
    tx.meta!.postBalances![0]! += 1_488_440;
    tx.meta!.innerInstructions = tx.meta!.innerInstructions!.filter(g => g.index !== 2);
    const r = classify(tx, SELLER, MAINNET);
    expect(r.kind).toBe('swap');
    expect(deltas(r)).toEqual(['moved:short(3gmF):-135435988491', 'moved:SOL:4668480', 'rent:SOL:1488440']);
  });

  // A27
  it('"via" is named only for Jupiter v6', () => {
    expect(classify('tx-jupiter-token-to-sol-2FSgk4Ge.json', SELLER, {...MAINNET, jupiterProgramId: 'SomeOtherProgram'})).toMatchObject({kind: 'swap', via: null});
  });
});

describe('account setup, no funds moved, failed, unknown (§4.3 rules 1, 7–9)', () => {
  // A28 (r2 N2)
  it("creating one's own ATA (pXiTRFpg…, an idempotent create of a new Token-2022 account): account setup, the rent once", () => {
    const r = classify('tx-ata-own-pXiTRFpg.json', ATA_OWNER, MAINNET);
    expect(r).toMatchObject({kind: 'account-setup', counterparty: null, extraAssets: 0});
    expect(r.primary).toEqual({mint: 'native', symbol: 'SOL', raw: -1513840n, decimals: 9, role: 'rent'});
    expect(deltas(r)).toEqual(['rent:SOL:-1513840']); // the create and its inner createAccount prove it: counted once
  });

  // A29 (r2 N2) — DERIVED from pXiTRFpg…: the top-level create is replaced by an unparsed instruction of an unknown
  // program, so only the INNER createAccount proves the account
  it('a token account created by CPI (an inner instruction alone) is rent', () => {
    const tx = load('tx-ata-own-pXiTRFpg.json');
    const instructions = tx.transaction!.message!.instructions as RawInstruction[];
    const at = instructions.findIndex(x => x.program === 'spl-associated-token-account');
    instructions[at] = {programId: 'SomeProgram1111111111111111111111111111111', accounts: [], data: '1'};
    expect(deltas(classify(tx, ATA_OWNER, MAINNET))).toEqual(['rent:SOL:-1513840']);
  });

  // A30
  it('closing an empty token account (5A6bCt6V…) is account setup: the refund, with its sign', () => {
    const r = classify('tx-close-empty-5A6bCt6V.json', CLOSER, MAINNET);
    expect(r).toMatchObject({kind: 'account-setup', feePaidByAccount: 5000n});
    expect(r.primary).toMatchObject({raw: 1574800n, role: 'rent'});
  });

  // A31
  it("someone else creating this account's ATA (63fU5RvD…): no funds moved for the owner, account setup for the payer", () => {
    expect(classify('tx-ata-for-main-63fU5RvD.json', MAIN)).toMatchObject({kind: 'no-funds-moved', primary: null, deltas: [], feePaidByAccount: null});
    const payer = classify('tx-ata-for-main-63fU5RvD.json', ATA_PAYER);
    expect(payer.kind).toBe('account-setup');
    expect(deltas(payer)).toEqual(['rent:SOL:-1488440']);
  });

  // A32
  it('a failed transaction (2hdMogDK…): failed for everyone, no amount, the fee only for who paid it', () => {
    const payer = classify('tx-failed-sol-2hdMogDK.json', FAILED_PAYER, MAINNET);
    expect(payer).toMatchObject({kind: 'failed', status: 'failed', primary: null, counterparty: null, feePaidByAccount: 5000n, deltas: []});
    expect(classify('tx-failed-sol-2hdMogDK.json', FAILED_RECIPIENT, MAINNET)).toMatchObject({kind: 'failed', status: 'failed', feePaidByAccount: null});
  });

  // A32b (review I1) — DERIVED from 3MGayyac… (an unwrap by close): made failed — `meta.err` set, every post balance =
  // its pre balance except the fee at index 0, post token balances = pre
  it('a failed unwrap by close claims no rent refund: the instructions list a close, the balances show none', () => {
    const tx = load('tx-unwrap-close-3MGayyac.json');
    tx.meta!.err = {InstructionError: [0, 'Custom']};
    tx.meta!.postBalances = [...tx.meta!.preBalances!];
    tx.meta!.postBalances[0]! -= tx.meta!.fee!;
    tx.meta!.postTokenBalances = clone(tx.meta!.preTokenBalances!);
    const r = classify(tx, UNWRAPPER, MAINNET);
    expect(r).toMatchObject({kind: 'failed', primary: null, deltas: []});
  });

  // A32c (review I1) — DERIVED from 2HWCCJQd… (a SOL send): the TREASURY key is pushed onto the account keys with a
  // `preBalances` entry of 900 000, a 20000-lamport transfer to it is added, then the transaction is made failed in the
  // same way (`meta.err` set, post = pre but the fee at index 0)
  it('a failed send with the markup transfer claims no markup', () => {
    const tx = load('tx-sol-transfer.json');
    tx.transaction!.message!.accountKeys!.push({pubkey: TREASURY, signer: false, writable: true});
    tx.meta!.preBalances!.push(900_000);
    tx.transaction!.message!.instructions!.push({
      program: 'system', programId: '11111111111111111111111111111111',
      parsed: {type: 'transfer', info: {source: ACC_3, destination: TREASURY, lamports: 20_000}},
    });
    tx.meta!.err = {InstructionError: [1, 'Custom']};
    tx.meta!.postBalances = [...tx.meta!.preBalances!];
    tx.meta!.postBalances[0]! -= tx.meta!.fee!;
    expect(classify(tx, ACC_3)).toMatchObject({kind: 'failed', primary: null, deltas: []});
  });

  // A33
  it('the status handed in is kept; `meta.err` overrides it; a failed status makes the kind failed', () => {
    const tx = load('tx-sol-transfer.json');
    expect(classifyActivity(tx, ACC_3, 'confirmed', ctx()).status).toBe('confirmed');
    expect(classifyActivity(tx, ACC_3, 'finalized', ctx()).status).toBe('finalized');
    expect(classifyActivity(tx, ACC_3, 'failed', ctx())).toMatchObject({status: 'failed', kind: 'failed', primary: null});
  });

  // A34
  it('an account that is not in the transaction at all: no funds moved', () => {
    expect(classify('tx-sol-transfer.json', MAIN)).toMatchObject({kind: 'no-funds-moved', deltas: [], feePaidByAccount: null});
  });
});

describe('unattributable entries (§4.2)', () => {
  // A35 — DERIVED from QAgzVzY6…: main's token entries lose their `owner`
  it('an owner-less entry of one of the account\'s token accounts sets incomplete: never "no funds moved"', () => {
    const tx = load('tx-test-to-main.json');
    delete tx.meta!.preTokenBalances![1]!.owner;
    delete tx.meta!.postTokenBalances![1]!.owner;
    const r = classify(tx, MAIN, {ownTokenAccounts: new Set([MAIN_TA])});
    expect(r).toMatchObject({kind: 'unknown', incomplete: true, primary: null, deltas: []});
    // without the source list (opened from #21 or a deep link) the entry is simply not this account's
    expect(classify(tx, MAIN)).toMatchObject({kind: 'no-funds-moved', incomplete: false});
  });

  // A35b (review m1) — DERIVED from QAgzVzY6…: both token-balance arrays deleted; MAIN is no key, its token account is
  it('token balances missing for an owned token account named in the keys: incomplete, never "no funds moved"', () => {
    const tx = load('tx-test-to-main.json');
    delete tx.meta!.preTokenBalances;
    delete tx.meta!.postTokenBalances;
    expect(classify(tx, MAIN, {ownTokenAccounts: new Set([MAIN_TA])})).toMatchObject({kind: 'unknown', incomplete: true, primary: null});
  });

  // A35d (Task 2 re-review n2) — DERIVED from QAgzVzY6…: only ONE token-balance array is deleted (each in turn)
  it('one token-balance array missing for an owned token account named in the keys is incomplete too', () => {
    for (const side of ['preTokenBalances', 'postTokenBalances'] as const) {
      const tx = load('tx-test-to-main.json');
      delete tx.meta![side];
      expect(classify(tx, MAIN, {ownTokenAccounts: new Set([MAIN_TA])})).toMatchObject({incomplete: true});
    }
  });

  // A35e (Task 2 re-review n1, the negative control) — DERIVED from 2HWCCJQd… (a SOL send): both token-balance arrays
  // deleted. No owned token account is in its keys, so nothing is missing for this account: an old SOL send stays a send
  it('token balances missing where no owned token account is named: complete, and still a send', () => {
    const tx = load('tx-sol-transfer.json');
    delete tx.meta!.preTokenBalances;
    delete tx.meta!.postTokenBalances;
    expect(classify(tx, ACC_3, {ownTokenAccounts: new Set([MAIN_TA])})).toMatchObject({kind: 'sent', incomplete: false});
  });

  // A35c (review m1) — DERIVED from 2HWCCJQd…: `meta` is null; the account is a stranger to it
  it('a response without transaction metadata is incomplete for any account', () => {
    const tx = load('tx-sol-transfer.json');
    tx.meta = null;
    expect(classify(tx, MAIN)).toMatchObject({kind: 'unknown', incomplete: true, deltas: []});
  });

  // A36 — DERIVED from QAgzVzY6…: the sender's entries lose their `decimals`
  it('an entry of the account with unknown decimals sets incomplete and shows no figure', () => {
    const tx = load('tx-test-to-main.json');
    delete tx.meta!.preTokenBalances![0]!.uiTokenAmount!.decimals;
    delete tx.meta!.postTokenBalances![0]!.uiTokenAmount!.decimals;
    expect(classify(tx, ACC_2)).toMatchObject({kind: 'unknown', incomplete: true, primary: null});
  });

  // A37 — DERIVED from pXiTRFpg… (own ATA): a second, owner-less entry of one of the account's token accounts is added
  it('an incomplete row is never "account setup"', () => {
    const tx = load('tx-ata-own-pXiTRFpg.json');
    tx.meta!.postTokenBalances!.push({accountIndex: 4, mint: 'M', uiTokenAmount: {amount: '1', decimals: 6}});
    const mintKey = '6rRptDJnoTGfZzCpFqERAkNt6kCjXzTJcdwtCPYppump'; // account key 4 of this transaction
    const r = classify(tx, ATA_OWNER, {...MAINNET, ownTokenAccounts: new Set([mintKey])});
    expect(r).toMatchObject({kind: 'unknown', incomplete: true});
  });

  // A38 — DERIVED from QAgzVzY6…: `uiAmount` is made wrong on purpose
  it('amounts come from `uiTokenAmount.amount`, never from `uiAmount`', () => {
    const tx = load('tx-test-to-main.json');
    for (const b of [...tx.meta!.preTokenBalances!, ...tx.meta!.postTokenBalances!]) {
      (b.uiTokenAmount as {uiAmount?: number}).uiAmount = 123456;
    }
    expect(deltas(classify(tx, MAIN))).toEqual(['moved:TEST:200000']);
  });
});

describe('amounts at the edges (Review Focus 2)', () => {
  // A40 — DERIVED from QAgzVzY6…: main's token entry goes from 0 to the largest u64
  it('a token amount above 2^53 is exact: it is read as a string into BigInt, never through a float', () => {
    const tx = load('tx-test-to-main.json');
    tx.meta!.preTokenBalances![1]!.uiTokenAmount!.amount = '0';
    tx.meta!.postTokenBalances![1]!.uiTokenAmount!.amount = '18446744073709551615';
    const r = classify(tx, MAIN);
    expect(r.primary).toMatchObject({raw: 18446744073709551615n, decimals: 9});
    expect(r.kind).toBe('received');
  });

  // A41 — DERIVED from 2HWCCJQd…: the recipient's post balance is 2^60 lamports (not a safe integer in JSON)
  it("lamports the JSON can no longer hold exactly are not a balance: incomplete, never a figure and never \"no funds moved\"", () => {
    const tx = load('tx-sol-transfer.json');
    tx.meta!.postBalances![1] = 2 ** 60;
    const r = classify(tx, OUTSIDE);
    expect(r).toMatchObject({incomplete: true, kind: 'unknown', primary: null});
  });

  // A42 — DERIVED from 2HWCCJQd…: the balance arrays are missing
  it('a response without lamport balances: incomplete for an account that is in it', () => {
    const tx = load('tx-sol-transfer.json');
    delete tx.meta!.preBalances;
    delete tx.meta!.postBalances;
    expect(classify(tx, ACC_3)).toMatchObject({incomplete: true, kind: 'unknown', primary: null});
    // an account that is not in the transaction has nothing unread
    expect(classify(tx, MAIN)).toMatchObject({incomplete: false, kind: 'no-funds-moved'});
  });
});

describe('the response as web3.js hands it over', () => {
  // A39 — DERIVED from 3d31ATap…: every account key, program id and instruction account is a PublicKey-like object
  it('keys, program ids and instruction accounts that are objects with toString() are read like strings', () => {
    const key = (s: unknown): unknown => (typeof s === 'string' ? {toString: () => s} : s);
    const wrapIx = (ix: RawInstruction): RawInstruction => ({...ix, programId: key(ix.programId), ...(ix.accounts ? {accounts: ix.accounts.map(key)} : {})});
    const tx = clone(load('tx-deposit-3d31ATap.json'));
    const message = tx.transaction!.message!;
    message.accountKeys = message.accountKeys!.map(k => ({...k, pubkey: key(k.pubkey)}));
    message.instructions = (message.instructions as RawInstruction[]).map(wrapIx);
    tx.meta!.innerInstructions = tx.meta!.innerInstructions!.map(g => ({...g, instructions: g.instructions!.map(wrapIx)}));
    const r = classify(tx, MAIN);
    expect(r.kind).toBe('made-private');
    expect(deltas(r)).toEqual(['moved:TEST:-100000', 'rent:SOL:-695960']);
  });
});

describe('version 1 transactions (spec §3.3, owner decision 2026-11-27)', () => {
  const V1_SOL = 'tx-v1-sol-transfer-4kMGkJzt.json';
  const V1_SWAP = 'tx-v1-jupiter-token-to-sol-2D2esRV1.json';

  // A43 — a pin: the two files ARE version 1, in the shape the node serves it
  it('the two fixtures are version 1: a `transactionConfig` in the message, and no compute-budget instruction', () => {
    for (const file of [V1_SOL, V1_SWAP]) {
      const tx = load(file);
      expect(tx.version).toBe(1);
      expect(tx.transaction!.message!.transactionConfig).toMatchObject({computeUnitLimit: expect.any(Number)});
      const programs = (tx.transaction!.message!.instructions as RawInstruction[]).map(ix => String(ix.programId));
      expect(programs).not.toContain('ComputeBudget111111111111111111111111111111');
    }
  });

  // A44
  it('a version-1 SOL transfer (4kMGkJzt…): Sent for the sender — the fee is not part of the amount', () => {
    const r = classify(V1_SOL, V1_SENDER, MAINNET);
    expect(r).toMatchObject({kind: 'sent', counterparty: V1_RECIPIENT, feePaidByAccount: 5000n, extraAssets: 0, incomplete: false, via: null});
    expect(deltas(r)).toEqual(['moved:SOL:-202400']); // post − pre is −207400: the 5000 fee is apart
    expect(r).toMatchObject({signature: '4kMGkJztTKPgSzvaNTJYaEY3D2SzXDXGTLTvkQhJ26zkAgC1cuFNo4oE5QwqL9Hyx6KAM5fKKoSkDe3nPf4rNyBn', slot: 474305397});
  });

  // A45
  it('the same transfer is Received for the recipient, from the sender', () => {
    const r = classify(V1_SOL, V1_RECIPIENT, MAINNET);
    expect(r).toMatchObject({kind: 'received', counterparty: V1_SENDER, feePaidByAccount: null, incomplete: false});
    expect(deltas(r)).toEqual(['moved:SOL:202400']);
  });

  // A46
  it('a version-1 Jupiter v6 swap, token → SOL (2D2esRV1…): the outgoing leg first, the SOL received, via Jupiter', () => {
    const r = classify(V1_SWAP, V1_SELLER, MAINNET);
    expect(r).toMatchObject({kind: 'swap', via: 'Jupiter', counterparty: null, feePaidByAccount: 12127n, extraAssets: 0, incomplete: false});
    // SOL: post 2843155983 − pre 2633609484 + the 12127 fee
    expect(deltas(r)).toEqual(['moved:short(4mKf):-1199362376042', 'moved:SOL:209558626']);
    expect(r.primary).toMatchObject({mint: '4mKfxSWjz58mL1juoUwmyPXTuC21UYZMCMx42reEC6ZB', decimals: 6});
  });

  // A47 — DERIVED from each: `transactionConfig` removed and `version` set to 0
  it('`transactionConfig` and `version` are never read: the row is the same without them', () => {
    for (const [file, account] of [
      [V1_SOL, V1_SENDER],
      [V1_SOL, V1_RECIPIENT],
      [V1_SWAP, V1_SELLER],
    ] as const) {
      const tx = load(file);
      delete tx.transaction!.message!.transactionConfig;
      tx.version = 0;
      expect(classify(tx, account, MAINNET)).toEqual(classify(file, account, MAINNET));
    }
  });
});
