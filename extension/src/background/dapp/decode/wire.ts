import {VersionedTransaction} from '@solana/web3.js';

/**
 * A dApp's transaction as bytes (spec B1c §1.4, §3.3): legacy or v0, at most 1 232 bytes (the packet limit), read with
 * the web3.js parser the background already carries (D6: no new third-party code in the signing path) and accepted
 * only if re-serialising gives back exactly the bytes received — trailing bytes, a non-canonical length prefix or a
 * signature count that disagrees with the header are refused, so what is shown, simulated and signed is one thing.
 */
export const MAX_TX_BYTES = 1232;

export interface ParsedInstruction {
  /** Index of the program in the full key list (static keys, then the lookups' writable, then readonly). */
  program: number;
  accounts: number[];
  data: Uint8Array;
}

export interface Lookup {
  table: string;
  writable: number[];
  readonly: number[];
}

export interface ParsedTx {
  version: 'legacy' | 0;
  /** The message bytes — exactly what a signature covers. */
  message: Uint8Array;
  /** One per required signer, in order; an all-zero slot is unsigned. */
  signatures: Uint8Array[];
  staticKeys: string[];
  /** The required signers (the first numRequiredSignatures static keys); signers[0] is the fee payer. */
  signers: string[];
  header: {numRequiredSignatures: number; numReadonlySignedAccounts: number; numReadonlyUnsignedAccounts: number};
  lookups: Lookup[];
  instructions: ParsedInstruction[];
  blockhash: string;
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** The bytes, parsed — or null when they are not exactly one canonical legacy or v0 transaction of at most MAX_TX_BYTES. */
export function parseWire(bytes: Uint8Array): ParsedTx | null {
  if (bytes.length === 0 || bytes.length > MAX_TX_BYTES) return null;
  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(bytes);
    if (!sameBytes(tx.serialize(), bytes)) return null;
  } catch {
    return null;
  }
  const m = tx.message;
  const version = tx.version;
  if (version !== 'legacy' && version !== 0) return null;
  const staticKeys = m.staticAccountKeys.map(k => k.toBase58());
  const header = {...m.header};
  if (header.numRequiredSignatures < 1 || header.numRequiredSignatures > staticKeys.length || tx.signatures.length !== header.numRequiredSignatures) return null;
  return {
    version,
    message: m.serialize(),
    signatures: tx.signatures.map(s => Uint8Array.from(s)),
    staticKeys,
    signers: staticKeys.slice(0, header.numRequiredSignatures),
    header,
    lookups: m.addressTableLookups.map(l => ({table: l.accountKey.toBase58(), writable: [...l.writableIndexes], readonly: [...l.readonlyIndexes]})),
    instructions: m.compiledInstructions.map(ix => ({program: ix.programIdIndex, accounts: [...ix.accountKeyIndexes], data: Uint8Array.from(ix.data)})),
    blockhash: m.recentBlockhash,
  };
}

/** Writable by the message's header (static keys) or by the lookup it came through (the rest). */
export function isWritableIndex(p: ParsedTx, i: number): boolean {
  const n = p.staticKeys.length;
  const {numRequiredSignatures: s, numReadonlySignedAccounts: rs, numReadonlyUnsignedAccounts: ru} = p.header;
  if (i < s) return i < s - rs;
  if (i < n) return i < n - ru;
  const writableLookups = p.lookups.reduce((sum, l) => sum + l.writable.length, 0);
  return i < n + writableLookups;
}
