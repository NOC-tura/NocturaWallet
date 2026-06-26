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
    const {referrerAllocation} = derivePresalePdas(USER);
    const ix = buildSolPurchaseInstruction(USER, lamports, referrerAllocation);
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
    const {referrerAllocation} = derivePresalePdas(USER);
    expect(() => buildSolPurchaseInstruction(USER, -1n, referrerAllocation)).toThrow();
    expect(() => buildSolPurchaseInstruction(USER, 2n ** 64n, referrerAllocation)).toThrow();
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
import {useReferralCaptureStore as referralStoreForBuildTests} from '../../../store/zustand/referralCaptureStore';

describe('buildSolPurchaseTx', () => {
  it('builds a VersionedTransaction with the purchase instruction and the user as payer', async () => {
    referralStoreForBuildTests.getState().clearCapturedReferrer();
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getLatestBlockhash: async () => ({blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1}),
      // resolveReferrer (no captured referrer) reads the allocation account.
      getAccountInfo: async () => null,
    } as never);
    const tx = await buildSolPurchaseTx(USER, 2_000_000_000n);
    expect(tx).toBeInstanceOf(VersionedTransaction);
    // payer is the first static account key
    expect(tx.message.staticAccountKeys[0].toBase58()).toBe(USER.toBase58());
  });
});

import {buildStablecoinPurchaseInstruction, estimateNocForUsd} from '../presaleBuyModule';
import {USDC_MINT, USDT_MINT} from '../../tokens/coreTokens';
import {findAssociatedTokenAddress} from '../../solana/transactionBuilder';

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ADMIN = new PublicKey(ADMIN_ADDRESS);

describe('buildStablecoinPurchaseInstruction', () => {
  it.each([
    ['USDC', USDC_MINT, [150, 34, 181, 239, 229, 123, 187, 128]],
    ['USDT', USDT_MINT, [209, 3, 170, 172, 219, 182, 149, 89]],
  ] as const)('builds the %s instruction with the right disc, amount, and 10 accounts', (token, mint, disc) => {
    const amount = 25_000_000n; // 25 USDC/USDT (6 dp)
    const {referrerAllocation} = derivePresalePdas(USER);
    const ix = buildStablecoinPurchaseInstruction(USER, token, amount, referrerAllocation);
    expect([...ix.data.subarray(0, 8)]).toEqual(disc);
    // 25_000_000 = 0x017D7840 → LE
    expect([...ix.data.subarray(8, 16)]).toEqual([0x40, 0x78, 0x7d, 0x01, 0x00, 0x00, 0x00, 0x00]);
    expect(ix.data.length).toBe(16);
    expect(ix.programId.toBase58()).toBe(PROGRAM_ID);
    const pdas = derivePresalePdas(USER);
    const userAta = findAssociatedTokenAddress(USER, new PublicKey(mint)).toBase58();
    const adminAta = findAssociatedTokenAddress(ADMIN, new PublicKey(mint)).toBase58();
    const expected = [
      [pdas.config.toBase58(), false, true],
      [pdas.userAccount.toBase58(), false, true],
      [pdas.userAllocation.toBase58(), false, true],
      [pdas.referrerAllocation.toBase58(), false, true],
      [userAta, false, true],
      [adminAta, false, true],
      [mint, false, false],
      [USER.toBase58(), true, true],
      [TOKEN_PROGRAM, false, false],
      [SystemProgram.programId.toBase58(), false, false],
    ];
    expect(ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable])).toEqual(expected);
  });
});

describe('estimateNocForUsd', () => {
  it('computes NOC = usd/stagePrice (stablecoin is 1:1 USD)', () => {
    expect(estimateNocForUsd(40, 0.1501)).toBeCloseTo(266.489, 2);
    expect(estimateNocForUsd(10, 0)).toBe(0);
  });
});

import {buildStablecoinPurchaseTx} from '../presaleBuyModule';

describe('buildStablecoinPurchaseTx', () => {
  it('builds a VersionedTransaction with the user as payer', async () => {
    referralStoreForBuildTests.getState().clearCapturedReferrer();
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getLatestBlockhash: async () => ({blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1}),
      getAccountInfo: async () => null,
    } as never);
    const tx = await buildStablecoinPurchaseTx(USER, 'USDC', 25_000_000n);
    expect(tx.message.staticAccountKeys[0].toBase58()).toBe(USER.toBase58());
  });
});

import {fetchOnChainAllocation} from '../presaleBuyModule';

function allocBufferWithTotal(total: bigint): Buffer {
  const buf = Buffer.alloc(117);
  let rem = total;
  for (let i = 0; i < 8; i++) {
    buf[40 + i] = Number(rem & 0xffn);
    rem >>= 8n;
  }
  return buf;
}

describe('fetchOnChainAllocation', () => {
  it('decodes total_tokens (u64 LE at offset 40) from the allocation account', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => ({data: allocBufferWithTotal(697401732177n)}),
    } as never);
    const r = await fetchOnChainAllocation(USER);
    expect(r.exists).toBe(true);
    expect(r.totalTokensBase).toBe('697401732177');
  });

  it('returns 0 / exists:false when the allocation account does not exist', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => null,
    } as never);
    const r = await fetchOnChainAllocation(USER);
    expect(r).toEqual({totalTokensBase: '0', exists: false});
  });
});

import {fetchTgeTimestamp} from '../presaleBuyModule';

function configBufferWithTge(tge: bigint): Buffer {
  // Config account: tge_timestamp is an i64 LE at byte offset 201.
  const buf = Buffer.alloc(209);
  let rem = tge;
  for (let i = 0; i < 8; i++) {
    buf[201 + i] = Number(rem & 0xffn);
    rem >>= 8n;
  }
  return buf;
}

describe('fetchTgeTimestamp', () => {
  it('decodes tge_timestamp (i64 LE at offset 201) from the config account', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => ({data: configBufferWithTge(1800230400n)}),
    } as never);
    expect(await fetchTgeTimestamp()).toBe(1800230400);
  });

  it('returns null when the config account does not exist', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => null,
    } as never);
    expect(await fetchTgeTimestamp()).toBeNull();
  });

  it('returns null when the account data is too short', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => ({data: Buffer.alloc(208)}),
    } as never);
    expect(await fetchTgeTimestamp()).toBeNull();
  });
});

// ===========================================================================
// Task 3: register_referrer ix + allocation read + resolveReferrer
// ===========================================================================

import {
  buildRegisterReferrerInstruction,
  REGISTER_REFERRER_DISCRIMINATOR,
  fetchAllocationRef,
  resolveReferrer,
} from '../presaleBuyModule';
import * as presaleBuyModule from '../presaleBuyModule';

// A referral wallet whose bytes are meaningful (not the all-zero bytes a
// string-constructed PublicKey carries in the mock), so we can assert that the
// register instruction actually serializes the 32 referrer bytes.
const REF_BYTES = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
const REF = new PublicKey(REF_BYTES);
const REF_B58 = REF.toBase58();

// A REAL base58 address for resolveReferrer's `capturedReferrer` arg — the
// validity check (captureIsValid / parseReferralInput) base58-decodes the
// captured string and asserts 32 bytes, so it must be a genuine pubkey string
// (REF_B58 above is the mock's `mock-pubkey-…` placeholder, not valid base58).
const CAPTURED_REF = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';

/**
 * Craft a 117-byte PresaleAllocation buffer with purchase_count (u32 LE @56)
 * and an optional referrer pubkey (32 bytes @84).
 */
function allocBuffer(purchaseCount: number, referrer: PublicKey | null): Buffer {
  const buf = Buffer.alloc(117);
  buf[56] = purchaseCount & 0xff;
  buf[57] = (purchaseCount >>> 8) & 0xff;
  buf[58] = (purchaseCount >>> 16) & 0xff;
  buf[59] = (purchaseCount >>> 24) & 0xff;
  if (referrer) {
    Buffer.from(referrer.toBytes()).copy(buf, 84);
  }
  return buf;
}

describe('buildRegisterReferrerInstruction', () => {
  it('encodes the disc + 32-byte referrer arg and orders the 4 accounts', () => {
    const ix = buildRegisterReferrerInstruction(USER, REF);
    expect(REGISTER_REFERRER_DISCRIMINATOR).toEqual([122, 229, 215, 169, 100, 145, 198, 120]);
    expect([...ix.data.subarray(0, 8)]).toEqual([122, 229, 215, 169, 100, 145, 198, 120]);
    expect([...ix.data.subarray(8, 40)]).toEqual([...REF.toBytes()]);
    expect(ix.data.length).toBe(40);
    expect(ix.programId.toBase58()).toBe(PROGRAM_ID);
    const pdas = derivePresalePdas(USER);
    const expected = [
      [pdas.userAccount.toBase58(), false, true],
      [pdas.userAllocation.toBase58(), false, true],
      [USER.toBase58(), true, true],
      [SystemProgram.programId.toBase58(), false, false],
    ];
    expect(ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable])).toEqual(expected);
  });
});

describe('fetchAllocationRef', () => {
  it('decodes purchase_count (u32 LE @56) and referrer (@84) from the allocation', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => ({data: allocBuffer(1, REF)}),
    } as never);
    const r = await fetchAllocationRef(USER);
    expect(r).toEqual({exists: true, referrer: REF_B58, purchaseCount: 1});
  });

  it('returns referrer:null when the 32 referrer bytes are all zero', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => ({data: allocBuffer(3, null)}),
    } as never);
    const r = await fetchAllocationRef(USER);
    expect(r).toEqual({exists: true, referrer: null, purchaseCount: 3});
  });

  it('returns exists:false when no account / too-short data', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => null,
    } as never);
    expect(await fetchAllocationRef(USER)).toEqual({exists: false, referrer: null, purchaseCount: 0});

    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getAccountInfo: async () => ({data: Buffer.alloc(115)}),
    } as never);
    expect(await fetchAllocationRef(USER)).toEqual({exists: false, referrer: null, purchaseCount: 0});
  });
});

describe('resolveReferrer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('no allocation + captured REF → registers REF; referrerAllocation == PDA(REF)', async () => {
    jest
      .spyOn(presaleBuyModule, 'fetchAllocationRef')
      .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
    const r = await resolveReferrer(USER, CAPTURED_REF);
    const [pdaRef] = PublicKey.findProgramAddressSync(
      [Buffer.from('allocation'), new PublicKey(CAPTURED_REF).toBytes()],
      PROGRAM,
    );
    expect(r.registerReferrer?.toBase58()).toBe(CAPTURED_REF);
    expect(r.effectiveReferrerAddress).toBe(CAPTURED_REF);
    expect(r.referrerAllocation.toBase58()).toBe(pdaRef.toBase58());
    // CORRECTNESS INVARIANT: referrerAllocation is the PDA of the SAME key we register.
    const [pdaOfRegistered] = PublicKey.findProgramAddressSync(
      [Buffer.from('allocation'), r.registerReferrer!.toBytes()],
      PROGRAM,
    );
    expect(r.referrerAllocation.toBase58()).toBe(pdaOfRegistered.toBase58());
  });

  it('on-chain referrer R2 set → no register; referrerAllocation == PDA(R2); effective R2', async () => {
    const r2Bytes = new Uint8Array(32).map((_, i) => (i + 11) & 0xff);
    const R2 = new PublicKey(r2Bytes);
    jest
      .spyOn(presaleBuyModule, 'fetchAllocationRef')
      .mockResolvedValue({exists: true, referrer: R2.toBase58(), purchaseCount: 2});
    const r = await resolveReferrer(USER, CAPTURED_REF);
    const [pdaR2] = PublicKey.findProgramAddressSync(
      [Buffer.from('allocation'), new PublicKey(R2.toBase58()).toBytes()],
      PROGRAM,
    );
    expect(r.registerReferrer).toBeNull();
    expect(r.effectiveReferrerAddress).toBe(R2.toBase58());
    expect(r.referrerAllocation.toBase58()).toBe(pdaR2.toBase58());
  });

  it('purchase_count 1, captured REF, no on-chain → no register, effective null, PDA(default)', async () => {
    jest
      .spyOn(presaleBuyModule, 'fetchAllocationRef')
      .mockResolvedValue({exists: true, referrer: null, purchaseCount: 1});
    const r = await resolveReferrer(USER, CAPTURED_REF);
    const [pdaDefault] = PublicKey.findProgramAddressSync(
      [Buffer.from('allocation'), PublicKey.default.toBytes()],
      PROGRAM,
    );
    expect(r.registerReferrer).toBeNull();
    expect(r.effectiveReferrerAddress).toBeNull();
    expect(r.referrerAllocation.toBase58()).toBe(pdaDefault.toBase58());
  });

  it('captured == self → ignored (no register, effective null)', async () => {
    jest
      .spyOn(presaleBuyModule, 'fetchAllocationRef')
      .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
    const r = await resolveReferrer(USER, USER.toBase58());
    expect(r.registerReferrer).toBeNull();
    expect(r.effectiveReferrerAddress).toBeNull();
  });

  it('captured junk → ignored (no register, effective null)', async () => {
    jest
      .spyOn(presaleBuyModule, 'fetchAllocationRef')
      .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
    const r = await resolveReferrer(USER, 'not-a-real-address');
    expect(r.registerReferrer).toBeNull();
    expect(r.effectiveReferrerAddress).toBeNull();
  });
});

// ===========================================================================
// Task 4: bundle register_referrer + real referrer_allocation into the buy tx
// ===========================================================================

import {
  submitPresaleBuySol,
  submitPresaleBuyStablecoin,
} from '../presaleBuyModule';
import {useReferralCaptureStore} from '../../../store/zustand/referralCaptureStore';

// Stub the connection + signing dependencies the submit* path reaches into so we
// can build (and inspect) the tx without real RPC / keychain.
jest.mock('../../keychain/keychainModule', () => ({
  KeychainManager: jest.fn().mockImplementation(() => ({
    retrieveSeed: jest.fn().mockResolvedValue('test mnemonic'),
  })),
}));
jest.mock('../../keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn().mockResolvedValue(new Uint8Array(64)),
}));
jest.mock('../../keyDerivation/transparent', () => {
  const {Keypair} = jest.requireActual('@solana/web3.js');
  return {
    deriveTransparentKeypair: jest.fn(() => {
      const kp = Keypair.fromSeed(
        new Uint8Array(32).map((_, i) => (i * 13 + 1) & 0xff),
      );
      return {secretKey: kp.secretKey, publicKey: kp.publicKey};
    }),
  };
});
jest.mock('../../session/zeroize', () => ({zeroize: jest.fn()}));
jest.mock('../../solana/priorityFee', () => ({
  estimatePriorityFee: jest.fn().mockResolvedValue(0),
}));

// The submit* path derives the signer from the (mocked) keypair above; that
// fixed public key is the `user` resolveReferrer/the purchase ix actually sees.
const SUBMIT_SIGNER = (() => {
  const {Keypair} = jest.requireActual('@solana/web3.js');
  return Keypair.fromSeed(new Uint8Array(32).map((_, i) => (i * 13 + 1) & 0xff))
    .publicKey as PublicKey;
})();

const SCHEME = {kind: 'slip10', account: 0} as const;

function mockConnectionForSubmit() {
  jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
    getLatestBlockhash: async () => ({
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 1,
    }),
    sendRawTransaction: async () => 'sig-deadbeef',
  } as never);
}

/**
 * Recover the program's (presale) instructions from a compiled v0 message so we
 * can assert instruction count + ordering + the referrer_allocation account at
 * index 3 of the purchase instruction. Under the test web3.js build the
 * compiled message preserves the original `instructions` (programId + keys +
 * data), so we read those directly and filter to the presale program.
 */
function programIxs(tx: VersionedTransaction): {data: Uint8Array; accountKeys: string[]}[] {
  const message = tx.message as unknown as {
    instructions: {programId: PublicKey; keys: {pubkey: PublicKey}[]; data: Uint8Array}[];
  };
  return message.instructions
    .filter(ix => ix.programId.toBase58() === PROGRAM_ID)
    .map(ix => ({
      data: Buffer.from(ix.data),
      accountKeys: ix.keys.map(k => k.pubkey.toBase58()),
    }));
}

describe('Task 4 — bundle register_referrer into the buy tx', () => {
  beforeEach(() => {
    useReferralCaptureStore.getState().clearCapturedReferrer();
    mockConnectionForSubmit();
  });
  afterEach(() => {
    useReferralCaptureStore.getState().clearCapturedReferrer();
    jest.restoreAllMocks();
  });

  describe('buildSolPurchaseTx', () => {
    it('first-time captured referrer → 2 instructions [register, purchase], purchase acct#3 == PDA(captured)', async () => {
      useReferralCaptureStore.getState().setCapturedReferrer(CAPTURED_REF);
      jest
        .spyOn(presaleBuyModule, 'fetchAllocationRef')
        .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
      const tx = await buildSolPurchaseTx(SUBMIT_SIGNER, 2_000_000_000n);
      const ixs = programIxs(tx);
      expect(ixs.length).toBe(2);
      expect([...ixs[0].data.subarray(0, 8)]).toEqual(REGISTER_REFERRER_DISCRIMINATOR);
      expect([...ixs[1].data.subarray(0, 8)]).toEqual([161, 153, 65, 238, 160, 236, 43, 165]);
      const [pdaRef] = PublicKey.findProgramAddressSync(
        [Buffer.from('allocation'), new PublicKey(CAPTURED_REF).toBytes()],
        PROGRAM,
      );
      expect(ixs[1].accountKeys[3]).toBe(pdaRef.toBase58());
    });

    it('no captured referrer → exactly 1 instruction (purchase), acct#3 == default PDA', async () => {
      jest
        .spyOn(presaleBuyModule, 'fetchAllocationRef')
        .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
      const tx = await buildSolPurchaseTx(SUBMIT_SIGNER, 2_000_000_000n);
      const ixs = programIxs(tx);
      expect(ixs.length).toBe(1);
      expect([...ixs[0].data.subarray(0, 8)]).toEqual([161, 153, 65, 238, 160, 236, 43, 165]);
      const [pdaDefault] = PublicKey.findProgramAddressSync(
        [Buffer.from('allocation'), PublicKey.default.toBytes()],
        PROGRAM,
      );
      expect(ixs[0].accountKeys[3]).toBe(pdaDefault.toBase58());
    });
  });

  describe('buildStablecoinPurchaseTx', () => {
    it('first-time captured referrer → 2 instructions [register, purchase], purchase acct#3 == PDA(captured)', async () => {
      useReferralCaptureStore.getState().setCapturedReferrer(CAPTURED_REF);
      jest
        .spyOn(presaleBuyModule, 'fetchAllocationRef')
        .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
      const tx = await buildStablecoinPurchaseTx(SUBMIT_SIGNER, 'USDC', 25_000_000n);
      const ixs = programIxs(tx);
      expect(ixs.length).toBe(2);
      expect([...ixs[0].data.subarray(0, 8)]).toEqual(REGISTER_REFERRER_DISCRIMINATOR);
      expect([...ixs[1].data.subarray(0, 8)]).toEqual([150, 34, 181, 239, 229, 123, 187, 128]);
      const [pdaRef] = PublicKey.findProgramAddressSync(
        [Buffer.from('allocation'), new PublicKey(CAPTURED_REF).toBytes()],
        PROGRAM,
      );
      expect(ixs[1].accountKeys[3]).toBe(pdaRef.toBase58());
    });

    it('no captured referrer → exactly 1 instruction (purchase), acct#3 == default PDA', async () => {
      jest
        .spyOn(presaleBuyModule, 'fetchAllocationRef')
        .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
      const tx = await buildStablecoinPurchaseTx(SUBMIT_SIGNER, 'USDC', 25_000_000n);
      const ixs = programIxs(tx);
      expect(ixs.length).toBe(1);
      const [pdaDefault] = PublicKey.findProgramAddressSync(
        [Buffer.from('allocation'), PublicKey.default.toBytes()],
        PROGRAM,
      );
      expect(ixs[0].accountKeys[3]).toBe(pdaDefault.toBase58());
    });
  });

  describe('submitPresaleBuySol', () => {
    it('bundles register + purchase and returns effectiveReferrerAddress', async () => {
      useReferralCaptureStore.getState().setCapturedReferrer(CAPTURED_REF);
      jest
        .spyOn(presaleBuyModule, 'fetchAllocationRef')
        .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
      const res = await submitPresaleBuySol(2_000_000_000n, SCHEME);
      expect(res.signature).toBe('sig-deadbeef');
      expect(res.lastValidBlockHeight).toBe(1);
      expect(res.effectiveReferrerAddress).toBe(CAPTURED_REF);
    });

    it('no captured referrer → effectiveReferrerAddress null', async () => {
      jest
        .spyOn(presaleBuyModule, 'fetchAllocationRef')
        .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
      const res = await submitPresaleBuySol(2_000_000_000n, SCHEME);
      expect(res.effectiveReferrerAddress).toBeNull();
    });
  });

  describe('submitPresaleBuyStablecoin', () => {
    it('bundles register + purchase and returns effectiveReferrerAddress', async () => {
      useReferralCaptureStore.getState().setCapturedReferrer(CAPTURED_REF);
      jest
        .spyOn(presaleBuyModule, 'fetchAllocationRef')
        .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
      const res = await submitPresaleBuyStablecoin('USDC', 25_000_000n, SCHEME);
      expect(res.signature).toBe('sig-deadbeef');
      expect(res.lastValidBlockHeight).toBe(1);
      expect(res.effectiveReferrerAddress).toBe(CAPTURED_REF);
    });

    it('no captured referrer → effectiveReferrerAddress null', async () => {
      jest
        .spyOn(presaleBuyModule, 'fetchAllocationRef')
        .mockResolvedValue({exists: false, referrer: null, purchaseCount: 0});
      const res = await submitPresaleBuyStablecoin('USDC', 25_000_000n, SCHEME);
      expect(res.effectiveReferrerAddress).toBeNull();
    });
  });
});
