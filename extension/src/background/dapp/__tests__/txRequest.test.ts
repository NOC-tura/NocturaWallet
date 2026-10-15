import {ed25519} from '@noble/curves/ed25519.js';
import {base58} from '@scure/base';
import type {ParsedTx} from '../decode/wire';
import {othersSigned} from '../txRequest';
import {ACCOUNT} from '../../__tests__/fixtures';

/**
 * Fix round 1, Minor 4 (promoted): `othersSigned` must verify every other required signer's signature under
 * RFC 8032 / Solana-runtime-strict rules (`{zip215: false}`), never @noble/curves' permissive ZIP-215 default. A
 * ZIP-215-only signature is easy to build from a small-order public key: Ed25519's cofactored verification equation
 * trivially holds for the identity point (order 1) no matter the message, when nothing rejects a small-order key.
 */
describe('othersSigned — strict (non-ZIP-215) verification, Solana-runtime-matching', () => {
  it('a forged "signature" under a small-order (identity) public key verifies under the permissive default for ANY message, but othersSigned rejects it', () => {
    const {Point} = ed25519;
    const identity = Point.ZERO;
    const identityKey = identity.toBytes();
    // S = 1 (32-byte little-endian scalar), R = the base point: then [S]B = B = [1]R + [k]A for ANY k, because
    // A = the identity point makes [k]A the identity regardless of k — the equation holds for every message.
    const scalarOne = new Uint8Array(32);
    scalarOne[0] = 1;
    const forged = new Uint8Array(64);
    forged.set(Point.BASE.toBytes(), 0);
    forged.set(scalarOne, 32);

    const messageA = new TextEncoder().encode('transfer all funds to the attacker');
    const messageB = new TextEncoder().encode('a completely different message');
    // Positive control: the forgery is real — the permissive default accepts it for any message at all, confirming
    // this test actually exercises the ZIP-215 gap the fix closes (not a signature that merely happens to be valid).
    expect(ed25519.verify(forged, messageA, identityKey)).toBe(true);
    expect(ed25519.verify(forged, messageB, identityKey)).toBe(true);
    // The strict option (what the fix now always passes) rejects it outright: a small-order public key never verifies.
    expect(ed25519.verify(forged, messageA, identityKey, {zip215: false})).toBe(false);

    const signerAddress = base58.encode(identityKey);
    const tx: ParsedTx = {
      version: 0,
      message: messageA,
      // account's own slot is never read (signer === account short-circuits); the identity co-signer's slot carries
      // the forged signature.
      signatures: [new Uint8Array(64), forged],
      staticKeys: [ACCOUNT.publicKey, signerAddress],
      signers: [ACCOUNT.publicKey, signerAddress],
      header: {numRequiredSignatures: 2, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0},
      lookups: [],
      instructions: [],
      blockhash: '11111111111111111111111111111111111111111111',
    };
    expect(othersSigned(tx, ACCOUNT.publicKey)).toBe(false);
  });

  it('a genuine signature from an ordinary (non-small-order) key still verifies under the strict option (positive control, no regression)', () => {
    const seed = new Uint8Array(32).fill(7);
    const pub = ed25519.getPublicKey(seed);
    const message = new TextEncoder().encode('an ordinary, honestly signed message');
    const sig = ed25519.sign(message, seed);
    const signerAddress = base58.encode(pub);
    const tx: ParsedTx = {
      version: 0,
      message,
      signatures: [new Uint8Array(64), sig],
      staticKeys: [ACCOUNT.publicKey, signerAddress],
      signers: [ACCOUNT.publicKey, signerAddress],
      header: {numRequiredSignatures: 2, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0},
      lookups: [],
      instructions: [],
      blockhash: '11111111111111111111111111111111111111111111',
    };
    expect(othersSigned(tx, ACCOUNT.publicKey)).toBe(true);
  });
});
