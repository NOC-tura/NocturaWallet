import {PublicKey, VersionedTransaction} from '@solana/web3.js';
import {base64} from '@scure/base';
import {solCents} from '../quote';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT} from '../layouts';
import {scaledUsdPrice} from '../../reauthPolicy';
import {SIMULATED_SLOT} from '../../__tests__/fixtures';
import {PRESALE_INSTRUCTIONS} from '../../dapp/decode/presaleIdl';
import {MAINNET_PROGRAM_ID, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {derivePresalePdas, readU64LE} from '../../../../../core/presale/allocation';
import {tokensFor, usdCentsForStable} from '../../../../../core/presale/limits';
import {SPL_TOKEN_PROGRAM} from '../../../../../core/solana/encoding';
import {SYSTEM_PROGRAM_ID, type AccountData, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../../core/solana/rpc';
import {ACCOUNT, CONFIG_PDA, TREASURY_ADDRESS, USDC_VAULT, USDT_VAULT, allocationData, tokenAccountData, userData, vault} from './chain';

// B1d §3.3: the program's own effects on the accounts a purchase's prepare asks the simulation for — moved from
// buy.test.ts (B1d-1b Task 4) so #23's component tests prepare against the same simulation.
export const ALLOCATION_RENT = 1_244_600n;
export const USER_RENT = 944_880n;
const PDAS = derivePresalePdas(new PublicKey(ACCOUNT));

/** What the program does to the accounts a purchase touches, as a simulation reports them. */
export interface Effects {
  currency: 'SOL' | 'USDC' | 'USDT';
  amount: bigint;
  cents: bigint;
  stage: number;
}

export function effectsOf(wire: string, chain: Map<string, AccountData | null>, pythUsd: number): Effects {
  const message = VersionedTransaction.deserialize(base64.decode(wire)).message;
  const ix = message.compiledInstructions.at(-1);
  if (ix === undefined) throw new Error('no purchase');
  const disc = [...ix.data.subarray(0, 8)];
  const name = PRESALE_INSTRUCTIONS.find(i => i.discriminator.every((b, n) => b === disc[n]))?.name;
  const currency = name === 'presale_purchase_with_sol' ? 'SOL' : name === 'presale_purchase_with_usdc' ? 'USDC' : 'USDT';
  const amount = readU64LE(ix.data, 8);
  const config = chain.get(CONFIG_PDA)?.data ?? new Uint8Array(0);
  const stage = config[CONFIG_LAYOUT.fields.current_stage.offset] as number;
  const cents = currency === 'SOL' ? solCents(amount, scaledUsdPrice(pythUsd) as bigint) : usdCentsForStable(amount);
  return {currency, amount, cents, stage};
}

/** The simulation the program and an honest proxy give for `wire`, against `chain` as it is at that slot. */
export function honestSimulation(wire: string, addresses: readonly string[], chain: Map<string, AccountData | null>, sol: bigint, holdings: readonly TokenAccountEntry[], pythUsd: number): SimulationOutcome {
  const e = effectsOf(wire, chain, pythUsd);
  const allocation = chain.get(PDAS.userAllocation.toBase58()) ?? null;
  const user = chain.get(PDAS.userAccount.toBase58()) ?? null;
  const A = PRESALE_ALLOCATION_LAYOUT.fields;
  const before = allocation === null ? {total: 0n, spent: 0n, count: 0} : {total: readU64LE(allocation.data, A.total_tokens.offset), spent: readU64LE(allocation.data, A.total_spent_cents.offset), count: allocation.data[A.purchase_count.offset] as number};
  const referrer = allocation === null ? null : allocation.data.subarray(A.referrer.offset, A.referrer.offset + 32).every(b => b === 0) ? null : new PublicKey(allocation.data.subarray(A.referrer.offset, A.referrer.offset + 32)).toBase58();
  const allocationAfter: SimulatedAccount = {
    lamports: allocation?.lamports ?? ALLOCATION_RENT,
    owner: MAINNET_PROGRAM_ID,
    data: allocationData({totalTokens: before.total + tokensFor(e.cents, e.stage), spent: before.spent + e.cents, count: before.count + 1, referrer, bonus: 0n}),
  };
  const rent = (allocation === null ? ALLOCATION_RENT : 0n) + (user === null ? USER_RENT : 0n);
  const post = (address: string): SimulatedAccount | null => {
    if (address === ACCOUNT) return {lamports: sol - (e.currency === 'SOL' ? e.amount : 0n) - rent, owner: SYSTEM_PROGRAM_ID, data: new Uint8Array(0)};
    if (address === PDAS.userAllocation.toBase58()) return allocationAfter;
    if (address === PDAS.userAccount.toBase58()) return user ?? {lamports: USER_RENT, owner: MAINNET_PROGRAM_ID, data: userData()};
    const before = chain.get(address);
    if (address === TREASURY_ADDRESS && before) return {...before, lamports: before.lamports + (e.currency === 'SOL' ? e.amount : 0n)};
    if ((address === USDC_VAULT || address === USDT_VAULT) && before) {
      const mint = address === USDC_VAULT ? MAINNET_USDC_MINT : MAINNET_USDT_MINT;
      const gain = (e.currency === 'USDC' && address === USDC_VAULT) || (e.currency === 'USDT' && address === USDT_VAULT) ? e.amount : 0n;
      return vault({mint, amount: readU64LE(before.data, 64) + gain});
    }
    const h = holdings.find(x => x.pubkey === address);
    if (h !== undefined) return {lamports: 2_039_280n, owner: SPL_TOKEN_PROGRAM, data: tokenAccountData({mint: h.mint, owner: h.owner, amount: h.amount - e.amount})};
    return null;
  };
  return {err: null, logs: [], unitsConsumed: 61_000, slot: SIMULATED_SLOT, accounts: addresses.map(post)};
}
