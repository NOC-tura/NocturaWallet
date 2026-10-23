import type {Ext} from '../ext';
import type {WalletDeps} from './deps';

/**
 * B1d §1.1: what the background hands its presale entry module at start-up (`registerPresale`, called once by
 * index.ts) — the entry `presale/api.ts` in the presale build, its stub `src/presale-off/background.ts` in the build
 * without it. Types only: both import it, and neither imports the other.
 */
export interface PresaleHost {
  ext: Ext;
  deps: WalletDeps;
}
