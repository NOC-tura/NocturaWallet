import {AddressLookupTableAccount, ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import type {AccountData} from '../../../../../core/solana/rpc';
import {BLOCKHASH, PUB, RECIPIENT} from '../../__tests__/fixtures';
import {WHOLE_BALANCE_PERCENT, type DappReauthReason} from '../../reauthPolicy';
import {ATA_PROGRAM, SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, decodeInstructions} from '../decode/decode';
import {resolveKeys} from '../decode/keys';
import {parseWire} from '../decode/wire';
import {expectedOverrides, flagMints, overridesMatch, redFlagsOf, type FlagOutcome, type RedFlag, type TxFlagInput} from '../redFlags';
import {
  FREEZER,
  HOOK_AUTHORITY,
  HOOK_PROGRAM,
  ISSUER,
  PERMANENT_DELEGATE,
  U64_MAX,
  keyOf,
  mintBytes,
  permanentDelegateExt,
  pyusdLikeMint,
  tokenAccountBytes,
  transferHookExt,
  usdcLikeMint,
} from './tokenBytes';

const ME = new PublicKey(PUB);
const ACCT = ME.toBase58();
const TO = new PublicKey(RECIPIENT);
const UNKNOWN = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const OTHER_PROGRAM = new PublicKey(keyOf(41));
const SRC = new PublicKey(keyOf(31));
const SRC2 = new PublicKey(keyOf(32));
const THEIRS = new PublicKey(keyOf(33));
const DELEGATE = new PublicKey(keyOf(34));
const T22_MINT = keyOf(35);
const ODD_MINT = keyOf(36);
const MINT_ACCT = new PublicKey(keyOf(37));
const OTHER_DELEGATE = new PublicKey(keyOf(38));
const SOL = 10_000_000_000n;

const u64 = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const meta = (pubkey: PublicKey, signer = false, writable = false) => ({pubkey, isSigner: signer, isWritable: writable});
const tokenIx = (data: number[], keys: ReturnType<typeof meta>[], program = TOKEN_PROGRAM) => new TransactionInstruction({programId: new PublicKey(program), data: Buffer.from(data), keys});
const transferIx = (amount: bigint, program = TOKEN_PROGRAM) => tokenIx([3, ...u64(amount)], [meta(SRC, false, true), meta(TO, false, true), meta(ME, true)], program);
const transferCheckedIx = (amount: bigint, mint: string, program = TOKEN_PROGRAM) =>
  tokenIx([12, ...u64(amount), 6], [meta(SRC, false, true), meta(new PublicKey(mint)), meta(TO, false, true), meta(ME, true)], program);
const approveIx = (amount: bigint, source = SRC, owner = ME, program = TOKEN_PROGRAM) => tokenIx([4, ...u64(amount)], [meta(source, false, true), meta(DELEGATE), meta(owner, true)], program);
const approveCheckedIx = (amount: bigint, mint: string, source = SRC) => tokenIx([13, ...u64(amount), 6], [meta(source, false, true), meta(new PublicKey(mint)), meta(DELEGATE), meta(ME, true)]);
/** SetAuthority: `type` 0 MintTokens, 1 FreezeAccount, 2 AccountOwner, 3 CloseAccount; the new authority TO. */
const setAuthorityIx = (account: PublicKey, current: PublicKey, type = 2) => tokenIx([6, type, 1, ...TO.toBytes()], [meta(account, false, true), meta(current, true)]);
/** ATA create (tag 0) / createIdempotent (tag 1) of SRC2: `payer` funds it for `wallet`. */
const ataCreateIx = (mint: string, wallet = ME, payer = ME, tag = 1) =>
  new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), data: Buffer.from([tag]), keys: [meta(payer, true, true), meta(SRC2, false, true), meta(wallet), meta(new PublicKey(mint)), meta(SystemProgram.programId), meta(new PublicKey(TOKEN_PROGRAM))]});
const syncNativeIx = (account: PublicKey) => tokenIx([17], [meta(account, false, true)]);
const closeAccountIx = (account: PublicKey, destination: PublicKey, owner = ME) => tokenIx([9], [meta(account, false, true), meta(destination, false, true), meta(owner, true)]);
const unknownIx = (program = UNKNOWN, keys: PublicKey[] = [SRC]) => new TransactionInstruction({programId: program, data: Buffer.from([1]), keys: keys.map(k => meta(k, false, true))});

const plain = (lamports = SOL): AccountData => ({lamports, owner: SYSTEM_PROGRAM, data: new Uint8Array()});
const tokenAcc = (s: {mint: string; owner?: PublicKey; amount?: bigint; delegate?: PublicKey | null; delegatedAmount?: bigint; closeAuthority?: PublicKey | null}, program = TOKEN_PROGRAM): AccountData => ({
  lamports: 2_039_280n,
  owner: program,
  data: tokenAccountBytes({mint: s.mint, owner: (s.owner ?? ME).toBase58(), amount: s.amount ?? 0n, delegate: s.delegate?.toBase58() ?? null, delegatedAmount: s.delegatedAmount ?? 0n, closeAuthority: s.closeAuthority?.toBase58() ?? null}),
});
const mintAcc = (data: Uint8Array, owner = TOKEN_PROGRAM): AccountData => ({lamports: 1_461_600n, owner, data});
const USDC_MINT = mintAcc(usdcLikeMint());

interface Spec {
  ixs: TransactionInstruction[];
  tables?: AddressLookupTableAccount[];
  pre?: [PublicKey | string, AccountData | null][];
  /** The simulation's post-state (the wallet account plain unless given), or the outcome when it did not simulate. */
  post?: [PublicKey | string, AccountData | null][] | 'failed' | {dependentOn: number};
  firstSend?: boolean;
}
const addr = (k: PublicKey | string): string => (typeof k === 'string' ? k : k.toBase58());
function txOf(s: Spec): TxFlagInput {
  const bytes = new VersionedTransaction(new TransactionMessage({payerKey: ME, recentBlockhash: BLOCKHASH, instructions: s.ixs}).compileToV0Message(s.tables ?? [])).serialize();
  const tx = parseWire(bytes);
  if (tx === null) throw new Error('did not parse');
  const pre = new Map<string, AccountData | null>([[ACCT, plain()], ...(s.pre ?? []).map(([k, v]) => [addr(k), v] as const)]);
  const outcome: FlagOutcome =
    s.post === 'failed'
      ? {status: 'failed'}
      : s.post !== undefined && !Array.isArray(s.post)
        ? {status: 'dependent', on: s.post.dependentOn}
        : {status: 'simulated', post: new Map<string, AccountData | null>([[ACCT, plain(SOL - 5_000n)], ...(s.post ?? []).map(([k, v]) => [addr(k), v] as const)])};
  return {tx, decoded: decodeInstructions(tx, resolveKeys(tx, new Map())), pre, outcome, firstSend: s.firstSend ?? false};
}
function flagsOf(specs: Spec[], opts: {mints?: [string, AccountData | null][]; reasons?: DappReauthReason[]} = {}): RedFlag[][] {
  return redFlagsOf({account: ACCT, txs: specs.map(txOf), mints: new Map([[MAINNET_USDC_MINT, USDC_MINT], ...(opts.mints ?? [])]), reasons: opts.reasons ?? []});
}
const one = (spec: Spec, opts?: Parameters<typeof flagsOf>[1]): RedFlag[] => flagsOf([spec], opts)[0] ?? [];
const kinds = (flags: readonly RedFlag[]): string[] => flags.map(f => f.kind);
const find = <K extends RedFlag['kind']>(flags: readonly RedFlag[], kind: K): Extract<RedFlag, {kind: K}> | undefined => flags.find((f): f is Extract<RedFlag, {kind: K}> => f.kind === kind);

// B1c-3 (spec B1c §3.3 rev 3.6, B1 §3): the red-flag table, computed in the background, per transaction.
describe('redFlagsOf — F1 unknown program', () => {
  it('every unknown program of a transaction in one warning, each address once, anchored at the first', () => {
    const flags = one({ixs: [SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1}), unknownIx(), unknownIx(OTHER_PROGRAM), unknownIx()]});
    expect(flags).toEqual([{kind: 'unknown-program', severity: 'warn', word: null, at: 1, programs: [UNKNOWN.toBase58(), OTHER_PROGRAM.toBase58()]}]);
  });

  it('a known program whose data does not parse strictly, and an account no lookup table resolved, are unknown programs', () => {
    const trailing = tokenIx([3, ...u64(5n), 0], [meta(SRC, false, true), meta(TO, false, true), meta(ME, true)]);
    expect(one({ixs: [trailing]})).toEqual([{kind: 'unknown-program', severity: 'warn', word: null, at: 0, programs: [TOKEN_PROGRAM]}]);
    const table = new AddressLookupTableAccount({key: new PublicKey(keyOf(42)), state: {deactivationSlot: U64_MAX, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: [THEIRS]}});
    const viaTable = SystemProgram.transfer({fromPubkey: ME, toPubkey: THEIRS, lamports: 1});
    expect(one({ixs: [viaTable], tables: [table]})).toEqual([{kind: 'unknown-program', severity: 'warn', word: null, at: 0, programs: [SYSTEM_PROGRAM]}]);
    // Negative control: the same transfer without a table decodes, and is no flag.
    expect(one({ixs: [viaTable]})).toEqual([]);
  });
});

describe('redFlagsOf — F2 non-transfer', () => {
  it('every instruction of a decoded program that is not a transfer, named, in one warning — an unknown tag too', () => {
    const unknownTag = tokenIx([99], [meta(SRC, false, true)]);
    const transferWithSeed = SystemProgram.transfer({fromPubkey: SRC, basePubkey: ME, toPubkey: TO, lamports: 1, seed: 's', programId: SystemProgram.programId});
    const flags = one({ixs: [SystemProgram.assign({accountPubkey: THEIRS, programId: UNKNOWN}), ataCreateIx(MAINNET_USDC_MINT, THEIRS), unknownTag, transferWithSeed]});
    expect(find(flags, 'non-transfer')).toEqual({
      kind: 'non-transfer',
      severity: 'warn',
      word: null,
      at: 0,
      instructions: [
        {index: 0, program: 'system', name: 'assign'},
        {index: 1, program: 'associated-token', name: 'createIdempotent'},
        {index: 2, program: 'token', name: null},
        {index: 3, program: 'system', name: 'transferWithSeed'},
      ],
    });
  });

  it('never for Compute Budget (the fee) and never for System transfer, Token / Token-2022 transfer and transferChecked', () => {
    const ixs = [
      ComputeBudgetProgram.setComputeUnitLimit({units: 200_000}),
      ComputeBudgetProgram.setComputeUnitPrice({microLamports: 1_000}),
      SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1}),
      transferIx(5n),
      transferIx(5n, TOKEN_2022_PROGRAM),
      transferCheckedIx(5n, MAINNET_USDC_MINT),
    ];
    expect(one({ixs, pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 100n})]]})).toEqual([]);
    // Positive control: a revoke beside them is named.
    const revoke = tokenIx([5], [meta(SRC, false, true), meta(ME, true)]);
    expect(find(one({ixs: [...ixs, revoke]}), 'non-transfer')?.instructions).toEqual([{index: 6, program: 'token', name: 'revoke'}]);
  });

  it('O7: never for the three self-rent instructions — an own ATA created and paid by the account, syncNative and closeAccount (to the account) of an own token account', () => {
    const wsol = [[SRC, tokenAcc({mint: keyOf(45), amount: 0n})]] as [PublicKey, AccountData][];
    const ixs = [ataCreateIx(MAINNET_USDC_MINT, ME, ME, 0), ataCreateIx(MAINNET_USDC_MINT), syncNativeIx(SRC), closeAccountIx(SRC, ME)];
    expect(kinds(one({ixs, pre: wsol}))).not.toContain('non-transfer');
    // Positive control: a revoke beside them is still named, alone.
    const revoke = tokenIx([5], [meta(SRC, false, true), meta(ME, true)]);
    expect(find(one({ixs: [...ixs, revoke], pre: wsol}), 'non-transfer')?.instructions).toEqual([{index: 4, program: 'token', name: 'revoke'}]);
  });

  it('O7 negative controls: another wallet’s ATA, one another payer funds, a sync or close of an account not the user’s (or unreadable), a close elsewhere — each named', () => {
    const mine = [SRC, tokenAcc({mint: keyOf(45), amount: 0n})] as [PublicKey, AccountData];
    const theirs = [THEIRS, tokenAcc({mint: keyOf(45), owner: TO, amount: 0n})] as [PublicKey, AccountData];
    const cases: [TransactionInstruction, string, [PublicKey, AccountData | null][]][] = [
      [ataCreateIx(MAINNET_USDC_MINT, THEIRS), 'createIdempotent', []],
      [ataCreateIx(MAINNET_USDC_MINT, ME, THEIRS, 0), 'create', []],
      [syncNativeIx(THEIRS), 'syncNative', [theirs]],
      [syncNativeIx(SRC), 'syncNative', [[SRC, null]]],
      [closeAccountIx(SRC, TO), 'closeAccount', [mine]],
      [closeAccountIx(THEIRS, ME, TO), 'closeAccount', [theirs]],
      [closeAccountIx(SRC, ME), 'closeAccount', [[SRC, null]]],
    ];
    for (const [ix, name, pre] of cases) {
      expect(find(one({ixs: [ix], pre}), 'non-transfer')?.instructions.map(x => x.name)).toEqual([name]);
    }
  });
});

// Controller ruling (plan 3, Task 5's ledger): F2 does not repeat an instruction a more specific flag of the same
// transaction already names (F3, F4, F5, F6, F8) — the design draws one banner for an unlimited approve; every other
// instruction F2 named stays named.
describe('redFlagsOf — F2 beside a more specific flag', () => {
  const held = [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n})]] as [PublicKey, AccountData][];
  const closeIx = tokenIx([9], [meta(SRC, false, true), meta(TO, false, true), meta(ME, true)]);

  it('an unlimited approve alone is F5 only; beside an ATA create for another wallet, F2 names only the create', () => {
    expect(kinds(one({ixs: [approveIx(U64_MAX)], pre: held}))).toEqual(['unlimited-approve']);
    const flags = one({ixs: [approveIx(U64_MAX), ataCreateIx(MAINNET_USDC_MINT, THEIRS)], pre: held});
    expect(kinds(flags)).toEqual(['unlimited-approve', 'non-transfer']);
    expect(find(flags, 'non-transfer')).toEqual({kind: 'non-transfer', severity: 'warn', word: null, at: 1, instructions: [{index: 1, program: 'associated-token', name: 'createIdempotent'}]});
  });

  it('negative control: a lone closeAccount, or a revoke, is still F2', () => {
    expect(one({ixs: [closeIx], pre: held})).toEqual([{kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'token', name: 'closeAccount'}]}]);
    const revoke = tokenIx([5], [meta(SRC, false, true), meta(ME, true)]);
    expect(kinds(one({ixs: [revoke], pre: held}))).toEqual(['non-transfer']);
  });

  it('only the instructions the specific flag names leave F2 — the same instruction on someone else’s account stays', () => {
    const named = (spec: Spec): number[] => find(one(spec), 'non-transfer')?.instructions.map(x => x.index) ?? [];
    // F3: the wallet's assign is F3's, another account's stays F2's.
    expect(named({ixs: [SystemProgram.assign({accountPubkey: THEIRS, programId: UNKNOWN}), SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN})]})).toEqual([0]);
    // F4: the own account's setAuthority is F4's, someone else's stays F2's.
    const theirs = tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n});
    expect(named({ixs: [setAuthorityIx(THEIRS, TO), setAuthorityIx(SRC, ME, 3)], pre: [...held, [THEIRS, theirs]]})).toEqual([0]);
    // F5 / F6: the wallet's approves are theirs; an approve by someone else of their own account stays F2's.
    expect(named({ixs: [approveIx(U64_MAX, THEIRS, TO), approveIx(U64_MAX)], pre: [...held, [THEIRS, theirs]]})).toEqual([0]);
    expect(named({ixs: [approveIx(U64_MAX, THEIRS, TO), approveIx(5n)], pre: [...held, [THEIRS, theirs]]})).toEqual([0]);
    // F8 names instruction 0 only: a second AdvanceNonceAccount stays F2's.
    const nonce = SystemProgram.nonceAdvance({noncePubkey: SRC, authorizedPubkey: ME});
    expect(named({ixs: [nonce, SystemProgram.nonceAdvance({noncePubkey: SRC2, authorizedPubkey: ME})]})).toEqual([1]);
  });

  it('a decoded approve no flag names stays F2: bounded, while the chain state shows the account unlimited (F5 is the chain’s)', () => {
    const post: [PublicKey, AccountData][] = [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate: DELEGATE, delegatedAmount: U64_MAX})]];
    const flags = one({ixs: [approveIx(5n)], pre: held, post});
    expect(kinds(flags)).toEqual(['unlimited-approve', 'non-transfer']);
    expect(find(flags, 'unlimited-approve')?.approvals.map(a => a.at)).toEqual([null]);
    expect(find(flags, 'non-transfer')?.instructions).toEqual([{index: 0, program: 'token', name: 'approve'}]);
  });

  it('F7 is not among them: an ATA create (for another wallet) of a Token-2022 mint with settings is F7 and F2', () => {
    const flags = one({ixs: [ataCreateIx(T22_MINT, THEIRS)]}, {mints: [[T22_MINT, mintAcc(pyusdLikeMint(), TOKEN_2022_PROGRAM)]]});
    // O7: the account's own ATA of the same mint is no F2 — F7 still names the mint.
    expect(kinds(one({ixs: [ataCreateIx(T22_MINT)]}, {mints: [[T22_MINT, mintAcc(pyusdLikeMint(), TOKEN_2022_PROGRAM)]]}))).toEqual(['token-2022']);
    expect(kinds(flags)).toEqual(['non-transfer', 'token-2022']);
    expect(flags.map(f => f.at)).toEqual([0, 0]);
  });
});

describe('redFlagsOf — F3 assign / allocate on the wallet account', () => {
  it('assign, allocate, assignWithSeed, allocateWithSeed of the wallet account: one block, ASSIGN, naming each', () => {
    const ixs = [
      SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN}),
      SystemProgram.allocate({accountPubkey: ME, space: 64}),
      SystemProgram.assign({accountPubkey: ME, basePubkey: SRC, seed: 'x', programId: UNKNOWN}),
      SystemProgram.allocate({accountPubkey: ME, basePubkey: SRC, seed: 'x', space: 64, programId: UNKNOWN}),
    ];
    const flags = one({ixs});
    expect(kinds(flags)).toEqual(['assign']);
    expect(find(flags, 'assign')).toEqual({
      kind: 'assign',
      severity: 'block',
      word: 'ASSIGN',
      at: 0,
      instructions: [
        {index: 0, program: 'system', name: 'assign'},
        {index: 1, program: 'system', name: 'allocate'},
        {index: 2, program: 'system', name: 'assignWithSeed'},
        {index: 3, program: 'system', name: 'allocateWithSeed'},
      ],
      chain: null,
    });
  });

  it('another account assigned or allocated is F2 only — the …WithSeed forms by their target, never their base', () => {
    for (const ix of [
      SystemProgram.assign({accountPubkey: THEIRS, programId: UNKNOWN}),
      SystemProgram.allocate({accountPubkey: THEIRS, space: 64}),
      SystemProgram.assign({accountPubkey: THEIRS, basePubkey: ME, seed: 'x', programId: UNKNOWN}),
      SystemProgram.allocate({accountPubkey: THEIRS, basePubkey: ME, seed: 'x', space: 64, programId: UNKNOWN}),
    ]) {
      expect(kinds(one({ixs: [ix]}))).toEqual(['non-transfer']);
    }
  });

  it('chain state: the wallet account owned by another program, or holding data, after the simulation — a CPI — is a block', () => {
    const assigned = one({ixs: [unknownIx()], post: [[ME, {lamports: SOL, owner: UNKNOWN.toBase58(), data: new Uint8Array()}]]});
    expect(find(assigned, 'assign')).toEqual({kind: 'assign', severity: 'block', word: 'ASSIGN', at: null, instructions: [], chain: {owner: UNKNOWN.toBase58(), space: 0}});
    const allocated = one({ixs: [unknownIx()], post: [[ME, {lamports: SOL, owner: SYSTEM_PROGRAM, data: new Uint8Array(100)}]]});
    expect(find(allocated, 'assign')?.chain).toEqual({owner: SYSTEM_PROGRAM, space: 100});
    // Negative controls: a plain wallet account after; and one already so before, which this transaction does not change.
    expect(kinds(one({ixs: [unknownIx()]}))).toEqual(['unknown-program']);
    const before: AccountData = {lamports: SOL, owner: UNKNOWN.toBase58(), data: new Uint8Array(8)};
    expect(kinds(one({ixs: [unknownIx()], pre: [[ME, before]], post: [[ME, before]]}))).toEqual(['unknown-program']);
  });
});

describe('redFlagsOf — F4 setAuthority on an account the user owns', () => {
  it('an own token account (its pre-state owner field is the wallet): a block, AUTHORITY', () => {
    const flags = one({ixs: [setAuthorityIx(SRC, ME, 3)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n})]]});
    expect(kinds(flags)).toEqual(['set-authority']);
    expect(find(flags, 'set-authority')).toEqual({
      kind: 'set-authority',
      severity: 'block',
      word: 'AUTHORITY',
      at: 0,
      instructions: [{index: 0, program: 'token', account: SRC.toBase58(), owned: 'token-account', authorityType: 'closeAccount', newAuthority: TO.toBase58()}],
      chain: [],
    });
    // Its owner field alone decides: a close authority the user once granted signing.
    expect(find(one({ixs: [setAuthorityIx(SRC, DELEGATE, 3)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n, closeAuthority: DELEGATE})]]}), 'set-authority')?.instructions[0]?.owned).toBe('token-account');
  });

  it('a mint whose mint or freeze authority is the wallet — even when someone else signs as its current authority', () => {
    const frozenByMe = mintAcc(mintBytes({mintAuthority: ISSUER, freezeAuthority: ACCT}));
    expect(find(one({ixs: [setAuthorityIx(MINT_ACCT, new PublicKey(ISSUER), 0)], pre: [[MINT_ACCT, frozenByMe]]}), 'set-authority')?.instructions).toEqual([
      {index: 0, program: 'token', account: MINT_ACCT.toBase58(), owned: 'mint', authorityType: 'mintTokens', newAuthority: TO.toBase58()},
    ]);
    const mintedByMe = mintAcc(mintBytes({mintAuthority: ACCT, freezeAuthority: FREEZER}));
    expect(find(one({ixs: [setAuthorityIx(MINT_ACCT, new PublicKey(FREEZER), 1)], pre: [[MINT_ACCT, mintedByMe]]}), 'set-authority')?.instructions[0]?.owned).toBe('mint');
  });

  it('the wallet signing as the current authority of an account it cannot read is a block too (fail closed)', () => {
    expect(find(one({ixs: [setAuthorityIx(THEIRS, ME)], pre: [[THEIRS, null]]}), 'set-authority')?.instructions[0]?.owned).toBe('current-authority');
  });

  it('someone else’s token account, or a mint of others, is F2 only', () => {
    expect(kinds(one({ixs: [setAuthorityIx(THEIRS, TO)], pre: [[THEIRS, tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n})]]}))).toEqual(['non-transfer']);
    expect(kinds(one({ixs: [setAuthorityIx(MINT_ACCT, new PublicKey(ISSUER), 0)], pre: [[MINT_ACCT, mintAcc(usdcLikeMint())]]}))).toEqual(['non-transfer']);
  });

  it('chain state (a CPI): an own account’s owner reassigned, its close authority changed, a mint authority of the wallet’s moved', () => {
    const mine = tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n});
    const reassigned = one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine]], post: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n})]]});
    expect(find(reassigned, 'set-authority')).toEqual({kind: 'set-authority', severity: 'block', word: 'AUTHORITY', at: null, instructions: [], chain: [{account: SRC.toBase58(), change: 'owner', from: ACCT, to: TO.toBase58()}]});
    const closer = one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine]], post: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n, closeAuthority: TO})]]});
    expect(find(closer, 'set-authority')?.chain).toEqual([{account: SRC.toBase58(), change: 'close-authority', from: null, to: TO.toBase58()}]);
    const mintMine = mintAcc(mintBytes({mintAuthority: ACCT, freezeAuthority: ACCT}));
    const moved = one({ixs: [unknownIx(UNKNOWN, [MINT_ACCT])], pre: [[MINT_ACCT, mintMine]], post: [[MINT_ACCT, mintAcc(mintBytes({mintAuthority: TO.toBase58(), freezeAuthority: null}))]]});
    expect(find(moved, 'set-authority')?.chain).toEqual([
      {account: MINT_ACCT.toBase58(), change: 'mint-authority', from: ACCT, to: TO.toBase58()},
      {account: MINT_ACCT.toBase58(), change: 'freeze-authority', from: ACCT, to: null},
    ]);
    // Negative controls: someone else's account changing hands; an own account left as it was.
    const theirs = tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n});
    expect(kinds(one({ixs: [unknownIx(UNKNOWN, [THEIRS])], pre: [[THEIRS, theirs]], post: [[THEIRS, tokenAcc({mint: MAINNET_USDC_MINT, owner: DELEGATE, amount: 5n, closeAuthority: DELEGATE})]]}))).toEqual(['unknown-program']);
    expect(kinds(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine]], post: [[SRC, mine]]}))).toEqual(['unknown-program']);
  });
});

describe('redFlagsOf — F5 unlimited approve, F6 bounded approve', () => {
  const held = (amount = 1_000n) => [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount})]] as [PublicKey, AccountData][];

  it('u64::MAX, or at least the source’s whole balance: a block whose word is the wallet’s own symbol', () => {
    const flags = one({ixs: [approveIx(U64_MAX)], pre: held()});
    expect(kinds(flags)).toEqual(['unlimited-approve']);
    expect(find(flags, 'unlimited-approve')).toEqual({
      kind: 'unlimited-approve',
      severity: 'block',
      word: 'USDC',
      at: 0,
      approvals: [{at: 0, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: U64_MAX.toString(), balance: '1000'}],
    });
    expect(find(one({ixs: [approveIx(1_000n)], pre: held()}), 'unlimited-approve')?.approvals[0]?.amount).toBe('1000');
    expect(find(one({ixs: [approveCheckedIx(5_000n, MAINNET_USDC_MINT)], pre: held()}), 'unlimited-approve')?.word).toBe('USDC');
  });

  it('O5: 99 % of the balance or more is a block — the threshold’s both edges; below it is bounded (F6)', () => {
    // Balance 1 000: 990 is exactly 99 % and 999 is the balance − 1 — blocks; 989, just under 99 %, is a warning.
    for (const amount of [990n, 999n]) expect(kinds(one({ixs: [approveIx(amount)], pre: held()}))).toEqual(['unlimited-approve']);
    expect(find(one({ixs: [approveCheckedIx(990n, MAINNET_USDC_MINT)], pre: held()}), 'unlimited-approve')?.word).toBe('USDC');
    const flags = one({ixs: [approveIx(989n)], pre: held()});
    expect(kinds(flags)).toEqual(['bounded-approve']);
    expect(find(flags, 'bounded-approve')).toEqual({
      kind: 'bounded-approve',
      severity: 'warn',
      word: null,
      at: 0,
      approvals: [{at: 0, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: '989', balance: '1000'}],
    });
    expect(kinds(one({ixs: [approveCheckedIx(989n, MAINNET_USDC_MINT)], pre: held()}))).toEqual(['bounded-approve']);
    expect(kinds(one({ixs: [approveIx(500n)], pre: held()}))).toEqual(['bounded-approve']);
    // A balance whose 99 % is no whole number (7 → 6.93): 7 blocks, 6 does not.
    expect(kinds(one({ixs: [approveIx(7n)], pre: held(7n)}))).toEqual(['unlimited-approve']);
    expect(kinds(one({ixs: [approveIx(6n)], pre: held(7n)}))).toEqual(['bounded-approve']);
  });

  it('O8 (review 2 M5): each balance where it is exact — chain state against the balance after; a decoded approve against the balance before, or the delegation it leaves against the balance after', () => {
    const mine = (amount: bigint, delegatedAmount = 0n) => tokenAcc({mint: MAINNET_USDC_MINT, amount, delegate: delegatedAmount > 0n ? DELEGATE : null, delegatedAmount});
    const viaCpi = (pre: bigint, post: bigint, delegated: bigint) => one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine(pre)]], post: [[SRC, mine(post, delegated)]]});
    // Chain state, review 1 M1's example: 90 % moved out, 150 delegated of the 100 left — a block, against the balance after.
    expect(kinds(viaCpi(1_000n, 100n, 150n))).toEqual(['unlimited-approve', 'unknown-program']);
    expect(find(viaCpi(1_000n, 100n, 150n), 'unlimited-approve')?.approvals[0]?.balance).toBe('100');
    // Tokens brought in, 150 delegated of the 1 000 now held (15 %): F6 — the delegate can move up to 150, as its copy says.
    expect(kinds(viaCpi(100n, 1_000n, 150n))).toEqual(['unknown-program', 'bounded-approve']);
    expect(find(viaCpi(100n, 1_000n, 150n), 'bounded-approve')?.approvals).toEqual([
      {at: null, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: '150', balance: '1000'},
    ]);
    // Negative control: below 99 % before and after.
    expect(kinds(viaCpi(1_000n, 1_000n, 150n))).toEqual(['unknown-program', 'bounded-approve']);
    // Decoded: 900 out, then 150 approved — 150 left delegated of the 100 left: the decoded approve blocks (its instruction 1; the
    // chain state's sighting of the same delegation folded into it), its balance the one before.
    const decoded = (post: bigint, delegated: bigint) => one({ixs: [transferIx(900n), approveIx(150n)], pre: [[SRC, mine(1_000n)]], post: [[SRC, mine(post, delegated)]]});
    expect(find(decoded(100n, 150n), 'unlimited-approve')?.approvals.map(a => [a.at, a.balance])).toEqual([[1, '1000']]);
    expect(kinds(decoded(1_000n, 150n))).toEqual(['bounded-approve']);
    // A delegation a program raised past what the decoded approve granted is the chain state's F5 (Q43), not the instruction's.
    expect(find(one({ixs: [approveIx(5n)], pre: held(), post: [[SRC, mine(1_000n, U64_MAX)]]}), 'unlimited-approve')?.approvals.map(a => a.at)).toEqual([null]);
  });

  it('O8: a delegation the same transaction consumes is F6 — approve 500 of 1 000, a program pulls the 500 (the delegate cleared), the rest kept or sent away', () => {
    const consumed = (post: bigint) => one({ixs: [approveIx(500n), unknownIx(UNKNOWN, [SRC])], pre: held(), post: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: post})]]});
    for (const post of [500n, 0n]) {
      expect(kinds(consumed(post))).toEqual(['bounded-approve', 'unknown-program']);
      // Q45's body: "This lets a delegate move up to 0.0005 USDC of your USDC until you revoke." — the approved amount.
      expect(find(consumed(post), 'bounded-approve')?.approvals).toEqual([
        {at: 0, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: '500', balance: '1000'},
      ]);
    }
  });

  it('L12 (review 3): the delegation an approve leaves is its own only with its own delegate — another left there is the chain state’s F5, naming it', () => {
    const mine = (amount: bigint, delegate: PublicKey | null = null, delegatedAmount = 0n) => tokenAcc({mint: MAINNET_USDC_MINT, amount, delegate, delegatedAmount});
    // Approve 500 to DELEGATE, 500 sent out; after it THEIRS holds 495 of the 500 left: F5 from chain state, naming THEIRS.
    const px1 = (delegate: PublicKey) => one({ixs: [approveIx(500n), transferIx(500n)], pre: [[SRC, mine(1_000n)]], post: [[SRC, mine(500n, delegate, 495n)]]});
    expect(find(px1(THEIRS), 'unlimited-approve')?.approvals.map(a => [a.at, a.delegate])).toEqual([[null, THEIRS.toBase58()]]);
    // Positive control: the instruction's own delegate left with it — the decoded approve's F5, naming DELEGATE.
    expect(find(px1(DELEGATE), 'unlimited-approve')?.approvals.map(a => [a.at, a.delegate])).toEqual([[0, DELEGATE.toBase58()]]);
  });

  it('L13 (review 3): a source holding nothing before — empty, even with tokens arriving in the same transaction — makes any decoded approve of it a block (fail closed)', () => {
    const mine = (amount: bigint, delegatedAmount = 0n) => tokenAcc({mint: MAINNET_USDC_MINT, amount, delegate: delegatedAmount > 0n ? DELEGATE : null, delegatedAmount});
    const px2 = (pre: bigint) => one({ixs: [approveIx(150n), unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine(pre)]], post: [[SRC, mine(1_000n, 150n)]]});
    expect(find(px2(0n), 'unlimited-approve')?.approvals.map(a => [a.at, a.balance])).toEqual([[0, '0']]);
    // Negative control: the same with 500 held before — 150 of 500 before, of 1 000 after: F6.
    expect(find(px2(500n), 'unlimited-approve')).toBeUndefined();
    expect(find(px2(500n), 'bounded-approve')?.approvals.map(a => [a.at, a.amount])).toEqual([[0, '150']]);
  });

  it('a source the wallet cannot read, approved by the wallet, counts as an empty balance (fail closed)', () => {
    expect(kinds(one({ixs: [approveIx(1n)], pre: [[SRC, null]]}))).toEqual(['unlimited-approve']);
  });

  it('someone else’s account approved by its own owner is F2 only', () => {
    expect(kinds(one({ixs: [approveIx(U64_MAX, THEIRS, TO)], pre: [[THEIRS, tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n})]]}))).toEqual(['non-transfer']);
  });

  it('chain state (a CPI): an own account’s delegation new or raised to u64::MAX, its whole balance or 99 % of it is a block; less is bounded', () => {
    const viaCpi = (delegatedAmount: bigint, pre = tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n}), delegate = DELEGATE) =>
      one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, pre]], post: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate, delegatedAmount})]]});
    expect(find(viaCpi(U64_MAX), 'unlimited-approve')).toEqual({
      kind: 'unlimited-approve',
      severity: 'block',
      word: 'USDC',
      at: null,
      approvals: [{at: null, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: U64_MAX.toString(), balance: '1000'}],
    });
    expect(kinds(viaCpi(1_000n))).toEqual(['unlimited-approve', 'unknown-program']);
    expect(kinds(viaCpi(990n))).toEqual(['unlimited-approve', 'unknown-program']);
    expect(kinds(viaCpi(989n))).toEqual(['unknown-program', 'bounded-approve']);
    // Negative control: a delegation already there, unchanged by this transaction.
    const already = tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate: DELEGATE, delegatedAmount: U64_MAX});
    expect(kinds(viaCpi(U64_MAX, already))).toEqual(['unknown-program']);
    // Final review I2: a delegation already there (10 to DELEGATE) RAISED by the CPI, or moved to another delegate at the
    // same amount, is a new approval — never "unchanged" (redFlags.ts's skip needs the same delegate AND no more than before).
    const small = tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate: DELEGATE, delegatedAmount: 10n});
    expect(kinds(viaCpi(U64_MAX, small))).toEqual(['unlimited-approve', 'unknown-program']);
    expect(kinds(viaCpi(500n, small))).toEqual(['unknown-program', 'bounded-approve']);
    const moved = viaCpi(10n, small, OTHER_DELEGATE);
    expect(kinds(moved)).toEqual(['unknown-program', 'bounded-approve']);
    expect(find(moved, 'bounded-approve')?.approvals.map(a => [a.delegate, a.amount])).toEqual([[OTHER_DELEGATE.toBase58(), '10']]);
    // Its negative control: the same 10 to the same delegate is unchanged.
    expect(kinds(viaCpi(10n, small))).toEqual(['unknown-program']);
  });

  it('final review I1: another transaction of the batch — earlier or later — sending tokens out of the source lowers the balance an approve of it is judged against — never raises it', () => {
    const mine = (amount: bigint, delegatedAmount = 0n) => tokenAcc({mint: MAINNET_USDC_MINT, amount, delegate: delegatedAmount > 0n ? DELEGATE : null, delegatedAmount});
    const send600: Spec = {ixs: [transferIx(600n)], pre: [[SRC, mine(1_000n)]], post: [[SRC, mine(400n)]]};
    // Every transaction is simulated against the state as it is now: step 2 sees 1 000, the batch leaves 400.
    const approve = (amount: bigint): Spec => ({ixs: [approveIx(amount)], pre: [[SRC, mine(1_000n)]], post: [[SRC, mine(1_000n, amount)]]});
    const [s1, s2] = flagsOf([send600, approve(400n)]);
    expect(s1).toEqual([]);
    expect(kinds(s2 ?? [])).toEqual(['unlimited-approve']);
    expect(find(s2 ?? [], 'unlimited-approve')?.approvals.map(a => [a.at, a.amount, a.balance])).toEqual([[0, '400', '400']]);
    // The decoded rule alone (no delegation in step 2's post-state), and the chain state's (a CPI in step 2): the same.
    expect(kinds(flagsOf([send600, {ixs: [approveIx(400n)], pre: [[SRC, mine(1_000n)]]}])[1] ?? [])).toEqual(['unlimited-approve']);
    expect(kinds(flagsOf([send600, {ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine(1_000n)]], post: [[SRC, mine(1_000n, 400n)]]}])[1] ?? [])).toEqual(['unlimited-approve', 'unknown-program']);
    // Sending all of it first: any approve of the source is a block (an empty balance, L13's rule).
    const sendAll: Spec = {ixs: [transferIx(1_000n)], pre: [[SRC, mine(1_000n)]], post: [[SRC, mine(0n)]]};
    expect(kinds(flagsOf([sendAll, approve(1n)])[1] ?? [])).toEqual(['unlimited-approve']);
    // Negative controls: 300 of the 400 left is bounded; alone, 400 of 1 000 is bounded.
    expect(kinds(flagsOf([send600, approve(300n)])[1] ?? [])).toEqual(['bounded-approve']);
    expect(kinds(flagsOf([approve(400n)])[0] ?? [])).toEqual(['bounded-approve']);
    // A LATER outflow counts too (the controller's ruling): approve 400 in step 1, send 600 of 1 000 in step 2 — a block;
    // its negative control: 300 with the same later send is bounded.
    expect(kinds(flagsOf([approve(400n), send600])[0] ?? [])).toEqual(['unlimited-approve']);
    expect(find(flagsOf([approve(400n), send600])[0] ?? [], 'unlimited-approve')?.approvals[0]?.balance).toBe('400');
    expect(kinds(flagsOf([approve(300n), send600])[0] ?? [])).toEqual(['bounded-approve']);
    // A later inflow never lowers (or raises) the bar either: 400 of 1 000 stays bounded, 990 stays a block.
    const receiveLater: Spec = {ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine(1_000n)]], post: [[SRC, mine(1_600n)]]};
    expect(kinds(flagsOf([approve(400n), receiveLater])[0] ?? [])).toEqual(['bounded-approve']);
    expect(kinds(flagsOf([approve(990n), receiveLater])[0] ?? [])).toEqual(['unlimited-approve']);
    // An earlier step that RECEIVES tokens does not raise the bar: 400 of 1 000 stays bounded, 990 of 1 000 stays a block.
    const receive600: Spec = {ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine(1_000n)]], post: [[SRC, mine(1_600n)]]};
    expect(kinds(flagsOf([receive600, approve(400n)])[1] ?? [])).toEqual(['bounded-approve']);
    expect(find(flagsOf([receive600, approve(400n)])[1] ?? [], 'bounded-approve')?.approvals[0]?.balance).toBe('1000');
    expect(kinds(flagsOf([receive600, approve(990n)])[1] ?? [])).toEqual(['unlimited-approve']);
    // Another source's outflow, or a step that did not simulate, drains nothing from this one.
    const sendOther: Spec = {ixs: [unknownIx(UNKNOWN, [SRC2])], pre: [[SRC2, mine(1_000n)]], post: [[SRC2, mine(400n)]]};
    expect(kinds(flagsOf([sendOther, approve(400n)])[1] ?? [])).toEqual(['bounded-approve']);
    expect(kinds(flagsOf([{...send600, post: 'failed'}, approve(400n)])[1] ?? [])).toEqual(['bounded-approve']);
    // Nor does a dependent one (no post-state; spec §9) — before or after the approve.
    expect(kinds(flagsOf([{...send600, post: {dependentOn: 1}}, approve(400n)])[1] ?? [])).toEqual(['bounded-approve']);
    expect(kinds(flagsOf([approve(400n), {...send600, post: {dependentOn: 0}}])[0] ?? [])).toEqual(['bounded-approve']);
  });

  it('an approve seen both decoded and in chain state is listed once', () => {
    const post: [PublicKey, AccountData][] = [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate: DELEGATE, delegatedAmount: U64_MAX})]];
    expect(find(one({ixs: [approveIx(U64_MAX)], pre: held(), post}), 'unlimited-approve')?.approvals.map(a => a.at)).toEqual([0]);
  });

  it('Task 2 review I1: a chain-state delegation is folded into a decoded approve only when it is that approve’s own — same delegate, no more than it granted', () => {
    const left = (delegate: PublicKey, delegatedAmount: bigint) => [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate, delegatedAmount})]] as [PublicKey, AccountData][];
    const view = (approvals: readonly {at: number | null; delegate: string | null; amount: string}[] | undefined) => approvals?.map(a => [a.at, a.delegate, a.amount]);
    // P1: approve u64::MAX to DELEGATE, a program leaves THEIRS at u64::MAX — the block names THEIRS too.
    const p1 = one({ixs: [approveIx(U64_MAX), unknownIx(UNKNOWN, [SRC])], pre: held(), post: left(THEIRS, U64_MAX)});
    expect(view(find(p1, 'unlimited-approve')?.approvals)).toEqual([
      [0, DELEGATE.toBase58(), U64_MAX.toString()],
      [null, THEIRS.toBase58(), U64_MAX.toString()],
    ]);
    // P1b: approve 5 to DELEGATE, a program re-approves 900 of the 1 000 to THEIRS (90 %, below 99 %): F6 lists both, each with its own amount.
    const p1b = one({ixs: [approveIx(5n), unknownIx(UNKNOWN, [SRC])], pre: held(), post: left(THEIRS, 900n)});
    expect(find(p1b, 'unlimited-approve')).toBeUndefined();
    expect(view(find(p1b, 'bounded-approve')?.approvals)).toEqual([
      [0, DELEGATE.toBase58(), '5'],
      [null, THEIRS.toBase58(), '900'],
    ]);
    // P1b at 99 % (THEIRS 990 of 1 000): F5 for THEIRS from chain state; the decoded approve's bounded entry for the same source folds into the block.
    const p1b99 = one({ixs: [approveIx(5n), unknownIx(UNKNOWN, [SRC])], pre: held(), post: left(THEIRS, 990n)});
    expect(view(find(p1b99, 'unlimited-approve')?.approvals)).toEqual([[null, THEIRS.toBase58(), '990']]);
    // Negative controls: the approve's own delegate left with exactly what it granted — one entry, the decoded one.
    expect(view(find(one({ixs: [approveIx(500n), unknownIx(UNKNOWN, [SRC])], pre: held(), post: left(DELEGATE, 500n)}), 'bounded-approve')?.approvals)).toEqual([[0, DELEGATE.toBase58(), '500']]);
    expect(view(find(one({ixs: [approveIx(U64_MAX), unknownIx(UNKNOWN, [SRC])], pre: held(), post: left(DELEGATE, U64_MAX)}), 'unlimited-approve')?.approvals)).toEqual([[0, DELEGATE.toBase58(), U64_MAX.toString()]]);
    // Positive control: the same delegate raised past the grant (500 → 600, still bounded) is listed from chain state too.
    expect(view(find(one({ixs: [approveIx(500n), unknownIx(UNKNOWN, [SRC])], pre: held(), post: left(DELEGATE, 600n)}), 'bounded-approve')?.approvals)).toEqual([
      [0, DELEGATE.toBase58(), '500'],
      [null, DELEGATE.toBase58(), '600'],
    ]);
  });

  it('Task 2 review minor 4: F5’s threshold is exactly 99 % (WHOLE_BALANCE_PERCENT) — a change to it is deliberate', () => {
    expect(WHOLE_BALANCE_PERCENT).toBe(99n);
    // Balance 10 000: 9 900 (99 %) blocks, 9 899 does not; 9 800 (98 %) does not; 9 999 (under 100 %) blocks.
    const held10k = [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 10_000n})]] as [PublicKey, AccountData][];
    const blocks = (amount: bigint) => find(one({ixs: [approveIx(amount)], pre: held10k}), 'unlimited-approve') !== undefined;
    expect([9_800n, 9_899n, 9_900n, 9_999n].map(blocks)).toEqual([false, false, true, true]);
  });

  it('the word: the wallet table’s symbol only when the mint’s decimals match it; else UNLIMITED — never a name the mint claims', () => {
    expect(find(one({ixs: [approveIx(U64_MAX)], pre: held()}, {mints: [[MAINNET_USDC_MINT, mintAcc(mintBytes({decimals: 9}))]]}), 'unlimited-approve')).toMatchObject({word: 'UNLIMITED', approvals: [{symbol: null, decimals: 9}]});
    expect(find(one({ixs: [approveIx(U64_MAX)], pre: held()}, {mints: [[MAINNET_USDC_MINT, null]]}), 'unlimited-approve')).toMatchObject({word: 'UNLIMITED', approvals: [{symbol: null, decimals: null}]});
    const claimsUsdc = mintAcc(mintBytes({decimals: 6, extensions: [{type: 19, value: Uint8Array.from('USDC', c => c.charCodeAt(0))}]}), TOKEN_2022_PROGRAM);
    const fake = [[SRC, tokenAcc({mint: ODD_MINT, amount: 1_000n}, TOKEN_2022_PROGRAM)]] as [PublicKey, AccountData][];
    expect(find(one({ixs: [approveIx(U64_MAX, SRC, ME, TOKEN_2022_PROGRAM)], pre: fake}, {mints: [[ODD_MINT, claimsUsdc]]}), 'unlimited-approve')).toMatchObject({word: 'UNLIMITED', approvals: [{mint: ODD_MINT, symbol: null, decimals: 6}]});
  });

  it('one word per transaction: one symbol for every unlimited approval, else UNLIMITED', () => {
    const both = [
      [SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 10n})],
      [SRC2, tokenAcc({mint: MAINNET_USDT_MINT, amount: 10n})],
    ] as [PublicKey, AccountData][];
    const usdt = mintAcc(mintBytes({decimals: 6}));
    expect(find(one({ixs: [approveIx(U64_MAX), approveIx(U64_MAX, SRC2)], pre: both}, {mints: [[MAINNET_USDT_MINT, usdt]]}), 'unlimited-approve')?.word).toBe('UNLIMITED');
    expect(find(one({ixs: [approveIx(U64_MAX), approveIx(10n)], pre: both}), 'unlimited-approve')?.word).toBe('USDC');
  });

  it('L14 (review 3): a token the wallet cannot name — UNLIMITED only at u64::MAX, ALLOWANCE below it; a named token keeps its symbol either way', () => {
    const odd = mintAcc(mintBytes({decimals: 9}));
    const word = (amounts: bigint[], mints: [string, AccountData | null][] = [[MAINNET_USDC_MINT, odd]]) =>
      find(one({ixs: amounts.map((a, i) => approveIx(a, i === 0 ? SRC : SRC2)), pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n})], [SRC2, tokenAcc({mint: MAINNET_USDT_MINT, amount: 1_000n})]]}, {mints}), 'unlimited-approve')?.word;
    expect(word([U64_MAX])).toBe('UNLIMITED');
    expect(word([995n])).toBe('ALLOWANCE');
    expect(word([995n], [])).toBe('USDC');
    expect(word([U64_MAX], [])).toBe('USDC');
    // Two tokens: UNLIMITED when one of them is u64::MAX, else ALLOWANCE.
    const usdt = mintAcc(mintBytes({decimals: 6}));
    expect(word([995n, 999n], [[MAINNET_USDT_MINT, usdt]])).toBe('ALLOWANCE');
    expect(word([995n, U64_MAX], [[MAINNET_USDT_MINT, usdt]])).toBe('UNLIMITED');
  });
});

describe('redFlagsOf — F7 Token-2022 mint settings', () => {
  const holding = (mint: string) => [[SRC, tokenAcc({mint, amount: 5n}, TOKEN_2022_PROGRAM)]] as [PublicKey, AccountData][];

  it('a Token-2022 mint of an own account: its freeze authority, permanent delegate and transfer hook, named', () => {
    const flags = one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints: [[T22_MINT, mintAcc(pyusdLikeMint(), TOKEN_2022_PROGRAM)]]});
    expect(find(flags, 'token-2022')).toEqual({kind: 'token-2022', severity: 'warn', word: null, at: null, mint: T22_MINT, settings: {freezeAuthority: FREEZER, permanentDelegate: PERMANENT_DELEGATE, transferHookProgram: null}});
    const hooked = mintAcc(mintBytes({extensions: [transferHookExt(HOOK_AUTHORITY, HOOK_PROGRAM)]}), TOKEN_2022_PROGRAM);
    expect(find(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints: [[T22_MINT, hooked]]}), 'token-2022')?.settings).toEqual({freezeAuthority: null, permanentDelegate: null, transferHookProgram: HOOK_PROGRAM});
  });

  it('no flag: a Token-2022 mint whose delegate is the zero key and with no freeze authority or hook; a classic mint with a freeze authority', () => {
    const zero = mintAcc(mintBytes({mintAuthority: ISSUER, extensions: [permanentDelegateExt(null), transferHookExt(HOOK_AUTHORITY, null)]}), TOKEN_2022_PROGRAM);
    expect(kinds(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints: [[T22_MINT, zero]]}))).toEqual(['unknown-program']);
    expect(kinds(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n})]]}))).toEqual(['unknown-program']);
    // Positive control: the same Token-2022 mint with a real delegate key.
    const real = mintAcc(mintBytes({mintAuthority: ISSUER, extensions: [permanentDelegateExt(PERMANENT_DELEGATE)]}), TOKEN_2022_PROGRAM);
    expect(find(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints: [[T22_MINT, real]]}), 'token-2022')?.settings).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
  });

  it('a mint that cannot be read — not read at all, absent, another owner, Token-2022 bytes that do not parse — warns (Q36)', () => {
    const unreadable = (mints: [string, AccountData | null][]) => find(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints}), 'token-2022');
    const q36 = {kind: 'token-2022', severity: 'warn', word: null, at: null, mint: T22_MINT, settings: null};
    expect(unreadable([])).toEqual(q36);
    expect(unreadable([[T22_MINT, null]])).toEqual(q36);
    expect(unreadable([[T22_MINT, mintAcc(pyusdLikeMint(), UNKNOWN.toBase58())]])).toEqual(q36);
    expect(unreadable([[T22_MINT, mintAcc(mintBytes({extensions: [{...permanentDelegateExt(PERMANENT_DELEGATE), length: 40}]}), TOKEN_2022_PROGRAM)]])).toEqual(q36);
  });

  it('the mints: own token accounts pre and post, and every mint a decoded token or ATA instruction names — not someone else’s account', () => {
    const t22Post = [[SRC2, tokenAcc({mint: ODD_MINT, amount: 1n}, TOKEN_2022_PROGRAM)]] as [PublicKey, AccountData][];
    const theirs = [[THEIRS, tokenAcc({mint: keyOf(43), owner: TO, amount: 1n}, TOKEN_2022_PROGRAM)]] as [PublicKey, AccountData][];
    const spec: Spec = {ixs: [transferCheckedIx(1n, T22_MINT, TOKEN_2022_PROGRAM), ataCreateIx(keyOf(44))], pre: [...holding(MAINNET_USDC_MINT), ...theirs], post: [...t22Post, ...theirs]};
    expect(flagMints({account: ACCT, txs: [txOf(spec)]})).toEqual([T22_MINT, keyOf(44), MAINNET_USDC_MINT, ODD_MINT]);
    const flags = one(spec);
    expect(flags.filter(f => f.kind === 'token-2022').map(f => [f.at, f.kind === 'token-2022' ? f.mint : null])).toEqual([
      [0, T22_MINT],
      [1, keyOf(44)],
      [null, ODD_MINT],
    ]);
  });
});

describe('redFlagsOf — F8 durable nonce, F9 whole balance, F10 dependent step', () => {
  it('AdvanceNonceAccount first: "does not expire" (F8 names it, so F2 does not); at index 1 it is F2 only', () => {
    const nonce = SystemProgram.nonceAdvance({noncePubkey: SRC, authorizedPubkey: ME});
    const transfer = SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1});
    expect(one({ixs: [nonce, transfer]})).toEqual([{kind: 'durable-nonce', severity: 'warn', word: null, at: 0}]);
    expect(kinds(one({ixs: [transfer, nonce]}))).toEqual(['non-transfer']);
  });

  it('whole balance to a first-time address: on each transaction that sends to one, when the request has the reason', () => {
    const transfer = SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1});
    const reasons: DappReauthReason[] = ['first-send', 'whole-balance-to-new'];
    expect(flagsOf([{ixs: [transfer], firstSend: true}, {ixs: [transfer]}], {reasons})).toEqual([[{kind: 'whole-balance', severity: 'warn', word: null, at: null}], []]);
    expect(flagsOf([{ixs: [transfer], firstSend: true}], {reasons: ['first-send']})).toEqual([[]]);
  });

  it('a step that depends on an earlier one: a block, UNCHECKED; any other failure is no flag (Reject only) — decoded flags stay', () => {
    const assign = SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN});
    expect(one({ixs: [transferIx(1n)], post: {dependentOn: 0}})).toEqual([{kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, on: 0}]);
    expect(one({ixs: [transferIx(1n)], post: 'failed'})).toEqual([]);
    expect(kinds(one({ixs: [assign], post: 'failed'}))).toEqual(['assign']);
    // A failed step has no post-state: chain-state rules read nothing (the wallet's plain post is not consulted).
    expect(kinds(one({ixs: [unknownIx()], pre: [[ME, {lamports: SOL, owner: UNKNOWN.toBase58(), data: new Uint8Array(4)}]], post: 'failed'}))).toEqual(['unknown-program']);
  });
});

describe('redFlagsOf — the order', () => {
  it('blocks first, then warnings; within each by instruction index (chain state and whole-transaction flags after), then by row', () => {
    const nonce = SystemProgram.nonceAdvance({noncePubkey: SRC2, authorizedPubkey: ME});
    const revoke = tokenIx([5], [meta(SRC, false, true), meta(ME, true)]);
    const flags = one(
      {ixs: [revoke, nonce, SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN}), unknownIx(), approveIx(U64_MAX)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1n})]], post: {dependentOn: 0}, firstSend: true},
      {reasons: ['whole-balance-to-new']},
    );
    // The nonce is not first, so it is no F8: F2 names it beside the revoke.
    expect(flags.map(f => [f.kind, f.at])).toEqual([
      ['assign', 2],
      ['unlimited-approve', 4],
      ['dependent', null],
      ['non-transfer', 0],
      ['unknown-program', 3],
      ['whole-balance', null],
    ]);
    expect(find(flags, 'non-transfer')?.instructions.map(x => x.index)).toEqual([0, 1]);
  });
});

describe('expectedOverrides / overridesMatch', () => {
  const batch = (): RedFlag[][] =>
    flagsOf([
      {ixs: [SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN}), approveIx(U64_MAX)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1n})]]},
      {ixs: [approveIx(1n)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 9n})]]},
      {ixs: [transferIx(1n)], post: {dependentOn: 1}},
    ]);
  const expected = [
    {tx: 0, word: 'ASSIGN'},
    {tx: 0, word: 'USDC'},
    {tx: 2, word: 'UNCHECKED'},
  ];

  it('one word per (transaction, block kind), in order; none for warnings', () => {
    expect(expectedOverrides(batch())).toEqual(expected);
    expect(expectedOverrides(flagsOf([{ixs: [approveIx(1n)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 9n})]]}]))).toEqual([]);
  });

  it('ok only for exactly the expected words, in any order; missing when some are absent; mismatch for anything else', () => {
    expect(overridesMatch(batch(), expected)).toBe('ok');
    expect(overridesMatch(batch(), [...expected].reverse())).toBe('ok');
    expect(overridesMatch([[], []], [])).toBe('ok');
    expect(overridesMatch(batch(), expected.slice(1))).toBe('missing');
    expect(overridesMatch(batch(), [])).toBe('missing');
    expect(overridesMatch(batch(), [{tx: 0, word: 'ASSIGN'}, {tx: 0, word: 'usdc'}, {tx: 2, word: 'UNCHECKED'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [{tx: 0, word: 'ASSIGN '}, {tx: 0, word: 'USDC'}, {tx: 2, word: 'UNCHECKED'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [...expected, {tx: 1, word: 'USDC'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [...expected, {tx: 0, word: 'ASSIGN'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [{tx: 1, word: 'ASSIGN'}, {tx: 0, word: 'USDC'}, {tx: 2, word: 'UNCHECKED'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [{tx: 0, word: 'USDC'}, {tx: 0, word: 'USDC'}, {tx: 2, word: 'UNCHECKED'}])).toBe('mismatch');
    expect(overridesMatch([[], []], [{tx: 0, word: 'ASSIGN'}])).toBe('mismatch');
  });
});
