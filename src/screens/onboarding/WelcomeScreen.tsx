import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface WelcomeScreenProps {
  onCreate: () => void;
  onImport: () => void;
}

export function WelcomeScreen({onCreate, onImport}: WelcomeScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🛡️</Text>
      <Text style={styles.title}>Welcome to Noctura</Text>
      <Text style={styles.subtitle}>Your private Solana wallet</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={onCreate}>
          <Text style={styles.primaryButtonText}>Create new wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostButton} onPress={onImport}>
          <Text style={styles.ghostButtonText}>Import existing wallet</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8A9A',
    marginBottom: 48,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: '#6C47FF',
    fontSize: 16,
    fontWeight: '600',
  },
});
