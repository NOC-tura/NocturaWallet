/** Available proof types matching the Noctura circuit set. */
export type ProofType = 'transfer' | 'swap' | 'deposit' | 'withdraw';

/** Status of a queued proof job. */
export type ProofJobStatus = 'pending' | 'proving' | 'done' | 'failed';

/**
 * The witness contains all private inputs for the ZK circuit.
 * SECURITY: sk_spend MUST NEVER be included in hosted prover params.
 * Zeroize witness fields after the proof is generated.
 */
export interface ProofWitness {
  /** Note commitment being spent. */
  noteCommitment: string;
  /** Merkle path (array of sibling hashes). */
  merklePath: string[];
  /** Merkle path indices (0=left, 1=right). */
  merklePathIndices: number[];
  /** Nullifier for the spent note. */
  nullifier: string;
  /** Amount in lamports (as string to avoid BigInt serialization issues). */
  amount: string;
  /** Recipient shielded address (for transfers). */
  recipientAddress?: string;
  /**
   * Note secret — used only in local proving.
   * NEVER sent to hosted prover.
   */
  noteSecret: string;
}

/** Public inputs revealed to the verifier. */
export interface ProofPublicInputs {
  root: string;
  nullifier: string;
  amount: string;
  recipientAddress?: string;
}

/** A generated ZK proof (Groth16 format). */
export interface ZKProof {
  proofType: ProofType;
  /** Groth16 proof bytes (base64). */
  proofData: string;
  publicInputs: ProofPublicInputs;
  /** Unix ms timestamp when proof was generated. */
  generatedAt: number;
  /** On-chain-ready proof bytes (hex, 256 B), from the coordinator converter. */
  proofBytes: string;
}

/** A queued proof job, persisted in MMKV for crash safety. */
export interface ProofJob {
  id: string;
  proofType: ProofType;
  /** Serialized witness (noteSecret stripped before persist when using hosted). */
  witnessJson: string;
  status: ProofJobStatus;
  /** Number of attempts made. */
  attempts: number;
  /** Unix ms when the job was enqueued. */
  enqueuedAt: number;
  /** Last error message, if any. */
  lastError?: string;
  /** Completed proof, populated when status==='done'. */
  result?: ZKProof;
}

/** Response from the hosted prover API. */
export interface HostedProverResponse {
  success: boolean;
  proofData?: string;
  /** On-chain-ready proof (hex, 256 bytes). Forwarded opaquely into the ix. */
  proofBytes?: string;
  /** Public inputs as computed by the prover (root, nullifier, etc.). */
  publicInputs?: ProofPublicInputs;
  error?: string;
}

export class ProverUnavailableError extends Error {
  readonly code = 'E032';
  constructor(message = 'No prover available') {
    super(message);
    this.name = 'ProverUnavailableError';
  }
}

export class ProofGenerationError extends Error {
  readonly code = 'E030';
  readonly cause: Error;
  constructor(message: string, cause: Error) {
    super(message);
    this.name = 'ProofGenerationError';
    this.cause = cause;
  }
}
