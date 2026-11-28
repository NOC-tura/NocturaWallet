/**
 * History spec §4.1: the app's values for `classifyActivity` — kept apart from `activity.ts` so the
 * classifier stays pure (its tests hand every constant in).
 */
import {NETWORK, NOCTURA_FEE_TREASURY} from '../../constants/programs';
import {A0, A0_RELAYER} from '../shielded/a0/constants';
import {trustedSymbol} from '../tokens/trustedSymbol';
import {JUPITER_V6_PROGRAM_ID} from './activity';
import type {ActivityContext} from './activity';

const NO_ACCOUNTS: ReadonlySet<string> = new Set();

export function activityContext(ownTokenAccounts: ReadonlySet<string> = NO_ACCOUNTS): ActivityContext {
  return {
    symbolOf: trustedSymbol,
    cluster: NETWORK,
    a0: A0,
    feeTreasury: NOCTURA_FEE_TREASURY,
    relayerFeePayer: A0_RELAYER.feePayer,
    jupiterProgramId: JUPITER_V6_PROGRAM_ID,
    ownTokenAccounts,
  };
}
