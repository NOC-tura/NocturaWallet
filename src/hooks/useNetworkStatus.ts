import {useCallback, useEffect, useRef, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';

/** Registered callbacks that fire when the device comes back online. */
const reconnectListeners = new Set<() => void>();

/** Register a callback to be invoked on reconnect. Returns unsubscribe fn. */
export function onReconnect(cb: () => void): () => void {
  reconnectListeners.add(cb);
  return () => reconnectListeners.delete(cb);
}

interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
  lastOnlineAt: number | null;
  /** Manually trigger a NetInfo refresh + fire reconnect listeners. */
  forceSync: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isInternetReachable: null,
    connectionType: 'unknown',
    lastOnlineAt: null,
    forceSync: async () => {},
  });
  const wasOnline = useRef(true);

  const forceSync = useCallback(async () => {
    const state = await NetInfo.fetch();
    const online = state.isConnected === true;
    if (online) {
      reconnectListeners.forEach(cb => cb());
    }
    setStatus(prev => ({
      ...prev,
      isOnline: online,
      isInternetReachable: state.isInternetReachable,
      connectionType: state.type,
    }));
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true;
      const transitioningToOffline = wasOnline.current && !online;
      const transitioningToOnline = !wasOnline.current && online;
      wasOnline.current = online;

      if (transitioningToOnline) {
        reconnectListeners.forEach(cb => cb());
      }

      setStatus(prev => ({
        ...prev,
        isOnline: online,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
        lastOnlineAt: transitioningToOffline ? Date.now() : prev.lastOnlineAt,
      }));
    });

    return unsubscribe;
  }, []);

  return {...status, forceSync};
}
