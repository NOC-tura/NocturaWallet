import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {bytesToHex, decToHex64} from './fieldCodec';
import {syncLeaves} from './merkleSync';
import {getConnection} from '../solana/connection';

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

// Bound the post-200 confirmation poll. The coordinator already confirms before
// answering, so this normally returns on the first poll; the window only covers
// RPC propagation lag to the wallet's own endpoint.
const CONFIRM_ATTEMPTS = 20;
const CONFIRM_INTERVAL_MS = 1000;

/**
 * Wallet → coordinator relayer client for shielded transfers.
 *
 * The coordinator is the fee_payer: it builds the transfer ix from these
 * semantic fields (the ix data is fee_payer-independent, every account but
 * fee_payer is a deterministic PDA), signs, submits and confirms. So the
 * sender's transparent key NEVER appears on-chain — that's the whole point.
 *
 * Frozen contract (see project memory `project_shielded_relayer_contract`):
 *   POST {API_BASE}/relayer/submit  →  200 { txSignature }
 * All 32/128/256-byte fields are hex; publicInputs are decimal, circuit order.
 */

export interface RelayerTransferInput {
  mint: string;
  merkleRoot: Uint8Array; // 32
  nullifier0: Uint8Array; // 32
  nullifier1: Uint8Array; // 32
  outCommitment0: Uint8Array; // 32 — recipient out
  outCommitment1: Uint8Array; // 32 — self change
  proofBytes: Uint8Array; // 256
  publicInputs: string[]; // 6, decimal, circuit order
  ciphertext0: Uint8Array; // 128
  ciphertext1: Uint8Array; // 128
  cuLimit: number;
  /** outCommitment0 as decimal — used to disambiguate a 409 (see below). */
  recipientCommitmentDec: string;
}

export interface RelayerSubmitResult {
  /** The landed tx signature, or '' when `alreadyLanded` via a 409. */
  txSignature: string;
  /**
   * True only for the 409 case where our recipient commitment is already
   * on-chain (our exact transfer landed via a retry or a griefer relaying our
   * proof). The state transition is done; there's just no signature to show.
   */
  alreadyLanded: boolean;
}

/** Generic relayer failure (400/500/502/…) — surfaced, never self-relayed. */
export class RelayerError extends Error {}
/** Coordinator's relayer endpoint is disabled (503, e.g. SHIELDED_PROGRAM_ID unset). */
export class RelayerDisabledError extends RelayerError {}
/**
 * 409 where our recipient commitment is NOT on-chain: one of our input notes was
 * already spent by a DIFFERENT transfer, so this transfer did not land. Distinct
 * from the benign "already landed" case, which returns success.
 */
export class RelayerAlreadySpentError extends RelayerError {}

export async function submitTransferViaRelayer(
  input: RelayerTransferInput,
): Promise<RelayerSubmitResult> {
  const payload = {
    kind: 'transfer',
    mint: input.mint,
    merkleRoot: bytesToHex(input.merkleRoot),
    nullifier0: bytesToHex(input.nullifier0),
    nullifier1: bytesToHex(input.nullifier1),
    outCommitment0: bytesToHex(input.outCommitment0),
    outCommitment1: bytesToHex(input.outCommitment1),
    proofBytes: bytesToHex(input.proofBytes),
    publicInputs: input.publicInputs,
    ciphertext0: bytesToHex(input.ciphertext0),
    ciphertext1: bytesToHex(input.ciphertext1),
    cuLimit: input.cuLimit,
  };

  const resp = await pinnedFetch(`${API_BASE}/relayer/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (resp.status === 200) {
    const data = (await resp.json()) as {txSignature?: string};
    if (!data.txSignature) {
      throw new RelayerError('Relayer returned 200 without a txSignature');
    }
    // NEVER trust the coordinator's word that the tx landed. Independently
    // confirm the signature on-chain before the caller marks inputs spent — a
    // coordinator that returns 200 for a failed-but-"already processed" tx (or
    // optimistically, pre-confirmation) would otherwise cause the wallet to burn
    // notes for a transfer that never succeeded. getSignatureStatus surfaces the
    // on-chain `err`, so a failed tx throws here instead of a false success.
    await confirmRelayedSignature(data.txSignature);
    return {txSignature: data.txSignature, alreadyLanded: false};
  }

  if (resp.status === 409) {
    // A nullifier PDA already exists. Either (a) our exact transfer already
    // landed (our retry / a griefer relaying our proof) → success, or (b) an
    // input note was spent by a different transfer → not landed. On-chain the
    // two are indistinguishable, so disambiguate by whether OUR recipient
    // out-commitment made it into the tree. Only (a) is success.
    const landed = await recipientCommitmentOnChain(
      input.mint,
      input.recipientCommitmentDec,
    );
    if (landed) return {txSignature: '', alreadyLanded: true};
    throw new RelayerAlreadySpentError(
      'An input note was already spent by another transfer',
    );
  }

  if (resp.status === 503) {
    throw new RelayerDisabledError('Relayer is disabled on the coordinator');
  }

  let detail = '';
  try {
    detail = JSON.stringify(await resp.json());
  } catch {
    // no JSON body
  }
  throw new RelayerError(
    `Relayer submit failed (HTTP ${resp.status})${detail ? `: ${detail}` : ''}`,
  );
}

/**
 * Whether `commitmentDec` is present as an on-chain merkle leaf. A sync failure
 * returns false ON PURPOSE — an unverifiable 409 must surface as an error, never
 * a false "already landed" success.
 */
async function recipientCommitmentOnChain(
  mint: string,
  commitmentDec: string,
): Promise<boolean> {
  try {
    const hex = decToHex64(commitmentDec);
    const {leaves} = await syncLeaves(mint);
    return leaves.indexOf(hex) >= 0;
  } catch {
    return false;
  }
}

/**
 * Confirm a relayer-submitted signature actually SUCCEEDED on-chain. Polls
 * getSignatureStatus (HTTP, endpoint-agnostic — no WS) until confirmed/finalized
 * with no on-chain error. Throws RelayerError if the tx failed on-chain or never
 * confirms within the window — the caller must not mark inputs spent otherwise.
 */
async function confirmRelayedSignature(signature: string): Promise<void> {
  const connection = getConnection();
  for (let i = 0; i < CONFIRM_ATTEMPTS; i++) {
    const {value} = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    if (value?.err) {
      throw new RelayerError(
        `Relayed tx failed on-chain: ${JSON.stringify(value.err)}`,
      );
    }
    if (
      value?.confirmationStatus === 'confirmed' ||
      value?.confirmationStatus === 'finalized'
    ) {
      return;
    }
    await sleep(CONFIRM_INTERVAL_MS);
  }
  throw new RelayerError('Relayed tx not confirmed on-chain within timeout');
}
