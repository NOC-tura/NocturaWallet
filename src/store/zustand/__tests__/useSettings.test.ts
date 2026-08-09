import {usePublicSettingsStore} from '../publicSettingsStore';
import {useSettings} from '../useSettings';
import {renderHook, act} from '@testing-library/react-native';

describe('useSettings facade', () => {
  it('exposes public settings', () => {
    const {result} = renderHook(() => useSettings());
    expect(result.current.language).toBe('en');
    expect(result.current.amoledMode).toBe(false);
  });

  it('exposes secure settings with defaults', () => {
    const {result} = renderHook(() => useSettings());
    expect(result.current.sessionTimeoutMinutes).toBe(5);
    expect(result.current.biometricEnabled).toBe(false);
  });

  it('updates propagate through facade', () => {
    act(() => {
      usePublicSettingsStore.getState().setLanguage('sl');
    });
    const {result} = renderHook(() => useSettings());
    expect(result.current.language).toBe('sl');
    act(() => {
      usePublicSettingsStore.getState().setLanguage('en');
    });
  });
});

describe('secure settings rehydration', () => {
  it('re-reads persisted values once the secure store opens', async () => {
    // Zustand hydrates at store-creation time. The import chain
    // App -> useSessionGuard -> sessionStore -> secureSettingsStore runs at cold
    // boot, BEFORE unlock, when mmkvSecure() is still null — so getItem returns
    // null and the store settles on DEFAULTS. Nothing called rehydrate()
    // afterwards, so the user's session timeout silently reverted to 5 minutes
    // every launch and the first post-unlock write persisted the defaults over
    // their real values.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {initSecureMmkv, mmkvSecure} = require('../../mmkv/instances');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {useSecureSettingsStore} = require('../secureSettingsStore');

    expect(useSecureSettingsStore.getState().sessionTimeoutMinutes).toBe(5);

    initSecureMmkv('0123456789abcdef0123456789abcdef');
    mmkvSecure()!.set(
      'noctura-secure-settings',
      JSON.stringify({state: {sessionTimeoutMinutes: 30}, version: 0}),
    );
    await useSecureSettingsStore.persist.rehydrate();

    expect(useSecureSettingsStore.getState().sessionTimeoutMinutes).toBe(30);
  });

  it('rehydrates automatically when the secure store opens, with no explicit call', async () => {
    // The mechanism above works; the bug was that nothing invoked it. This
    // asserts the wiring: opening the secure store must trigger a rehydrate.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const instances = require('../../mmkv/instances');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {useSecureSettingsStore: store} = require('../secureSettingsStore');
    const spy = jest.spyOn(store.persist, 'rehydrate');

    instances.initSecureMmkv('0123456789abcdef0123456789abcdef');
    await new Promise(r => setTimeout(r, 0));

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
