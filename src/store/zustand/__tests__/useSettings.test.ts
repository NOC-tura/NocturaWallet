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
