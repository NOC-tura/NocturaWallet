import {base58} from '@scure/base';
import {MAINNET_PROGRAM_ID} from '../../../../../core/presale/addresses';
import type {ResolvedKeys} from './keys';
import {PRESALE_INSTRUCTIONS, STAKE_TIERS, type PresaleArgType} from './presaleIdl';
import type {ParsedTx} from './wire';

/**
 * The decoder (spec B1c §3.3, B1 §3; D6 — our own, no new third-party code in the signing path): every instruction of a
 * dApp's transaction, named and with its fields, for the programs the wallet knows — System (transfer, createAccount,
 * assign, allocate, advanceNonceAccount), SPL Token and Token-2022 (transfer, transferChecked, approve, approveChecked,
 * revoke, setAuthority, closeAccount, burn, burnChecked, initializeAccount 1/2/3, syncNative, freezeAccount,
 * thawAccount, and the Token-2022 extensions B1 §3 names: the transfer hook and the permanent delegate), the Associated
 * Token Account program (create, createIdempotent), Compute Budget (the unit limit and price) and the presale program
 * (by Anchor discriminator, presaleIdl.ts). Any other instruction of a known program is named when its tag is known and
 * carries no fields; an instruction of any other program — or one that touches an account no lookup table resolved —
 * is an unknown program (`program: null`). Pure: the decoded instructions never depend on the coordinator once the
 * lookups are resolved (B1 §3).
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

/** A field's value: addresses whole (null when the instruction carries too few accounts), amounts as base-unit strings. */
export type FieldValue =
  | {kind: 'address'; value: string | null}
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
  /** Null: an unknown program (not in the decoded set, or an account a lookup table did not resolve). */
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
  /** The bytes all read, none left over (a strict decode). */
  done(): boolean {
    return this.at === this.data.length;
  }
}

const addr = (name: string, value: string | null): Field => ({name, value: {kind: 'address', value}});
const lamports = (name: string, v: bigint): Field => ({name, value: {kind: 'lamports', value: v.toString()}});
const amount = (name: string, v: bigint, decimals: number | null): Field => ({name, value: {kind: 'amount', value: v.toString(), decimals}});
const num = (name: string, v: number | bigint): Field => ({name, value: {kind: 'number', value: v.toString()}});
const text = (name: string, v: string): Field => ({name, value: {kind: 'text', value: v}});
const hex = (b: Uint8Array): string => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

type Known = {name: string | null; fields: Field[]};
const unnamed: Known = {name: null, fields: []};
/** Named by its tag, no fields (a known program's instruction outside the decoded list, or one whose data does not parse). */
const nameOnly = (names: readonly string[], tag: number | null): Known => ({name: tag === null ? null : (names[tag] ?? null), fields: []});

function system(r: Reader, acc: (i: number) => string | null): Known {
  const tag = r.u32();
  switch (tag) {
    case 0: {
      const l = r.u64();
      const space = r.u64();
      const owner = r.pubkey();
      if (l === null || space === null || owner === null || !r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'createAccount', fields: [addr('from', acc(0)), addr('newAccount', acc(1)), lamports('lamports', l), num('space', space), addr('owner', owner)]};
    }
    case 1: {
      const owner = r.pubkey();
      if (owner === null || !r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'assign', fields: [addr('account', acc(0)), addr('owner', owner)]};
    }
    case 2: {
      const l = r.u64();
      if (l === null || !r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'transfer', fields: [addr('from', acc(0)), addr('to', acc(1)), lamports('lamports', l)]};
    }
    case 4:
      if (!r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'advanceNonceAccount', fields: [addr('nonceAccount', acc(0)), addr('authority', acc(2))]};
    case 8: {
      const space = r.u64();
      if (space === null || !r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'allocate', fields: [addr('account', acc(0)), num('space', space)]};
    }
    default:
      return nameOnly(SYSTEM_NAMES, tag);
  }
}

/** SPL Token and Token-2022 (the same layout for every shared tag). */
function token(r: Reader, acc: (i: number) => string | null, names: readonly string[]): Known {
  const tag = r.u8();
  const withAmount = (build: (a: bigint) => Field[], name: string): Known => {
    const a = r.u64();
    return a === null || !r.done() ? nameOnly(names, tag) : {name, fields: build(a)};
  };
  const withChecked = (build: (a: bigint, d: number) => Field[], name: string): Known => {
    const a = r.u64();
    const d = r.u8();
    return a === null || d === null || !r.done() ? nameOnly(names, tag) : {name, fields: build(a, d)};
  };
  switch (tag) {
    case 1:
      return r.done() ? {name: 'initializeAccount', fields: [addr('account', acc(0)), addr('mint', acc(1)), addr('owner', acc(2))]} : nameOnly(names, tag);
    case 3:
      return withAmount(a => [addr('source', acc(0)), addr('destination', acc(1)), addr('owner', acc(2)), amount('amount', a, null)], 'transfer');
    case 4:
      return withAmount(a => [addr('source', acc(0)), addr('delegate', acc(1)), addr('owner', acc(2)), amount('amount', a, null)], 'approve');
    case 5:
      return r.done() ? {name: 'revoke', fields: [addr('source', acc(0)), addr('owner', acc(1))]} : nameOnly(names, tag);
    case 6: {
      const type = r.u8();
      const option = r.u8();
      const next = option === 1 ? r.pubkey() : null;
      const authorityType = type === null ? undefined : AUTHORITY_TYPES[type];
      if (authorityType === undefined || (option !== 0 && option !== 1) || (option === 1 && next === null) || !r.done()) return nameOnly(names, tag);
      // Token-2022 only past the classic four.
      if (type !== null && type > 3 && names !== TOKEN_2022_NAMES) return nameOnly(names, tag);
      return {name: 'setAuthority', fields: [addr('account', acc(0)), addr('currentAuthority', acc(1)), text('authorityType', authorityType), addr('newAuthority', next)]};
    }
    case 8:
      return withAmount(a => [addr('account', acc(0)), addr('mint', acc(1)), addr('owner', acc(2)), amount('amount', a, null)], 'burn');
    case 9:
      return r.done() ? {name: 'closeAccount', fields: [addr('account', acc(0)), addr('destination', acc(1)), addr('owner', acc(2))]} : nameOnly(names, tag);
    case 10:
    case 11:
      return r.done() ? {name: tag === 10 ? 'freezeAccount' : 'thawAccount', fields: [addr('account', acc(0)), addr('mint', acc(1)), addr('authority', acc(2))]} : nameOnly(names, tag);
    case 12:
      return withChecked((a, d) => [addr('source', acc(0)), addr('mint', acc(1)), addr('destination', acc(2)), addr('owner', acc(3)), amount('amount', a, d)], 'transferChecked');
    case 13:
      return withChecked((a, d) => [addr('source', acc(0)), addr('mint', acc(1)), addr('delegate', acc(2)), addr('owner', acc(3)), amount('amount', a, d)], 'approveChecked');
    case 15:
      return withChecked((a, d) => [addr('account', acc(0)), addr('mint', acc(1)), addr('owner', acc(2)), amount('amount', a, d)], 'burnChecked');
    case 16:
    case 18: {
      const owner = r.pubkey();
      if (owner === null || !r.done()) return nameOnly(names, tag);
      return {name: tag === 16 ? 'initializeAccount2' : 'initializeAccount3', fields: [addr('account', acc(0)), addr('mint', acc(1)), addr('owner', owner)]};
    }
    case 17:
      return r.done() ? {name: 'syncNative', fields: [addr('account', acc(0))]} : nameOnly(names, tag);
    case 35: {
      if (names !== TOKEN_2022_NAMES) return nameOnly(names, tag);
      const delegate = r.pubkey();
      if (delegate === null || !r.done()) return nameOnly(names, tag);
      return {name: 'initializePermanentDelegate', fields: [addr('mint', acc(0)), addr('delegate', delegate)]};
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
        const program = opt();
        if (authority === undefined || program === undefined || !r.done()) return nameOnly(names, tag);
        return {name: 'transferHookInitialize', fields: [addr('mint', acc(0)), addr('authority', authority), addr('programId', program)]};
      }
      if (sub === 1) {
        const program = opt();
        if (program === undefined || !r.done()) return nameOnly(names, tag);
        return {name: 'transferHookUpdate', fields: [addr('mint', acc(0)), addr('authority', acc(1)), addr('programId', program)]};
      }
      return nameOnly(names, tag);
    }
    default:
      return nameOnly(names, tag);
  }
}

function ata(r: Reader, acc: (i: number) => string | null): Known {
  const tag = r.data.length === 0 ? 0 : r.u8();
  if (!r.done()) return unnamed;
  const fields = [addr('payer', acc(0)), addr('account', acc(1)), addr('wallet', acc(2)), addr('mint', acc(3))];
  if (tag === 0) return {name: 'create', fields};
  if (tag === 1) return {name: 'createIdempotent', fields};
  if (tag === 2) return {name: 'recoverNested', fields: []};
  return unnamed;
}

function computeBudget(r: Reader): Known {
  const tag = r.u8();
  if (tag === 2 || tag === 1 || tag === 4) {
    const v = r.u32();
    if (v === null || !r.done()) return nameOnly(COMPUTE_NAMES, tag);
    return {name: COMPUTE_NAMES[tag] ?? null, fields: [num(tag === 2 ? 'units' : 'bytes', v)]};
  }
  if (tag === 3) {
    const v = r.u64();
    if (v === null || !r.done()) return nameOnly(COMPUTE_NAMES, tag);
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

function presale(r: Reader, acc: (i: number) => string | null): Known {
  const head = r.bytes(8);
  if (head === null) return unnamed;
  const ix = PRESALE_INSTRUCTIONS.find(x => x.discriminator.every((b, i) => head[i] === b));
  if (ix === undefined) return unnamed;
  const fields: Field[] = [];
  for (const a of ix.args) {
    const f = presaleArg(r, a.name, a.type);
    if (f === null) return {name: ix.name, fields: []};
    fields.push(f);
  }
  if (!r.done()) return {name: ix.name, fields: []};
  return {name: ix.name, fields: [...fields, ...ix.accounts.map((name, i) => addr(name, acc(i)))]};
}

/**
 * Every instruction of `p`, decoded against its resolved keys. An instruction that touches an account the lookups left
 * unresolved is an unknown program, whatever its program (spec §3.3).
 */
export function decodeInstructions(p: ParsedTx, r: ResolvedKeys): DecodedInstruction[] {
  return p.instructions.map(ix => {
    const programId = ix.program < p.staticKeys.length ? (p.staticKeys[ix.program] ?? null) : null;
    const program = programId === null ? null : (PROGRAMS.get(programId) ?? null);
    const accounts = ix.accounts.map(i => r.keys[i] ?? null);
    if (program === null || accounts.some(a => a === null)) return {programId, program: null, name: null, fields: []};
    const acc = (i: number): string | null => accounts[i] ?? null;
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
    return {programId, program, name: known.name, fields: known.fields};
  });
}

/** A field's value by name, when it is an address (null otherwise, or when absent). */
export function addressField(ix: DecodedInstruction, name: string): string | null {
  const f = ix.fields.find(x => x.name === name);
  return f?.value.kind === 'address' ? f.value.value : null;
}
