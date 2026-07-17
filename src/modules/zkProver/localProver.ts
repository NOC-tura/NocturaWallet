import type {ShieldedProveParams} from './types';
import {EXPECTED_NPUBLIC, type CircuitId} from '../../constants/provingAssets';
import {isProverSupported, nativeProve} from './nativeProverBridge';
import {ensureCircuitAssets, type AssetIO} from './provingAssets';
import {rnfsAssetIO} from './rnfsAssetIO';

/**
 * On-device ZK prover. `supported` is true only when the native module reports it
 * can prove; `prove` verifies the pinned zkey + wasm then runs the native Groth16
 * prover with both paths. The witness (incl. noteSecret) is passed to native ONLY —
 * never over the network. The returned proof's public-input count is asserted
 * against the circuit's expected nPublic (fail-closed) so a wrong circuit/artifact
 * can never yield an accepted-looking proof.
 */
export const localProver = {
  get supported(): boolean {
    return isProverSupported();
  },

  async prove(
    proofType: CircuitId,
    params: ShieldedProveParams,
    io: AssetIO = rnfsAssetIO,
  ): Promise<{proofBytes: string; publicInputs: string[]}> {
    const {zkeyPath, wasmPath} = await ensureCircuitAssets(proofType, io);
    const res = await nativeProve(
      proofType,
      JSON.stringify(params),
      zkeyPath,
      wasmPath,
    );
    if (res.publicInputs.length !== EXPECTED_NPUBLIC[proofType]) {
      throw new Error(
        `proof public input count ${res.publicInputs.length} != expected ${EXPECTED_NPUBLIC[proofType]} for '${proofType}'`,
      );
    }
    return res;
  },
} as const;
