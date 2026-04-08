import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {proveLimiter} from '../solana/rpcLimiter';
import {localProver} from './localProver';
import {proofQueue} from './proofQueue';
import {
  ProofType,
  ProofWitness,
  ZKProof,
  HostedProverResponse,
  ProofGenerationError,
  ProverUnavailableError,
} from './types';

// ---- Witness sanitisation ------------------------------------------------

/**
 * Strip fields that must NEVER be sent to an external hosted service.
 * SECURITY: sk_spend and noteSecret are excluded from hosted params.
 */
function sanitiseWitnessForHosted(
  witness: ProofWitness,
): Omit<ProofWitness, 'noteSecret'> {
  // Destructure to explicitly exclude noteSecret
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {noteSecret: _dropped, ...safe} = witness;
  return safe;
}

/**
 * Zeroize mutable witness fields after use to reduce secret residency.
 *
 * LIMITATION: JavaScript strings are immutable — assigning '\x00' to a property
 * creates a NEW string but does NOT overwrite the original string's memory in the
 * V8/Hermes heap. The original value persists until garbage collected.
 * This is BEST-EFFORT only. On a jailbroken device, a heap dump could recover
 * the original values between assignment and GC.
 *
 * For truly sensitive data (keypairs, seeds), use Uint8Array + zeroize() from
 * src/modules/session/zeroize.ts which overwrites the buffer in-place.
 * When the WitnessProvider is wired to use Uint8Array for noteSecret and
 * merklePath entries, this function should be updated accordingly.
 *
 * Works on a plain object copy — caller must not use the witness after this.
 */
function zeroizeWitness(witness: ProofWitness): void {
  (witness as unknown as Record<string, unknown>).noteSecret = '\x00'.repeat(
    (witness.noteSecret ?? '').length,
  );
  (witness as unknown as Record<string, unknown>).nullifier = '\x00'.repeat(
    (witness.nullifier ?? '').length,
  );
  if (witness.merklePath) {
    for (let i = 0; i < witness.merklePath.length; i++) {
      witness.merklePath[i] = '\x00'.repeat(64);
    }
  }
}

// ---- Hosted prover -------------------------------------------------------

// Monotonically-increasing counter used to produce unique rate-limiter keys
// so sequential proof requests are never deduplicated.
let _proveCallId = 0;

async function proveHosted(
  proofType: ProofType,
  witness: ProofWitness,
): Promise<ZKProof> {
  const safeParams = sanitiseWitnessForHosted(witness);
  const callKey = `prove:${proofType}:${++_proveCallId}`;

  const resp = await proveLimiter.execute(callKey, () =>
    pinnedFetch(`${API_BASE}/zk/prove`, {
      method: 'POST',
      body: JSON.stringify({proofType, params: safeParams}),
    }),
  );

  if (resp.status !== 200) {
    throw new Error(`Hosted prover returned HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as HostedProverResponse;
  if (!data.success || !data.proofData) {
    throw new Error(data.error ?? 'Hosted prover returned no proof');
  }

  return {
    proofType,
    proofData: data.proofData,
    publicInputs: data.publicInputs ?? {
      root: '',
      nullifier: witness.nullifier,
      amount: witness.amount,
      recipientAddress: witness.recipientAddress,
    },
    generatedAt: Date.now(),
  };
}

// ---- ZkProverModule ------------------------------------------------------

/**
 * Fallback chain: hosted → local → queue
 *
 * 1. Try hosted prover (primary, fast, no device overhead).
 *    - noteSecret and any sk_spend-derived fields are STRIPPED before sending.
 * 2. If hosted fails and device supports local proving, try localProver.
 * 3. If both fail, enqueue the job in the MMKV proof queue for retry.
 *
 * Witness is zeroized after the proof attempt regardless of outcome.
 */
export class ZkProverModule {
  /**
   * Request a proof.  Returns the ZKProof immediately if hosted/local succeeds,
   * or throws ProverUnavailableError after queuing the job for later processing.
   */
  async prove(proofType: ProofType, witness: ProofWitness): Promise<ZKProof> {
    try {
      // --- Attempt 1: hosted prover ---
      try {
        const proof = await proveHosted(proofType, witness);
        zeroizeWitness(witness);
        return proof;
      } catch {
        // Hosted failed, try local
      }

      // --- Attempt 2: local prover ---
      if (localProver.supported) {
        try {
          const proof = await localProver.prove(proofType, witness);
          zeroizeWitness(witness);
          return proof;
        } catch {
          // Local failed, fall through to queue
        }
      }

      // --- Attempt 3: enqueue for later ---
      // Sanitise witness before persisting: strip noteSecret from the queued job
      const safeWitness = sanitiseWitnessForHosted(witness);
      const job = proofQueue.enqueue(proofType, JSON.stringify(safeWitness));
      zeroizeWitness(witness);

      throw new ProverUnavailableError(
        `Proof queued (job ${job.id}) — no prover available right now`,
      );
    } catch (err) {
      if (
        err instanceof ProverUnavailableError ||
        err instanceof ProofGenerationError
      ) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new ProofGenerationError('ZK proof generation failed', cause);
    }
  }

  /**
   * Process all pending queue jobs.
   * Expires stale entries first (recovers crash-stranded 'proving' jobs),
   * then attempts hosted prover for each remaining pending job.
   * Local prover is not tried for queued jobs because noteSecret was stripped
   * before queuing; this will need updating when local proving is integrated.
   * Returns the number of jobs successfully proved.
   */
  async processQueue(): Promise<number> {
    proofQueue.expireStaleEntries();
    const pending = proofQueue.getPending();
    let succeeded = 0;

    for (const job of pending) {
      if (job.attempts >= 3) {
        proofQueue.markFailed(job.id, 'Max attempts (3) exceeded');
        continue;
      }
      proofQueue.markProving(job.id);
      try {
        const witness = JSON.parse(job.witnessJson) as ProofWitness;
        // Queue jobs never have noteSecret — attempt hosted only
        const proof = await proveHosted(job.proofType, witness);
        proofQueue.markDone(job.id, proof);
        succeeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        proofQueue.markFailed(job.id, msg);
      }
    }

    return succeeded;
  }
}

export const zkProver = new ZkProverModule();
