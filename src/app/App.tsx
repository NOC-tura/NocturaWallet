import React, {useCallback} from 'react';
import {StatusBar} from 'react-native';
import {AppProviders} from './AppProviders';
import {RootNavigator} from './Navigator';
import {useSessionGuard} from '../hooks/useSessionGuard';
import {navigationRef} from './navigationRef';

function AppContent() {
  const handleSessionExpired = useCallback(() => {
    // Navigate to Unlock screen when session expires
    if (navigationRef.current?.isReady()) {
      navigationRef.current.reset({
        index: 0,
        routes: [{name: 'Unlock', params: {reason: 'session_expired'}}],
      });
    }
  }, []);

  useSessionGuard(handleSessionExpired);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0C0C14" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}
