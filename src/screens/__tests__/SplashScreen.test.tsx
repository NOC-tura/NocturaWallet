import {resolveSplashRoute} from '../SplashScreen';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

beforeEach(() => {
  mmkvPublic.clearAll();
});

describe('resolveSplashRoute', () => {
  it('returns Onboarding when no wallet exists', async () => {
    const route = await resolveSplashRoute();
    expect(route).toBe('Onboarding');
  });

  it('returns Onboarding when wallet exists but onboarding not completed', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    const route = await resolveSplashRoute();
    expect(route).toBe('Onboarding');
  });

  it('returns Unlock when wallet exists and onboarding completed', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true');
    const route = await resolveSplashRoute();
    expect(route).toBe('Unlock');
  });

  it('returns Unlock even with session timestamp in MMKV (session check is in-memory)', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true');
    mmkvPublic.set(MMKV_KEYS.SESSION_LAST_ACTIVE, String(Date.now()));
    const route = await resolveSplashRoute();
    expect(route).toBe('Unlock');
  });
});
