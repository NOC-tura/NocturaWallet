import {NativeModules} from 'react-native';

/** Native (mopro) prover contract. Implemented by the NocturaProver native module
 *  (Rust core via UniFFI → iOS/Android). JS supplies BOTH SHA-256-verified paths —
 *  the .zkey proving key and the .wasm witness generator — at prove-time (runtime
 *  load, NOT a compile-time-embed template; native does not bundle the wasm). Output
 *  is on-chain-ready. */
interface NocturaProverNative {
  isSupported(): boolean;
  prove(
    circuitId: string,
    witnessJson: string,
    zkeyPath: string,
    wasmPath: string,
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
  wasmPath: string,
): Promise<{proofBytes: string; publicInputs: string[]}> {
  if (!native) {
    throw new Error('NocturaProver native module unavailable');
  }
  return native.prove(circuitId, witnessJson, zkeyPath, wasmPath);
}
