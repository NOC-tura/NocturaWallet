/**
 * What a reconciliation of pending unshields decided, read for the screens (M1c final review I-1,
 * re-review N-1 / N-4). Pure: no React, no store, no native — the hook and #21 share it.
 */
import type {A0VerifyRefusal} from './landedVerifier';
import type {A0UnshieldReconcileReport} from './unshieldFlow';

/**
 * What a reconciliation decided about the pending unshields (M1c final review I-1), from its report
 * alone, in this order: a verifier refusal (LOUD), something still pending, a settle, a revert.
 * A settle by recovery's rules (no intent: `verified` false with NO code) is a settle, not a
 * refusal. Null when it decided nothing about an unshield.
 */
export type A0UnshieldCheck =
  | {kind: 'unverified'; code: A0VerifyRefusal}
  | {kind: 'pending'}
  /** `verified` false: settled by recovery's rules (no approved terms stored), never "verified" (re-review N-4) */
  | {kind: 'settled'; verified: boolean}
  | {kind: 'reverted'};

/**
 * Re-review N-1: what the report decided about ONE note (its rho) — #21 reads its own run's note
 * only; another pending unshield's settle, revert or refusal is null here ("not this one's").
 */
export function a0UnshieldDecisionFor(r: A0UnshieldReconcileReport, rho: string): A0UnshieldCheck | null {
  const s = r.settled.find(x => x.rho === rho);
  if (s) {
    return !s.verified && s.code !== null ? {kind: 'unverified', code: s.code} : {kind: 'settled', verified: s.verified};
  }
  if (r.reverted.some(x => x.rho === rho)) {
    return {kind: 'reverted'};
  }
  if (r.stillPending.some(x => x.rho === rho)) {
    return {kind: 'pending'};
  }
  return null;
}

export function a0UnshieldCheckOf(r: A0UnshieldReconcileReport): A0UnshieldCheck | null {
  const refused = r.settled.find(x => !x.verified && x.code !== null);
  if (refused) {
    return {kind: 'unverified', code: refused.code!};
  }
  if (r.stillPending.length > 0) {
    return {kind: 'pending'};
  }
  if (r.settled.length > 0) {
    return {kind: 'settled', verified: r.settled.every(x => x.verified)};
  }
  if (r.reverted.length > 0) {
    return {kind: 'reverted'};
  }
  return null;
}

/** The "Check again" caption of a decision (#16, the dashboard, #21 — the last for its own note only). */
export function a0CheckCaption(d: A0UnshieldCheck): string {
  switch (d.kind) {
    case 'unverified':
      return 'Checked just now · it landed, but failed verification.';
    case 'pending':
      return 'Still not confirmed · checked just now.';
    case 'settled':
      return d.verified ? 'Confirmed · now public.' : 'Settled from the chain · now public.';
    case 'reverted':
      return 'Not sent · your note is back in your private balance.';
  }
}
