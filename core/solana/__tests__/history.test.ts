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

  it('a failed transaction with no transfer the owner signed is "other", failed, with its fee', () => {
    const e = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OWNER, OTHER], pre: [1_000_000, 0], post: [995_000, 0], err: {InstructionError: [0, 'Custom']}}));
    expect(e).toMatchObject({kind: 'other', failed: true, feeLamports: 5000n, amount: null, token: null});
  });

  // Plan 3, owner question 1 (option A): a failed send reads as what it tried to send — from its instructions.
  describe('a failed send: what it tried to send, from its own instructions (plan 3)', () => {
    const ERR = {InstructionError: [0, {Custom: 1}]};
    const failedKeys = {pre: [1_000_000, 0, 0, 1], post: [995_000, 0, 0, 1], err: ERR};

    it('a System transfer signed by the owner: sent SOL, the attempted amount and recipient, failed (the Noctura fee transfer left out)', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM],
        instructions: [sysTransfer(OWNER, OTHER, 2_480_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
      }));
      expect(e).toEqual({signature: 'sig', blockTime: 1_700_000_000, kind: 'sent', token: 'SOL', mint: null, amount: 2_480_000_000n, counterparty: OTHER, feeLamports: 5000n, failed: true});
    });

    it('an SPL TransferChecked: the token by its mint, the recipient wallet from the destination’s balance entry', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, 'SrcAta111', 'DestAta111', SYSTEM],
        instructions: [{program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OWNER, mint: NOC, tokenAmount: {amount: '2000', decimals: 9}}}}],
        preToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
        postToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
      }));
      expect(e).toMatchObject({kind: 'sent', token: 'NOC', mint: NOC, amount: 2000n, counterparty: OTHER, failed: true});
    });

    it('an SPL Transfer to an account created in the same transaction: the mint from the source entry, the wallet from the create', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, 'SrcAta111', 'NewAta111', SYSTEM],
        instructions: [
          {program: 'spl-associated-token-account', parsed: {type: 'createIdempotent', info: {account: 'NewAta111', wallet: OTHER, mint: USDC, source: OWNER}}},
          {program: 'spl-token', parsed: {type: 'transfer', info: {source: 'SrcAta111', destination: 'NewAta111', authority: OWNER, amount: '12000000'}}},
        ],
        preToken: [tb(1, USDC, OWNER, '50000000')],
        postToken: [tb(1, USDC, OWNER, '50000000')],
      }));
      expect(e).toMatchObject({kind: 'sent', token: 'USDC', mint: USDC, amount: 12_000_000n, counterparty: OTHER, failed: true});
    });

    it('a failed transaction the owner did not pay for, one whose transfer has another authority, or one whose only transfer is the Noctura fee, stays "other" (negative controls)', () => {
      const notSigned = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OTHER, OWNER, SYSTEM, MAINNET_FEE_TREASURY], instructions: [sysTransfer(OTHER, OWNER, 1_000)]}));
      expect(notSigned).toMatchObject({kind: 'other', failed: true, amount: null});
      const someoneElses = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, SYSTEM, MAINNET_FEE_TREASURY], instructions: [sysTransfer(OTHER, OWNER, 1_000)]}));
      expect(someoneElses).toMatchObject({kind: 'other', failed: true});
      const feeOnly = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, MAINNET_FEE_TREASURY, SYSTEM, OTHER], instructions: [sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)]}));
      expect(feeOnly).toMatchObject({kind: 'other', failed: true});
      const otherAuthority = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, 'SrcAta111', 'DestAta111', SYSTEM],
        instructions: [{program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OTHER, mint: NOC, tokenAmount: {amount: '2000', decimals: 9}}}}],
      }));
      expect(otherAuthority).toMatchObject({kind: 'other', failed: true});
    });

    // Fable's H1 (plan-3 review, binding): `sent` only when this account paid (the first key), the transaction carries
    // exactly ONE top-level transfer from it, and that transfer is of a mint the wallet knows. Each case that breaks one
    // condition is its own test, each killed by its own mutation (task-4 report). The full `other` shape is asserted:
    // #27's [Try again] proposes token, amount and counterparty, so none of them may survive on an `other`.
    const OTHER_SHAPE = {kind: 'other', failed: true, token: null, mint: null, amount: null, counterparty: null};
    const nocChecked = (authority: string) => ({program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority, mint: NOC, tokenAmount: {amount: '2000', decimals: 9}}}});

    it('a non-owner payer: signed as the token authority, but another account paid (its first key), stays "other"', () => {
      // The owner paid no fee, so it is not the owner's failed send.
      const relayed = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OTHER, OWNER, 'SrcAta111', 'DestAta111'],
        instructions: [nocChecked(OWNER)],
        preToken: [tb(2, NOC, OWNER, '5000'), tb(3, NOC, OTHER, '0')],
        postToken: [tb(2, NOC, OWNER, '5000'), tb(3, NOC, OTHER, '0')],
      }));
      expect(relayed).toMatchObject(OTHER_SHAPE);
      // Positive control: the same transaction with the owner as the first key is its failed send.
      const own = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, OTHER, 'SrcAta111', 'DestAta111'],
        instructions: [nocChecked(OWNER)],
        preToken: [tb(2, NOC, OWNER, '5000'), tb(3, NOC, OTHER, '0')],
        postToken: [tb(2, NOC, OWNER, '5000'), tb(3, NOC, OTHER, '0')],
      }));
      expect(own).toMatchObject({kind: 'sent', token: 'NOC', amount: 2000n, counterparty: OTHER, failed: true});
    });

    // Plan-3 review H1: #27's [Try again] proposes what was decoded, so a batch is never summed into one send.
    it('two System transfers from the owner (1 SOL to A and 1 SOL to B) stay "other" — never "2 SOL to A", never "1 SOL to A"', () => {
      const twoSol = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, OTHER, 'Second1111', SYSTEM],
        instructions: [sysTransfer(OWNER, OTHER, 1_000_000_000), sysTransfer(OWNER, 'Second1111', 1_000_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
      }));
      expect(twoSol).toMatchObject(OTHER_SHAPE);
    });

    it('a token transfer plus a SOL transfer from the owner stays "other"', () => {
      const tokenAndSol = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, 'SrcAta111', 'DestAta111', OTHER],
        instructions: [nocChecked(OWNER), sysTransfer(OWNER, OTHER, 1_000_000)],
        preToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
        postToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
      }));
      expect(tokenAndSol).toMatchObject(OTHER_SHAPE);
    });

    it('one transfer of a mint the wallet does not know stays "other" — from the instruction’s mint or from the source’s balance entry', () => {
      const UNKNOWN = 'UnknownMint1111111111111111111111111111111';
      const checked = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, 'SrcAta111', 'DestAta111', SYSTEM],
        instructions: [{program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OWNER, mint: UNKNOWN, tokenAmount: {amount: '2000', decimals: 9}}}}],
      }));
      expect(checked).toMatchObject(OTHER_SHAPE);
      const plain = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, 'SrcAta111', 'DestAta111', SYSTEM],
        instructions: [{program: 'spl-token', parsed: {type: 'transfer', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OWNER, amount: '2000'}}}],
        preToken: [tb(1, UNKNOWN, OWNER, '5000'), tb(2, UNKNOWN, OTHER, '0')],
        postToken: [tb(1, UNKNOWN, OWNER, '5000'), tb(2, UNKNOWN, OTHER, '0')],
      }));
      expect(plain).toMatchObject(OTHER_SHAPE);
    });

    it('a transfer a program made for the owner (an inner, CPI instruction) is not read: "other" — the honest limit of option A', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', {
        ...tx({...failedKeys, keys: [OWNER, OTHER, 'DappProg1111', SYSTEM], instructions: [{programId: 'DappProg1111', accounts: [OWNER, OTHER], data: '3Bxs'}]}),
        meta: {
          err: ERR, fee: 5000, preBalances: failedKeys.pre, postBalances: failedKeys.post, preTokenBalances: [], postTokenBalances: [],
          innerInstructions: [{index: 0, instructions: [sysTransfer(OWNER, OTHER, 1_000_000)]}],
        },
      });
      expect(e).toMatchObject(OTHER_SHAPE);
    });
  });

  it('never throws on a malformed answer', () => {
    for (const bad of [null, 42, {meta: 'x'}, {transaction: {message: {accountKeys: 'x'}}}]) {
      expect(decodeHistoryEntry(OWNER, 'sig', bad)).toMatchObject({kind: 'other', amount: null, feeLamports: 0n});
    }
  });
});
