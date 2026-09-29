import type {FeePolicyInputs} from '../../../core/fees/transferMarkup';

/**
 * Plan B1b-1, decision 4. The extension has no trustworthy source for the TGE status or for
 * zero-fee eligibility — and neither does the app: its tgeStatus is never written and its
 * eligibility is hard-coded false. The TGE date must not be written into the extension. So both
 * inputs are 'unknown' and the core policy charges nothing, with the reason 'status-unknown' on the
 * fee line, until the coordinator reports them (docs/superpowers/specs/2026-09-29-coordinator-
 * broadcast-route.md, ask 6). In the user's favour, and disclosed.
 */
export const EXTENSION_FEE_INPUTS: FeePolicyInputs = {tgeStatus: 'unknown', isZeroFeeEligible: 'unknown', stakingDiscount: 0};
