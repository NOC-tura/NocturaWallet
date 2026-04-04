import {renderHook, act} from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import {useNetworkStatus} from '../useNetworkStatus';

// Access mock helpers
const mockNetInfo = NetInfo as typeof NetInfo & {
  __setMockState: (state: {
    type?: string;
    isConnected?: boolean | null;
    isInternetReachable?: boolean | null;
  }) => void;
  __reset: () => void;
};

describe('useNetworkStatus', () => {
  beforeEach(() => {
    mockNetInfo.__reset();
  });

  it('returns online by default', () => {
    const {result} = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isInternetReachable).toBe(true);
  });

  it('detects offline state', () => {
    mockNetInfo.__setMockState({isConnected: false, isInternetReachable: false, type: 'none'});
    const {result} = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('tracks connection type', () => {
    mockNetInfo.__setMockState({type: 'cellular'});
    const {result} = renderHook(() => useNetworkStatus());
    expect(result.current.connectionType).toBe('cellular');
  });

  it('updates lastOnlineAt when going offline', () => {
    const {result} = renderHook(() => useNetworkStatus());
    const beforeOffline = Date.now();

    act(() => {
      mockNetInfo.__setMockState({isConnected: false, isInternetReachable: false});
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.lastOnlineAt).toBeGreaterThanOrEqual(beforeOffline - 100);
    expect(result.current.lastOnlineAt).toBeLessThanOrEqual(Date.now());
  });

  it('updates when connection changes', () => {
    const {result} = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      mockNetInfo.__setMockState({isConnected: false, isInternetReachable: false});
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      mockNetInfo.__setMockState({isConnected: true, isInternetReachable: true});
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('subscribes to NetInfo on mount', () => {
    renderHook(() => useNetworkStatus());
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const {unmount} = renderHook(() => useNetworkStatus());
    unmount();
    // After unmount, state changes should not cause errors
    act(() => {
      mockNetInfo.__setMockState({isConnected: false});
    });
    // No error thrown = success
  });
});
