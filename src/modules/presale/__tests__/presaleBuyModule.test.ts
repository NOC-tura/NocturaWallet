import {PublicKey, SystemProgram} from '@solana/web3.js';
import {
  derivePresalePdas,
  buildSolPurchaseInstruction,
  estimateNocForSol,
  MIN_PURCHASE_USD,
  MAX_PURCHASE_USD,
} from '../presaleBuyModule';
import {PROGRAM_ID, ADMIN_ADDRESS, SOL_TREASURY, PYTH_SOL_USD_ACCOUNT} from '../../../constants/programs';

const USER = new PublicKey('KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr');
const PROGRAM = new PublicKey(PROGRAM_ID);

describe('derivePresalePdas', () => {
  it('derives config from ADMIN, user/allocation from the buyer, referrer from default', () => {
    const pdas = derivePresalePdas(USER);
    const [config] = PublicKey.findProgramAddressSync([Buffer.from('config'), new PublicKey(ADMIN_ADDRESS).toBytes()], PROGRAM);
    const [userAccount] = PublicKey.findProgramAddressSync([Buffer.from('user'), USER.toBytes()], PROGRAM);
    const [userAllocation] = PublicKey.findProgramAddressSync([Buffer.from('allocation'), USER.toBytes()], PROGRAM);
    const [referrer] = PublicKey.findProgramAddressSync([Buffer.from('allocation'), PublicKey.default.toBytes()], PROGRAM);
    expect(pdas.config.toBase58()).toBe(config.toBase58());
    expect(pdas.userAccount.toBase58()).toBe(userAccount.toBase58());
    expect(pdas.userAllocation.toBase58()).toBe(userAllocation.toBase58());
    expect(pdas.referrerAllocation.toBase58()).toBe(referrer.toBase58());
  });
});

describe('buildSolPurchaseInstruction', () => {
  it('encodes the discriminator + u64-LE lamports and orders the 8 accounts', () => {
    const lamports = 2_000_000_000n; // 2 SOL
    const ix = buildSolPurchaseInstruction(USER, lamports);
    // data: 8-byte discriminator + 8-byte u64 LE
    expect([...ix.data.subarray(0, 8)]).toEqual([161, 153, 65, 238, 160, 236, 43, 165]);
    // 2_000_000_000 = 0x7735_9400 → LE bytes
    expect([...ix.data.subarray(8, 16)]).toEqual([0x00, 0x94, 0x35, 0x77, 0x00, 0x00, 0x00, 0x00]);
    expect(ix.data.length).toBe(16);
    expect(ix.programId.toBase58()).toBe(PROGRAM_ID);
    const pdas = derivePresalePdas(USER);
    const expected = [
      [pdas.config.toBase58(), false, true],
      [pdas.userAccount.toBase58(), false, true],
      [pdas.userAllocation.toBase58(), false, true],
      [pdas.referrerAllocation.toBase58(), false, true],
      [PYTH_SOL_USD_ACCOUNT, false, false],
      [USER.toBase58(), true, true],
      [SOL_TREASURY, false, true],
      [SystemProgram.programId.toBase58(), false, false],
    ];
    expect(ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable])).toEqual(expected);
  });

  it('rejects a lamports value out of u64 range', () => {
    expect(() => buildSolPurchaseInstruction(USER, -1n)).toThrow();
    expect(() => buildSolPurchaseInstruction(USER, 2n ** 64n)).toThrow();
  });
});

describe('estimateNocForSol', () => {
  it('computes NOC = sol*usd/stagePrice', () => {
    expect(estimateNocForSol(2, 150, 0.1501)).toBeCloseTo(1998.667, 2);
    expect(estimateNocForSol(1, 150, 0)).toBe(0);
  });
  it('MIN_PURCHASE_USD is $10 and MAX_PURCHASE_USD is $50,000', () => {
    expect(MIN_PURCHASE_USD).toBe(10);
    expect(MAX_PURCHASE_USD).toBe(50_000);
  });
});

import {VersionedTransaction} from '@solana/web3.js';
import {buildSolPurchaseTx} from '../presaleBuyModule';
import * as connectionMod from '../../solana/connection';

describe('buildSolPurchaseTx', () => {
  it('builds a VersionedTransaction with the purchase instruction and the user as payer', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getLatestBlockhash: async () => ({blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1}),
    } as never);
    const tx = await buildSolPurchaseTx(USER, 2_000_000_000n);
    expect(tx).toBeInstanceOf(VersionedTransaction);
    // payer is the first static account key
    expect(tx.message.staticAccountKeys[0].toBase58()).toBe(USER.toBase58());
  });
});
