import React, {useEffect, useState} from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';

type SplashRoute = 'Onboarding' | 'MainTabs' | 'Unlock';

export async function resolveSplashRoute(): Promise<SplashRoute> {
  const walletExists = mmkvPublic.getString(MMKV_KEYS.WALLET_EXISTS) === 'true';
  if (!walletExists) return 'Onboarding';

  const onboardingCompleted =
    mmkvPublic.getString(MMKV_KEYS.ONBOARDING_COMPLETED) === 'true';
  if (!onboardingCompleted) return 'Onboarding';

  return 'Unlock';
}

interface SplashScreenProps {
  onRouteResolved?: (route: SplashRoute) => void;
}

export function SplashScreen({onRouteResolved}: SplashScreenProps) {
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    const resolve = async () => {
      const route = await resolveSplashRoute();
      setResolving(false);
      onRouteResolved?.(route);
    };
    const timer = setTimeout(resolve, 500);
    return () => clearTimeout(timer);
  }, [onRouteResolved]);

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
