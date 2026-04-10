import React, {useEffect, useRef} from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {generateMnemonic} from '../../modules/keyDerivation/mnemonicUtils';

interface CreateWalletScreenProps {
  onMnemonicGenerated: (mnemonic: string) => void;
}

export function CreateWalletScreen({onMnemonicGenerated}: CreateWalletScreenProps) {
  const callbackRef = useRef(onMnemonicGenerated);
  callbackRef.current = onMnemonicGenerated;
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return; // Prevent double-fire (StrictMode)
    calledRef.current = true;
    const mnemonic = generateMnemonic();
    callbackRef.current(mnemonic);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🛡️</Text>
      <Text style={styles.title}>Creating your wallet...</Text>
      <ActivityIndicator color="#6C47FF" size="large" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
  },
  loader: {
    marginTop: 8,
  },
});
