import {SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
import {mintInfo, tokenAccountInfo} from '../tokenState';
import {
  ACCOUNT_SIZE,
  FREEZER,
  HOOK_AUTHORITY,
  HOOK_PROGRAM,
  ISSUER,
  MINT_SIZE,
  MULTISIG_SIZE,
  PERMANENT_DELEGATE,
  U64_MAX,
  keyOf,
  mintBytes,
  otherExt,
  permanentDelegateExt,
  pyusdLikeMint,
  tokenAccountBytes,
  transferHookExt,
  usdcLikeMint,
  withByte,
  withU32,
} from './tokenBytes';

const MINT = keyOf(21);
const OWNER = keyOf(22);
const DELEGATE = keyOf(23);
const CLOSER = keyOf(24);

// B1c-3 (spec B1c §3.3 rev 3.6, F4/F5/F7): one parser for a mint and one for a token account, for both token programs.
describe('mintInfo', () => {
  it('USDC-like: a classic mint — its decimals, mint and freeze authority; no extension can exist', () => {
    expect(mintInfo(usdcLikeMint(), TOKEN_PROGRAM)).toEqual({program: 'token', decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER, permanentDelegate: null, transferHookProgram: null});
  });

  it('PYUSD-like: Token-2022 — freeze authority, permanent delegate; a hook with a zero program id is no hook; other extensions stepped over', () => {
    expect(mintInfo(pyusdLikeMint(), TOKEN_2022_PROGRAM)).toEqual({program: 'token-2022', decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER, permanentDelegate: PERMANENT_DELEGATE, transferHookProgram: null});
  });

  it('a transfer hook with a program id names it; a permanent delegate of 32 zero bytes is none', () => {
    const hooked = mintBytes({decimals: 9, extensions: [transferHookExt(HOOK_AUTHORITY, HOOK_PROGRAM), permanentDelegateExt(null)]});
    expect(mintInfo(hooked, TOKEN_2022_PROGRAM)).toEqual({program: 'token-2022', decimals: 9, mintAuthority: null, freezeAuthority: null, permanentDelegate: null, transferHookProgram: HOOK_PROGRAM});
  });

  it('Token-2022 without extensions: the 82-byte base, and the extended layout with an empty TLV', () => {
    const plain = {program: 'token-2022', decimals: 2, mintAuthority: ISSUER, freezeAuthority: null, permanentDelegate: null, transferHookProgram: null};
    expect(mintInfo(mintBytes({decimals: 2, mintAuthority: ISSUER}), TOKEN_2022_PROGRAM)).toEqual(plain);
    const empty = mintBytes({decimals: 2, mintAuthority: ISSUER, extended: true});
    expect(empty.length).toBe(ACCOUNT_SIZE + 1);
    expect(mintInfo(empty, TOKEN_2022_PROGRAM)).toEqual(plain);
  });

  it('no mint: an owner that is no token program, a classic mint of any other size, an extended layout under classic Token', () => {
    expect(mintInfo(usdcLikeMint(), SYSTEM_PROGRAM)).toBeNull();
    expect(mintInfo(Uint8Array.of(...usdcLikeMint(), 0), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(usdcLikeMint().subarray(0, MINT_SIZE - 1), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(pyusdLikeMint(), TOKEN_PROGRAM)).toBeNull();
    // Positive control: the same bytes under their own program.
    expect(mintInfo(pyusdLikeMint(), TOKEN_2022_PROGRAM)).not.toBeNull();
  });

  it('a COption tag other than 0 or 1 is no mint (fail closed); 1 is a key and 0 none, whatever its 32 bytes', () => {
    const base = mintBytes({mintAuthority: ISSUER, freezeAuthority: FREEZER});
    expect(mintInfo(withU32(base, 0, 2), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(withU32(base, 46, 2), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(withU32(base, 46, 0x0100), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(withU32(base, 46, 0), TOKEN_PROGRAM)).toMatchObject({mintAuthority: ISSUER, freezeAuthority: null});
    expect(mintInfo(withU32(base, 0, 0), TOKEN_PROGRAM)).toMatchObject({mintAuthority: null, freezeAuthority: FREEZER});
  });

  // Fix round 1, I2: both programs' Mint::unpack refuse is_initialized !== 1 (UninitializedAccount / InvalidAccountData).
  it('I2: is_initialized must be 1 — an all-zero mint, or byte 45 = 2, is no mint, matching Mint::unpack', () => {
    expect(mintInfo(new Uint8Array(MINT_SIZE), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(withByte(mintBytes({mintAuthority: ISSUER}), 45, 2), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(withByte(mintBytes({mintAuthority: ISSUER}), 45, 0), TOKEN_PROGRAM)).toBeNull();
    // Positive control: byte 45 = 1 (mintBytes' own default) still reads.
    expect(mintInfo(mintBytes({mintAuthority: ISSUER}), TOKEN_PROGRAM)).toMatchObject({mintAuthority: ISSUER});
  });

  it('the extended layout: the AccountType byte must be Mint (1) — an Account’s (2) or Uninitialized (0) is no mint', () => {
    const ext = [permanentDelegateExt(PERMANENT_DELEGATE)];
    expect(mintInfo(mintBytes({extensions: ext}), TOKEN_2022_PROGRAM)).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
    expect(mintInfo(mintBytes({extensions: ext, accountType: 2}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: ext, accountType: 0}), TOKEN_2022_PROGRAM)).toBeNull();
  });

  it('the extended layout: the padding between the base mint and the AccountType byte must be zero', () => {
    const good = mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)]});
    expect(mintInfo(withByte(good, MINT_SIZE, 1), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(withByte(good, ACCOUNT_SIZE - 1, 1), TOKEN_2022_PROGRAM)).toBeNull();
  });

  it('a TLV that overruns the data is no mint: a value past the end, a header cut short', () => {
    expect(mintInfo(mintBytes({extensions: [{...permanentDelegateExt(PERMANENT_DELEGATE), length: 33}]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)], tail: [14, 0]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)], tail: [14, 0, 64]}), TOKEN_2022_PROGRAM)).toBeNull();
    // Positive control: the same entries with nothing cut.
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), transferHookExt(null, HOOK_PROGRAM)]}), TOKEN_2022_PROGRAM)).toMatchObject({
      permanentDelegate: PERMANENT_DELEGATE,
      transferHookProgram: HOOK_PROGRAM,
    });
  });

  it('a read extension of the wrong size, or an extension twice, is no mint', () => {
    expect(mintInfo(mintBytes({extensions: [{type: 12, value: new Uint8Array(31).fill(9)}]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [{type: 14, value: new Uint8Array(65).fill(9)}]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), permanentDelegateExt(null)]}), TOKEN_2022_PROGRAM)).toBeNull();
    // An extension the parser does not read may have any size.
    expect(mintInfo(mintBytes({extensions: [otherExt(3, 31)]}), TOKEN_2022_PROGRAM)).not.toBeNull();
  });

  it('an Uninitialized (0) TLV header ends the extensions; anything but zeros after it is no mint', () => {
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)], tail: [0, 0, 0, 0, 0, 0]}), TOKEN_2022_PROGRAM)).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
    expect(mintInfo(mintBytes({extensions: [{type: 0, value: new Uint8Array(0)}, permanentDelegateExt(PERMANENT_DELEGATE)]}), TOKEN_2022_PROGRAM)).toBeNull();
  });

  it('a 355-byte account (a Multisig’s size) is never an extended mint, even with byte 165 = 1 and a well-formed TLV', () => {
    const filler = MULTISIG_SIZE - (ACCOUNT_SIZE + 1) - 4 - 32 - 4;
    const forged = mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), otherExt(3, filler)]});
    expect(forged.length).toBe(MULTISIG_SIZE);
    expect(mintInfo(forged, TOKEN_2022_PROGRAM)).toBeNull();
    // Positive control: one byte longer reads.
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), otherExt(3, filler + 1)]}), TOKEN_2022_PROGRAM)).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
  });

  // Fix round 1, I1: Token-2022's own `adjust_len_for_multisig` pads a mint that would otherwise land at exactly 355
  // bytes (a Multisig's size) with 2 extra zero bytes — a real mint can end in a short `[0, 0]` tail, and it must read.
  it('I1: a Multisig-size pad (357 bytes, a [0, 0] tail) is a real mint, matching Token-2022’s own TLV walk', () => {
    const padded = mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), otherExt(3, 149)], tail: [0, 0]});
    expect(padded.length).toBe(MULTISIG_SIZE + 2);
    expect(mintInfo(padded, TOKEN_2022_PROGRAM)).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
    // Negative control: a non-zero type with only 2 or 3 bytes left — too little for even its own length field —
    // stays malformed, never read as the pad's clean end (the same shapes the "TLV that overruns" test above pins).
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)], tail: [14, 0]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)], tail: [14, 0, 64]}), TOKEN_2022_PROGRAM)).toBeNull();
  });
});

describe('tokenAccountInfo', () => {
  it('a classic account: mint, owner, amount, delegate and its amount, close authority, state, native', () => {
    const data = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 500n, delegate: DELEGATE, delegatedAmount: U64_MAX, closeAuthority: CLOSER});
    expect(tokenAccountInfo(data, TOKEN_PROGRAM)).toEqual({
      program: 'token',
      mint: MINT,
      owner: OWNER,
      amount: 500n,
      delegate: DELEGATE,
      delegatedAmount: U64_MAX,
      closeAuthority: CLOSER,
      state: 'initialized',
      isNative: false,
    });
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, state: 2, nativeReserve: 2_039_280n}), TOKEN_PROGRAM)).toMatchObject({state: 'frozen', isNative: true, delegate: null, closeAuthority: null});
  });

  it('Token-2022: the 165-byte base, and the extended layout (AccountType 2) with its TLV', () => {
    const plain = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 7n});
    expect(tokenAccountInfo(plain, TOKEN_2022_PROGRAM)).toMatchObject({program: 'token-2022', mint: MINT, owner: OWNER, amount: 7n});
    const ext = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 7n, extensions: [otherExt(7, 0), otherExt(15, 1, 0)]});
    expect(tokenAccountInfo(ext, TOKEN_2022_PROGRAM)).toMatchObject({program: 'token-2022', amount: 7n});
  });

  it('no account: Uninitialized or an unknown state, another program, a classic account of another size', () => {
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, state: 0}), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, state: 3}), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER}), SYSTEM_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extended: true}), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER}).subarray(0, ACCOUNT_SIZE - 1), TOKEN_PROGRAM)).toBeNull();
  });

  it('a COption tag other than 0 or 1 (delegate, is_native, close authority) is no account', () => {
    const base = tokenAccountBytes({mint: MINT, owner: OWNER, delegate: DELEGATE, closeAuthority: CLOSER});
    expect(tokenAccountInfo(base, TOKEN_PROGRAM)).not.toBeNull();
    expect(tokenAccountInfo(withU32(base, 72, 2), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(withU32(base, 109, 2), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(withU32(base, 129, 2), TOKEN_PROGRAM)).toBeNull();
  });

  it('the extended layout: the AccountType byte must be Account (2); a TLV overrun is no account', () => {
    const ext = [otherExt(7, 0)];
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extensions: ext, accountType: 1}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extensions: [{type: 15, value: Uint8Array.of(0), length: 2}]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extensions: ext, tail: [7]}), TOKEN_2022_PROGRAM)).toBeNull();
  });

  it('a 355-byte account (a Multisig’s size) is never a token account, even with byte 165 = 2', () => {
    const forged = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 1n, extensions: [otherExt(3, MULTISIG_SIZE - (ACCOUNT_SIZE + 1) - 4)]});
    expect(forged.length).toBe(MULTISIG_SIZE);
    expect(tokenAccountInfo(forged, TOKEN_2022_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, amount: 1n, extensions: [otherExt(3, MULTISIG_SIZE - (ACCOUNT_SIZE + 1) - 3)]}), TOKEN_2022_PROGRAM)).toMatchObject({amount: 1n});
  });

  // Fix round 1, I1: the account twin of the mint pad above — a real token account can end in the same `[0, 0]` tail.
  it('I1: a Multisig-size pad (357 bytes, a [0, 0] tail) is a real token account; a non-zero type with 2–3 bytes left is not', () => {
    const padded = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 1n, extensions: [otherExt(7, 185)], tail: [0, 0]});
    expect(padded.length).toBe(MULTISIG_SIZE + 2);
    expect(tokenAccountInfo(padded, TOKEN_2022_PROGRAM)).toMatchObject({amount: 1n});
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extensions: [otherExt(7, 0)], tail: [9, 0]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extensions: [otherExt(7, 0)], tail: [9, 0, 1]}), TOKEN_2022_PROGRAM)).toBeNull();
  });
});
