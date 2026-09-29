import type {SolanaReader} from '../../../core/solana/rpc';
import type {Prices} from '../../../core/portfolio/value';

/**
 * Everything the wallet engine needs from outside: chain reads, the broadcast route, prices, time
 * and randomness. The browser's implementation is browserDeps() (added in Task 9); tests pass a
 * fake, so no unit test can reach the network.
 */
export interface WalletDeps {
  reader: SolanaReader;
  /** Sends signed wire bytes through the coordinator's broadcast route; resolves to the verified signature. */
  broadcast(wire: Uint8Array): Promise<string>;
  /** USD prices for SOL, USDC and USDT. */
  prices(): Promise<Prices>;
  /** USD per NOC at the current presale stage (owner decision B), or null when /stats does not say it validly. */
  stagePrice(): Promise<number | null>;
  now(): number;
  randomBytes(n: number): Uint8Array;
  sleep(ms: number): Promise<void>;
}
