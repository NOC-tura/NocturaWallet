import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {SYSTEM_PROGRAM} from './decode/decode';
import {MAX_TX_BYTES, parseWire, type ParsedTx} from './decode/wire';

/**
 * The two transaction requests' payloads (spec B1c §1.4, §3.3; D8): `page.signTransaction {account, transactions:
 * base64[]}` — 1 to MAX_BATCH transactions — and `page.signAndSendTransaction {account, transaction: base64, options?}`;
 * `chain`, when sent, must be `solana:mainnet`. Each transaction at most 1 232 bytes, one canonical legacy or v0
 * transaction (decode/wire.ts). The account must be the fee payer or a required signer of every one (checked after
 * the grant, in pageApi.ts: a page without a grant learns nothing about its payload but its shape).
 */
export const MAX_BATCH = 5;
export const CHAIN = 'solana:mainnet';
/** The largest base64 a 1 232-byte transaction can be. */
const MAX_TX_BASE64 = Math.ceil(MAX_TX_BYTES / 3) * 4;
const ACCOUNT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface TxRequest {
  account: string;
  /** The bytes as the page sent them, base64 (what is stored, simulated and signed). */
  wires: string[];
  txs: ParsedTx[];
}

const isAccount = (x: unknown): x is string => {
  if (typeof x !== 'string' || !ACCOUNT.test(x)) return false;
  try {
    return base58.decode(x).length === 32;
  } catch {
    return false;
  }
};

function one(x: unknown): {wire: string; tx: ParsedTx} | null {
  if (typeof x !== 'string' || x.length === 0 || x.length > MAX_TX_BASE64) return null;
  let bytes: Uint8Array;
  try {
    bytes = base64.decode(x);
  } catch {
    return null;
  }
  const tx = parseWire(bytes);
  return tx === null ? null : {wire: base64.encode(bytes), tx};
}

/** The payload's shape — or null: `invalid-request` before anything else is read (spec §9's row for transactions, rev 3.3). */
export function txRequestOf(m: Record<string, unknown>, kind: 'signTransaction' | 'signAndSendTransaction'): TxRequest | null {
  if (!isAccount(m.account) || (m.chain !== undefined && m.chain !== CHAIN)) return null;
  let list: unknown[];
  if (kind === 'signTransaction') {
    if (!Array.isArray(m.transactions) || m.transactions.length < 1 || m.transactions.length > MAX_BATCH) return null;
    list = m.transactions as unknown[];
  } else {
    if (m.options !== undefined && (typeof m.options !== 'object' || m.options === null || Array.isArray(m.options))) return null;
    list = [m.transaction];
  }
  const parsed = list.map(one);
  if (parsed.some(p => p === null)) return null;
  const ok = parsed as {wire: string; tx: ParsedTx}[];
  return {account: m.account, wires: ok.map(p => p.wire), txs: ok.map(p => p.tx)};
}

/** The account's signature slot in a transaction (its index among the required signers), or -1. */
export const slotOf = (tx: ParsedTx, account: string): number => tx.signers.indexOf(account);

/**
 * signAndSend only: every OTHER required signature is present and valid over the message — the broadcast route takes
 * only a fully signed transaction (B1 §4), and the wallet sends nothing it would have to send incomplete.
 */
export function othersSigned(tx: ParsedTx, account: string): boolean {
  return tx.signers.every((signer, i) => {
    if (signer === account) return true;
    const sig = tx.signatures[i];
    if (sig === undefined || sig.every(b => b === 0)) return false;
    try {
      return ed25519.verify(sig, tx.message, base58.decode(signer));
    } catch {
      return false;
    }
  });
}

/**
 * A durable-nonce transaction (its first instruction is System AdvanceNonceAccount): it never expires (B1 §3's red-flag
 * row). The send path cannot watch it — B1b's pending record calls a send "not confirmed — no funds moved" once its
 * blockhash's life is over, which would be false for one that can still land — so signAndSend refuses it (a controller
 * ruling); signTransaction (the dApp sends) signs it.
 */
export function usesDurableNonce(tx: ParsedTx): boolean {
  const first = tx.instructions[0];
  if (first === undefined || tx.staticKeys[first.program] !== SYSTEM_PROGRAM || first.data.length < 4) return false;
  return new DataView(first.data.buffer, first.data.byteOffset, 4).getUint32(0, true) === 4;
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** §3.3: "a second identical request while the first is unanswered" — the same message bytes. */
export function sameMessage(a: readonly string[], b: readonly string[]): boolean {
  const messages = (wires: readonly string[]) => wires.map(w => parseWire(base64.decode(w))?.message).filter((m): m is Uint8Array => m !== undefined);
  const ma = messages(a);
  return messages(b).some(x => ma.some(y => sameBytes(x, y)));
}
