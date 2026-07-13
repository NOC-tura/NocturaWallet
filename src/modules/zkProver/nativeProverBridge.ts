import {NativeModules} from 'react-native';

/** Native (mopro) prover contract. Implemented by the NocturaProver native module
 *  (Rust core via UniFFI → iOS/Android). Native owns the bundled witness .wasm per
 *  circuitId; JS supplies the SHA-256-verified .zkey path. Output is on-chain-ready. */
interface NocturaProverNative {
  isSupported(): boolean;
  prove(
    circuitId: string,
    witnessJson: string,
    zkeyPath: string,
  ): Promise<{proofBytes: string; publicInputs: string[]}>;
}

const native = NativeModules.NocturaProver as NocturaProverNative | undefined;

export function isProverSupported(): boolean {
  return !!native && native.isSupported();
}

export async function nativeProve(
  circuitId: string,
  witnessJson: string,
  zkeyPath: string,
): Promise<{proofBytes: string; publicInputs: string[]}> {
  if (!native) {
    throw new Error('NocturaProver native module unavailable');
  }
  return native.prove(circuitId, witnessJson, zkeyPath);
}
