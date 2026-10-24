import type {BrowserContext, Route} from '@playwright/test';
import {randomBytes} from 'node:crypto';
import {base58, base64} from '@scure/base';
import {presalePurchase} from './historyFixtures';
import {
  ALLOCATION_RENT,
  CONFIG_PDA,
  PRESALE_PROGRAM,
  USDC_MINT,
  USDT_MINT,
  USER_ACCOUNT_RENT,
  allocationData,
  allocationOf,
  allocationPda,
  configOf,
  purchaseCurrency,
  restrictedList,
  solCents,
  stableCents,
  tokensFor,
  userData,
  userPda,
  type Currency,
} from './presaleChain';

/** The chain's height when the fake starts; a blockhash handed out at height h is valid through h + 150. */
export const FAKE_START_HEIGHT = 1000;
export const BLOCKHASH_LIFETIME = 150;
const RPC = 'https://api.noc-tura.io/api/v1/rpc';
const BROADCAST = 'https://api.noc-tura.io/api/v1/tx/broadcast';
const PRICES = 'https://api.noc-tura.io/api/v1/wallet/prices';
const STATS = 'https://api.noc-tura.io/api/v1/stats';
const GEO_CHECK = 'https://api.noc-tura.io/api/v1/geo/check';
const GEO_LIST = 'https://api.noc-tura.io/api/v1/geo/restricted-list';
/** rpcResult's answer for a method it does not implement (listed in `unexpected` too). */
const METHOD_NOT_FOUND: unique symbol = Symbol('method not found');
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
/** B1c-3: Token-2022 — its token accounts and mints the fake answers like the classic program's, with the extensions. */
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
/** B1c-3: the wallet's own tokens' mints (NOC, USDC, USDT) and their decimals — what the fake chain holds by default. */
const WALLET_MINTS: [string, number][] = [
  ['B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', 9],
  ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6],
  ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 6],
];
/** The rent-exempt minimum of a 165-byte token account: what an associated-token-account Create takes from its payer. */
export const TOKEN_ACCOUNT_RENT = 2_039_280;

export interface FakeCoordinator {
  /**
   * 'confirm': a signature is confirmed at its second status check. 'expire': the network never sees it.
   * 'fail' (plan 3): it lands at its second check, confirmed WITH an error (#44's rejected-by-program).
   */
  mode: 'confirm' | 'expire' | 'fail';
  /** Plan 3: the broadcast route refuses before forwarding — 400 `rejected` (#44's network-error). */
  broadcastReject: boolean;
  /** What getBlockHeight answers; the test moves it past a blockhash's life to drive expiry. */
  blockHeight: number;
  hits: {url: string; rpcMethod: string | null}[];
  /** Signatures, in the order the broadcast route received them. */
  broadcasts: string[];
  /** The signed wire bytes (base64), in the same order: each distinct set is a distinct transaction. */
  broadcastWires: string[];
  /** Full-history status checks (searchTransactionHistory: true) and when they were answered. */
  historyChecks: {signature: string; at: number}[];
  /** Anything the fake was asked that it does not implement, or asked in the wrong shape. */
  unexpected: string[];
  /**
   * B1b-2a: 'ok' answers; 'forbidden' answers every request 403 (the D26 cool-down); 'unreachable'
   * aborts every request — no answer at all (#42).
   */
  network: 'ok' | 'forbidden' | 'unreachable';
  /** SOL per address, lamports; anything unlisted holds `defaultLamports`. */
  lamports: Map<string, number>;
  /** What an unlisted address holds (10 SOL unless a spec sets an empty chain). */
  defaultLamports: number;
  /** What getAccountInfo says an address is (E2); anything unlisted does not exist. */
  accountKinds: Map<string, 'wallet' | 'program' | 'other'>;
  /** The simulation's error switch (E2): err set and accounts null, as the real RPC answers. */
  simulateError: boolean;
  /** B1c-2: the err a switched-on simulation answers — an InstructionError unless set (the node's 'BlockhashNotFound', Q21). */
  simulateErr: unknown;
  /** Every simulateTransaction's requested addresses (null = the field was missing). */
  simulations: (string[] | null)[];
  /** Plan 3: the payer's lamports after each simulated transaction, fee included — what the node answered. */
  simulatedPayerAfter: number[];
  /**
   * Plan 3: SPL token accounts per owner, answered by getTokenAccountsByOwner in the node's jsonParsed shape
   * (what core/solana/rpc.ts reads: pubkey, account.data.parsed.info.{mint, owner, tokenAmount.{amount,
   * decimals}}). They feed the balances #11 and #43 show, and (final review, carry d) a token send's simulation:
   * a requested token account comes back in its 165-byte layout after the transaction's transfers.
   */
  tokenAccounts: Map<string, {pubkey: string; mint: string; amount: string; decimals: number; program?: 'token' | 'token-2022'}[]>;
  /**
   * B1c-3: mint accounts by address — their owner program and bytes (`mintData`), answered by getMultipleAccounts (the
   * simulation's one mint read, for decimals and the red flags F5/F7) and getAccountInfo. It starts with the wallet's
   * three tokens as the chain has them — classic SPL mints, NOC at 9 decimals, USDC and USDT at 6 (their authorities
   * are not modeled: no flag reads a classic mint's, O3). An unlisted mint reads as every other unlisted address does:
   * a system account (no mint data — the wallet cannot read it).
   */
  mints: Map<string, {program: 'token' | 'token-2022'; data: Uint8Array}>;
  /** Per owner, newest first: the signatures getSignaturesForAddress pages through, and each getTransaction result. */
  history: Map<string, {signature: string; tx: unknown}[]>;
  /** B1d-1b Task 8 (spec B1d §6.3): the presale program's accounts and what it does to a purchase. */
  presale: FakePresale;
  /** B1d-1b Task 8: the coordinator's jurisdiction routes, /geo/check and /geo/restricted-list. */
  geo: FakeGeo;
  /**
   * Holds every answer until the returned function is called — how a visual spec keeps a loading
   * state (#40's, #8's "Checking…") on screen deterministically while it is asserted and shot.
   */
  hold(): () => void;
}

/**
 * B1d §6.3: the presale program on this chain. Its accounts (the config and each buyer's UserAccount and
 * PresaleAllocation PDAs, owned by the program) are answered by getMultipleAccounts and getAccountInfo; the treasury is
 * any system account (`lamports`) and its two vault ATAs are token accounts listed under the treasury in
 * `tokenAccounts`. A purchase instruction in a simulated transaction is run as the program runs it — its PDAs checked
 * (ConstraintSeeds 2006), its cents (SOL at `solUsd`, a stablecoin at 100 a unit) against the config's minimum (6022) and
 * maximum (6023), the paying token account's balance (1), the PDAs it creates paid by the payer at mainnet's rent — and
 * the post-state reports the allocation, the user account, the destination the instruction names and the paying
 * account after it. The broadcast route applies the same effects to the chain (the purchase lands at its broadcast).
 */
export interface FakePresale {
  accounts: Map<string, {lamports: number; data: Uint8Array}>;
  /** The program's own SOL price (its Pyth read), dollars. */
  solUsd: number;
  /** 'unreachable': a getMultipleAccounts that names the config gets no answer at all (aborted). */
  read: 'ok' | 'unreachable';
  /** The simulation reports the destination the purchase names unchanged: the payment went somewhere else (C28). */
  wrongDestination: boolean;
  /** Each purchase the program ran in a simulation, in order. */
  simulated: PresaleEffect[];
  /** Each purchase that landed through the broadcast route. */
  landed: PresaleEffect[];
}
export interface PresaleEffect {
  currency: Currency;
  amount: bigint;
  cents: bigint;
  tokens: bigint;
  /** The program's 0-indexed stage it priced at. */
  stage: number;
  user: string;
  destination: string;
  source: string | null;
  /** The rent of the PDAs it creates, lamports. */
  rent: number;
}
/** B1d §6.3: /geo/check's answer (a location, no answer, a body of the wrong shape) and the list's body; each read counted. */
export interface FakeGeo {
  check: {countryCode: string; isVpn: boolean} | 'unreachable' | 'malformed';
  list: unknown;
  checks: number;
  lists: number;
}

/**
 * An initialized SPL token account's 165 bytes, as the node returns them in base64: mint (0–32), owner (32–64),
 * amount u64 LE (64–72); the delegate COption (tag u32 at 72, pubkey at 76–108) when `delegate` is given, else
 * none; state 1 (initialized) at 108, not native; the delegated amount u64 LE at 121 (B1c-2 Task 10 fix round 2:
 * modeled so a real validator's own re-authentication-triggering layout — simulate.ts's `ownTokenAccountOf` reads
 * a new or raised delegate from exactly these bytes — is what the fake reports too); no close authority.
 */
function tokenAccountData(mint: string, owner: string, amount: bigint, delegate: {address: string; amount: bigint} | null = null): Uint8Array {
  const data = new Uint8Array(165);
  data.set(base58.decode(mint), 0);
  data.set(base58.decode(owner), 32);
  new DataView(data.buffer).setBigUint64(64, amount, true);
  if (delegate !== null) {
    new DataView(data.buffer).setUint32(72, 1, true);
    data.set(base58.decode(delegate.address), 76);
  }
  data[108] = 1;
  if (delegate !== null) new DataView(data.buffer).setBigUint64(121, delegate.amount, true);
  return data;
}

/**
 * B1c-3: a mint's bytes, the token programs' own layout (e2e copies the builder — it imports nothing from core/ or src/):
 * mint authority COption<Pubkey> (u32 tag at 0, key at 4), supply u64 at 36, decimals at 44, is_initialized at 45,
 * freeze authority COption<Pubkey> (tag at 46, key at 50) — 82 bytes. With `extensions` (Token-2022 only), zero padding
 * to 165, the AccountType byte 1 (Mint) at 165, then each extension as TLV from 166: u16 LE type, u16 LE length, the
 * value — PermanentDelegate (12: its delegate, 32 bytes) and TransferHook (14: its authority, then its program id; 64
 * bytes), 32 zero bytes being "none" in both.
 */
export interface MintSpec {
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  extensions?: {permanentDelegate?: string | null; transferHook?: {authority: string | null; program: string | null}};
}
const keyBytes = (key: string | null): Uint8Array => (key === null ? new Uint8Array(32) : base58.decode(key));
export function mintData(spec: MintSpec): Uint8Array {
  const tlv: {type: number; value: Uint8Array}[] = [];
  const ext = spec.extensions;
  if (ext?.permanentDelegate !== undefined) tlv.push({type: 12, value: keyBytes(ext.permanentDelegate)});
  if (ext?.transferHook !== undefined) tlv.push({type: 14, value: new Uint8Array([...keyBytes(ext.transferHook.authority), ...keyBytes(ext.transferHook.program)])});
  const size = ext === undefined ? 82 : 166 + tlv.reduce((n, e) => n + 4 + e.value.length, 0);
  const data = new Uint8Array(size);
  const view = new DataView(data.buffer);
  if (spec.mintAuthority !== null) {
    view.setUint32(0, 1, true);
    data.set(base58.decode(spec.mintAuthority), 4);
  }
  data[44] = spec.decimals;
  data[45] = 1;
  if (spec.freezeAuthority !== null) {
    view.setUint32(46, 1, true);
    data.set(base58.decode(spec.freezeAuthority), 50);
  }
  if (ext === undefined) return data;
  data[165] = 1;
  let at = 166;
  for (const e of tlv) {
    view.setUint16(at, e.type, true);
    view.setUint16(at + 2, e.value.length, true);
    data.set(e.value, at + 4);
    at += 4 + e.value.length;
  }
  return data;
}

/** Compact-u16: the signature count that opens a serialized transaction. */
function shortVec(bytes: Uint8Array): {value: number; size: number} {
  let value = 0;
  for (let size = 0; size < 3; size++) {
    const b = bytes[size] ?? 0;
    value |= (b & 0x7f) << (7 * size);
    if ((b & 0x80) === 0) return {value, size: size + 1};
  }
  return {value, size: 3};
}

/**
 * The static keys and instructions of a serialized v0 transaction: signature count and slots, then
 * the message (0x80 prefix, 3-byte header, keys, blockhash, instructions). Read by hand: the E2E runs
 * under Playwright's loader, where @solana/web3.js's CommonJS dependencies do not load.
 */
export function parseV0(wire: Uint8Array): {signers: number; keys: string[]; instructions: {program: number; accounts: number[]; data: Uint8Array}[]} {
  let at = 0;
  const vec = (): number => {
    const {value, size} = shortVec(wire.subarray(at));
    at += size;
    return value;
  };
  const signatures = vec();
  at += 64 * signatures;
  if (wire[at] !== 0x80) throw new Error('not a v0 message');
  // The header's first byte: the required signatures (each pays the 5 000-lamport base fee).
  const signers = wire[at + 1] ?? 0;
  at += 4;
  const keys: string[] = [];
  for (let n = vec(), i = 0; i < n; i++, at += 32) keys.push(base58.encode(wire.subarray(at, at + 32)));
  at += 32;
  const instructions: {program: number; accounts: number[]; data: Uint8Array}[] = [];
  for (let n = vec(), i = 0; i < n; i++) {
    const program = wire[at++] ?? 0;
    const accounts: number[] = [];
    const count = vec();
    for (let j = 0; j < count; j++) accounts.push(wire[at++] ?? 0);
    const len = vec();
    instructions.push({program, accounts, data: wire.slice(at, at + len)});
    at += len;
  }
  return {signers, keys, instructions};
}

/**
 * A simulated coordinator: the read proxy for the methods the engine uses, the broadcast route
 * with the contract this plan defines (docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md),
 * prices and /stats. 10 SOL, no token accounts unless a spec lists some, quiet fees, a simulation that applies the
 * fee, the System transfers, an associated-token-account Create's rent and the SPL Token transfers. Every
 * getLatestBlockhash hands out a fresh blockhash valid for BLOCKHASH_LIFETIME blocks from the
 * current height, as a real node does.
 */
export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeCoordinator> {
  let held: Promise<void> | null = null;
  const fake: FakeCoordinator = {
    mode: 'confirm',
    broadcastReject: false,
    blockHeight: FAKE_START_HEIGHT,
    hits: [],
    broadcasts: [],
    broadcastWires: [],
    historyChecks: [],
    unexpected: [],
    network: 'ok',
    lamports: new Map(),
    defaultLamports: 10_000_000_000,
    accountKinds: new Map(),
    simulateError: false,
    simulateErr: {InstructionError: [2, {Custom: 1}]},
    simulations: [],
    simulatedPayerAfter: [],
    tokenAccounts: new Map(),
    mints: new Map(WALLET_MINTS.map(([mint, decimals]) => [mint, {program: 'token' as const, data: mintData({decimals, mintAuthority: null, freezeAuthority: null})}])),
    history: new Map(),
    presale: {accounts: new Map(), solUsd: 150, read: 'ok', wrongDestination: false, simulated: [], landed: []},
    geo: {check: {countryCode: 'SI', isVpn: false}, list: restrictedList(), checks: 0, lists: 0},
    hold: () => {
      let release: () => void = () => undefined;
      held = new Promise<void>(r => (release = r));
      return () => {
        held = null;
        release();
      };
    },
  };
  const statusChecks = new Map<string, number>();
  const context = () => ({slot: fake.blockHeight + 50});

  const signatureStatuses = (signatures: string[], history: boolean): unknown => ({
    context: context(),
    value: signatures.map(signature => {
      if (history) fake.historyChecks.push({signature, at: Date.now()});
      if (fake.mode === 'expire') return null;
      const seen = (statusChecks.get(signature) ?? 0) + 1;
      statusChecks.set(signature, seen);
      if (seen < 2) return null;
      return fake.mode === 'fail'
        ? {slot: context().slot, confirmations: 1, err: {InstructionError: [2, {Custom: 1}]}, status: {Err: {InstructionError: [2, {Custom: 1}]}}, confirmationStatus: 'confirmed'}
        : {slot: context().slot, confirmations: 1, err: null, status: {Ok: null}, confirmationStatus: 'confirmed'};
    }),
  });

  const lamportsOf = (address: string): number => fake.lamports.get(address) ?? fake.defaultLamports;

  /**
   * What a node answers: the requested accounts after the transaction WITH its fee paid, as the coordinator
   * measured a real node answer (spec §11.5: a payer that sends `balance − 5 000` ends at exactly 0) — the
   * payer's lamports less every System transfer it makes, less 5 000 per signature and the priority fee its
   * ComputeBudget instructions set (price × limit / 10⁶, rounded up), less the rent of each token account an
   * associated-token-account Create makes for it. A requested token account (one listed in `tokenAccounts`) comes
   * back owned by the Token program in its 165-byte layout (mint, owner, amount u64 LE at 64), its amount less what
   * the transaction's Transfer / TransferChecked take from it; a transfer from an account not listed, or for more
   * than it holds, fails as the Token program does (Custom 1, InsufficientFunds), and one to an account that is
   * neither listed nor created earlier in the transaction fails as uninitialized. Its error switch answers err with
   * accounts: null, as the real RPC does (review H2).
   * B1c-3: Token-2022 token accounts move the same way (their own program as the owner); Approve and ApproveChecked
   * (both programs) leave the source account delegated in its post-state; CloseAccount closes the account (null, as
   * every account holding no lamports reads here) and pays its rent to the destination when that is the payer; System
   * Assign / Allocate (and their …WithSeed
   * forms) give the account they name its new owner program / its zeroed data, as the post-state reports it. Each
   * transaction is simulated on its own against the current state, as a node does — so a transfer into a token account
   * that only an EARLIER transaction of a batch creates fails here as uninitialized (B1c-3's dependent step, F10).
   */
  const simulate = (params: unknown[]): unknown => {
    const config = params[1] as {accounts?: {encoding?: string; addresses?: unknown}} | undefined;
    const addresses = Array.isArray(config?.accounts?.addresses) ? (config.accounts.addresses as string[]) : null;
    fake.simulations.push(addresses);
    if (addresses === null || config?.accounts?.encoding !== 'base64') fake.unexpected.push('simulateTransaction without accounts {encoding: base64, addresses}');
    if (fake.simulateError) return {context: context(), value: {err: fake.simulateErr, logs: [], accounts: null, unitsConsumed: 0, returnData: null}};
    const {signers, keys, instructions} = parseV0(base64.decode(params[0] as string));
    const payer = keys[0] ?? '';
    let out = 0;
    let price = 0n;
    let limit = 0n;
    /** What each token account gives up in this transaction. */
    const tokenOut = new Map<string, bigint>();
    /** The token accounts an associated-token-account Create made earlier in this transaction. */
    const created = new Set<string>();
    /** B1c-2 Task 10 fix round 2: an SPL Token Approve (tag 4)'s own resulting delegate, per source account — a
     * real validator's simulateTransaction reports the POST state, delegate included; without this the fake
     * depicted an approve as moving nothing at all, which the engine's own re-authentication rule (simulate.ts,
     * `approvalFromChain`) would never agree with on mainnet. */
    const approvals = new Map<string, {address: string; amount: bigint}>();
    /** B1c-3: System Assign / Allocate (and …WithSeed): the account's new owner program, its new data size. */
    const assigned = new Map<string, string>();
    const allocated = new Map<string, number>();
    /** B1c-3: the token accounts a CloseAccount closed. */
    const closed = new Set<string>();
    for (const [i, ix] of instructions.entries()) {
      const data = ix.data;
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const program = keys[ix.program];
      if (program === SYSTEM_PROGRAM && data[0] === 2 && keys[ix.accounts[0] ?? -1] === payer) out += Number(view.getBigUint64(4, true));
      if (program === COMPUTE_BUDGET && data[0] === 2) limit = BigInt(view.getUint32(1, true));
      if (program === COMPUTE_BUDGET && data[0] === 3) price = view.getBigUint64(1, true);
      // Create (no data) and CreateIdempotent (1) fund a new token account from the payer; the idempotent form takes
      // nothing when the account already exists.
      if (program === ATA_PROGRAM && (data.length === 0 || data[0] === 0 || data[0] === 1) && keys[ix.accounts[0] ?? -1] === payer) {
        const ata = keys[ix.accounts[1] ?? -1] ?? '';
        if (data[0] !== 1 || tokenAccountAt(ata) === null) out += TOKEN_ACCOUNT_RENT;
        created.add(ata);
      }
      // B1c-3: Assign (1: owner at 4), Allocate (8: space u64 at 4), AllocateWithSeed (9) and AssignWithSeed (10): base
      // at 4, the seed (u64 length at 36, then its bytes), then AllocateWithSeed's space and owner, AssignWithSeed's owner.
      if (program === SYSTEM_PROGRAM && data.length >= 4) {
        const target = keys[ix.accounts[0] ?? -1] ?? '';
        const tag = view.getUint32(0, true);
        const seedEnd = data.length >= 44 ? 44 + Number(view.getBigUint64(36, true)) : 0;
        if (tag === 1) assigned.set(target, base58.encode(data.subarray(4, 36)));
        if (tag === 8) allocated.set(target, Number(view.getBigUint64(4, true)));
        if (tag === 9) {
          allocated.set(target, Number(view.getBigUint64(seedEnd, true)));
          assigned.set(target, base58.encode(data.subarray(seedEnd + 8, seedEnd + 40)));
        }
        if (tag === 10) assigned.set(target, base58.encode(data.subarray(seedEnd, seedEnd + 32)));
      }
      const token = program === TOKEN_PROGRAM || program === TOKEN_2022_PROGRAM;
      // Transfer (3) and TransferChecked (12): the amount (u64 LE at 1) leaves the source (the first account).
      if (token && (data[0] === 3 || data[0] === 12)) {
        const source = keys[ix.accounts[0] ?? -1] ?? '';
        const held = tokenAccountAt(source);
        const taken = (tokenOut.get(source) ?? 0n) + view.getBigUint64(1, true);
        const failed = (err: unknown) => ({context: context(), value: {err: {InstructionError: [i, err]}, logs: [], accounts: null, unitsConsumed: 0, returnData: null}});
        // The destination (second account of Transfer, third of TransferChecked) must be a token account: listed, or
        // made by a Create before this instruction — otherwise the Token program refuses it as uninitialized.
        const destination = keys[ix.accounts[data[0] === 12 ? 2 : 1] ?? -1] ?? '';
        if (tokenAccountAt(destination) === null && !created.has(destination)) return failed('UninitializedAccount');
        if (held === null || taken > BigInt(held.amount)) return failed({Custom: 1});
        tokenOut.set(source, taken);
      }
      // Approve (4): the delegate and amount (u64 LE at 1) the source account's post-state now carries. B1c-3:
      // ApproveChecked (13) too — source, mint, delegate, owner; the amount at 1, the decimals after it.
      if (token && (data[0] === 4 || data[0] === 13)) {
        const source = keys[ix.accounts[0] ?? -1] ?? '';
        const delegate = keys[ix.accounts[data[0] === 13 ? 2 : 1] ?? -1] ?? '';
        approvals.set(source, {address: delegate, amount: view.getBigUint64(1, true)});
      }
      // CloseAccount (9): account, destination, owner — the account's rent goes to the destination.
      if (token && data[0] === 9) {
        closed.add(keys[ix.accounts[0] ?? -1] ?? '');
        if (keys[ix.accounts[1] ?? -1] === payer) out -= TOKEN_ACCOUNT_RENT;
      }
    }
    const fee = 5_000 * signers + Number((price * limit + 999_999n) / 1_000_000n);
    // B1d §6.3: a presale purchase, as the program runs it — its refusal, or the SOL it takes and the post-states it leaves.
    const purchase = purchaseIn(keys, instructions);
    if (purchase !== null && 'error' in purchase) return {context: context(), value: {err: purchase.error, logs: [], accounts: null, unitsConsumed: 0, returnData: null}};
    if (purchase !== null) {
      fake.presale.simulated.push(purchase.effect);
      out += (purchase.effect.currency === 'SOL' ? Number(purchase.effect.amount) : 0) + purchase.effect.rent;
    }
    const presalePost = purchase === null ? new Map<string, unknown>() : purchasePost(purchase.effect);
    const after = lamportsOf(payer) - out - fee;
    fake.simulatedPayerAfter.push(after);
    /** A system account's post-state: its owner program and data as Assign / Allocate left them (B1c-3). */
    const systemAccount = (a: string, lamports: number) => {
      const space = allocated.get(a) ?? 0;
      return {lamports, owner: assigned.get(a) ?? SYSTEM_PROGRAM, data: [base64.encode(new Uint8Array(space)), 'base64'], executable: false, rentEpoch: 18446744073709552000, space};
    };
    const accounts = (addresses ?? []).map(a => {
      if (a === payer) return systemAccount(a, after);
      if (closed.has(a)) return null;
      if (presalePost.has(a)) return presalePost.get(a);
      const owned = programAccountAt(a);
      if (owned !== null) return owned;
      const t = tokenAccountAt(a);
      if (t !== null) {
        const amount = BigInt(t.amount) - (tokenOut.get(a) ?? 0n);
        return {lamports: TOKEN_ACCOUNT_RENT, owner: t.program, data: [base64.encode(tokenAccountData(t.mint, t.owner, amount, approvals.get(a) ?? null)), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 165};
      }
      // B1c-2 Task 10 fix round 1 (test-only, additive — LIMITATION, fix round 2 L1: this models an unaffected
      // address correctly, but if a FUTURE spec ever requested simulateTransaction.accounts for a non-payer,
      // non-token address whose lamports genuinely changed by this transaction — e.g. a System transfer INTO it,
      // which the fake does not credit at all — this fallback would wrongly report it unchanged; no instruction
      // this fake models can do that today, so the limitation is latent, not exercised): every address the
      // transaction's own instructions never touch — not the payer, not a seeded token account (a connected
      // account that merely co-signs a transaction it does not pay for) — reads its current, unchanged lamports,
      // exactly as getMultipleAccounts already reports it, never null (null reads, one level up in
      // simulateTransactions.ts, as the whole account having vanished).
      const lamports = lamportsOf(a);
      return lamports > 0 ? systemAccount(a, lamports) : null;
    });
    return {context: context(), value: {err: null, logs: ['Program 11111111111111111111111111111111 success'], accounts, unitsConsumed: 450, returnData: null}};
  };

  /** B1d §6.3: an account the presale program owns, as the node reports it, or null. */
  const programAccountAt = (address: string): {lamports: number; owner: string; data: [string, 'base64']; executable: false; rentEpoch: number; space: number} | null => {
    const a = fake.presale.accounts.get(address);
    return a === undefined ? null : {lamports: a.lamports, owner: PRESALE_PROGRAM, data: [base64.encode(a.data), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: a.data.length};
  };

  /**
   * B1d §6.3: the transaction's presale purchase run as the program runs it — null when it has none; its refusal as the
   * node reports a program error; else what it does. The accounts are the IDL's (config, user account, allocation,
   * referrer allocation, then SOL: Pyth, the buyer, the treasury, System; a stablecoin: the paying token account, the
   * vault ATA, the mint, the buyer, Token, System).
   */
  const purchaseIn = (keys: string[], instructions: {program: number; accounts: number[]; data: Uint8Array}[]): {effect: PresaleEffect} | {error: unknown} | null => {
    const index = instructions.findIndex(ix => keys[ix.program] === PRESALE_PROGRAM && purchaseCurrency(ix.data) !== null);
    const ix = instructions[index];
    if (ix === undefined) return null;
    const currency = purchaseCurrency(ix.data) as Currency;
    const amount = ix.data.length >= 16 ? new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength).getBigUint64(8, true) : 0n;
    const acc = ix.accounts.map(a => keys[a] ?? '');
    const user = (currency === 'SOL' ? acc[5] : acc[7]) ?? '';
    const fail = (code: number) => ({error: {InstructionError: [index, {Custom: code}]}});
    const config = fake.presale.accounts.get(acc[0] ?? '');
    if (acc[0] !== CONFIG_PDA || config === undefined || acc[1] !== userPda(user) || acc[2] !== allocationPda(user)) return fail(2006);
    const c = configOf(config.data);
    const cents = currency === 'SOL' ? solCents(amount, fake.presale.solUsd) : stableCents(amount);
    if (cents < c.minCents) return fail(6022);
    if (cents > c.maxCents) return fail(6023);
    const source = currency === 'SOL' ? null : (acc[4] ?? '');
    if (source !== null) {
      const t = tokenAccountAt(source);
      if (t === null || t.owner !== user || t.mint !== (currency === 'USDC' ? USDC_MINT : USDT_MINT) || BigInt(t.amount) < amount) return fail(1);
    }
    const rent = (fake.presale.accounts.has(acc[1] ?? '') ? 0 : USER_ACCOUNT_RENT) + (fake.presale.accounts.has(acc[2] ?? '') ? 0 : ALLOCATION_RENT);
    return {effect: {currency, amount, cents, tokens: tokensFor(cents, c.stage), stage: c.stage, user, destination: (currency === 'SOL' ? acc[6] : acc[5]) ?? '', source, rent}};
  };

  /** The presale program's accounts after a purchase (each the account the purchase made or changed). */
  const purchaseAccounts = (e: PresaleEffect): Map<string, {lamports: number; data: Uint8Array}> => {
    const allocation = allocationPda(e.user);
    const before = fake.presale.accounts.get(allocation);
    const was = before === undefined ? {user: e.user, totalBase: 0n, spentCents: 0n, count: 0} : allocationOf(before.data);
    const user = userPda(e.user);
    return new Map([
      [allocation, {lamports: before?.lamports ?? ALLOCATION_RENT, data: allocationData({user: e.user, totalBase: was.totalBase + e.tokens, spentCents: was.spentCents + e.cents, count: was.count + 1})}],
      [user, fake.presale.accounts.get(user) ?? {lamports: USER_ACCOUNT_RENT, data: userData()}],
    ]);
  };

  /**
   * A simulation's post-state of a purchase, by address: the program's accounts it made or changed, the destination it
   * names (a token account gains the amount; any other account, the lamports) — unless `wrongDestination`, which
   * leaves it as it was — and the paying token account less the amount. The payer is the caller's.
   */
  const purchasePost = (e: PresaleEffect): Map<string, unknown> => {
    const post = new Map<string, unknown>();
    for (const [address, a] of purchaseAccounts(e)) post.set(address, {lamports: a.lamports, owner: PRESALE_PROGRAM, data: [base64.encode(a.data), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: a.data.length});
    const token = (address: string, delta: bigint) => {
      const t = tokenAccountAt(address);
      return t === null ? null : {lamports: TOKEN_ACCOUNT_RENT, owner: t.program, data: [base64.encode(tokenAccountData(t.mint, t.owner, BigInt(t.amount) + delta)), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 165};
    };
    if (!fake.presale.wrongDestination) {
      const gained = token(e.destination, e.amount);
      const lamports = lamportsOf(e.destination) + Number(e.amount);
      post.set(e.destination, gained ?? {lamports, owner: SYSTEM_PROGRAM, data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0});
    }
    if (e.source !== null) post.set(e.source, token(e.source, -e.amount));
    return post;
  };

  /** A transaction's fee as simulate takes it: 5 000 per signature and the priority its ComputeBudget instructions set. */
  const feeOf = (tx: ReturnType<typeof parseV0>): number => {
    let price = 0n;
    let limit = 0n;
    for (const ix of tx.instructions) {
      if (tx.keys[ix.program] !== COMPUTE_BUDGET) continue;
      const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
      if (ix.data[0] === 2) limit = BigInt(view.getUint32(1, true));
      if (ix.data[0] === 3) price = view.getBigUint64(1, true);
    }
    return 5_000 * tx.signers + Number((price * limit + 999_999n) / 1_000_000n);
  };

  /** The broadcast route's purchase landing: the chain as the program leaves it (the payer's fee and rent, every balance it moves). */
  const land = (e: PresaleEffect, fee: number, signature: string) => {
    for (const [address, a] of purchaseAccounts(e)) fake.presale.accounts.set(address, a);
    fake.lamports.set(e.user, lamportsOf(e.user) - fee - e.rent - (e.currency === 'SOL' ? Number(e.amount) : 0));
    const move = (address: string, delta: bigint) => {
      for (const list of fake.tokenAccounts.values()) for (const t of list) if (t.pubkey === address) t.amount = String(BigInt(t.amount) + delta);
    };
    if (e.currency === 'SOL') fake.lamports.set(e.destination, lamportsOf(e.destination) + Number(e.amount));
    else move(e.destination, e.amount);
    if (e.source !== null) move(e.source, -e.amount);
    fake.history.set(e.user, [{signature, tx: presalePurchase(e.user, e.currency === 'SOL' ? Number(e.amount) : 0, Math.floor(Date.now() / 1000))}, ...(fake.history.get(e.user) ?? [])]);
    fake.presale.landed.push(e);
  };

  /** A token account listed in `tokenAccounts`, with its owner and its program (B1c-3: classic unless listed Token-2022), or null. */
  const tokenAccountAt = (address: string): {mint: string; owner: string; amount: string; program: string} | null => {
    for (const [owner, list] of fake.tokenAccounts) {
      const t = list.find(x => x.pubkey === address);
      if (t !== undefined) return {mint: t.mint, owner, amount: t.amount, program: t.program === 'token-2022' ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM};
    }
    return null;
  };
  /** B1c-3: a mint listed in `mints`, as the node reports the account. */
  const mintAt = (address: string): {lamports: number; owner: string; data: [string, 'base64']; executable: false; rentEpoch: number; space: number} | null => {
    const m = fake.mints.get(address);
    return m === undefined ? null : {lamports: 1_461_600, owner: m.program === 'token-2022' ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM, data: [base64.encode(m.data), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: m.data.length};
  };

  /** getTokenAccountsByOwner in the node's jsonParsed shape, filtered by `mint` or `programId` as a node filters. */
  const tokenAccountsOf = (owner: string, filter: {mint?: string; programId?: string} | undefined): unknown[] =>
    (fake.tokenAccounts.get(owner) ?? [])
      .filter(t => filter?.mint === undefined || t.mint === filter.mint)
      // A listed account is owned by the classic SPL Token program unless listed as Token-2022 (B1c-3).
      .filter(t => filter?.programId === undefined || filter.programId === (t.program === 'token-2022' ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM))
      .map(t => ({
        pubkey: t.pubkey,
        account: {
          data: {
            parsed: {info: {isNative: false, mint: t.mint, owner, state: 'initialized', tokenAmount: {amount: t.amount, decimals: t.decimals, uiAmount: Number(t.amount) / 10 ** t.decimals, uiAmountString: String(Number(t.amount) / 10 ** t.decimals)}}, type: 'account'},
            program: t.program === 'token-2022' ? 'spl-token-2022' : 'spl-token',
            space: 165,
          },
          executable: false,
          lamports: 2_039_280,
          owner: t.program === 'token-2022' ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM,
          rentEpoch: 18446744073709552000,
          space: 165,
        },
      }));

  const rpcResult = (method: string, params: unknown[]): unknown => {
    switch (method) {
      case 'getBalance':
        return {context: context(), value: lamportsOf(params[0] as string)};
      case 'getLatestBlockhash':
        return {context: context(), value: {blockhash: base58.encode(randomBytes(32)), lastValidBlockHeight: fake.blockHeight + BLOCKHASH_LIFETIME}};
      case 'getRecentPrioritizationFees':
        return [];
      case 'simulateTransaction':
        return simulate(params);
      case 'getTokenAccountsByOwner': {
        // A node needs a filter (mint or programId), and answers the parsed shape only for encoding jsonParsed —
        // without it the accounts come back as base64 bytes, which core/solana/rpc.ts cannot read. Either mistake is
        // listed in `unexpected`, so contained(h) fails on it.
        const filter = params[1] as {mint?: unknown; programId?: unknown} | undefined;
        const config = params[2] as {encoding?: unknown} | undefined;
        if (typeof filter?.mint !== 'string' && typeof filter?.programId !== 'string') fake.unexpected.push('getTokenAccountsByOwner without a mint or programId filter');
        if (config?.encoding !== 'jsonParsed') fake.unexpected.push('getTokenAccountsByOwner without encoding jsonParsed');
        return {context: context(), value: tokenAccountsOf(params[0] as string, params[1] as {mint?: string; programId?: string} | undefined)};
      }
      case 'getMultipleAccounts':
        // Each address as the node reports it: a token account listed in `tokenAccounts` (B1c-2 Task 10 fix round
        // 1, test-only, additive — getAccountInfo already does this below; getAccountsData is simulateTransactions'
        // OWN pre-state read, immediately before a dApp approval's simulation — mirrored here so a seeded token
        // account's PRE amount is real, not the generic empty-data shape, for a balance delta to come out correct.
        // No existing spec requests a seeded token-account address through getMultipleAccounts/getMultipleLamports —
        // only getAccountsData does, and only from background/dapp/simulate.ts — so this is additive only), else a
        // system account holding its lamports, or null when it holds none (the import probe reads balances this
        // way — the same `lamports` table as getBalance).
        return {
          context: context(),
          value: (params[0] as string[]).map(a => {
            const owned = programAccountAt(a);
            if (owned !== null) return owned;
            const t = tokenAccountAt(a);
            if (t !== null) return {lamports: TOKEN_ACCOUNT_RENT, owner: t.program, data: [base64.encode(tokenAccountData(t.mint, t.owner, BigInt(t.amount))), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 165};
            const mint = mintAt(a);
            if (mint !== null) return mint;
            const lamports = lamportsOf(a);
            return lamports > 0 ? {lamports, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0} : null;
          }),
        };
      case 'getAccountInfo': {
        const owned = programAccountAt(params[0] as string);
        if (owned !== null) return {context: context(), value: owned};
        const kind = fake.accountKinds.get(params[0] as string);
        // A token account listed in `tokenAccounts` exists (an associated token account the engine asks about included).
        const token = tokenAccountAt(params[0] as string);
        if (kind === undefined && token !== null) {
          const data = base64.encode(tokenAccountData(token.mint, token.owner, BigInt(token.amount)));
          return {context: context(), value: {lamports: TOKEN_ACCOUNT_RENT, owner: token.program, executable: false, data: [data, 'base64'], rentEpoch: 0, space: 165}};
        }
        const mint = mintAt(params[0] as string);
        if (kind === undefined && mint !== null) return {context: context(), value: mint};
        if (kind === undefined) return {context: context(), value: null};
        const owner = kind === 'wallet' ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        return {context: context(), value: {lamports: 1_000_000, owner, executable: kind === 'program', data: ['', 'base64'], rentEpoch: 0, space: 0}};
      }
      case 'getBlockHeight':
        return fake.blockHeight;
      case 'getSignatureStatuses': {
        const config = params[1] as {searchTransactionHistory?: boolean} | undefined;
        return signatureStatuses(params[0] as string[], config?.searchTransactionHistory === true);
      }
      case 'getSignaturesForAddress': {
        const list = fake.history.get(params[0] as string) ?? [];
        const o = params[1] as {limit?: number; before?: string} | undefined;
        // An unknown `before` is an empty page, as a node answers — never a restart at page 0.
        const at = o?.before === undefined ? -1 : list.findIndex(e => e.signature === o.before);
        if (o?.before !== undefined && at < 0) return [];
        // Each entry as the node reports it: the transaction's own err and blockTime, when it has them.
        return list.slice(at + 1, at + 1 + (o?.limit ?? 10)).map(e => {
          const t = e.tx as {blockTime?: unknown; meta?: {err?: unknown}} | null;
          const blockTime = typeof t?.blockTime === 'number' ? t.blockTime : null;
          return {signature: e.signature, slot: 1, err: t?.meta?.err ?? null, memo: null, blockTime, confirmationStatus: 'finalized'};
        });
      }
      case 'getTransaction': {
        for (const list of fake.history.values()) {
          const hit = list.find(e => e.signature === params[0]);
          if (hit !== undefined) return hit.tx;
        }
        return null;
      }
      default:
        fake.unexpected.push(`rpc ${method}`);
        return METHOD_NOT_FOUND;
    }
  };

  const json = (route: Route, status: number, body: unknown) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});

  await ctx.route('https://api.noc-tura.io/**', async route => {
    if (held !== null) await held;
    const req = route.request();
    const url = req.url();
    // B1b-2a: the two failure switches, counted as hits (the request did leave the extension).
    if (fake.network === 'unreachable') {
      fake.hits.push({url, rpcMethod: null});
      return route.abort('internetdisconnected');
    }
    // ICO (2026-10-23): a CrowdSec ban is always a 403 with an HTML body — the wallet reads the status alone.
    if (fake.network === 'forbidden') {
      fake.hits.push({url, rpcMethod: null});
      return route.fulfill({status: 403, contentType: 'text/html', body: '<html><head><title>403 Forbidden</title></head><body>Forbidden</body></html>'});
    }
    if (url === RPC && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}') as {jsonrpc?: string; id?: number; method?: string; params?: unknown[]};
      const method = body.method ?? '';
      fake.hits.push({url, rpcMethod: method});
      // B1d §6.3: the presale's chain reads get no answer (the request leaves, nothing comes back).
      if (fake.presale.read === 'unreachable' && method === 'getMultipleAccounts' && Array.isArray(body.params?.[0]) && (body.params[0] as unknown[]).includes(CONFIG_PDA)) return route.abort('internetdisconnected');
      if (body.jsonrpc !== '2.0' || !Array.isArray(body.params)) fake.unexpected.push(`rpc ${method}: not a JSON-RPC 2.0 request`);
      const result = rpcResult(method, body.params ?? []);
      // A method the fake does not implement answers as the coordinator's proxy answers a method outside its
      // allowlist (docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md §3): JSON-RPC -32601
      // "Method not allowed", never a result. The rest of the fake stays lenient on purpose: it checks no
      // params shapes beyond what `unexpected` lists.
      if (result === METHOD_NOT_FOUND) return json(route, 200, {jsonrpc: '2.0', id: body.id ?? 0, error: {code: -32601, message: 'Method not allowed'}});
      return json(route, 200, {jsonrpc: '2.0', id: body.id ?? 0, result});
    }
    fake.hits.push({url, rpcMethod: null});
    if (url === BROADCAST && req.method() === 'POST') {
      const {transaction} = JSON.parse(req.postData() ?? '{}') as {transaction?: string};
      const wire = base64.decode(transaction ?? '');
      // The route's contract: 200 with the FIRST signature of the bytes it received.
      const {value: count, size} = shortVec(wire);
      if (count < 1 || wire.length < size + 64) return json(route, 400, {error: 'malformed', message: 'no signature'});
      const signature = base58.encode(wire.subarray(size, size + 64));
      // The route's own refusal (a contract reason): nothing was forwarded, nothing recorded as broadcast.
      if (fake.broadcastReject) return json(route, 400, {error: 'rejected', message: 'Blockhash not found'});
      fake.broadcasts.push(signature);
      fake.broadcastWires.push(transaction ?? '');
      // B1d §6.3: a purchase lands as the program runs it — a refusal lands nothing (the fake's chain has no failed-tx state).
      const tx = parseV0(wire);
      const purchase = purchaseIn(tx.keys, tx.instructions);
      if (purchase !== null && 'effect' in purchase) land(purchase.effect, feeOf(tx), signature);
      return json(route, 200, {signature});
    }
    if (url.startsWith(PRICES) && req.method() === 'GET') {
      return json(route, 200, {success: true, data: {solana: {usd: 150}, 'usd-coin': {usd: 1}, tether: {usd: 1}}});
    }
    if (url === GEO_CHECK && req.method() === 'GET') {
      fake.geo.checks += 1;
      if (fake.geo.check === 'unreachable') return route.abort('internetdisconnected');
      return json(route, 200, fake.geo.check === 'malformed' ? {country: 'SI'} : fake.geo.check);
    }
    if (url === GEO_LIST && req.method() === 'GET') {
      fake.geo.lists += 1;
      return json(route, 200, fake.geo.list);
    }
    if (url === STATS && req.method() === 'GET') {
      // The presale stage, for NOC's value in the dollar re-auth rule (owner decision B).
      return json(route, 200, {success: true, data: {currentStage: 0, totalNocSold: 0, isPaused: false}});
    }
    fake.unexpected.push(`${req.method()} ${url}`);
    return json(route, 404, {error: 'not in the fake coordinator'});
  });
  return fake;
}
