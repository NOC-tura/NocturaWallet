import {ed25519} from '@noble/curves/ed25519.js';
import {sha256} from '@noble/hashes/sha2.js';
import {base58} from '@scure/base';

/**
 * B1d §6.3: the presale program's chain for the E2E — its accounts as bytes, its PDAs, its purchase instructions and
 * its arithmetic, copied minimally from the program's layouts (src/background/presale/layouts.ts, generated from the
 * pinned IDL) and core/presale (addresses.ts, limits.ts): e2e imports nothing from core/. The fake coordinator
 * (fakeCoordinator.ts) answers these accounts and applies `purchaseEffects` to a purchase it simulates or broadcasts.
 * Mainnet's own addresses: the extension refuses the presale unless they are exactly these.
 */
export const PRESALE_PROGRAM = '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';
export const PRESALE_ADMIN = 'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr';
export const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
export const SOL_TREASURY = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
export const USDC_VAULT = 'DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3';
export const USDT_VAULT = '8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp';
export const PYTH_SOL_USD = '7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE';
/** ["config", admin] under the program — the spec's literal (§2.1); presale.spec.ts re-derives it. */
export const CONFIG_PDA = '8MwasPrRzsCDuH78PJSDdWhdjFXT15MX7pHs3iE4b7Gx';
export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

/** The program's 0-indexed stage prices in ten-thousandths of a dollar (lib.rs STAGE_PRICES). */
export const STAGE_PRICE_TICKS: readonly bigint[] = [1501n, 1723n, 1945n, 2167n, 2389n, 2611n, 2833n, 3055n, 3277n, 3499n];
/** Mainnet's rent today (5 080 lamports a byte + the account overhead): what the program's `init_if_needed` takes. */
export const USER_ACCOUNT_RENT = 944_880;
export const ALLOCATION_RENT = 1_244_600;

const CONFIG = {
  length: 370,
  discriminator: [155, 12, 170, 224, 30, 250, 204, 130],
  admin: 8,
  saleToken: 40,
  usdt: 72,
  usdc: 104,
  stage: 168,
  stageSold: 169,
  tokensSold: 177,
  raised: 185,
  start: 193,
  active: 209,
  maxPerUser: 322,
  minPurchase: 330,
  treasury: 338,
} as const;
const ALLOCATION = {length: 117, discriminator: [202, 26, 199, 26, 125, 244, 253, 18], user: 8, total: 40, spent: 48, count: 56, first: 60, last: 68, bonus: 76, referrer: 84, claimed: 116} as const;
const USER = {length: 58, discriminator: [211, 33, 136, 16, 186, 110, 242, 127], blocked: 8} as const;

const putU64 = (d: Uint8Array, at: number, v: bigint) => new DataView(d.buffer, d.byteOffset, d.byteLength).setBigUint64(at, BigInt.asUintN(64, v), true);
const u64 = (d: Uint8Array, at: number): bigint => new DataView(d.buffer, d.byteOffset, d.byteLength).getBigUint64(at, true);

export interface ConfigFacts {
  stage: number;
  stageSold: bigint;
  tokensSold: bigint;
  raisedCents: bigint;
  /** UTC seconds. */
  start: bigint;
  active: boolean;
  maxPerUserCents: bigint;
  minPurchaseCents: bigint;
}
/** A live sale at stage 1 (0-indexed 0), a $10 minimum and the program's default maximum (0). */
export const LIVE: ConfigFacts = {
  stage: 0,
  stageSold: 1_312_240_123_017_711n,
  tokensSold: 1_312_240_123_017_711n,
  raisedCents: 19_696_720n,
  start: BigInt(Math.floor(Date.now() / 1000) - 86_400),
  active: true,
  maxPerUserCents: 0n,
  minPurchaseCents: 1_000n,
};

export function configData(o: Partial<ConfigFacts> = {}): Uint8Array {
  const c = {...LIVE, ...o};
  const d = new Uint8Array(CONFIG.length);
  d.set(CONFIG.discriminator, 0);
  d.set(base58.decode(PRESALE_ADMIN), CONFIG.admin);
  d.set(base58.decode(NOC_MINT), CONFIG.saleToken);
  d.set(base58.decode(USDT_MINT), CONFIG.usdt);
  d.set(base58.decode(USDC_MINT), CONFIG.usdc);
  d[CONFIG.stage] = c.stage;
  putU64(d, CONFIG.stageSold, c.stageSold);
  putU64(d, CONFIG.tokensSold, c.tokensSold);
  putU64(d, CONFIG.raised, c.raisedCents);
  putU64(d, CONFIG.start, c.start);
  d[CONFIG.active] = c.active ? 1 : 0;
  putU64(d, CONFIG.maxPerUser, c.maxPerUserCents);
  putU64(d, CONFIG.minPurchase, c.minPurchaseCents);
  d.set(base58.decode(SOL_TREASURY), CONFIG.treasury);
  return d;
}
/** What a purchase needs of the config: the stage and the two limits (0 = the program's own constant). */
export const configOf = (d: Uint8Array): {stage: number; minCents: bigint; maxCents: bigint} => ({
  stage: d[CONFIG.stage] ?? 0,
  minCents: u64(d, CONFIG.minPurchase) > 0n ? u64(d, CONFIG.minPurchase) : 2_500n,
  maxCents: u64(d, CONFIG.maxPerUser) > 0n ? u64(d, CONFIG.maxPerUser) : 5_000_000n,
});

export function userData(o: {blocked?: boolean} = {}): Uint8Array {
  const d = new Uint8Array(USER.length);
  d.set(USER.discriminator, 0);
  d[USER.blocked] = o.blocked === true ? 1 : 0;
  return d;
}

export interface AllocationFacts {
  user: string;
  totalBase: bigint;
  spentCents: bigint;
  count: number;
}
/** B1d-2: an allocation's referral fields — the bonus credited to it as a referrer (u64 at 76), its own referrer (84–116, zero = none). */
export interface AllocationReferral {
  bonusBase: bigint;
  referrer: string | null;
}
export function allocationData(a: AllocationFacts & Partial<AllocationReferral>): Uint8Array {
  const d = new Uint8Array(ALLOCATION.length);
  d.set(ALLOCATION.discriminator, 0);
  d.set(base58.decode(a.user), ALLOCATION.user);
  putU64(d, ALLOCATION.total, a.totalBase);
  putU64(d, ALLOCATION.spent, a.spentCents);
  new DataView(d.buffer).setUint32(ALLOCATION.count, a.count, true);
  putU64(d, ALLOCATION.bonus, a.bonusBase ?? 0n);
  if (a.referrer !== undefined && a.referrer !== null) d.set(base58.decode(a.referrer), ALLOCATION.referrer);
  return d;
}
export const allocationReferral = (d: Uint8Array): AllocationReferral => {
  const referrer = d.subarray(ALLOCATION.referrer, ALLOCATION.referrer + 32);
  return {bonusBase: u64(d, ALLOCATION.bonus), referrer: referrer.every(b => b === 0) ? null : base58.encode(referrer)};
};
export const allocationOf = (d: Uint8Array): AllocationFacts => ({
  user: base58.encode(d.subarray(ALLOCATION.user, ALLOCATION.user + 32)),
  totalBase: u64(d, ALLOCATION.total),
  spentCents: u64(d, ALLOCATION.spent),
  count: new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(ALLOCATION.count, true),
});

function onCurve(bytes: Uint8Array): boolean {
  try {
    ed25519.Point.fromBytes(bytes);
    return true;
  } catch {
    return false;
  }
}
/** A program-derived address: sha256(seeds ‖ bump ‖ program ‖ "ProgramDerivedAddress") for the highest bump off the curve. */
export function programAddress(seeds: readonly Uint8Array[], program: string): string {
  const tail = [base58.decode(program), new TextEncoder().encode('ProgramDerivedAddress')];
  for (let bump = 255; bump >= 0; bump--) {
    const all = [...seeds, Uint8Array.of(bump), ...tail];
    const bytes = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of all) {
      bytes.set(p, at);
      at += p.length;
    }
    const hash = sha256(bytes);
    if (!onCurve(hash)) return base58.encode(hash);
  }
  throw new Error('no off-curve bump');
}
const seed = (s: string) => new TextEncoder().encode(s);
export const configPda = (): string => programAddress([seed('config'), base58.decode(PRESALE_ADMIN)], PRESALE_PROGRAM);
export const userPda = (account: string): string => programAddress([seed('user'), base58.decode(account)], PRESALE_PROGRAM);
export const allocationPda = (account: string): string => programAddress([seed('allocation'), base58.decode(account)], PRESALE_PROGRAM);

export type Currency = 'SOL' | 'USDC' | 'USDT';
/** The three purchase instructions' discriminators (the IDL's, as buy.ts names them). */
export const PURCHASE_DISCRIMINATORS: Readonly<Record<Currency, readonly number[]>> = {
  SOL: [161, 153, 65, 238, 160, 236, 43, 165],
  USDC: [150, 34, 181, 239, 229, 123, 187, 128],
  USDT: [209, 3, 170, 172, 219, 182, 149, 89],
};
export function purchaseCurrency(data: Uint8Array): Currency | null {
  for (const c of ['SOL', 'USDC', 'USDT'] as const) if (PURCHASE_DISCRIMINATORS[c].every((b, i) => data[i] === b)) return c;
  return null;
}
/** B1d-2: `register_referrer(referrer: Pubkey)` — its discriminator (the IDL's, as buyInstructions.ts names it), then the 32 bytes. */
export const REGISTER_REFERRER_DISCRIMINATOR: readonly number[] = [122, 229, 215, 169, 100, 145, 198, 120];
/** The referrer a `register_referrer` instruction's data names, or null when the data is not one. */
export function registeredReferrer(data: Uint8Array): string | null {
  return data.length === 40 && REGISTER_REFERRER_DISCRIMINATOR.every((b, i) => data[i] === b) ? base58.encode(data.subarray(8, 40)) : null;
}

/** The program's arithmetic, every division floored: SOL at its price (B1b's 1e-12-dollar scale), a stablecoin at 100 cents a unit, NOC at the stage's price. */
export const solCents = (lamports: bigint, usd: number): bigint => (lamports * BigInt(Math.round(usd * 1e12))) / 10n ** 19n;
export const stableCents = (amount6: bigint): bigint => (amount6 * 100n) / 1_000_000n;
export const tokensFor = (cents: bigint, stage: number): bigint => (cents * 100_000_000_000n) / (STAGE_PRICE_TICKS[stage] ?? 1n);

/** NOC as the popup shows it (two places, floored, thousands grouped): "499.66". */
export function nocText(base: bigint): string {
  const hundredths = base / 10_000_000n;
  const whole = (hundredths / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${whole}.${(hundredths % 100n).toString().padStart(2, '0')}`;
}

/** The account list of a SOL purchase in the IDL's order, as a site's transaction names it (E2E 9). */
export function solPurchaseIx(account: string, lamports: bigint): {programId: string; keys: {pubkey: string; isSigner: boolean; isWritable: boolean}[]; data: number[]} {
  const w = (pubkey: string) => ({pubkey, isSigner: false, isWritable: true});
  const amount = new Uint8Array(8);
  putU64(amount, 0, lamports);
  return {
    programId: PRESALE_PROGRAM,
    keys: [
      w(CONFIG_PDA),
      w(userPda(account)),
      w(allocationPda(account)),
      w(allocationPda('11111111111111111111111111111111')),
      {pubkey: PYTH_SOL_USD, isSigner: false, isWritable: false},
      {pubkey: account, isSigner: true, isWritable: true},
      w(SOL_TREASURY),
      {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
    ],
    data: [...PURCHASE_DISCRIMINATORS.SOL, ...amount],
  };
}

/** The coordinator's /geo/restricted-list, fresh (updated today, a 30-day limit) unless `ageDays` says otherwise. */
export function restrictedList(o: {ageDays?: number} = {}): unknown {
  const updated = new Date(Date.now() - (o.ageDays ?? 0) * 86_400_000).toISOString().slice(0, 10);
  return {
    success: true,
    data: {
      countries: [
        {code: 'CU', category: 'sanctioned'},
        {code: 'IR', category: 'sanctioned'},
        {code: 'KP', category: 'sanctioned'},
        {code: 'SY', category: 'sanctioned'},
        {code: 'RU', category: 'sanctioned'},
        {code: 'CN', category: 'restricted'},
      ],
      updated_at: updated,
      reviewed_at: updated,
      max_staleness_days: 30,
      stale: false,
    },
  };
}
