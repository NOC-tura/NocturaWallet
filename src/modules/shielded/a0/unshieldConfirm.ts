/**
 * The JS half of the native confirmation (spec 2026-11-08 shielded A0 M1 §4 step 4, §6 step 5):
 * `confirmA0Unshield(handle, {owner, amount, fee})` asks native to confirm — Rust parses, Kotlin
 * shows its own dialog and BiometricPrompt, Rust records a single-use authorization — and then
 * holds the answer to the request:
 *
 *   - the approved owner must be EXACTLY the owner JS asked for (Rust returns the base58 of the
 *     32 bytes it decoded; a canonical request comes back unchanged);
 *   - the approved token account must equal JS's OWN `ATA(owner, mint)` (`a0AtaOf`: web3.js
 *     `findProgramAddressSync([owner, TOKEN_PROGRAM, mint], ASSOCIATED_TOKEN_PROGRAM)` — what
 *     spl-token's `getAssociatedTokenAddressSync` computes; the app does not depend on spl-token).
 *
 * A mismatch ABORTS the unshield (`E_A0_CONFIRM_MISMATCH`): nothing is proved with that `authId`.
 * It stays recorded in Rust until the caller's `finally` closes the handle (`keysClose` kills it,
 * §3) or its 120 s run out — the flow (Task 7) opens one handle per unshield and closes it in a
 * `finally`, so an aborted approval cannot outlive the attempt.
 *
 * The amount and fee are not returned: Rust bound them to the `authId` exactly as the human saw
 * them, and `prove` puts them into the proof's public inputs, which the payload builder compares
 * with JS's own (§6.6) before anything is sent.
 */
import {PublicKey} from '@solana/web3.js';
import {a0ConfirmUnshield} from '../../zkProver/nativeProverBridge';
import type {A0Handle, A0UnshieldApproval} from '../../zkProver/nativeProverBridge';
import {a0AtaOf} from './relayerClient';

export interface A0UnshieldConfirmRequest {
  /** The destination OWNER (a wallet address, base58) — never a token account (§6.1). */
  owner: string;
  /** Base units the destination receives. */
  amount: bigint;
  /** The quote's `minFee.withdraw_change` (R5), taken from the shielded balance. */
  fee: bigint;
}

export class A0ConfirmMismatchError extends Error {
  readonly code = 'E_A0_CONFIRM_MISMATCH' as const;
  constructor(message: string) {
    super(message);
    this.name = 'A0ConfirmMismatchError';
  }
}

export interface A0UnshieldConfirmDeps {
  confirm?: typeof a0ConfirmUnshield;
}

export async function confirmA0Unshield(
  handle: A0Handle,
  req: A0UnshieldConfirmRequest,
  deps: A0UnshieldConfirmDeps = {},
): Promise<A0UnshieldApproval> {
  const confirm = deps.confirm ?? a0ConfirmUnshield;
  const approval = await confirm(handle, req.owner, req.amount, req.fee);
  if (approval.owner !== req.owner) {
    throw new A0ConfirmMismatchError('the approved owner is not the requested one');
  }
  let owner: PublicKey;
  try {
    owner = new PublicKey(approval.owner);
  } catch {
    throw new A0ConfirmMismatchError('the approved owner is not a public key');
  }
  if (a0AtaOf(owner).toBase58() !== approval.ata) {
    throw new A0ConfirmMismatchError('the approved token account is not ATA(owner, mint)');
  }
  return approval;
}
