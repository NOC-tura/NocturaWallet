/* eslint-disable no-bitwise -- byte-level encoding is what this file is about */
/**
 * The A0 `deposit` instruction against the deposit that LANDED on devnet (spec §1, §5 step 5,
 * §14 JS "our own deposit encoding against the landed deposit 3DR6F7oW…", §16 M1b first task, I1).
 *
 * Three sources, none of them the code under test:
 *   - `fixtures/landed-deposit-3DR6F7oW.json` — the RPC's `getTransaction` answer, recorded ONCE by
 *     `scripts/a0-fixtures/fetch-devnet-tx.mjs` (devnet genesis checked, slot and time recorded).
 *     Its signature is verified here over the message bytes, so the bytes are the ones the chain
 *     accepted;
 *   - `fixtures/shielded_pool.idl.json` — the program side's IDL (`target/idl/shielded_pool.json`,
 *     sha256 pinned below = spec §1's `cfd37078…`), decoded here by a tiny borsh reader driven by
 *     the IDL's own arg types — not by our builder;
 *   - the program side's `landed.deposit` public inputs (devnet-a0-deployed-contract.json), copied
 *     below as comparison targets.
 *
 * Every PDA / ATA expected value is computed in this file with the REAL @solana/web3.js
 * (`findProgramAddressSync`), never read from our constants: the constants are compared with it.
 */
import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';
import {ed25519} from '@noble/curves/ed25519.js';
import {sha256} from '@noble/hashes/sha2.js';

// The app's Jest maps @solana/web3.js to a mock whose PublicKey(string) is 32 zero bytes and
// whose findProgramAddressSync hashes nothing — a golden test under it would be green and empty
// (see presaleBuyModule.test.ts). This suite, and the module under test, use the real library.
jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  A0,
  A0_CU,
  A0_DEPOSIT_ACCOUNTS,
  A0_DEPOSIT_ARGS_BYTES,
  A0_EVENT_DISCRIMINATOR,
  A0_IX_DISCRIMINATOR,
  A0_PROOF_BYTES,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../constants';
import {a0RhoMarkerPda, buildA0DepositIx, encodeA0DepositData} from '../depositIx';
import type {A0DepositArgs} from '../depositIx';

// ------------------------------------------------------------------------------ fixtures

interface TxFixture {
  schema: string;
  cluster: string;
  genesisHash: string;
  rpc: string;
  fetchedAt: string;
  slot: number;
  blockTime: number;
  signature: string;
  result: {slot: number; blockTime: number; meta: {err: unknown}; transaction: [string, string]};
}
interface IdlType {
  array?: [string, number];
}
interface IdlInstruction {
  name: string;
  discriminator: number[];
  accounts: Array<{
    name: string;
    writable?: boolean;
    signer?: boolean;
    address?: string;
    pda?: {seeds: Array<{kind: string; value?: number[]; path?: string}>};
  }>;
  args: Array<{name: string; type: string | IdlType}>;
}
interface Idl {
  address: string;
  instructions: IdlInstruction[];
  events: Array<{name: string; discriminator: number[]}>;
}

const FIX = join(__dirname, 'fixtures');
const LANDED_RAW = readFileSync(join(FIX, 'landed-deposit-3DR6F7oW.json'));
const IDL_RAW = readFileSync(join(FIX, 'shielded_pool.idl.json'));
const landed = JSON.parse(LANDED_RAW.toString('utf8')) as TxFixture;
const idl = JSON.parse(IDL_RAW.toString('utf8')) as Idl;

const SIGNATURE =
  '3DR6F7oWXS4D5RSsDJAQMbYtQM4EW5Kp2qkJRVSHH72x2GPB4N4G93JkNK9uGGK9CpFeGuy7vtBVeaDHiVQ7b8sm';
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
/** spec §1 / the ICO state file: sha256 of the program side's target/idl/shielded_pool.json. */
const IDL_SHA256 = 'cfd370784ef3e982e86aadd55b848edff46599472a1be8585dfe6c0b05c829a0';
/**
 * The program side's devnet-a0-deployed-contract.json `landed.deposit` (their 19e3891, read
 * 2026-11-15): the public inputs [commitment, amount, mintHash, rho] of this very deposit, as
 * decimal field elements. Comparison targets only.
 */
const LANDED_PUBLIC = {
  commitment: 1832099858828464171255386012686455982544889024198594493159238616499632609709n,
  amount: 1000000n,
  rho: 2682398932710728289451863586583737043718296808864885766580558010318135811237n,
};
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
/** Bitcoin-alphabet base58, written out (no base58 library is a direct dependency). */
function base58(b: Uint8Array): string {
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = BigInt('0x' + (hex(b) || '0'));
  let s = '';
  while (n > 0n) {
    s = A[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const x of b) {
    if (x !== 0) {
      break;
    }
    s = '1' + s;
  }
  return s;
}
const beInt = (b: Uint8Array): bigint => BigInt('0x' + (hex(b) || '0'));
const anchorDisc = (preimage: string): string =>
  hex(sha256(new TextEncoder().encode(preimage)).slice(0, 8));

const wire = Buffer.from(landed.result.transaction[0], 'base64');
const tx = VersionedTransaction.deserialize(wire);
const msg = tx.message;
const keys = msg.staticAccountKeys;
const depositCompiled = (() => {
  const found = msg.compiledInstructions.filter(
    ci => keys[ci.programIdIndex].toBase58() === A0.programId,
  );
  if (found.length !== 1) {
    throw new Error(`the landed tx carries ${found.length} FeGSS instructions, expected 1`);
  }
  return found[0];
})();
const landedData = Uint8Array.from(depositCompiled.data);

/** Signer / writable of account i, read from the message HEADER (not from web3's helpers). */
function headerFlags(i: number): {isSigner: boolean; isWritable: boolean} {
  const h = msg.header;
  const n = keys.length;
  const isSigner = i < h.numRequiredSignatures;
  const isWritable = isSigner
    ? i < h.numRequiredSignatures - h.numReadonlySignedAccounts
    : i < n - h.numReadonlyUnsignedAccounts;
  return {isSigner, isWritable};
}
type Meta = [string, boolean, boolean];
const landedMetas: Meta[] = depositCompiled.accountKeyIndexes.map(i => {
  const f = headerFlags(i);
  return [keys[i].toBase58(), f.isSigner, f.isWritable];
});
const ixMetas = (ix: TransactionInstruction): Meta[] =>
  ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);

// ------------------------------------------------------------- the IDL-driven borsh reader

type IdlValue = bigint | Uint8Array;
/** Decodes `data` (after the 8-byte discriminator) by the IDL's arg list; refuses trailing bytes. */
function idlDecode(ixName: string, data: Uint8Array): Record<string, IdlValue> {
  const def = idl.instructions.find(i => i.name === ixName);
  if (!def) {
    throw new Error(`IDL has no instruction ${ixName}`);
  }
  if (hex(data.subarray(0, 8)) !== hex(Uint8Array.from(def.discriminator))) {
    throw new Error('discriminator mismatch');
  }
  let o = 8;
  const take = (n: number): Uint8Array => {
    if (o + n > data.length) {
      throw new Error(`short read at ${o}+${n} of ${data.length}`);
    }
    const s = data.slice(o, o + n);
    o += n;
    return s;
  };
  const out: Record<string, IdlValue> = {};
  for (const a of def.args) {
    if (a.type === 'u64') {
      const b = take(8);
      let v = 0n;
      for (let i = 7; i >= 0; i--) {
        v = (v << 8n) | BigInt(b[i]);
      }
      out[a.name] = v;
    } else if (a.type === 'bytes') {
      const l = take(4);
      const len = l[0] | (l[1] << 8) | (l[2] << 16) | (l[3] * 2 ** 24);
      out[a.name] = take(len);
    } else if (typeof a.type === 'object' && a.type.array && a.type.array[0] === 'u8') {
      out[a.name] = take(a.type.array[1]);
    } else {
      throw new Error(`the reader does not know IDL type ${JSON.stringify(a.type)}`);
    }
  }
  if (o !== data.length) {
    throw new Error(`${data.length - o} trailing bytes`);
  }
  return out;
}

const decoded = idlDecode('deposit', landedData);
const bytesOf = (v: IdlValue): Uint8Array => {
  if (typeof v === 'bigint') {
    throw new Error('expected bytes');
  }
  return v;
};
const amountOf = (v: IdlValue): bigint => {
  if (typeof v !== 'bigint') {
    throw new Error('expected u64');
  }
  return v;
};
const landedArgs: A0DepositArgs = {
  amount: amountOf(decoded.amount),
  commitment: bytesOf(decoded.commitment),
  rho: bytesOf(decoded.rho),
  proof: bytesOf(decoded.proof_bytes),
};
const DEPOSITOR = new PublicKey(landedMetas[3][0]);
const DEPOSITOR_TOKEN_ACCOUNT = new PublicKey(landedMetas[4][0]);
const rebuild = (args: A0DepositArgs = landedArgs) =>
  buildA0DepositIx(args, {depositor: DEPOSITOR, depositorTokenAccount: DEPOSITOR_TOKEN_ACCOUNT});

// ------------------------------------------------------------------------------ the tests

describe('the fixtures are what they claim to be', () => {
  it('the recorded tx is the devnet deposit 3DR6F7oW…, landed without error, with its slot and time', () => {
    expect(landed.schema).toBe('noctura.a0.devnet-tx-fixture/1');
    expect(landed.cluster).toBe('devnet');
    expect(landed.genesisHash).toBe(DEVNET_GENESIS);
    expect(landed.signature).toBe(SIGNATURE);
    expect(landed.result.meta.err).toBeNull();
    expect(landed.slot).toBe(landed.result.slot);
    expect(landed.blockTime).toBe(landed.result.blockTime);
    expect(Number.isNaN(Date.parse(landed.fetchedAt))).toBe(false);
    expect(tx.signatures).toHaveLength(1);
    expect(base58(Uint8Array.from(tx.signatures[0]))).toBe(SIGNATURE);
  });

  it("the fee payer's signature verifies over the recorded message bytes (positive and negative control)", () => {
    const message = msg.serialize();
    const sig = Uint8Array.from(tx.signatures[0]);
    const payer = keys[0].toBytes();
    expect(ed25519.verify(sig, message, payer)).toBe(true);
    const tampered = Uint8Array.from(message);
    tampered[tampered.length - 1] ^= 1; // the last byte is inside the deposit's proof
    expect(ed25519.verify(sig, tampered, payer)).toBe(false);
  });

  it('the committed IDL is byte for byte the one spec §1 pins, and it is the IDL of FeGSS…', () => {
    expect(createHash('sha256').update(IDL_RAW).digest('hex')).toBe(IDL_SHA256);
    expect(idl.address).toBe(A0.programId);
  });
});

describe('A0 constants: the facts agree with the IDL, the values are computed and agree with the chain', () => {
  it('every instruction and event discriminator equals the IDL and Anchor’s sha256 preimage', () => {
    const ixNames: Record<keyof typeof A0_IX_DISCRIMINATOR, string> = {
      deposit: 'deposit',
      withdrawWithChange: 'withdraw_with_change',
      transfer: 'transfer',
    };
    for (const [k, name] of Object.entries(ixNames) as Array<[keyof typeof ixNames, string]>) {
      const def = idl.instructions.find(i => i.name === name);
      expect(def).toBeDefined();
      expect(A0_IX_DISCRIMINATOR[k]).toBe(hex(Uint8Array.from(def?.discriminator ?? [])));
      expect(A0_IX_DISCRIMINATOR[k]).toBe(anchorDisc(`global:${name}`));
    }
    const evNames: Record<keyof typeof A0_EVENT_DISCRIMINATOR, string> = {
      leafInserted: 'LeafInserted',
      noteCiphertext: 'NoteCiphertext',
      transfer: 'Transfer',
      withdraw: 'Withdraw',
    };
    for (const [k, name] of Object.entries(evNames) as Array<[keyof typeof evNames, string]>) {
      const def = idl.events.find(e => e.name === name);
      expect(def).toBeDefined();
      expect(A0_EVENT_DISCRIMINATOR[k]).toBe(hex(Uint8Array.from(def?.discriminator ?? [])));
      expect(A0_EVENT_DISCRIMINATOR[k]).toBe(anchorDisc(`event:${name}`));
    }
    expect(A0_IX_DISCRIMINATOR.deposit).toBe('f223c68952e1f2b6'); // spec §1, as stated
  });

  it('the deposit account order and flags are the IDL’s, and the program ids are the IDL’s fixed addresses', () => {
    const def = idl.instructions.find(i => i.name === 'deposit');
    expect(def?.accounts.map(a => a.name)).toEqual([...A0_DEPOSIT_ACCOUNTS]);
    expect(def?.accounts.map(a => [a.name, a.signer === true, a.writable === true])).toEqual([
      ['pool', false, false],
      ['merkle_tree', false, true],
      ['vault', false, true],
      ['depositor', true, true],
      ['depositor_token_account', false, true],
      ['rho_marker', false, true],
      ['token_program', false, false],
      ['system_program', false, false],
    ]);
    expect(def?.accounts[6].address).toBe(TOKEN_PROGRAM_ID);
    expect(def?.accounts[7].address).toBe(SYSTEM_PROGRAM_ID);
    // rho_marker = PDA(["rho", arg rho]) — the seed is the literal "rho" and the rho ARGUMENT.
    expect(def?.accounts[5].pda?.seeds).toEqual([
      {kind: 'const', value: [...Buffer.from('rho')]},
      {kind: 'arg', path: 'rho'},
    ]);
    expect(def?.args.map(a => a.name)).toEqual(['amount', 'commitment', 'rho', 'proof_bytes']);
  });

  it('pool = PDA(["pool", mint]) with bump 253, tree = PDA(["merkle", pool]), vault = ATA(pool, mint) — each computed here and equal to the landed tx', () => {
    const program = new PublicKey(A0.programId);
    const mint = new PublicKey(A0.mint);
    const [pool, poolBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), mint.toBuffer()],
      program,
    );
    const [tree] = PublicKey.findProgramAddressSync(
      [Buffer.from('merkle'), pool.toBuffer()],
      program,
    );
    const [vault] = PublicKey.findProgramAddressSync(
      [pool.toBuffer(), new PublicKey(TOKEN_PROGRAM_ID).toBuffer(), mint.toBuffer()],
      ATA_PROGRAM,
    );
    expect([pool.toBase58(), poolBump]).toEqual([A0.pool, A0.poolBump]);
    expect(tree.toBase58()).toBe(A0.merkleTree);
    expect(vault.toBase58()).toBe(A0.vault);
    expect(landedMetas.slice(0, 3).map(m => m[0])).toEqual([A0.pool, A0.merkleTree, A0.vault]);
    expect(keys[depositCompiled.programIdIndex].toBase58()).toBe(A0.programId);
  });

  it('the deposit argument block is 332 bytes and the proof 256, as spec §1 states', () => {
    expect(landedData.length - 8).toBe(A0_DEPOSIT_ARGS_BYTES);
    expect(A0_DEPOSIT_ARGS_BYTES).toBe(332);
    expect(landedArgs.proof.length).toBe(A0_PROOF_BYTES);
    expect(A0_CU.deposit).toBe(200_000);
  });
});

describe('the landed deposit, decoded by the IDL and rebuilt by our builder', () => {
  it('the IDL decode equals the program side’s landed public inputs (commitment, amount, rho)', () => {
    expect(landedArgs.amount).toBe(LANDED_PUBLIC.amount);
    expect(beInt(landedArgs.commitment)).toBe(LANDED_PUBLIC.commitment);
    expect(beInt(landedArgs.rho)).toBe(LANDED_PUBLIC.rho);
  });

  it('our instruction data equals the landed data byte for byte (340 bytes)', () => {
    const ix = rebuild();
    expect(hex(Uint8Array.from(ix.data))).toBe(hex(landedData));
    expect(hex(encodeA0DepositData(landedArgs))).toBe(hex(landedData));
    expect(ix.data.length).toBe(340);
  });

  it('our account metas (key, isSigner, isWritable) equal the landed message’s, in order, and the program id', () => {
    const ix = rebuild();
    expect(ix.programId.toBase58()).toBe(A0.programId);
    expect(ixMetas(ix)).toEqual(landedMetas);
  });

  it('the rho marker is PDA(["rho", rho]) computed here, equal to ours and to the landed account', () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from('rho'), Buffer.from(landedArgs.rho)],
      new PublicKey(A0.programId),
    );
    expect(a0RhoMarkerPda(landedArgs.rho).toBase58()).toBe(expected.toBase58());
    expect(landedMetas[5][0]).toBe(expected.toBase58());
  });

  it('the landed depositor token account is the canonical ATA(depositor, mint) (a value computed here)', () => {
    const [ata] = PublicKey.findProgramAddressSync(
      [DEPOSITOR.toBuffer(), new PublicKey(TOKEN_PROGRAM_ID).toBuffer(), new PublicKey(A0.mint).toBuffer()],
      ATA_PROGRAM,
    );
    expect(DEPOSITOR_TOKEN_ACCOUNT.toBase58()).toBe(ata.toBase58());
  });

  it('with the landed tx’s own ComputeBudget limit, our instruction recompiles the WHOLE signed message byte for byte', () => {
    const cb = msg.compiledInstructions.filter(ci => keys[ci.programIdIndex].toBase58() === COMPUTE_BUDGET);
    expect(cb).toHaveLength(1);
    // setComputeUnitLimit = tag 2, u32 LE units — the landed tx asked for 1,400,000 (not our 200,000).
    const cbData = Uint8Array.from(cb[0].data);
    expect(cbData[0]).toBe(2);
    const units = cbData[1] | (cbData[2] << 8) | (cbData[3] << 16) | (cbData[4] * 2 ** 24);
    expect(units).toBe(1_400_000);
    const rebuilt = new Transaction({feePayer: DEPOSITOR, recentBlockhash: msg.recentBlockhash})
      .add(ComputeBudgetProgram.setComputeUnitLimit({units}), rebuild())
      .compileMessage()
      .serialize();
    expect(hex(Uint8Array.from(rebuilt))).toBe(hex(msg.serialize()));
    expect(ed25519.verify(Uint8Array.from(tx.signatures[0]), Uint8Array.from(rebuilt), DEPOSITOR.toBytes())).toBe(true);
  });
});

describe('negative controls: the comparison sees one byte and one account', () => {
  const flip = (b: Uint8Array, i: number): Uint8Array => {
    const c = Uint8Array.from(b);
    c[i] ^= 1;
    return c;
  };
  it.each([
    ['amount + 1', {...landedArgs, amount: landedArgs.amount + 1n}],
    ['one commitment byte', {...landedArgs, commitment: flip(landedArgs.commitment, 31)}],
    ['one rho byte', {...landedArgs, rho: flip(landedArgs.rho, 31)}],
    ['one proof byte', {...landedArgs, proof: flip(landedArgs.proof, 0)}],
    ['commitment and rho swapped', {...landedArgs, commitment: landedArgs.rho, rho: landedArgs.commitment}],
  ])('%s → the data differs from the landed data', (_label, args) => {
    expect(hex(Uint8Array.from(rebuild(args).data))).not.toBe(hex(landedData));
  });

  it('one rho byte changed → the rho marker meta differs (the marker follows the argument)', () => {
    const ix = rebuild({...landedArgs, rho: flip(landedArgs.rho, 31)});
    expect(ixMetas(ix)).not.toEqual(landedMetas);
    expect(ixMetas(ix)[5][0]).not.toBe(landedMetas[5][0]);
  });

  it('another depositor token account, or the depositor and its token account swapped → the metas differ', () => {
    const other = buildA0DepositIx(landedArgs, {
      depositor: DEPOSITOR,
      depositorTokenAccount: new PublicKey(A0.vault),
    });
    expect(ixMetas(other)).not.toEqual(landedMetas);
    const swapped = buildA0DepositIx(landedArgs, {
      depositor: DEPOSITOR_TOKEN_ACCOUNT,
      depositorTokenAccount: DEPOSITOR,
    });
    expect(ixMetas(swapped)).not.toEqual(landedMetas);
  });

  it('a meta list with two accounts swapped, or one flag flipped, is not equal (the comparator is not vacuous)', () => {
    const swapped = [...landedMetas];
    [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
    expect(swapped).not.toEqual(landedMetas);
    const flag: Meta[] = landedMetas.map((m, i) => (i === 0 ? [m[0], m[1], !m[2]] : m));
    expect(flag).not.toEqual(landedMetas);
  });

  it('the IDL reader refuses a truncated or extended blob (so “decoded” means the whole 340 bytes)', () => {
    expect(() => idlDecode('deposit', landedData.slice(0, 339))).toThrow(/short read/);
    const longer = new Uint8Array(341);
    longer.set(landedData);
    expect(() => idlDecode('deposit', longer)).toThrow(/1 trailing bytes/);
  });
});
