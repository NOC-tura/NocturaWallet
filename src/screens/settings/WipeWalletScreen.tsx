import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {keychainManager} from '../../modules/keychain/keychainModule';
import {useWalletStore} from '../../store/zustand/walletStore';
import {usePublicSettingsStore} from '../../store/zustand/publicSettingsStore';
import {useSecureSettingsStore} from '../../store/zustand/secureSettingsStore';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {useSessionStore} from '../../store/zustand/sessionStore';

type RootStackParamList = {
  Onboarding: undefined;
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const CONFIRM_WORD = 'DELETE';

export function WipeWalletScreen() {
  const navigation = useNavigation<NavProp>();
  const [confirmText, setConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);

  const {shieldedBalances} = useWalletStore();

  const hasShieldedFunds = Object.values(shieldedBalances).some(v => v !== '0');

  const canWipe = confirmText === CONFIRM_WORD && !wiping;

  const handleWipe = useCallback(async () => {
    if (!canWipe) {
      return;
    }
    setWiping(true);
    try {
      await keychainManager.wipeKeys();
      useWalletStore.getState().reset();
      usePublicSettingsStore.getState().reset();
      useSecureSettingsStore.getState().reset();
      useShieldedStore.getState().reset();
      useSessionStore.getState().lock();
      navigation.reset({
        index: 0,
        routes: [{name: 'Onboarding'}],
      });
    } catch (err) {
      setWiping(false);
      Alert.alert(
        'Wipe failed',
        'An error occurred while wiping the wallet. Please try again.',
      );
    }
  }, [canWipe, navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.title}>Wipe Wallet</Text>

        {hasShieldedFunds && (
          <View style={styles.shieldedWarningBox} testID="shielded-warning">
            <Text style={styles.shieldedWarningText}>
              You have funds in your private balance. Without backup, these funds will
              be PERMANENTLY LOST.
            </Text>
          </View>
        )}

        <View style={styles.warningBox} testID="wipe-warning">
          <Text style={styles.warningText}>
            This will permanently delete your wallet, keys, and all data from this
            device.
          </Text>
        </View>

        <Text style={styles.instructionText}>
          Type{' '}
          <Text style={styles.deleteWord}>{CONFIRM_WORD}</Text>
          {' '}to confirm:
        </Text>

        <TextInput
          testID="delete-input"
          style={styles.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="Type DELETE here"
          placeholderTextColor="#555"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!wiping}
        />

        <TouchableOpacity
          testID="wipe-button"
          style={[styles.wipeButton, !canWipe && styles.wipeButtonDisabled]}
          onPress={() => {
            void handleWipe();
          }}
          disabled={!canWipe}
          activeOpacity={0.8}>
          <Text style={styles.wipeButtonText}>
            {wiping ? 'Wiping…' : 'Wipe Wallet'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0C0C14'},
  content: {paddingBottom: 40},
  section: {
    margin: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF4D4D',
    marginBottom: 4,
  },
  shieldedWarningBox: {
    padding: 14,
    backgroundColor: '#FF9A0022',
    borderWidth: 1,
    borderColor: '#FF9A00',
    borderRadius: 8,
  },
  shieldedWarningText: {
    color: '#FF9A00',
    fontSize: 14,
    lineHeight: 20,
  },
  warningBox: {
    padding: 14,
    backgroundColor: '#FF4D4D22',
    borderWidth: 1,
    borderColor: '#FF4D4D',
    borderRadius: 8,
  },
  warningText: {
    color: '#FF4D4D',
    fontSize: 14,
    lineHeight: 20,
  },
  instructionText: {
    fontSize: 15,
    color: '#CCCCCC',
    marginTop: 8,
  },
  deleteWord: {
    color: '#FF4D4D',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 16,
    backgroundColor: '#1E1E2E',
    fontFamily: 'monospace',
  },
  wipeButton: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#FF4D4D',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  wipeButtonDisabled: {
    backgroundColor: '#4D1A1A',
    opacity: 0.6,
  },
  wipeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
