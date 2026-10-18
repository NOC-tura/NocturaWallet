import {base58} from '@scure/base';
import {MAINNET_PROGRAM_ID} from '../../../../../core/presale/addresses';
import type {ResolvedKeys} from './keys';
import {PRESALE_INSTRUCTIONS, STAKE_TIERS, type PresaleArgType} from './presaleIdl';
import type {ParsedTx} from './wire';

/**
 * The decoder (spec B1c §3.3, B1 §3; D6 — our own, no new third-party code in the signing path): every instruction of a
 * dApp's transaction, named and with its fields, for the programs the wallet knows — System (transfer, createAccount,
 * assign, allocate, advanceNonceAccount; B1c-3: createAccountWithSeed, allocateWithSeed, assignWithSeed,
 * transferWithSeed), SPL Token and Token-2022 (transfer, transferChecked, approve, approveChecked,
 * revoke, setAuthority, closeAccount, burn, burnChecked, initializeAccount 1/2/3, syncNative, freezeAccount,
 * thawAccount, and the Token-2022 extensions B1 §3 names: the transfer hook and the permanent delegate), the Associated
 * Token Account program (create, createIdempotent), Compute Budget (the unit limit and price) and the presale program
 * (by Anchor discriminator, presaleIdl.ts). Any other instruction of a known program is named when its tag is known and
 * carries no fields; an instruction of any other program — or one that touches an account no lookup table resolved —
 * is an unknown program (`program: null`). Pure: the decoded instructions never depend on the coordinator once the
 * lookups are resolved (B1 §3).
 *
 * Fail closed (fix round 1, controller ruling): on-chain parsers for every one of these programs (SPL Token/Token-2022's
 * unpack, System's bincode `allow_trailing_bytes`, Anchor's `deserialize`, Compute Budget's `try_from_slice_unchecked`)
 * ignore trailing bytes and bad option tags and STILL EXECUTE the instruction from its valid prefix. So an instruction
 * of a known program whose data does not parse strictly — trailing bytes left over, too few bytes, an invalid internal
 * enum tag (an Option discriminant that isn't 0/1, an AuthorityType or TransferHookInstruction tag we don't recognise
 * at all), or FEWER ACCOUNTS than the instruction needs — is never shown as a known name with missing or guessed
 * fields: the whole instruction decodes as a wholly unknown program (`{program: null, name: null, fields: []}`,
 * `programId` kept). This is distinct from a legitimate protocol-level "none" (setAuthority's new authority when the
 * Option tag is 0; Token-2022's OptionalNonZeroPubkey of all zero bytes), which gets its own `{kind: 'none'}` field
 * value — never the same shape as a field the decoder could not resolve.
 */
export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
export const PRESALE_PROGRAM = MAINNET_PROGRAM_ID;

export type ProgramKey = 'system' | 'token' | 'token-2022' | 'associated-token' | 'compute-budget' | 'presale';
export const PROGRAMS: ReadonlyMap<string, ProgramKey> = new Map([
  [SYSTEM_PROGRAM, 'system'],
  [TOKEN_PROGRAM, 'token'],
  [TOKEN_2022_PROGRAM, 'token-2022'],
  [ATA_PROGRAM, 'associated-token'],
  [COMPUTE_BUDGET_PROGRAM, 'compute-budget'],
  [PRESALE_PROGRAM, 'presale'],
]);

/**
 * A field's value. `address` is always a resolved, present account or pubkey (never null — see `none` below) and
 * `amount`s are base-unit strings. `none` is a DISTINCT value from a resolution failure: it is the decoder's
 * representation of a legitimate protocol-level absence (an Option<Pubkey> tag of 0, an OptionalNonZeroPubkey of all
 * zero bytes) — never used for "the decoder couldn't tell" (that makes the whole instruction unknown instead; fix
 * round 1, IMPORTANT).
 */
export type FieldValue =
  | {kind: 'address'; value: string}
  | {kind: 'none'}
  | {kind: 'lamports'; value: string}
  | {kind: 'amount'; value: string; decimals: number | null}
  | {kind: 'number'; value: string}
  | {kind: 'bool'; value: boolean}
  | {kind: 'text'; value: string}
  | {kind: 'hex'; value: string};
export interface Field {
  name: string;
  value: FieldValue;
}
export interface DecodedInstruction {
  /** The program's address, or null when even that is not a static key (a malformed message — never a known program). */
  programId: string | null;
  /** Null: an unknown program (not in the decoded set, an account a lookup table did not resolve, or a known program's
   * instruction whose data did not parse strictly — fix round 1, fail closed). */
  program: ProgramKey | null;
  /** The instruction's name (the program's own, e.g. `transferChecked`), or null when its tag is not one the wallet knows. */
  name: string | null;
  fields: Field[];
}

const SYSTEM_NAMES = ['createAccount', 'assign', 'transfer', 'createAccountWithSeed', 'advanceNonceAccount', 'withdrawNonceAccount', 'initializeNonceAccount', 'authorizeNonceAccount', 'allocate', 'allocateWithSeed', 'assignWithSeed', 'transferWithSeed', 'upgradeNonceAccount'];
const TOKEN_NAMES = [
  'initializeMint', 'initializeAccount', 'initializeMultisig', 'transfer', 'approve', 'revoke', 'setAuthority', 'mintTo', 'burn', 'closeAccount', 'freezeAccount', 'thawAccount',
  'transferChecked', 'approveChecked', 'mintToChecked', 'burnChecked', 'initializeAccount2', 'syncNative', 'initializeAccount3', 'initializeMultisig2', 'initializeMint2',
  'getAccountDataSize', 'initializeImmutableOwner', 'amountToUiAmount', 'uiAmountToAmount',
];
/** Token-2022's tags past the classic program's (25 …). */
const TOKEN_2022_NAMES = [
  ...TOKEN_NAMES, 'initializeMintCloseAuthority', 'transferFeeExtension', 'confidentialTransferExtension', 'defaultAccountStateExtension', 'reallocate', 'memoTransferExtension',
  'createNativeMint', 'initializeNonTransferableMint', 'interestBearingMintExtension', 'cpiGuardExtension', 'initializePermanentDelegate', 'transferHookExtension',
  'confidentialTransferFeeExtension', 'withdrawExcessLamports', 'metadataPointerExtension', 'groupPointerExtension', 'groupMemberPointerExtension', 'confidentialMintBurnExtension',
  'scaledUiAmountExtension', 'pausableExtension',
];
/** SetAuthority's AuthorityType, by tag (0–3 classic; the rest Token-2022). */
export const AUTHORITY_TYPES = [
  'mintTokens', 'freezeAccount', 'accountOwner', 'closeAccount', 'transferFeeConfig', 'withheldWithdraw', 'closeMint', 'interestRate', 'permanentDelegate',
  'confidentialTransferMint', 'transferHookProgramId', 'confidentialTransferFeeConfig', 'metadataPointer', 'groupPointer', 'groupMemberPointer', 'scaledUiAmount', 'pause',
];
const COMPUTE_NAMES = ['requestUnits', 'requestHeapFrame', 'setComputeUnitLimit', 'setComputeUnitPrice', 'setLoadedAccountsDataSizeLimit'];

/** Little-endian reads that never throw: null past the end. */
class Reader {
  constructor(
    readonly data: Uint8Array,
    private at = 0,
  ) {}
  private view(n: number): DataView | null {
    if (this.at + n > this.data.length) return null;
    const v = new DataView(this.data.buffer, this.data.byteOffset + this.at, n);
    this.at += n;
    return v;
  }
  u8(): number | null {
    return this.view(1)?.getUint8(0) ?? null;
  }
  u32(): number | null {
    return this.view(4)?.getUint32(0, true) ?? null;
  }
  u64(): bigint | null {
    return this.view(8)?.getBigUint64(0, true) ?? null;
  }
  i64(): bigint | null {
    return this.view(8)?.getBigInt64(0, true) ?? null;
  }
  bytes(n: number): Uint8Array | null {
    if (this.at + n > this.data.length) return null;
    const out = this.data.subarray(this.at, this.at + n);
    this.at += n;
    return out;
  }
  pubkey(): string | null {
    const b = this.bytes(32);
    return b === null ? null : base58.encode(b);
  }
  /** A System seed: bincode's String (u64 length, then the bytes) of at most MAX_SEED_LEN bytes — longer, the runtime
   * refuses the instruction. */
  seed(): Uint8Array | null {
    const n = this.u64();
    return n === null || n > BigInt(MAX_SEED_LEN) ? null : this.bytes(Number(n));
  }
  /** The bytes all read, none left over (a strict decode). */
  done(): boolean {
    return this.at === this.data.length;
  }
}

/** The runtime's MAX_SEED_LEN for an address derived with a seed. */
const MAX_SEED_LEN = 32;

/** An address field: `value` is always present — a resolution failure never reaches here (see `Acc`, below). */
const addr = (name: string, value: string): Field => ({name, value: {kind: 'address', value}});
/** A legitimate, protocol-level absence (never a resolution failure — those make the whole instruction unknown). */
const none = (name: string): Field => ({name, value: {kind: 'none'}});
/** An address that may be legitimately absent (an Option<Pubkey>/OptionalNonZeroPubkey already read to completion). */
const addrOrNone = (name: string, value: string | null): Field => (value === null ? none(name) : addr(name, value));
const lamports = (name: string, v: bigint): Field => ({name, value: {kind: 'lamports', value: v.toString()}});
const amount = (name: string, v: bigint, decimals: number | null): Field => ({name, value: {kind: 'amount', value: v.toString(), decimals}});
const num = (name: string, v: number | bigint): Field => ({name, value: {kind: 'number', value: v.toString()}});
const text = (name: string, v: string): Field => ({name, value: {kind: 'text', value: v}});
const hex = (b: Uint8Array): string => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
/** A seed as text when it is printable ASCII, else its bytes in hex (never an invisible or look-alike character shown as
 * text); null when it is not UTF-8 — bincode's String refuses it, so the runtime never runs the instruction. */
function seedField(name: string, b: Uint8Array): Field | null {
  try {
    new TextDecoder('utf-8', {fatal: true}).decode(b);
  } catch {
    return null;
  }
  return b.every(x => x >= 0x20 && x <= 0x7e) ? text(name, String.fromCharCode(...b)) : {name, value: {kind: 'hex', value: hex(b)}};
}

/** The instruction's own accounts, resolved by index — undefined when the instruction simply did not supply that many
 * accounts (never null: an account that failed lookup-table resolution already made the whole instruction unknown,
 * one level up in `decodeInstructions`, before any of this runs). */
type Acc = (i: number) => string | undefined;

/** Two/three/four account-sourced addresses at once — null (too few accounts) if ANY index is out of range; fix round
 * 1, IMPORTANT: this is a decode failure, never a silently-absent field (see `none`, above). */
const acc2 = (acc: Acc, i0: number, i1: number): [string, string] | null => {
  const a0 = acc(i0);
  const a1 = acc(i1);
  return a0 === undefined || a1 === undefined ? null : [a0, a1];
};
const acc3 = (acc: Acc, i0: number, i1: number, i2: number): [string, string, string] | null => {
  const a0 = acc(i0);
  const a1 = acc(i1);
  const a2 = acc(i2);
  return a0 === undefined || a1 === undefined || a2 === undefined ? null : [a0, a1, a2];
};
const acc4 = (acc: Acc, i0: number, i1: number, i2: number, i3: number): [string, string, string, string] | null => {
  const a0 = acc(i0);
  const a1 = acc(i1);
  const a2 = acc(i2);
  const a3 = acc(i3);
  return a0 === undefined || a1 === undefined || a2 === undefined || a3 === undefined ? null : [a0, a1, a2, a3];
};

type Known = {name: string | null; fields: Field[]};
const unnamed: Known = {name: null, fields: []};
/** Named by its tag, no fields — a known program's instruction we do not attempt to decode (its tag is recognised but
 * outside our decoded list, or its data could not even supply a tag). Never used when we DO attempt to decode an
 * instruction and its data fails to parse strictly: that is `null` (the whole instruction becomes unknown — see the
 * module doc and `decodeInstructions`). */
const nameOnly = (names: readonly string[], tag: number | null): Known => ({name: tag === null ? null : (names[tag] ?? null), fields: []});

function system(r: Reader, acc: Acc): Known | null {
  const tag = r.u32();
  switch (tag) {
    case 0: {
      const l = r.u64();
      const space = r.u64();
      const owner = r.pubkey();
      const accs = acc2(acc, 0, 1);
      if (l === null || space === null || owner === null || accs === null || !r.done()) return null;
      const [from, newAccount] = accs;
      return {name: 'createAccount', fields: [addr('from', from), addr('newAccount', newAccount), lamports('lamports', l), num('space', space), addr('owner', owner)]};
    }
    case 1: {
      const owner = r.pubkey();
      const account = acc(0);
      if (owner === null || account === undefined || !r.done()) return null;
      return {name: 'assign', fields: [addr('account', account), addr('owner', owner)]};
    }
    case 2: {
      const l = r.u64();
      const accs = acc2(acc, 0, 1);
      if (l === null || accs === null || !r.done()) return null;
      const [from, to] = accs;
      return {name: 'transfer', fields: [addr('from', from), addr('to', to), lamports('lamports', l)]};
    }
    case 3: {
      const base = r.pubkey();
      const seed = r.seed();
      const l = r.u64();
      const space = r.u64();
      const owner = r.pubkey();
      const accs = acc2(acc, 0, 1);
      const seedF = seed === null ? null : seedField('seed', seed);
      if (base === null || seedF === null || l === null || space === null || owner === null || accs === null || !r.done()) return null;
      const [from, newAccount] = accs;
      return {name: 'createAccountWithSeed', fields: [addr('from', from), addr('newAccount', newAccount), addr('base', base), seedF, lamports('lamports', l), num('space', space), addr('owner', owner)]};
    }
    case 4: {
      const accs = acc2(acc, 0, 2);
      if (accs === null || !r.done()) return null;
      const [nonceAccount, authority] = accs;
      return {name: 'advanceNonceAccount', fields: [addr('nonceAccount', nonceAccount), addr('authority', authority)]};
    }
    case 8: {
      const space = r.u64();
      const account = acc(0);
      if (space === null || account === undefined || !r.done()) return null;
      return {name: 'allocate', fields: [addr('account', account), num('space', space)]};
    }
    case 9:
    case 10: {
      const base = r.pubkey();
      const seed = r.seed();
      const space = tag === 9 ? r.u64() : 0n;
      const owner = r.pubkey();
      const account = acc(0);
      const seedF = seed === null ? null : seedField('seed', seed);
      if (base === null || seedF === null || space === null || owner === null || account === undefined || !r.done()) return null;
      const head = [addr('account', account), addr('base', base), seedF];
      return tag === 9 ? {name: 'allocateWithSeed', fields: [...head, num('space', space), addr('owner', owner)]} : {name: 'assignWithSeed', fields: [...head, addr('owner', owner)]};
    }
    case 11: {
      const l = r.u64();
      const seed = r.seed();
      const fromOwner = r.pubkey();
      const accs = acc3(acc, 0, 1, 2);
      const seedF = seed === null ? null : seedField('fromSeed', seed);
      if (l === null || seedF === null || fromOwner === null || accs === null || !r.done()) return null;
      const [from, fromBase, to] = accs;
      return {name: 'transferWithSeed', fields: [addr('from', from), addr('fromBase', fromBase), addr('to', to), lamports('lamports', l), seedF, addr('fromOwner', fromOwner)]};
    }
    default:
      return nameOnly(SYSTEM_NAMES, tag);
  }
}

/** SPL Token and Token-2022 (the same layout for every shared tag). */
function token(r: Reader, acc: Acc, names: readonly string[]): Known | null {
  const tag = r.u8();
  const withAmount = (name: string, i0: number, i1: number, i2: number, build: (p0: string, p1: string, p2: string, a: bigint) => Field[]): Known | null => {
    const a = r.u64();
    const accs = acc3(acc, i0, i1, i2);
    return a === null || accs === null || !r.done() ? null : {name, fields: build(accs[0], accs[1], accs[2], a)};
  };
  const withChecked4 = (name: string, i0: number, i1: number, i2: number, i3: number, build: (p0: string, p1: string, p2: string, p3: string, a: bigint, d: number) => Field[]): Known | null => {
    const a = r.u64();
    const d = r.u8();
    const accs = acc4(acc, i0, i1, i2, i3);
    return a === null || d === null || accs === null || !r.done() ? null : {name, fields: build(accs[0], accs[1], accs[2], accs[3], a, d)};
  };
  const withChecked3 = (name: string, i0: number, i1: number, i2: number, build: (p0: string, p1: string, p2: string, a: bigint, d: number) => Field[]): Known | null => {
    const a = r.u64();
    const d = r.u8();
    const accs = acc3(acc, i0, i1, i2);
    return a === null || d === null || accs === null || !r.done() ? null : {name, fields: build(accs[0], accs[1], accs[2], a, d)};
  };
  switch (tag) {
    case 1: {
      const accs = acc3(acc, 0, 1, 2);
      if (accs === null || !r.done()) return null;
      return {name: 'initializeAccount', fields: [addr('account', accs[0]), addr('mint', accs[1]), addr('owner', accs[2])]};
    }
    case 3:
      return withAmount('transfer', 0, 1, 2, (source, destination, owner, a) => [addr('source', source), addr('destination', destination), addr('owner', owner), amount('amount', a, null)]);
    case 4:
      return withAmount('approve', 0, 1, 2, (source, delegate, owner, a) => [addr('source', source), addr('delegate', delegate), addr('owner', owner), amount('amount', a, null)]);
    case 5: {
      const accs = acc2(acc, 0, 1);
      if (accs === null || !r.done()) return null;
      return {name: 'revoke', fields: [addr('source', accs[0]), addr('owner', accs[1])]};
    }
    case 6: {
      const type = r.u8();
      const option = r.u8();
      const next = option === 1 ? r.pubkey() : null;
      const authorityType = type === null ? undefined : AUTHORITY_TYPES[type];
      const accs = acc2(acc, 0, 1);
      if (authorityType === undefined || (option !== 0 && option !== 1) || (option === 1 && next === null) || accs === null || !r.done()) return null;
      // Token-2022 only past the classic four — a dispatch mismatch, not a parse failure: this opcode's layout parsed
      // fine, it simply names an authority type that this program's AuthorityType enum does not have.
      if (type !== null && type > 3 && names !== TOKEN_2022_NAMES) return nameOnly(names, tag);
      return {name: 'setAuthority', fields: [addr('account', accs[0]), addr('currentAuthority', accs[1]), text('authorityType', authorityType), addrOrNone('newAuthority', next)]};
    }
    case 8:
      return withAmount('burn', 0, 1, 2, (account, mint, owner, a) => [addr('account', account), addr('mint', mint), addr('owner', owner), amount('amount', a, null)]);
    case 9: {
      const accs = acc3(acc, 0, 1, 2);
      if (accs === null || !r.done()) return null;
      return {name: 'closeAccount', fields: [addr('account', accs[0]), addr('destination', accs[1]), addr('owner', accs[2])]};
    }
    case 10:
    case 11: {
      const accs = acc3(acc, 0, 1, 2);
      if (accs === null || !r.done()) return null;
      return {name: tag === 10 ? 'freezeAccount' : 'thawAccount', fields: [addr('account', accs[0]), addr('mint', accs[1]), addr('authority', accs[2])]};
    }
    case 12:
      return withChecked4('transferChecked', 0, 1, 2, 3, (source, mint, destination, owner, a, d) => [addr('source', source), addr('mint', mint), addr('destination', destination), addr('owner', owner), amount('amount', a, d)]);
    case 13:
      return withChecked4('approveChecked', 0, 1, 2, 3, (source, mint, delegate, owner, a, d) => [addr('source', source), addr('mint', mint), addr('delegate', delegate), addr('owner', owner), amount('amount', a, d)]);
    case 15:
      return withChecked3('burnChecked', 0, 1, 2, (account, mint, owner, a, d) => [addr('account', account), addr('mint', mint), addr('owner', owner), amount('amount', a, d)]);
    case 16:
    case 18: {
      const owner = r.pubkey();
      const accs = acc2(acc, 0, 1);
      if (owner === null || accs === null || !r.done()) return null;
      return {name: tag === 16 ? 'initializeAccount2' : 'initializeAccount3', fields: [addr('account', accs[0]), addr('mint', accs[1]), addr('owner', owner)]};
    }
    case 17: {
      const account = acc(0);
      if (account === undefined || !r.done()) return null;
      return {name: 'syncNative', fields: [addr('account', account)]};
    }
    case 35: {
      if (names !== TOKEN_2022_NAMES) return nameOnly(names, tag);
      const delegate = r.pubkey();
      const mint = acc(0);
      if (delegate === null || mint === undefined || !r.done()) return null;
      return {name: 'initializePermanentDelegate', fields: [addr('mint', mint), addr('delegate', delegate)]};
    }
    case 36: {
      if (names !== TOKEN_2022_NAMES) return nameOnly(names, tag);
      // TransferHookInstruction: 0 Initialize {authority, program_id} — both OptionalNonZeroPubkey (zeros = none); 1 Update {program_id}.
      const sub = r.u8();
      const opt = (): string | null | undefined => {
        const b = r.bytes(32);
        if (b === null) return undefined;
        return b.every(x => x === 0) ? null : base58.encode(b);
      };
      if (sub === 0) {
        const authority = opt();
        const programId = opt();
        const mint = acc(0);
        if (authority === undefined || programId === undefined || mint === undefined || !r.done()) return null;
        return {name: 'transferHookInitialize', fields: [addr('mint', mint), addrOrNone('authority', authority), addrOrNone('programId', programId)]};
      }
      if (sub === 1) {
        const programId = opt();
        const accs = acc2(acc, 0, 1);
        if (programId === undefined || accs === null || !r.done()) return null;
        return {name: 'transferHookUpdate', fields: [addr('mint', accs[0]), addr('authority', accs[1]), addrOrNone('programId', programId)]};
      }
      // Neither Initialize (0) nor Update (1): an invalid TransferHookInstruction discriminant — a bad tag, fail closed.
      return null;
    }
    default:
      return nameOnly(names, tag);
  }
}

function ata(r: Reader, acc: Acc): Known | null {
  const tag = r.data.length === 0 ? 0 : r.u8();
  if (tag === 0 || tag === 1) {
    // B1c-3: the token program (account 5, after the System program) is named — the program reads all six accounts.
    const accs = acc4(acc, 0, 1, 2, 3);
    const tokenProgram = acc2(acc, 4, 5);
    if (accs === null || tokenProgram === null || !r.done()) return null;
    const fields = [addr('payer', accs[0]), addr('account', accs[1]), addr('wallet', accs[2]), addr('mint', accs[3]), addr('tokenProgram', tokenProgram[1])];
    return {name: tag === 0 ? 'create' : 'createIdempotent', fields};
  }
  if (tag === 2) {
    if (!r.done()) return null;
    return {name: 'recoverNested', fields: []};
  }
  return unnamed;
}

function computeBudget(r: Reader): Known | null {
  const tag = r.u8();
  if (tag === 2 || tag === 1 || tag === 4) {
    const v = r.u32();
    if (v === null || !r.done()) return null;
    return {name: COMPUTE_NAMES[tag] ?? null, fields: [num(tag === 2 ? 'units' : 'bytes', v)]};
  }
  if (tag === 3) {
    const v = r.u64();
    if (v === null || !r.done()) return null;
    return {name: 'setComputeUnitPrice', fields: [num('microLamports', v)]};
  }
  return nameOnly(COMPUTE_NAMES, tag);
}

function presaleArg(r: Reader, name: string, type: PresaleArgType): Field | null {
  if (type === 'u8') {
    const v = r.u8();
    return v === null ? null : num(name, v);
  }
  if (type === 'u64') {
    const v = r.u64();
    return v === null ? null : num(name, v);
  }
  if (type === 'i64') {
    const v = r.i64();
    return v === null ? null : num(name, v);
  }
  if (type === 'bool') {
    const v = r.u8();
    return v === 0 || v === 1 ? {name, value: {kind: 'bool', value: v === 1}} : null;
  }
  if (type === 'pubkey') {
    const v = r.pubkey();
    return v === null ? null : addr(name, v);
  }
  if (type === 'tier') {
    const v = r.u8();
    const tier = v === null ? undefined : STAKE_TIERS[v];
    return tier === undefined ? null : text(name, tier);
  }
  const b = r.bytes(type.bytes);
  return b === null ? null : {name, value: {kind: 'hex', value: hex(b)}};
}

function presale(r: Reader, acc: Acc): Known | null {
  const head = r.bytes(8);
  if (head === null) return unnamed;
  const ix = PRESALE_INSTRUCTIONS.find(x => x.discriminator.every((b, i) => head[i] === b));
  if (ix === undefined) return unnamed;
  const fields: Field[] = [];
  for (const a of ix.args) {
    const f = presaleArg(r, a.name, a.type);
    if (f === null) return null;
    fields.push(f);
  }
  if (!r.done()) return null;
  const accountFields: Field[] = [];
  for (let i = 0; i < ix.accounts.length; i++) {
    const name = ix.accounts[i];
    const value = acc(i);
    if (name === undefined || value === undefined) return null;
    accountFields.push(addr(name, value));
  }
  return {name: ix.name, fields: [...fields, ...accountFields]};
}

/**
 * Every instruction of `p`, decoded against its resolved keys. An instruction that touches an account the lookups left
 * unresolved is an unknown program, whatever its program (spec §3.3) — and so, fix round 1, is one of a known program
 * whose data (or whose own, too-short account list) did not parse strictly: `system`/`token`/`ata`/`computeBudget`/
 * `presale` signal this by returning `null` instead of a `Known`, and it is treated exactly like an unresolved account.
 */
export function decodeInstructions(p: ParsedTx, r: ResolvedKeys): DecodedInstruction[] {
  return p.instructions.map(ix => {
    const programId = ix.program < p.staticKeys.length ? (p.staticKeys[ix.program] ?? null) : null;
    const program = programId === null ? null : (PROGRAMS.get(programId) ?? null);
    const resolved = ix.accounts.map(i => r.keys[i] ?? null);
    if (program === null || resolved.some(a => a === null)) return {programId, program: null, name: null, fields: []};
    const acc: Acc = i => resolved[i] ?? undefined;
    const reader = new Reader(ix.data);
    const known =
      program === 'system'
        ? system(reader, acc)
        : program === 'token'
          ? token(reader, acc, TOKEN_NAMES)
          : program === 'token-2022'
            ? token(reader, acc, TOKEN_2022_NAMES)
            : program === 'associated-token'
              ? ata(reader, acc)
              : program === 'compute-budget'
                ? computeBudget(reader)
                : presale(reader, acc);
    if (known === null) return {programId, program: null, name: null, fields: []};
    return {programId, program, name: known.name, fields: known.fields};
  });
}

/** A field's value by name, when it is a present address (null otherwise — absent, a different kind, or an explicit `none`). */
export function addressField(ix: DecodedInstruction, name: string): string | null {
  const f = ix.fields.find(x => x.name === name);
  return f?.value.kind === 'address' ? f.value.value : null;
}
