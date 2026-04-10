import React, {useEffect, useState} from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';
import {checkAppVersion} from '../modules/appUpdate/versionCheck';
import type {VersionCheckResult} from '../modules/appUpdate/versionCheck';

type SplashRoute = 'Onboarding' | 'MainTabs' | 'Unlock';

/**
 * Resolve the initial route based on wallet state.
 * Exported for testing — the component calls this internally.
 *
 * 1. No wallet → Onboarding
 * 2. Wallet exists but onboarding incomplete → Onboarding
 * 3. Wallet exists + onboarding complete → Unlock (session check is in-memory)
 */
export async function resolveSplashRoute(): Promise<SplashRoute> {
  const walletExists = mmkvPublic.getString(MMKV_KEYS.WALLET_EXISTS) === 'true';
  if (!walletExists) return 'Onboarding';

  const onboardingCompleted =
    mmkvPublic.getString(MMKV_KEYS.ONBOARDING_COMPLETED) === 'true';
  if (!onboardingCompleted) return 'Onboarding';

  // Session activity check happens via SessionManager (in-memory), not here.
  // On cold start, session is never active — always Unlock.
  // On warm resume from background, the AppState listener handles session check.
  return 'Unlock';
}

interface SplashScreenProps {
  onRouteResolved?: (route: SplashRoute) => void;
  onForceUpdate?: (result: VersionCheckResult) => void;
}

/**
 * Splash screen — shown briefly on app startup.
 * 1. Checks for forced app updates (persists in MMKV)
 * 2. Resolves the initial route and navigates automatically.
 * Max display: 1.5s (App Store guideline).
 */
export function SplashScreen({onRouteResolved, onForceUpdate}: SplashScreenProps) {
  const [resolving, setResolving] = useState(true);
  const onRouteResolvedRef = React.useRef(onRouteResolved);
  const onForceUpdateRef = React.useRef(onForceUpdate);
  onRouteResolvedRef.current = onRouteResolved;
  onForceUpdateRef.current = onForceUpdate;

  useEffect(() => {
    const resolve = async () => {
      // Check for forced update first
      const forceUpdateRequired =
        mmkvPublic.getString(MMKV_KEYS.APP_FORCE_UPDATE_REQUIRED) === 'true';

      if (!forceUpdateRequired) {
        // Run version check (fail-safe: returns ok on any error)
        const versionResult = await checkAppVersion();

        if (versionResult.status === 'update_required') {
          mmkvPublic.set(MMKV_KEYS.APP_FORCE_UPDATE_REQUIRED, 'true');
          onForceUpdateRef.current?.(versionResult);
          setResolving(false);
          return;
        }

        // update_available is handled by the dashboard banner, not here
      } else {
        // Previously flagged force update — re-check in case user updated
        const versionResult = await checkAppVersion();
        if (versionResult.status === 'update_required') {
          onForceUpdateRef.current?.(versionResult);
          setResolving(false);
          return;
        }
        // User updated — clear the flag
        mmkvPublic.remove(MMKV_KEYS.APP_FORCE_UPDATE_REQUIRED);
      }

      const route = await resolveSplashRoute();
      setResolving(false);
      onRouteResolvedRef.current?.(route);
    };

    // Ensure minimum display for branding
    const timer = setTimeout(resolve, 500);
    return () => clearTimeout(timer);
  }, []); // Stable — callbacks accessed via refs

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🛡️</Text>
      <Text style={styles.title}>Noctura</Text>
      {resolving && (
        <ActivityIndicator style={styles.loader} color="#6C47FF" size="small" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {fontSize: 48, marginBottom: 12},
  title: {fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 24},
  loader: {marginTop: 12},
});
