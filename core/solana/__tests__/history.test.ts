import {decodeHistoryEntry} from '../history';
import {WALLET_TOKENS} from '../balances';
import {MAINNET_PROGRAM_ID} from '../../presale/addresses';
import {MAINNET_FEE_TREASURY} from '../../fees/transferMarkup';

const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const OTHER = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const SYSTEM = '11111111111111111111111111111111';
const NOC = WALLET_TOKENS.NOC.mint as string;
const USDC = WALLET_TOKENS.USDC.mint as string;
const USDT = WALLET_TOKENS.USDT.mint as string;

interface TxShape {
  keys: string[];
  pre: number[];
  post: number[];
  fee?: number;
  err?: unknown;
  instructions?: unknown[];
  preToken?: unknown[];
  postToken?: unknown[];
}
/** A getTransaction(jsonParsed) result with just the fields the decoder reads. */
function tx(p: TxShape) {
  return {
    blockTime: 1_700_000_000,
    meta: {err: p.err ?? null, fee: p.fee ?? 5000, preBalances: p.pre, postBalances: p.post, preTokenBalances: p.preToken ?? [], postTokenBalances: p.postToken ?? []},
    transaction: {message: {accountKeys: p.keys.map(k => ({pubkey: k, signer: false, writable: true})), instructions: p.instructions ?? []}},
  };
}
const sysTransfer = (source: string, destination: string, lamports: number) => ({program: 'system', programId: SYSTEM, parsed: {type: 'transfer', info: {source, destination, lamports}}});
const tb = (accountIndex: number, mint: string, owner: string, amount: string) => ({accountIndex, mint, owner, uiTokenAmount: {amount, decimals: 9}});

describe('decodeHistoryEntry', () => {
  it('a SOL send: the recipient amount, not the markup or the fee, and the recipient as counterparty', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({
      keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM],
      pre: [10_000_000, 0, 0, 1],
      post: [10_000_000 - 1_000_000 - 20_000 - 5000, 1_000_000, 20_000, 1],
      instructions: [sysTransfer(OWNER, OTHER, 1_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
    }));
    expect(e).toEqual({
      signature: 'sig', blockTime: 1_700_000_000, kind: 'sent', token: 'SOL', mint: null, amount: 1_000_000n, counterparty: OTHER, feeLamports: 5000n, failed: false,
    });
  });

  it('a SOL send with unparsed instructions: the balance change without the fee the owner paid', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OWNER, OTHER], pre: [10_000_000, 0], post: [8_995_000, 1_000_000], instructions: [{programId: SYSTEM}]}));
    expect(e).toMatchObject({kind: 'sent', token: 'SOL', amount: 1_000_000n, counterparty: null});
  });

  it('SOL received: no fee adjustment when the owner did not pay it', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OTHER, OWNER], pre: [5_000_000, 0], post: [2_995_000, 2_000_000], instructions: [sysTransfer(OTHER, OWNER, 2_000_000)]}));
    expect(e).toMatchObject({kind: 'received', token: 'SOL', amount: 2_000_000n, counterparty: OTHER});
  });

  it('NOC sent from a non-canonical holding account: token balances by owner, the other owner as counterparty', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({
      keys: [OWNER, 'Holding111', 'DestAta111'],
      pre: [1_000_000, 2_039_280, 2_039_280],
      post: [995_000, 2_039_280, 2_039_280],
      preToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
      postToken: [tb(1, NOC, OWNER, '3000'), tb(2, NOC, OTHER, '2000')],
    }));
    expect(e).toMatchObject({kind: 'sent', token: 'NOC', mint: NOC, amount: 2000n, counterparty: OTHER});
  });

  it('USDC received into a token account the owner did not have before', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({
      keys: [OTHER, 'SrcAta111', 'NewAta111'],
      pre: [9_000_000, 2_039_280, 0],
      post: [6_955_720, 2_039_280, 2_039_280],
      preToken: [tb(1, USDC, OTHER, '100')],
      postToken: [tb(1, USDC, OTHER, '40'), tb(2, USDC, OWNER, '60')],
    }));
    expect(e).toMatchObject({kind: 'received', token: 'USDC', amount: 60n, counterparty: OTHER});
  });

  it('a presale purchase with SOL, and one with USDT', () => {
    const sol = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OWNER, MAINNET_PROGRAM_ID], pre: [10_000_000, 1], post: [7_995_000, 1], instructions: [{programId: MAINNET_PROGRAM_ID}]}));
    expect(sol).toMatchObject({kind: 'purchase', token: 'SOL', amount: 2_000_000n});
    const usdt = decodeHistoryEntry(OWNER, 'sig', tx({
      keys: [OWNER, 'UsdtAta111', MAINNET_PROGRAM_ID],
      pre: [10_000_000, 2_039_280, 1],
      post: [9_995_000, 2_039_280, 1],
      instructions: [{programId: MAINNET_PROGRAM_ID}],
      preToken: [tb(1, USDT, OWNER, '50000000')],
      postToken: [tb(1, USDT, OWNER, '25000000')],
    }));
    expect(usdt).toMatchObject({kind: 'purchase', token: 'USDT', amount: 25_000_000n});
  });

  it('a failed transaction is "other", failed, with its fee', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OWNER, OTHER], pre: [1_000_000, 0], post: [995_000, 0], err: {InstructionError: [0, 'Custom']}}));
    expect(e).toMatchObject({kind: 'other', failed: true, feeLamports: 5000n, amount: null});
  });

  it('never throws on a malformed answer', () => {
    for (const bad of [null, 42, {meta: 'x'}, {transaction: {message: {accountKeys: 'x'}}}]) {
      expect(decodeHistoryEntry(OWNER, 'sig', bad)).toMatchObject({kind: 'other', amount: null, feeLamports: 0n});
    }
  });
});
