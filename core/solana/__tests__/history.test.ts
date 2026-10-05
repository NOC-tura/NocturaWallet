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
    // Valid base58 keys (32 bytes each). OTHER_USDC_ATA is OTHER's associated token account for USDC, derived
    // offline with web3.js findProgramAddressSync([OTHER, Tokenkeg…, USDC], ATokenGP…) — a fixed value, so the
    // decoder's own derivation is checked against it, not against itself.
    const SRC = 'k7FaK87WHGVXzkaoHb7CdVPgkKDQhZ29VLDeBVbDfYn';
    const DEST = 'p2Yicb86aZig616Eav2VWG9vuXR5mEqhtzshZYBxzsV';
    const SECOND = 'swqrv48gsrwpBFbftEwnP2vB4jckpvfGJfXkwaniLCC';
    const NOT_AN_ATA = 'ws91DX9HBAAxGW77BZs5FogRDwpRtcUpiLBpKdPTfWu';
    const OTHER_USDC_ATA = '67fjBLfyeJ9WHFMFn3ixT5bdBpjtT5vRiqv3WRVXJd4Q';
    const OWNER_WSOL_ATA = 'CJoNbVgQcSsTHuTza6CSYoSuojo2vDMN3mxzM1GcTPSF';
    const UNKNOWN = 'UnknownMint1111111111111111111111111111111';
    const WSOL = 'So11111111111111111111111111111111111111112';
    const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
    const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
    const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';
    const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
    const JITO_TIP = '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5';

    const splChecked = (authority: string, o: {programId?: string; mint?: string; amount?: string; source?: string; destination?: string} = {}) => ({
      program: 'spl-token', programId: o.programId ?? TOKEN_PROGRAM,
      parsed: {type: 'transferChecked', info: {source: o.source ?? SRC, destination: o.destination ?? DEST, authority, mint: o.mint ?? NOC, tokenAmount: {amount: o.amount ?? '2000', decimals: 9}}},
    });
    const splTransfer = (authority: string, o: {amount?: string; destination?: string} = {}) => ({
      program: 'spl-token', programId: TOKEN_PROGRAM, parsed: {type: 'transfer', info: {source: SRC, destination: o.destination ?? DEST, authority, amount: o.amount ?? '2000'}},
    });
    const ataCreate = (account: string, wallet: string, mint: string) => ({
      program: 'spl-associated-token-account', programId: ATA_PROGRAM, parsed: {type: 'createIdempotent', info: {account, wallet, mint, source: OWNER, systemProgram: SYSTEM, tokenProgram: TOKEN_PROGRAM}},
    });
    const unparsed = (programId: string) => ({programId, accounts: [OWNER], data: '3Bxs4h24hBtQy9rw', stackHeight: null});
    /** A NOC source account (index 1) the owner holds, and a NOC destination (index 2) OTHER holds. */
    const nocBalances = {preToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')], postToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')]};
    const splKeys = [OWNER, SRC, DEST, SYSTEM];
    // Fable's H1 and fix round 1: the full `other` shape is asserted — #27's [Try again] proposes token, amount and
    // counterparty, so none of them may survive on an `other`.
    const OTHER_SHAPE = {kind: 'other', failed: true, token: null, mint: null, amount: null, counterparty: null};

    it('a System transfer signed by the owner: sent SOL, the attempted amount and recipient, failed (the Noctura fee transfer left out)', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM],
        instructions: [sysTransfer(OWNER, OTHER, 2_480_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
      }));
      expect(e).toEqual({signature: 'sig', blockTime: 1_700_000_000, kind: 'sent', token: 'SOL', mint: null, amount: 2_480_000_000n, counterparty: OTHER, feeLamports: 5000n, failed: true});
    });

    it('an SPL TransferChecked: the token by its mint, the recipient wallet from the destination’s balance entry', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splChecked(OWNER)], ...nocBalances}));
      expect(e).toMatchObject({kind: 'sent', token: 'NOC', mint: NOC, amount: 2000n, counterparty: OTHER, failed: true});
    });

    it('an SPL Transfer to an account created in the same transaction: the mint from the source entry, the wallet from the create (its derived ATA)', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, SRC, OTHER_USDC_ATA, SYSTEM],
        instructions: [ataCreate(OTHER_USDC_ATA, OTHER, USDC), splTransfer(OWNER, {amount: '12000000', destination: OTHER_USDC_ATA})],
        preToken: [tb(1, USDC, OWNER, '50000000')],
        postToken: [tb(1, USDC, OWNER, '50000000')],
      }));
      expect(e).toMatchObject({kind: 'sent', token: 'USDC', mint: USDC, amount: 12_000_000n, counterparty: OTHER, failed: true});
    });

    // Fix round 1, M3: the create's wallet names the recipient only when the destination IS that wallet's ATA.
    it('a create whose account is not the wallet’s derived ATA for the mint: still the send, but the recipient unknown (null)', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, SRC, NOT_AN_ATA, SYSTEM],
        instructions: [ataCreate(NOT_AN_ATA, OTHER, USDC), splTransfer(OWNER, {amount: '12000000', destination: NOT_AN_ATA})],
        preToken: [tb(1, USDC, OWNER, '50000000')],
        postToken: [tb(1, USDC, OWNER, '50000000')],
      }));
      expect(e).toMatchObject({kind: 'sent', token: 'USDC', amount: 12_000_000n, counterparty: null, failed: true});
      // OTHER's ATA for a different mint (USDC's ATA, a NOC transfer) is not the derived ATA either.
      const wrongMint = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, SRC, OTHER_USDC_ATA, SYSTEM],
        instructions: [ataCreate(OTHER_USDC_ATA, OTHER, NOC), splChecked(OWNER, {destination: OTHER_USDC_ATA})],
        preToken: [tb(1, NOC, OWNER, '5000')],
        postToken: [tb(1, NOC, OWNER, '5000')],
      }));
      expect(wrongMint).toMatchObject({kind: 'sent', token: 'NOC', counterparty: null});
    });

    it('an ATA create for an account that is not the transfer’s destination, or beside a SOL transfer, stays "other"', () => {
      const elsewhere = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [ataCreate(OTHER_USDC_ATA, OTHER, USDC), splChecked(OWNER)], ...nocBalances}));
      expect(elsewhere).toMatchObject(OTHER_SHAPE);
      const besideSol = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, OTHER_USDC_ATA, SYSTEM], instructions: [ataCreate(OTHER, OTHER, USDC), sysTransfer(OWNER, OTHER, 1_000_000)]}));
      expect(besideSol).toMatchObject(OTHER_SHAPE);
    });

    it('a failed transaction the owner did not pay for, one whose transfer has another authority, or one whose only transfer is the Noctura fee, stays "other" (negative controls)', () => {
      const notSigned = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OTHER, OWNER, SYSTEM, MAINNET_FEE_TREASURY], instructions: [sysTransfer(OTHER, OWNER, 1_000)]}));
      expect(notSigned).toMatchObject(OTHER_SHAPE);
      const someoneElses = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, SYSTEM, MAINNET_FEE_TREASURY], instructions: [sysTransfer(OTHER, OWNER, 1_000)]}));
      expect(someoneElses).toMatchObject(OTHER_SHAPE);
      const feeOnly = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, MAINNET_FEE_TREASURY, SYSTEM, OTHER], instructions: [sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)]}));
      expect(feeOnly).toMatchObject(OTHER_SHAPE);
      const otherAuthority = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splChecked(OTHER)], ...nocBalances}));
      expect(otherAuthority).toMatchObject(OTHER_SHAPE);
    });

    it('a non-owner payer: signed as the token authority, but another account paid (its first key), stays "other"', () => {
      // The owner paid no fee, so it is not the owner's failed send.
      const balances = {preToken: [tb(2, NOC, OWNER, '5000'), tb(3, NOC, OTHER, '0')], postToken: [tb(2, NOC, OWNER, '5000'), tb(3, NOC, OTHER, '0')]};
      const relayed = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OTHER, OWNER, SRC, DEST], instructions: [splChecked(OWNER)], ...balances}));
      expect(relayed).toMatchObject(OTHER_SHAPE);
      // Positive control: the same transaction with the owner as the first key is its failed send.
      const own = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, SRC, DEST], instructions: [splChecked(OWNER)], ...balances}));
      expect(own).toMatchObject({kind: 'sent', token: 'NOC', amount: 2000n, counterparty: OTHER, failed: true});
    });

    // Plan-3 review H1: #27's [Try again] proposes what was decoded, so a batch is never summed into one send.
    it('two System transfers from the owner (1 SOL to A and 1 SOL to B) stay "other" — never "2 SOL to A", never "1 SOL to A"', () => {
      const twoSol = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, OTHER, SECOND, SYSTEM],
        instructions: [sysTransfer(OWNER, OTHER, 1_000_000_000), sysTransfer(OWNER, SECOND, 1_000_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
      }));
      expect(twoSol).toMatchObject(OTHER_SHAPE);
    });

    it('a token transfer plus a SOL transfer from the owner stays "other"', () => {
      const tokenAndSol = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, SRC, DEST, OTHER], instructions: [splChecked(OWNER), sysTransfer(OWNER, OTHER, 1_000_000)], ...nocBalances}));
      expect(tokenAndSol).toMatchObject(OTHER_SHAPE);
    });

    it('one transfer of a mint the wallet does not know stays "other" — from the instruction’s mint or from the source’s balance entry', () => {
      const unknownBalances = {preToken: [tb(1, UNKNOWN, OWNER, '5000'), tb(2, UNKNOWN, OTHER, '0')], postToken: [tb(1, UNKNOWN, OWNER, '5000'), tb(2, UNKNOWN, OTHER, '0')]};
      const checked = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splChecked(OWNER, {mint: UNKNOWN})], ...unknownBalances}));
      expect(checked).toMatchObject(OTHER_SHAPE);
      const plain = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splTransfer(OWNER)], ...unknownBalances}));
      expect(plain).toMatchObject(OTHER_SHAPE);
    });

    it('a TransferChecked whose mint disagrees with its source account’s stays "other"', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splChecked(OWNER, {mint: USDC})], ...nocBalances}));
      expect(e).toMatchObject(OTHER_SHAPE);
    });

    it('a transfer a program made for the owner (an inner, CPI instruction) is not read: "other" — the honest limit of option A', () => {
      const withInner = (instructions: unknown[]) => ({
        ...tx({...failedKeys, keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM], instructions}),
        meta: {
          err: ERR, fee: 5000, preBalances: failedKeys.pre, postBalances: failedKeys.post, preTokenBalances: [], postTokenBalances: [],
          innerInstructions: [{index: 0, instructions: [sysTransfer(OWNER, OTHER, 1_000_000)]}],
        },
      });
      // A dApp call that transfers inside.
      expect(decodeHistoryEntry(OWNER, 'sig', withInner([unparsed('DappProg1111111111111111111111111111111111')]))).toMatchObject(OTHER_SHAPE);
      // Only allowlisted top-level instructions, the transfer only in the inner list: still not read.
      expect(decodeHistoryEntry(OWNER, 'sig', withInner([unparsed(COMPUTE_BUDGET), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)]))).toMatchObject(OTHER_SHAPE);
    });

    // Fix round 1, I1: "exactly one transfer" counted transfers, not what the transaction did. A failed send is
    // decoded only for a PURE send — every top-level instruction on the allowlist.
    it('a Jupiter swap with a Jito tip (one System transfer beside it) stays "other"', () => {
      // The swap alone is what makes it a dApp transaction: no other rule catches this one (mutation F1).
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, OWNER_WSOL_ATA, JITO_TIP, SYSTEM],
        instructions: [unparsed(COMPUTE_BUDGET), unparsed(COMPUTE_BUDGET), unparsed(JUPITER), sysTransfer(OWNER, JITO_TIP, 10_000)],
      }));
      expect(e).toMatchObject(OTHER_SHAPE);
      // The same with the wSOL account created first.
      const withCreate = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, OWNER_WSOL_ATA, JITO_TIP, SYSTEM],
        instructions: [unparsed(COMPUTE_BUDGET), ataCreate(OWNER_WSOL_ATA, OWNER, WSOL), unparsed(JUPITER), sysTransfer(OWNER, JITO_TIP, 10_000)],
      }));
      expect(withCreate).toMatchObject(OTHER_SHAPE);
    });

    it('wrapping SOL then swapping stays "other"', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, OWNER_WSOL_ATA, JUPITER, SYSTEM],
        // The wSOL account already exists (no create): the wrap and the swap are what make it `other`.
        instructions: [
          sysTransfer(OWNER, OWNER_WSOL_ATA, 1_000_000_000),
          {program: 'spl-token', programId: TOKEN_PROGRAM, parsed: {type: 'syncNative', info: {account: OWNER_WSOL_ATA}}},
          unparsed(JUPITER),
        ],
      }));
      expect(e).toMatchObject(OTHER_SHAPE);
    });

    it('a System createAccount beside a transfer stays "other"', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, SECOND, OTHER, SYSTEM],
        instructions: [
          {program: 'system', programId: SYSTEM, parsed: {type: 'createAccount', info: {source: OWNER, newAccount: SECOND, lamports: 890_880, space: 0, owner: SYSTEM}}},
          sysTransfer(OWNER, OTHER, 1_000_000),
        ],
      }));
      expect(e).toMatchObject(OTHER_SHAPE);
    });

    // Positive controls for the allowlist: each companion beside the one transfer leaves it a send.
    const companions: [string, unknown][] = [
      ['a ComputeBudget instruction', unparsed(COMPUTE_BUDGET)],
      ['a Memo (v2)', {program: 'spl-memo', programId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', parsed: 'invoice 42', stackHeight: null}],
      ['a Memo (v1)', {program: 'spl-memo', programId: 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo', parsed: 'invoice 42', stackHeight: null}],
      ['a System advanceNonce', {program: 'system', programId: SYSTEM, parsed: {type: 'advanceNonce', info: {nonceAccount: SECOND, nonceAuthority: OWNER, recentBlockhashesSysvar: 'SysvarRecentB1ockHashes11111111111111111111'}}}],
      ['the Noctura fee transfer to the treasury', sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
    ];
    it.each(companions)('%s beside the one transfer: still the send (allowlist positive control)', (_name, companion) => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM], instructions: [companion, sysTransfer(OWNER, OTHER, 1_000_000)]}));
      expect(e).toMatchObject({kind: 'sent', token: 'SOL', amount: 1_000_000n, counterparty: OTHER, failed: true});
    });

    it('every companion together, the ATA create for the destination included: still the send', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, SRC, OTHER_USDC_ATA, MAINNET_FEE_TREASURY],
        instructions: [...companions.map(([, c]) => c), ataCreate(OTHER_USDC_ATA, OTHER, USDC), splTransfer(OWNER, {amount: '12000000', destination: OTHER_USDC_ATA})],
        preToken: [tb(1, USDC, OWNER, '50000000')],
        postToken: [tb(1, USDC, OWNER, '50000000')],
      }));
      expect(e).toMatchObject({kind: 'sent', token: 'USDC', amount: 12_000_000n, counterparty: OTHER, failed: true});
    });

    // Fix round 1 follow-up: the send flow builds one fee transfer; two make it something else. The amount is not
    // pinned (it follows the fee policy of its day).
    it('two transfers to the Noctura treasury beside the one transfer stay "other"; one, of any amount, is the send', () => {
      const keys = [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM];
      const two = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys, instructions: [sysTransfer(OWNER, OTHER, 1_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)]}));
      expect(two).toMatchObject(OTHER_SHAPE);
      const one = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys, instructions: [sysTransfer(OWNER, OTHER, 1_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 123_456_789)]}));
      expect(one).toMatchObject({kind: 'sent', token: 'SOL', amount: 1_000_000n, counterparty: OTHER, failed: true});
    });

    // On purpose: every transfer to the treasury is read as the fee, so a deliberate send there is `other`.
    it('a deliberate send to the treasury address alone stays "other" (by design)', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, MAINNET_FEE_TREASURY, SYSTEM, OTHER], instructions: [sysTransfer(OWNER, MAINNET_FEE_TREASURY, 5_000_000_000)]}));
      expect(e).toMatchObject(OTHER_SHAPE);
    });

    // Fix round 1, M1: only the classic Token program; the wallet's mints are classic.
    it('a Token-2022 TransferChecked, even of the NOC mint, stays "other"', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splChecked(OWNER, {programId: TOKEN_2022})], ...nocBalances}));
      expect(e).toMatchObject(OTHER_SHAPE);
    });

    // Fix round 1, M2: the authority alone is not enough — a delegate may move someone else's tokens.
    it('a transfer the owner made as a delegate of another wallet’s account stays "other"', () => {
      const delegate = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: splKeys,
        instructions: [splChecked(OWNER)],
        preToken: [tb(1, NOC, SECOND, '5000'), tb(2, NOC, OTHER, '0')],
        postToken: [tb(1, NOC, SECOND, '5000'), tb(2, NOC, OTHER, '0')],
      }));
      expect(delegate).toMatchObject(OTHER_SHAPE);
      // A source with no balance entry has no known owner either.
      const unknownSource = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splChecked(OWNER)]}));
      expect(unknownSource).toMatchObject(OTHER_SHAPE);
    });

    // Fix round 1, M4: nothing to repeat in a zero transfer, and never a rounded amount.
    it('a zero transfer is not a send', () => {
      expect(decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM], instructions: [sysTransfer(OWNER, OTHER, 0)]}))).toMatchObject(OTHER_SHAPE);
      expect(decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splChecked(OWNER, {amount: '0'})], ...nocBalances}))).toMatchObject(OTHER_SHAPE);
    });

    it('lamports given as a JSON number above 2^53 are unreadable: "other", never a rounded amount; a token string reads exactly', () => {
      // 2^53 + 2 is representable, but not safe: JSON.parse may already have rounded whatever the node sent.
      const rounded = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM], instructions: [sysTransfer(OWNER, OTHER, 2 ** 53 + 2)]}));
      expect(rounded).toMatchObject(OTHER_SHAPE);
      // Positive control: the largest safe number reads exactly.
      const safe = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM], instructions: [sysTransfer(OWNER, OTHER, Number.MAX_SAFE_INTEGER)]}));
      expect(safe).toMatchObject({kind: 'sent', amount: 9_007_199_254_740_991n});
      // A token amount is a string: above 2^53 it still reads to the unit.
      const big = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: splKeys, instructions: [splChecked(OWNER, {amount: '9007199254740993'})], ...nocBalances}));
      expect(big).toMatchObject({kind: 'sent', token: 'NOC', amount: 9_007_199_254_740_993n});
    });

    // Review R1: a transferWithSeed is not decoded as a send — pinned.
    it('a System transferWithSeed stays "other"', () => {
      const e = decodeHistoryEntry(OWNER, 'sig', tx({
        ...failedKeys,
        keys: [OWNER, SECOND, OTHER, SYSTEM],
        instructions: [{program: 'system', programId: SYSTEM, parsed: {type: 'transferWithSeed', info: {source: SECOND, sourceBase: OWNER, sourceSeed: 'seed', sourceOwner: SYSTEM, destination: OTHER, lamports: 1_000_000}}}],
      }));
      expect(e).toMatchObject(OTHER_SHAPE);
    });
  });

  it('never throws on a malformed answer', () => {
    for (const bad of [null, 42, {meta: 'x'}, {transaction: {message: {accountKeys: 'x'}}}]) {
      expect(decodeHistoryEntry(OWNER, 'sig', bad)).toMatchObject({kind: 'other', amount: null, feeLamports: 0n});
    }
  });
});
