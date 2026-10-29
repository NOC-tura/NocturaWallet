import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import type {Result} from './walletApi';

/**
 * B1d §1.4: a `presale.*` message's handler — given the background's extension handle and deps of the call, and the
 * message as received (untrusted: the handler parses it). messages.ts calls it only after the partition passed.
 */
export type PresaleHandler = (ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>) => Promise<Result>;

/**
 * B1d §1.1: what the background hands its presale entry module at start-up (`registerPresale`, called once by
 * index.ts) — the entry `presale/api.ts` in the presale build, its stub `src/presale-off/background.ts` in the build
 * without it. Types only: both import it, and neither imports the other. `handle` registers one handler per type of
 * `PRESALE_MESSAGE_TYPES` (messages.ts's `registerPresaleHandler`); `alarm` (B1d-2) one run per alarm name the entry
 * arms itself, which index.ts calls when that alarm fires.
 */
export interface PresaleHost {
  ext: Ext;
  deps: WalletDeps;
  handle(type: string, handler: PresaleHandler): void;
  alarm(name: string, run: () => Promise<void>): void;
}
