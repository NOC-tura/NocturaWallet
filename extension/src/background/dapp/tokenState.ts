import {base58} from '@scure/base';
import {TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from './decode/decode';

/**
 * Token state (spec B1c §3.3 rev 3.6): the one reader of SPL Token and Token-2022 mints and token accounts, from their
 * account data and owner program — the simulation's balance changes (B1c-2) and the red flags (F4, F5, F7) both read
 * through it. Pure, and fail closed: every byte shape either program's own `unpack` refuses (an uninitialized mint, a
 * COption tag that is neither 0 nor 1) makes the whole account unreadable (null), never a partial answer. The TLV walk
 * is stricter than `unpack` itself ever checks — `StateWithExtensions::unpack` never walks the TLV at all — but never
 * looser than what either program actually writes (fix round 1, I1/review Minor 2).
 *
 * Layouts (the programs' own): a Mint is 82 bytes — mint authority COption<Pubkey> (u32 tag at 0, key at 4), supply u64
 * at 36, decimals at 44, is_initialized at 45 (must be 1 — 0 or 2+ is a mint the program itself refuses to unpack,
 * fix round 1 I2), freeze authority COption<Pubkey> (tag at 46, key at 50). An Account is 165 bytes — mint 0..32,
 * owner 32..64, amount u64 at 64, delegate COption<Pubkey> (tag at 72, key at 76), state at 108 (1 Initialized, 2
 * Frozen), is_native COption<u64> (tag at 109), delegated amount u64 at 121, close authority COption<Pubkey> (tag at
 * 129, key at 133). A COption tag is 0 (None) or 1 (Some); anything else is malformed. Token-2022 may extend either:
 * the base, zero padding up to 165, an AccountType byte at 165 (1 Mint, 2 Account), then TLV extensions from 166 —
 * u16 LE type, u16 LE length, the value. Never exactly 355 bytes, a Multisig's size (an extended account of that
 * length would be indistinguishable from one) — but Token-2022's own `adjust_len_for_multisig` pads an account that
 * would otherwise land there with 2 extra zero bytes, so a real mint or account can end in a short (< 2 bytes left)
 * or all-zero tail; the walk mirrors the program's own `get_tlv_data_info` (fix round 1, I1): fewer than 2 bytes left,
 * or a type of 0 (Uninitialized), ends the walk, and everything after that point must still be zero (the padding's
 * own invariant) — a non-zero type with fewer than 4 bytes left (too little for even its own length field), a header
 * or value that reads past the end, or a type seen twice, is malformed. Read here: PermanentDelegate (12, its
 * delegate) and TransferHook (14, its authority and program id) — both OptionalNonZeroPubkey, 32 zero bytes being
 * none.
 */
export type TokenProgramKey = 'token' | 'token-2022';

export interface MintInfo {
  program: TokenProgramKey;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  /** Token-2022's PermanentDelegate extension, when set to a non-zero key. */
  permanentDelegate: string | null;
  /** Token-2022's TransferHook extension's program, when set to a non-zero key. */
  transferHookProgram: string | null;
}

export interface TokenAccountInfo {
  program: TokenProgramKey;
  mint: string;
  /** The owner field: the wallet that may move it. */
  owner: string;
  amount: bigint;
  delegate: string | null;
  delegatedAmount: bigint;
  closeAuthority: string | null;
  state: 'initialized' | 'frozen';
  /** is_native set: a wrapped-SOL account of either program's native mint (its lamports are its value). */
  isNative: boolean;
}

const MINT_SIZE = 82;
const ACCOUNT_SIZE = 165;
const MULTISIG_SIZE = 355;
const ACCOUNT_TYPE_MINT = 1;
const ACCOUNT_TYPE_ACCOUNT = 2;
const PERMANENT_DELEGATE = 12;
const TRANSFER_HOOK = 14;

const programOf = (owner: string): TokenProgramKey | null => (owner === TOKEN_PROGRAM ? 'token' : owner === TOKEN_2022_PROGRAM ? 'token-2022' : null);
const viewOf = (data: Uint8Array): DataView => new DataView(data.buffer, data.byteOffset, data.byteLength);

/** A COption tag at `at`: true Some, false None, null malformed. */
function tag(view: DataView, at: number): boolean | null {
  const t = view.getUint32(at, true);
  return t === 1 ? true : t === 0 ? false : null;
}
/** A COption<Pubkey> (tag at `at`, key at `at + 4`): the key, null for None, undefined when malformed. */
function optionKey(data: Uint8Array, view: DataView, at: number): string | null | undefined {
  const t = tag(view, at);
  if (t === null) return undefined;
  return t ? base58.encode(data.subarray(at + 4, at + 36)) : null;
}
/** An OptionalNonZeroPubkey: 32 zero bytes are none. */
const nonZeroKey = (b: Uint8Array): string | null => (b.every(x => x === 0) ? null : base58.encode(b));

/**
 * Token-2022's extended layout after a base of `base` bytes: the extensions by type, or null when the layout is not an
 * extended `accountType` or is malformed. Fix round 1 (I1): the walk mirrors `get_tlv_data_info` — fewer than 2 bytes
 * left, or a type of 0, ends it cleanly (the `adjust_len_for_multisig` 2-byte zero pad that keeps a real account off
 * exactly 355 bytes lands here); a non-zero type with fewer than 4 bytes left is malformed.
 */
function extensionsOf(data: Uint8Array, base: number, accountType: number): ReadonlyMap<number, Uint8Array> | null {
  if (data.length <= ACCOUNT_SIZE || data.length === MULTISIG_SIZE || data[ACCOUNT_SIZE] !== accountType) return null;
  if (data.subarray(base, ACCOUNT_SIZE).some(b => b !== 0)) return null;
  const view = viewOf(data);
  const out = new Map<number, Uint8Array>();
  let at = ACCOUNT_SIZE + 1;
  while (at < data.length) {
    const left = data.length - at;
    if (left < 2) return data.subarray(at).every(b => b === 0) ? out : null;
    const type = view.getUint16(at, true);
    if (type === 0) return data.subarray(at).every(b => b === 0) ? out : null;
    if (left < 4) return null;
    const end = at + 4 + view.getUint16(at + 2, true);
    if (end > data.length || out.has(type)) return null;
    out.set(type, data.subarray(at + 4, end));
    at = end;
  }
  return out;
}

/** A mint's state from its data and owner program, or null (not a mint of either token program, or malformed). */
export function mintInfo(data: Uint8Array, owner: string): MintInfo | null {
  const program = programOf(owner);
  if (program === null) return null;
  let extensions: ReadonlyMap<number, Uint8Array> = new Map();
  if (data.length !== MINT_SIZE) {
    const ext = program === 'token-2022' ? extensionsOf(data, MINT_SIZE, ACCOUNT_TYPE_MINT) : null;
    if (ext === null) return null;
    extensions = ext;
  }
  // Fix round 1 (I2): both programs' Mint::unpack refuse is_initialized !== 1 — an all-zero or forged byte 45 is a
  // mint the program itself would never hand back, so it must not read here as a clean, authority-less mint.
  if (data[45] !== 1) return null;
  const view = viewOf(data);
  const mintAuthority = optionKey(data, view, 0);
  const freezeAuthority = optionKey(data, view, 46);
  const delegate = extensions.get(PERMANENT_DELEGATE);
  const hook = extensions.get(TRANSFER_HOOK);
  if (mintAuthority === undefined || freezeAuthority === undefined) return null;
  if ((delegate !== undefined && delegate.length !== 32) || (hook !== undefined && hook.length !== 64)) return null;
  return {
    program,
    decimals: view.getUint8(44),
    mintAuthority,
    freezeAuthority,
    permanentDelegate: delegate === undefined ? null : nonZeroKey(delegate),
    transferHookProgram: hook === undefined ? null : nonZeroKey(hook.subarray(32, 64)),
  };
}

/** A token account's state from its data and owner program, or null (not an initialized token account, or malformed). */
export function tokenAccountInfo(data: Uint8Array, owner: string): TokenAccountInfo | null {
  const program = programOf(owner);
  if (program === null) return null;
  if (data.length !== ACCOUNT_SIZE && (program !== 'token-2022' || extensionsOf(data, ACCOUNT_SIZE, ACCOUNT_TYPE_ACCOUNT) === null)) return null;
  const state = data[108];
  if (state !== 1 && state !== 2) return null;
  const view = viewOf(data);
  const delegate = optionKey(data, view, 72);
  const isNative = tag(view, 109);
  const closeAuthority = optionKey(data, view, 129);
  if (delegate === undefined || isNative === null || closeAuthority === undefined) return null;
  return {
    program,
    mint: base58.encode(data.subarray(0, 32)),
    owner: base58.encode(data.subarray(32, 64)),
    amount: view.getBigUint64(64, true),
    delegate,
    delegatedAmount: view.getBigUint64(121, true),
    closeAuthority,
    state: state === 1 ? 'initialized' : 'frozen',
    isNative,
  };
}
