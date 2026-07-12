import {setShieldedViewSession, getShieldedViewSession, clearShieldedViewSession} from '../shieldedViewSession';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';
import {getPkRecipientHash} from '../shieldedIdentity';

describe('shieldedViewSession', () => {
  afterEach(() => clearShieldedViewSession());
  it('caches sk_view + pkH from a seed, and clears', () => {
    expect(getShieldedViewSession()).toBeNull();
    const seed = new Uint8Array(32).fill(4);
    setShieldedViewSession(seed);
    const s = getShieldedViewSession();
    expect(s).not.toBeNull();
    expect(Buffer.from(s!.skView)).toEqual(Buffer.from(deriveShieldedViewKey(seed)));
    expect(s!.pkH).toBe(getPkRecipientHash(seed));
    clearShieldedViewSession();
    expect(getShieldedViewSession()).toBeNull();
  });
});
