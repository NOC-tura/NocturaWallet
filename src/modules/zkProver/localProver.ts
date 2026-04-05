import {ProofWitness, ZKProof, ProofType} from './types';

/**
 * LocalProver — stub for on-device ZK proof generation.
 *
 * Phase 1: always reports unsupported. When native SNARK libs are integrated
 * (react-native-rapidsnark or similar) this stub is replaced with a real
 * implementation without changing the public interface.
 */
export interface LocalProverResult {
  /** Whether the device supports local proof generation. */
  supported: false;
}

export const localProver = {
  /** Always false until native libs are integrated. */
  supported: false as const,

  /**
   * Attempt to generate a proof locally.
   * Currently always throws — callers must check `supported` first.
   */
  async prove(
    _proofType: ProofType,
    _witness: ProofWitness,
  ): Promise<ZKProof> {
    throw new Error('Local proving not yet supported on this device');
  },
} as const;
