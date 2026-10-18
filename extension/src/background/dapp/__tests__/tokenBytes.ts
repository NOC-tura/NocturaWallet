import {base58} from '@scure/base';

/**
 * Byte builders for SPL Token / Token-2022 mints and token accounts (B1c-3): every fixture a red-flag or token-state
 * test reads is built here from named fields, never typed as a hex blob. Offsets are the programs' own (the base Mint
 * is 82 bytes, the base Account 165; Token-2022's extended layout puts the AccountType byte at 165 and its TLV
 * extensions from 166).
 */
export const MINT_SIZE = 82;
export const ACCOUNT_SIZE = 165;
export const MULTISIG_SIZE = 355;
export const U64_MAX = 0xffff_ffff_ffff_ffffn;

/** A deterministic address: 32 bytes of `n` (never the zero key unless `n` is 0). */
export const keyOf = (n: number): string => base58.encode(new Uint8Array(32).fill(n));
const keyBytes = (k: string | null): Uint8Array => (k === null ? new Uint8Array(32) : base58.decode(k));

/** One TLV entry. `length` overrides the length written (an overrun when it exceeds `value`). */
export interface Extension {
  type: number;
  value: Uint8Array;
  length?: number;
}
/** PermanentDelegate (12): its delegate, an OptionalNonZeroPubkey — null writes 32 zero bytes. */
export const permanentDelegateExt = (delegate: string | null): Extension => ({type: 12, value: keyBytes(delegate)});
/** TransferHook (14): its authority and its program id, both OptionalNonZeroPubkey. */
export const transferHookExt = (authority: string | null, programId: string | null): Extension => ({type: 14, value: Uint8Array.of(...keyBytes(authority), ...keyBytes(programId))});
/** Any other extension, of `size` bytes of `fill` — the parser must step over it. */
export const otherExt = (type: number, size: number, fill = 0xab): Extension => ({type, value: new Uint8Array(size).fill(fill)});

const tlv = (extensions: readonly Extension[]): number[] =>
  extensions.flatMap(e => {
    const length = e.length ?? e.value.length;
    return [e.type & 0xff, e.type >> 8, length & 0xff, length >> 8, ...e.value];
  });

/** Base bytes + Token-2022's extended tail: zero padding to 165, the AccountType byte, the TLV, then `tail`. */
function extended(base: Uint8Array, accountType: number, extensions: readonly Extension[], tail: readonly number[]): Uint8Array {
  const out = new Uint8Array(ACCOUNT_SIZE + 1 + tlv(extensions).length + tail.length);
  out.set(base, 0);
  out[ACCOUNT_SIZE] = accountType;
  out.set([...tlv(extensions), ...tail], ACCOUNT_SIZE + 1);
  return out;
}

export interface MintSpec {
  decimals?: number;
  supply?: bigint;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  /** Token-2022's extended layout (AccountType at 165, TLV from 166) — implied by `extensions` or `tail`. */
  extended?: boolean;
  extensions?: readonly Extension[];
  /** The AccountType byte written at 165 (1 = Mint, the default). */
  accountType?: number;
  /** Raw bytes after the TLV (a cut header, padding). */
  tail?: readonly number[];
}

/** A mint's account data: the 82-byte base Mint, or Token-2022's extended layout. */
export function mintBytes(s: MintSpec = {}): Uint8Array {
  const base = new Uint8Array(MINT_SIZE);
  const view = new DataView(base.buffer);
  const mintAuthority = s.mintAuthority ?? null;
  const freezeAuthority = s.freezeAuthority ?? null;
  view.setUint32(0, mintAuthority === null ? 0 : 1, true);
  base.set(keyBytes(mintAuthority), 4);
  view.setBigUint64(36, s.supply ?? 1_000_000_000n, true);
  base[44] = s.decimals ?? 6;
  base[45] = 1;
  view.setUint32(46, freezeAuthority === null ? 0 : 1, true);
  base.set(keyBytes(freezeAuthority), 50);
  if (!(s.extended ?? false) && s.extensions === undefined && s.tail === undefined) return base;
  return extended(base, s.accountType ?? 1, s.extensions ?? [], s.tail ?? []);
}

export interface TokenAccountSpec {
  mint: string;
  owner: string;
  amount?: bigint;
  delegate?: string | null;
  delegatedAmount?: bigint;
  /** The state byte at 108: 1 Initialized (the default), 2 Frozen. */
  state?: number;
  /** is_native: the rent-exempt reserve of a native (wrapped SOL) account, or null. */
  nativeReserve?: bigint | null;
  closeAuthority?: string | null;
  extended?: boolean;
  extensions?: readonly Extension[];
  /** The AccountType byte written at 165 (2 = Account, the default). */
  accountType?: number;
  tail?: readonly number[];
}

/** A token account's data: the 165-byte base Account, or Token-2022's extended layout. */
export function tokenAccountBytes(s: TokenAccountSpec): Uint8Array {
  const base = new Uint8Array(ACCOUNT_SIZE);
  const view = new DataView(base.buffer);
  const delegate = s.delegate ?? null;
  const closeAuthority = s.closeAuthority ?? null;
  const nativeReserve = s.nativeReserve ?? null;
  base.set(base58.decode(s.mint), 0);
  base.set(base58.decode(s.owner), 32);
  view.setBigUint64(64, s.amount ?? 0n, true);
  view.setUint32(72, delegate === null ? 0 : 1, true);
  base.set(keyBytes(delegate), 76);
  base[108] = s.state ?? 1;
  view.setUint32(109, nativeReserve === null ? 0 : 1, true);
  view.setBigUint64(113, nativeReserve ?? 0n, true);
  view.setBigUint64(121, s.delegatedAmount ?? 0n, true);
  view.setUint32(129, closeAuthority === null ? 0 : 1, true);
  base.set(keyBytes(closeAuthority), 133);
  if (!(s.extended ?? false) && s.extensions === undefined && s.tail === undefined) return base;
  return extended(base, s.accountType ?? 2, s.extensions ?? [], s.tail ?? []);
}

/** `bytes` with the u32 LE at `offset` set to `value` (a COption tag forged). */
export function withU32(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const out = Uint8Array.from(bytes);
  new DataView(out.buffer).setUint32(offset, value, true);
  return out;
}
/** `bytes` with the byte at `offset` set to `value`. */
export function withByte(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const out = Uint8Array.from(bytes);
  out[offset] = value;
  return out;
}

/** Issuer keys for the fixtures below. */
export const ISSUER = keyOf(11);
export const FREEZER = keyOf(12);
export const PERMANENT_DELEGATE = keyOf(13);
export const HOOK_AUTHORITY = keyOf(14);
export const HOOK_PROGRAM = keyOf(15);

/** USDC-like: a classic SPL mint, 6 decimals, a mint authority and a freeze authority (O3: never flagged). */
export const usdcLikeMint = (): Uint8Array => mintBytes({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER});

/**
 * PYUSD-like: a Token-2022 mint, 6 decimals, a mint and a freeze authority, a permanent delegate, and a transfer hook
 * initialised with an authority but NO program (32 zero bytes) — among the other extensions such a mint carries
 * (ConfidentialTransferMint 4: 65 bytes, TransferFeeConfig 1: 108 bytes, MetadataPointer 18: 64 bytes, TokenMetadata 19:
 * variable), which the parser steps over.
 */
export const pyusdLikeMint = (): Uint8Array =>
  mintBytes({
    decimals: 6,
    mintAuthority: ISSUER,
    freezeAuthority: FREEZER,
    extensions: [otherExt(4, 65), otherExt(1, 108), permanentDelegateExt(PERMANENT_DELEGATE), transferHookExt(HOOK_AUTHORITY, null), otherExt(18, 64), otherExt(19, 141, 0x41)],
  });
