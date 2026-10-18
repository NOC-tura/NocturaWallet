import {base58} from '@scure/base';
import {
  ComputeBudgetProgram,
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
} from '@solana/web3.js';
import {buildSolPurchaseInstruction, findAssociatedTokenAddress} from '../../../../../../core/presale/buyInstructions';
import {buildCreateAtaIdempotentInstruction, buildTransferCheckedInstruction} from '../../../../../../core/solana/transfer';
import {PUB, RECIPIENT, BLOCKHASH} from '../../../__tests__/fixtures';
import {ADDRESS_LOOKUP_TABLE_PROGRAM, resolveKeys, tableAddresses, tablesOf} from '../keys';
import {ATA_PROGRAM, COMPUTE_BUDGET_PROGRAM, PRESALE_PROGRAM, SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, decodeInstructions, type DecodedInstruction} from '../decode';
import {MAX_TX_BYTES, isWritableIndex, parseWire, type ParsedTx} from '../wire';

const ME = new PublicKey(PUB);
const TO = new PublicKey(RECIPIENT);
const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
const SRC = new PublicKey('4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF');
const DST = new PublicKey('FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU');
const UNKNOWN = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');

const v0 = (instructions: TransactionInstruction[], tables: AddressLookupTableAccount[] = []): Uint8Array =>
  new VersionedTransaction(new TransactionMessage({payerKey: ME, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message(tables)).serialize();
const legacy = (instructions: TransactionInstruction[]): Uint8Array => new Transaction({feePayer: ME, recentBlockhash: BLOCKHASH}).add(...instructions).serialize({requireAllSignatures: false, verifySignatures: false});
const parsed = (bytes: Uint8Array): ParsedTx => {
  const p = parseWire(bytes);
  if (p === null) throw new Error('did not parse');
  return p;
};
const decodeAll = (bytes: Uint8Array): DecodedInstruction[] => {
  const p = parsed(bytes);
  return decodeInstructions(p, resolveKeys(p, new Map()));
};
const one = (ix: TransactionInstruction): DecodedInstruction => {
  const [d] = decodeAll(v0([ix]));
  if (d === undefined) throw new Error('no instruction');
  return d;
};
const u64 = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const tokenIx = (program: string, data: number[], keys: PublicKey[]) =>
  new TransactionInstruction({programId: new PublicKey(program), data: Buffer.from(data), keys: keys.map((pubkey, i) => ({pubkey, isSigner: i === keys.length - 1, isWritable: i === 0}))});

// Spec B1c §3.3, §1.4: the bytes a page sends are one canonical transaction of at most 1 232 bytes, or nothing.
describe('parseWire', () => {
  it('reads legacy and v0 transactions: version, signers (fee payer first), the message bytes, the blockhash', () => {
    const ix = SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1});
    const l = parsed(legacy([ix]));
    expect(l.version).toBe('legacy');
    expect(l.signers).toEqual([ME.toBase58()]);
    expect(l.blockhash).toBe(BLOCKHASH);
    const p = parsed(v0([ix]));
    expect(p.version).toBe(0);
    expect(p.signers).toEqual([ME.toBase58()]);
    expect(p.signatures).toEqual([new Uint8Array(64)]);
    expect(p.message).toEqual(VersionedTransaction.deserialize(v0([ix])).message.serialize());
    expect(p.lookups).toEqual([]);
  });

  it('refuses anything but exactly one canonical transaction: trailing bytes, too long, empty, garbage', () => {
    const bytes = v0([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]);
    expect(parseWire(Uint8Array.of(...bytes, 0))).toBeNull();
    expect(parseWire(new Uint8Array(0))).toBeNull();
    expect(parseWire(Uint8Array.of(1, 2, 3))).toBeNull();
    // A message padded with a memo-like data blob to 1 233 bytes: one past the packet limit.
    const filler = (n: number) => new TransactionInstruction({programId: UNKNOWN, keys: [], data: Buffer.alloc(n)});
    const at = (n: number) => v0([filler(n)]);
    let n = 900;
    while (at(n).length < MAX_TX_BYTES) n++;
    expect(at(n).length).toBe(MAX_TX_BYTES);
    expect(parseWire(at(n))).not.toBeNull();
    expect(parseWire(at(n + 1))).toBeNull();
  });

  it('isWritableIndex follows the header (signers, then unsigned static keys)', () => {
    const p = parsed(v0([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]));
    // [payer (writable signer), to (writable), system program (readonly)]
    expect([0, 1, 2].map(i => isWritableIndex(p, i))).toEqual([true, true, false]);
  });
});

describe('decodeInstructions — System', () => {
  it('transfer, createAccount, assign, allocate, advanceNonceAccount', () => {
    expect(one(SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 500_000_000}))).toEqual({
      programId: '11111111111111111111111111111111',
      program: 'system',
      name: 'transfer',
      fields: [
        {name: 'from', value: {kind: 'address', value: ME.toBase58()}},
        {name: 'to', value: {kind: 'address', value: TO.toBase58()}},
        {name: 'lamports', value: {kind: 'lamports', value: '500000000'}},
      ],
    });
    const created = one(SystemProgram.createAccount({fromPubkey: ME, newAccountPubkey: TO, lamports: 2_039_280, space: 165, programId: new PublicKey(TOKEN_PROGRAM)}));
    expect(created.name).toBe('createAccount');
    expect(created.fields.map(f => f.name)).toEqual(['from', 'newAccount', 'lamports', 'space', 'owner']);
    expect(created.fields[4]?.value).toEqual({kind: 'address', value: TOKEN_PROGRAM});
    expect(one(SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN})).fields).toEqual([
      {name: 'account', value: {kind: 'address', value: ME.toBase58()}},
      {name: 'owner', value: {kind: 'address', value: UNKNOWN.toBase58()}},
    ]);
    expect(one(SystemProgram.allocate({accountPubkey: ME, space: 1000})).fields[1]).toEqual({name: 'space', value: {kind: 'number', value: '1000'}});
    const nonce = one(SystemProgram.nonceAdvance({noncePubkey: TO, authorizedPubkey: ME}));
    expect(nonce.name).toBe('advanceNonceAccount');
    expect(nonce.fields).toEqual([
      {name: 'nonceAccount', value: {kind: 'address', value: TO.toBase58()}},
      {name: 'authority', value: {kind: 'address', value: ME.toBase58()}},
    ]);
    expect(NONCE_ACCOUNT_LENGTH).toBe(80);
  });

  it('a System instruction outside the decoded list is named, with no fields; a truncated one is an unknown program (fail closed — fix round 1)', () => {
    const withdraw = one(SystemProgram.nonceWithdraw({noncePubkey: TO, authorizedPubkey: ME, toPubkey: ME, lamports: 1}));
    expect(withdraw).toMatchObject({program: 'system', name: 'withdrawNonceAccount', fields: []});
    // System's bincode deserialiser allows trailing bytes and would still execute a transfer from this prefix — the
    // wallet must never show "transfer" with the amount hidden; it is wholly unknown instead.
    const truncated = one(new TransactionInstruction({programId: SystemProgram.programId, keys: [], data: Buffer.from([2, 0, 0, 0, 1])}));
    expect(truncated).toEqual({programId: SYSTEM_PROGRAM, program: null, name: null, fields: []});
  });
});

// B1c-3 (spec B1c §3.3 rev 3.6): System's four …WithSeed instructions, with their target account — F3 compares
// allocateWithSeed / assignWithSeed's account with the wallet's, F10 counts createAccountWithSeed's new account.
describe('decodeInstructions — System …WithSeed', () => {
  const BASE = new PublicKey(new Uint8Array(32).fill(5));
  const ascii = (t: string): number[] => Array.from(t, c => c.charCodeAt(0));
  const seedOf = (bytes: number[], length = bytes.length): number[] => [...u64(BigInt(length)), ...bytes];
  const sys = (tag: number, data: number[], keys: PublicKey[]) =>
    new TransactionInstruction({programId: SystemProgram.programId, data: Buffer.from([tag, 0, 0, 0, ...data]), keys: keys.map((pubkey, i) => ({pubkey, isSigner: i === 1, isWritable: i !== 1}))});
  const addressOf = (k: PublicKey | string) => ({kind: 'address', value: typeof k === 'string' ? k : k.toBase58()});

  it('createAccountWithSeed, allocateWithSeed, assignWithSeed, transferWithSeed: every field, the target account included', () => {
    expect(one(SystemProgram.createAccountWithSeed({fromPubkey: ME, newAccountPubkey: DST, basePubkey: BASE, seed: 'stake:0', lamports: 2_282_880, space: 200, programId: new PublicKey(TOKEN_PROGRAM)}))).toEqual({
      programId: SYSTEM_PROGRAM,
      program: 'system',
      name: 'createAccountWithSeed',
      fields: [
        {name: 'from', value: addressOf(ME)},
        {name: 'newAccount', value: addressOf(DST)},
        {name: 'base', value: addressOf(BASE)},
        {name: 'seed', value: {kind: 'text', value: 'stake:0'}},
        {name: 'lamports', value: {kind: 'lamports', value: '2282880'}},
        {name: 'space', value: {kind: 'number', value: '200'}},
        {name: 'owner', value: addressOf(TOKEN_PROGRAM)},
      ],
    });
    expect(one(SystemProgram.allocate({accountPubkey: ME, basePubkey: BASE, seed: 'x', space: 64, programId: UNKNOWN}))).toMatchObject({
      program: 'system',
      name: 'allocateWithSeed',
      fields: [
        {name: 'account', value: addressOf(ME)},
        {name: 'base', value: addressOf(BASE)},
        {name: 'seed', value: {kind: 'text', value: 'x'}},
        {name: 'space', value: {kind: 'number', value: '64'}},
        {name: 'owner', value: addressOf(UNKNOWN)},
      ],
    });
    expect(one(SystemProgram.assign({accountPubkey: ME, basePubkey: BASE, seed: 'vault', programId: UNKNOWN}))).toMatchObject({
      program: 'system',
      name: 'assignWithSeed',
      fields: [
        {name: 'account', value: addressOf(ME)},
        {name: 'base', value: addressOf(BASE)},
        {name: 'seed', value: {kind: 'text', value: 'vault'}},
        {name: 'owner', value: addressOf(UNKNOWN)},
      ],
    });
    expect(one(SystemProgram.transfer({fromPubkey: SRC, basePubkey: ME, toPubkey: TO, lamports: 42, seed: 'pay', programId: SystemProgram.programId}))).toMatchObject({
      program: 'system',
      name: 'transferWithSeed',
      fields: [
        {name: 'from', value: addressOf(SRC)},
        {name: 'fromBase', value: addressOf(ME)},
        {name: 'to', value: addressOf(TO)},
        {name: 'lamports', value: {kind: 'lamports', value: '42'}},
        {name: 'fromSeed', value: {kind: 'text', value: 'pay'}},
        {name: 'fromOwner', value: addressOf(SYSTEM_PROGRAM)},
      ],
    });
  });

  it('the seed: at most 32 bytes; printable ASCII is text, other UTF-8 hex; not UTF-8, cut short or a huge length is an unknown program', () => {
    const assignWith = (seed: number[], length?: number) => one(sys(10, [...BASE.toBytes(), ...seedOf(seed, length), ...UNKNOWN.toBytes()], [ME, BASE]));
    expect(assignWith(ascii('a'.repeat(32))).fields[2]).toEqual({name: 'seed', value: {kind: 'text', value: 'a'.repeat(32)}});
    expect(assignWith(ascii('a'.repeat(33)))).toEqual({programId: SYSTEM_PROGRAM, program: null, name: null, fields: []});
    const accented = Array.from(new TextEncoder().encode('caf\u00e9'));
    expect(assignWith(accented).fields[2]).toEqual({name: 'seed', value: {kind: 'hex', value: '636166c3a9'}});
    expect(assignWith(ascii('a\u0007b')).fields[2]).toEqual({name: 'seed', value: {kind: 'hex', value: '610762'}});
    expect(assignWith([0x61, 0xff])).toMatchObject({program: null, name: null});
    expect(assignWith(ascii('abc'), 5)).toMatchObject({program: null, name: null});
    expect(assignWith(ascii('abc'), 2 ** 53)).toMatchObject({program: null, name: null});
    expect(assignWith(ascii(''))).toMatchObject({program: 'system', name: 'assignWithSeed', fields: [{name: 'account'}, {name: 'base'}, {name: 'seed', value: {kind: 'text', value: ''}}, {name: 'owner'}]});
  });

  it('strict: a trailing byte, or fewer accounts than the instruction needs, is an unknown program', () => {
    const unknown = {programId: SYSTEM_PROGRAM, program: null, name: null, fields: []};
    const created = [...BASE.toBytes(), ...seedOf(ascii('s')), ...u64(1n), ...u64(0n), ...UNKNOWN.toBytes()];
    expect(one(sys(3, created, [ME, DST]))).toMatchObject({name: 'createAccountWithSeed'});
    expect(one(sys(3, [...created, 0], [ME, DST]))).toEqual(unknown);
    expect(one(sys(3, created, [ME]))).toEqual(unknown);
    const allocated = [...BASE.toBytes(), ...seedOf(ascii('s')), ...u64(10n), ...UNKNOWN.toBytes()];
    expect(one(sys(9, allocated, [ME]))).toMatchObject({name: 'allocateWithSeed'});
    expect(one(sys(9, [...allocated, 0], [ME, BASE]))).toEqual(unknown);
    expect(one(sys(9, allocated, []))).toEqual(unknown);
    const assigned = [...BASE.toBytes(), ...seedOf(ascii('s')), ...UNKNOWN.toBytes()];
    expect(one(sys(10, [...assigned, 0], [ME, BASE]))).toEqual(unknown);
    expect(one(sys(10, assigned, []))).toEqual(unknown);
    const moved = [...u64(5n), ...seedOf(ascii('s')), ...SystemProgram.programId.toBytes()];
    expect(one(sys(11, moved, [SRC, ME, TO]))).toMatchObject({name: 'transferWithSeed'});
    expect(one(sys(11, [...moved, 0], [SRC, ME, TO]))).toEqual(unknown);
    expect(one(sys(11, moved, [SRC, ME]))).toEqual(unknown);
  });
});

describe('decodeInstructions — SPL Token and Token-2022', () => {
  for (const program of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    const key = program === TOKEN_PROGRAM ? 'token' : 'token-2022';
    it(`${key}: transfer, transferChecked, approve, approveChecked, revoke, burn, burnChecked, closeAccount, syncNative, initializeAccount 1/2/3, freeze, thaw`, () => {
      const owner = ME;
      const cases: [number[], PublicKey[], string, string[]][] = [
        [[3, ...u64(7n)], [SRC, DST, owner], 'transfer', ['source', 'destination', 'owner', 'amount']],
        [[12, ...u64(7n), 9], [SRC, MINT, DST, owner], 'transferChecked', ['source', 'mint', 'destination', 'owner', 'amount']],
        [[4, ...u64(7n)], [SRC, DST, owner], 'approve', ['source', 'delegate', 'owner', 'amount']],
        [[13, ...u64(7n), 9], [SRC, MINT, DST, owner], 'approveChecked', ['source', 'mint', 'delegate', 'owner', 'amount']],
        [[5], [SRC, owner], 'revoke', ['source', 'owner']],
        [[8, ...u64(7n)], [SRC, MINT, owner], 'burn', ['account', 'mint', 'owner', 'amount']],
        [[15, ...u64(7n), 9], [SRC, MINT, owner], 'burnChecked', ['account', 'mint', 'owner', 'amount']],
        [[9], [SRC, DST, owner], 'closeAccount', ['account', 'destination', 'owner']],
        [[17], [SRC], 'syncNative', ['account']],
        [[1], [SRC, MINT, owner, new PublicKey('SysvarRent111111111111111111111111111111111')], 'initializeAccount', ['account', 'mint', 'owner']],
        [[16, ...owner.toBytes()], [SRC, MINT, new PublicKey('SysvarRent111111111111111111111111111111111')], 'initializeAccount2', ['account', 'mint', 'owner']],
        [[18, ...owner.toBytes()], [SRC, MINT], 'initializeAccount3', ['account', 'mint', 'owner']],
        [[10], [SRC, MINT, owner], 'freezeAccount', ['account', 'mint', 'authority']],
        [[11], [SRC, MINT, owner], 'thawAccount', ['account', 'mint', 'authority']],
      ];
      for (const [data, keys, name, fields] of cases) {
        const d = one(tokenIx(program, data, keys));
        expect([name, d.program, d.name, d.fields.map(f => f.name)]).toEqual([name, key, name, fields]);
      }
      // The checked forms carry their decimals with the amount; the plain forms do not know them.
      expect(one(tokenIx(program, [12, ...u64(1_500_000_000n), 9], [SRC, MINT, DST, owner])).fields[4]).toEqual({name: 'amount', value: {kind: 'amount', value: '1500000000', decimals: 9}});
      expect(one(tokenIx(program, [3, ...u64(5n)], [SRC, DST, owner])).fields[3]).toEqual({name: 'amount', value: {kind: 'amount', value: '5', decimals: null}});
      // u64::MAX survives as text (no float on the way).
      expect(one(tokenIx(program, [4, ...u64(2n ** 64n - 1n)], [SRC, DST, owner])).fields[3]?.value).toEqual({kind: 'amount', value: '18446744073709551615', decimals: null});
    });

    it(`${key}: setAuthority names the authority type and the new authority (none = null)`, () => {
      const d = one(tokenIx(program, [6, 2, 1, ...DST.toBytes()], [SRC, ME]));
      expect(d).toEqual({
        programId: program,
        program: key,
        name: 'setAuthority',
        fields: [
          {name: 'account', value: {kind: 'address', value: SRC.toBase58()}},
          {name: 'currentAuthority', value: {kind: 'address', value: ME.toBase58()}},
          {name: 'authorityType', value: {kind: 'text', value: 'accountOwner'}},
          {name: 'newAuthority', value: {kind: 'address', value: DST.toBase58()}},
        ],
      });
      // A legitimate "none" (the Option tag is 0) is its own distinct value — never the same shape a resolution
      // failure would produce (fix round 1, IMPORTANT).
      expect(one(tokenIx(program, [6, 3, 0], [SRC, ME])).fields[3]).toEqual({name: 'newAuthority', value: {kind: 'none'}});
    });
  }

  it('Token-2022 only: the transfer hook (initialize, update), the permanent delegate, its own authority types', () => {
    const hook = new PublicKey(new Uint8Array(32).fill(7));
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [36, 0, ...ME.toBytes(), ...hook.toBytes()], [MINT]))).toMatchObject({
      name: 'transferHookInitialize',
      fields: [
        {name: 'mint', value: {kind: 'address', value: MINT.toBase58()}},
        {name: 'authority', value: {kind: 'address', value: ME.toBase58()}},
        {name: 'programId', value: {kind: 'address', value: hook.toBase58()}},
      ],
    });
    // An OptionalNonZeroPubkey of zeros is "none" — its own distinct value (fix round 1, IMPORTANT).
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [36, 1, ...new Uint8Array(32)], [MINT, ME])).fields[2]).toEqual({name: 'programId', value: {kind: 'none'}});
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [35, ...DST.toBytes()], [MINT]))).toMatchObject({name: 'initializePermanentDelegate', fields: [{name: 'mint'}, {name: 'delegate', value: {kind: 'address', value: DST.toBase58()}}]});
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [6, 8, 1, ...DST.toBytes()], [MINT, ME])).fields[2]).toEqual({name: 'authorityType', value: {kind: 'text', value: 'permanentDelegate'}});
    // The same tags on the classic program are not those instructions.
    expect(one(tokenIx(TOKEN_PROGRAM, [36, 0, ...ME.toBytes(), ...hook.toBytes()], [MINT]))).toMatchObject({program: 'token', name: null, fields: []});
    expect(one(tokenIx(TOKEN_PROGRAM, [6, 8, 1, ...DST.toBytes()], [MINT, ME]))).toMatchObject({program: 'token', name: 'setAuthority', fields: []});
  });

  it('a known tag outside the decoded list is named with no fields (mintTo); a trailing byte on a decoded instruction is an unknown program (fail closed — fix round 1)', () => {
    expect(one(tokenIx(TOKEN_PROGRAM, [7, ...u64(1n)], [MINT, DST, ME]))).toMatchObject({program: 'token', name: 'mintTo', fields: []});
    // SPL Token's unpack ignores trailing bytes and would still execute this transfer — never shown as "transfer" with
    // the amount hidden.
    expect(one(tokenIx(TOKEN_PROGRAM, [3, ...u64(1n), 0], [SRC, DST, ME]))).toEqual({programId: TOKEN_PROGRAM, program: null, name: null, fields: []});
  });

  it('core’s own TransferChecked decodes as it is built', () => {
    const d = one(buildTransferCheckedInstruction(SRC, MINT, DST, ME, 42n, 9));
    expect(d.name).toBe('transferChecked');
    expect(d.fields.find(f => f.name === 'amount')?.value).toEqual({kind: 'amount', value: '42', decimals: 9});
  });
});

describe('decodeInstructions — ATA, Compute Budget, the presale program', () => {
  it('associated token account: create (no data) and createIdempotent', () => {
    const ata = findAssociatedTokenAddress(TO, MINT);
    const idem = one(buildCreateAtaIdempotentInstruction(ME, ata, TO, MINT));
    expect(idem).toMatchObject({programId: ATA_PROGRAM, program: 'associated-token', name: 'createIdempotent'});
    expect(idem.fields.map(f => [f.name, f.value.kind === 'address' ? f.value.value : null])).toEqual([
      ['payer', ME.toBase58()],
      ['account', ata.toBase58()],
      ['wallet', TO.toBase58()],
      ['mint', MINT.toBase58()],
    ]);
    const create = one(new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), keys: idem.fields.map(f => ({pubkey: new PublicKey(f.value.kind === 'address' ? (f.value.value ?? '') : ''), isSigner: false, isWritable: true})), data: Buffer.alloc(0)}));
    expect(create.name).toBe('create');
  });

  it('compute budget: the unit limit and price', () => {
    expect(one(ComputeBudgetProgram.setComputeUnitLimit({units: 200_000}))).toMatchObject({program: 'compute-budget', name: 'setComputeUnitLimit', fields: [{name: 'units', value: {kind: 'number', value: '200000'}}]});
    expect(one(ComputeBudgetProgram.setComputeUnitPrice({microLamports: 10_000}))).toMatchObject({name: 'setComputeUnitPrice', fields: [{name: 'microLamports', value: {kind: 'number', value: '10000'}}]});
  });

  it('the presale program by its Anchor discriminator: presale_purchase_with_sol, with its argument and the IDL’s account names', () => {
    const d = one(buildSolPurchaseInstruction(ME, 1_000_000_000n, ME, new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd')));
    expect(d.program).toBe('presale');
    expect(d.name).toBe('presale_purchase_with_sol');
    expect(d.fields[0]).toEqual({name: 'sol_amount', value: {kind: 'number', value: '1000000000'}});
    expect(d.fields.slice(1).map(f => f.name)).toEqual(['config', 'user_account', 'user_allocation', 'referrer_allocation', 'pyth_sol_usd_price', 'user', 'sol_treasury', 'system_program']);
    expect(d.fields.find(f => f.name === 'user')?.value).toEqual({kind: 'address', value: ME.toBase58()});
    // An unknown discriminator of the presale program is not guessed.
    expect(one(new TransactionInstruction({programId: new PublicKey('6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt'), keys: [], data: Buffer.alloc(8, 9)}))).toMatchObject({program: 'presale', name: null, fields: []});
  });

  it('a program outside the decoded set is an unknown program (B1 §3), its address kept', () => {
    expect(one(new TransactionInstruction({programId: UNKNOWN, keys: [{pubkey: ME, isSigner: true, isWritable: true}], data: Buffer.from([1, 2, 3])}))).toEqual({programId: UNKNOWN.toBase58(), program: null, name: null, fields: []});
  });
});

describe('address lookup tables (spec §3.3)', () => {
  const tableKey = Keypair.generate().publicKey;
  const table = (addresses: PublicKey[]): AddressLookupTableAccount =>
    ({key: tableKey, state: {deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses}, isActive: () => true}) as unknown as AddressLookupTableAccount;
  /** A lookup table account's bytes: the 56-byte meta (variant 1), then the addresses. */
  const tableData = (addresses: PublicKey[]): Uint8Array => {
    const d = new Uint8Array(56 + 32 * addresses.length);
    new DataView(d.buffer).setUint32(0, 1, true);
    addresses.forEach((a, i) => d.set(a.toBytes(), 56 + 32 * i));
    return d;
  };

  it('a table account parses to its addresses; anything else is not a table', () => {
    expect(tableAddresses(tableData([DST, SRC]))).toEqual([DST.toBase58(), SRC.toBase58()]);
    expect(tableAddresses(new Uint8Array(55))).toBeNull();
    expect(tableAddresses(new Uint8Array(57))).toBeNull();
    const uninitialized = tableData([DST]);
    uninitialized[0] = 0;
    expect(tableAddresses(uninitialized)).toBeNull();
    expect(ADDRESS_LOOKUP_TABLE_PROGRAM).toBe('AddressLookupTab1e1111111111111111111111111');
  });

  it('resolves a v0 transfer whose recipient comes from a table; an unread table makes the instruction an unknown program', () => {
    const ix = SystemProgram.transfer({fromPubkey: ME, toPubkey: DST, lamports: 9});
    const p = parsed(v0([ix], [table([SRC, DST])]));
    expect(tablesOf(p)).toEqual([tableKey.toBase58()]);
    expect(p.lookups).toEqual([{table: tableKey.toBase58(), writable: [1], readonly: []}]);
    const ok = decodeInstructions(p, resolveKeys(p, new Map([[tableKey.toBase58(), [SRC.toBase58(), DST.toBase58()]]])));
    expect(ok[0]?.fields[1]).toEqual({name: 'to', value: {kind: 'address', value: DST.toBase58()}});
    // The lookup's account is writable (it came through the writable list).
    expect(isWritableIndex(p, p.staticKeys.length)).toBe(true);
    for (const tables of [new Map(), new Map([[tableKey.toBase58(), null]]), new Map([[tableKey.toBase58(), [SRC.toBase58()]]])]) {
      expect(decodeInstructions(p, resolveKeys(p, tables))).toEqual([{programId: '11111111111111111111111111111111', program: null, name: null, fields: []}]);
    }
  });

  it('base58 round trip of a key in a table (sanity of the fixture)', () => {
    expect(base58.encode(tableData([DST]).subarray(56))).toBe(DST.toBase58());
  });
});

// Fix round 1 (controller ruling, CRITICAL): on-chain, SPL Token/Token-2022's unpack, System's bincode
// (allow_trailing_bytes), Anchor's deserialize and Compute Budget's try_from_slice_unchecked all ignore trailing bytes
// and STILL EXECUTE the instruction from its valid prefix. A dApp can append one byte to any of these and the wallet
// must never show a known name with the amount, destination, delegate or new owner hidden — the whole instruction is
// an unknown program instead. Positive controls (a plain, well-formed instruction of each kind) are covered by the
// describes above and are unchanged by this fix.
describe('a trailing byte after a decoded instruction is an unknown program, never a known name with empty fields (fail closed — fix round 1, CRITICAL)', () => {
  it('Token transfer + 1 byte', () => {
    expect(one(tokenIx(TOKEN_PROGRAM, [3, ...u64(7n), 0], [SRC, DST, ME]))).toEqual({programId: TOKEN_PROGRAM, program: null, name: null, fields: []});
  });

  it('Token-2022 setAuthority + 1 byte', () => {
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [6, 2, 1, ...DST.toBytes(), 0], [SRC, ME]))).toEqual({programId: TOKEN_2022_PROGRAM, program: null, name: null, fields: []});
  });

  it('System transfer + 1 byte', () => {
    const ix = new TransactionInstruction({programId: SystemProgram.programId, keys: [{pubkey: ME, isSigner: true, isWritable: true}, {pubkey: TO, isSigner: false, isWritable: true}], data: Buffer.from([2, 0, 0, 0, ...u64(5n), 9])});
    expect(one(ix)).toEqual({programId: SYSTEM_PROGRAM, program: null, name: null, fields: []});
  });

  it('a presale instruction (presale_purchase_with_sol) + 1 byte', () => {
    const presaleIx = buildSolPurchaseInstruction(ME, 1_000_000_000n, ME, new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd'));
    const plus1 = new TransactionInstruction({programId: presaleIx.programId, keys: presaleIx.keys, data: Buffer.concat([presaleIx.data, Buffer.from([0])])});
    expect(one(plus1)).toEqual({programId: PRESALE_PROGRAM, program: null, name: null, fields: []});
  });

  it('ComputeBudget setComputeUnitPrice + 1 byte', () => {
    const priceIx = ComputeBudgetProgram.setComputeUnitPrice({microLamports: 10_000});
    const plus1 = new TransactionInstruction({programId: priceIx.programId, keys: priceIx.keys, data: Buffer.concat([priceIx.data, Buffer.from([0])])});
    expect(one(plus1)).toEqual({programId: COMPUTE_BUDGET_PROGRAM, program: null, name: null, fields: []});
  });
});

// Fix round 1 (controller ruling, IMPORTANT): `{kind: 'address', value: null}` used to mean both "too few accounts"
// and a legitimate protocol-level "none" — indistinguishable. They are now distinct: `none` is its own FieldValue kind,
// and too few accounts makes the whole instruction unknown (never a named instruction with a guessed-absent field).
describe('too few accounts is an unknown program, distinct from an explicit none (fail closed — fix round 1, IMPORTANT)', () => {
  it('setAuthority to none (the Option tag is 0) vs setAuthority with too few accounts (only 1 of the 2 it needs)', () => {
    // The legitimate none: covered already by the positive-control describes above
    // (`{name: 'newAuthority', value: {kind: 'none'}}`); repeated here for contrast with the failure case below.
    expect(one(tokenIx(TOKEN_PROGRAM, [6, 3, 0], [SRC, ME])).fields[3]).toEqual({name: 'newAuthority', value: {kind: 'none'}});
    // setAuthority decodes `account` (index 0) and `currentAuthority` (index 1); only one account is supplied here.
    const tooFew = new TransactionInstruction({programId: new PublicKey(TOKEN_PROGRAM), data: Buffer.from([6, 3, 0]), keys: [{pubkey: SRC, isSigner: false, isWritable: true}]});
    expect(one(tooFew)).toEqual({programId: TOKEN_PROGRAM, program: null, name: null, fields: []});
  });

  it('transferHookUpdate with too few accounts (only the mint, missing the authority) is unknown, not a guessed authority', () => {
    const tooFew = new TransactionInstruction({programId: new PublicKey(TOKEN_2022_PROGRAM), data: Buffer.from([36, 1, ...new Uint8Array(32)]), keys: [{pubkey: MINT, isSigner: false, isWritable: false}]});
    expect(one(tooFew)).toEqual({programId: TOKEN_2022_PROGRAM, program: null, name: null, fields: []});
  });

  it('the presale program with one fewer account than its IDL declares is unknown, not a guess', () => {
    const presaleIx = buildSolPurchaseInstruction(ME, 1_000_000_000n, ME, new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd'));
    const tooFew = new TransactionInstruction({programId: presaleIx.programId, keys: presaleIx.keys.slice(0, -1), data: presaleIx.data});
    expect(one(tooFew)).toEqual({programId: PRESALE_PROGRAM, program: null, name: null, fields: []});
  });
});
