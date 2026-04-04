import {useEffect, useRef, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';

interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
  lastOnlineAt: number | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isInternetReachable: null,
    connectionType: 'unknown',
    lastOnlineAt: null,
  });
  const wasOnline = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true;
      // Capture wasOnline before the async setStatus updater runs
      const transitioningToOffline = wasOnline.current && !online;
      wasOnline.current = online;

      setStatus(prev => ({
        isOnline: online,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
        // Record timestamp when transitioning from online → offline
        lastOnlineAt: transitioningToOffline ? Date.now() : prev.lastOnlineAt,
      }));
    });

    return unsubscribe;
  }, []);

  return status;
}
