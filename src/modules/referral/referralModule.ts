import {getCoordinatorJson} from '../backend/coordinatorClient';
import {fetchReferralStats as coreFetchReferralStats} from '../../../core/referral';

export type {ReferralStats} from '../../../core/referral';
export {buildReferralLink} from '../../../core/referral';

const appJson = {get: <T,>(path: string) => getCoordinatorJson(path) as Promise<T>};

/** Live referral aggregates for `address`. Throws on failure. */
export const fetchReferralStats = (address: string) => coreFetchReferralStats(appJson, address);
