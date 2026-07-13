import type {ShieldedProveParams} from './types';
import type {CircuitId} from '../../constants/provingAssets';
import {isProverSupported, nativeProve} from './nativeProverBridge';
import {ensureZkey, type AssetIO} from './provingAssets';
import {rnfsAssetIO} from './rnfsAssetIO';

/**
 * On-device ZK prover. `supported` is true only when the native module reports it
 * can prove; `prove` verifies the pinned zkey then runs the native Groth16 prover.
 * The witness (incl. noteSecret) is passed to native ONLY — never over the network.
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
    const zkeyPath = await ensureZkey(proofType, io);
    return nativeProve(proofType, JSON.stringify(params), zkeyPath);
  },
} as const;
