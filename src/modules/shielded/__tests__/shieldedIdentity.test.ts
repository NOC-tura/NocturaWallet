import {getViewPublicKey, getPkRecipientHash} from '../shieldedIdentity';
import {pkRecipientHash} from '../noteCrypto';
import {BN254_FIELD_PRIME} from '../../merkle/field';

// Deterministic 64-byte seed fixture.
const SEED = new Uint8Array(64).map((_v, i) => (i * 3 + 1) & 0xff);

describe('shieldedIdentity', () => {
  it('view pubkey is a 48-byte compressed G1, deterministic per seed', () => {
    const a = getViewPublicKey(SEED);
    const b = getViewPublicKey(SEED);
    expect(a.length).toBe(48);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
  it('pkRecipientHash = poseidon3(0x05, viewG1) and is a field element', () => {
    const h = getPkRecipientHash(SEED);
    expect(h).toBe(pkRecipientHash(getViewPublicKey(SEED)));
    expect(h < BN254_FIELD_PRIME).toBe(true);
  });
});
