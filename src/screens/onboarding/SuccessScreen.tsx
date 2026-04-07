import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {KeychainManager} from '../../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair} from '../../modules/keyDerivation/transparent';
import {deriveShieldedViewKey} from '../../modules/keyDerivation/shielded';
import {useWalletStore} from '../../store/zustand/walletStore';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {zeroize} from '../../modules/session/zeroize';

interface SuccessScreenProps {
  mnemonic: string;
  onComplete: () => void;
}

const keychainManager = new KeychainManager();

export function SuccessScreen({mnemonic, onComplete}: SuccessScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnterWallet = async () => {
    setLoading(true);
    try {
      // 1. Save mnemonic to keychain (encrypted, biometric protected)
      await keychainManager.storeSeed(mnemonic);

      // 2. Derive seed
      const seed = await mnemonicToSeed(mnemonic);

      // 3. Derive Ed25519 keypair
      const keypair = deriveTransparentKeypair(seed);
      const publicKeyBase58 = Buffer.from(keypair.publicKey).toString('hex');
      // Note: In production, use bs58 encoding. Hex is used for scaffold.

      // 4. Derive BLS12-381 view key
      const viewKey = deriveShieldedViewKey(seed);

      // 5. Store view key in keychain
      await keychainManager.storeViewKey(viewKey);

      // 6. Update Zustand wallet store
      useWalletStore.getState().setPublicKey(publicKeyBase58);

      // 7. Set MMKV flags
      mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
      mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true');

      // 8. Zeroize seed from memory
      zeroize(seed);

      // 9. Navigate to next screen
      onComplete();
    } catch (error) {
      setLoading(false);
      setError('Could not save wallet. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>✓</Text>
      </View>

      <Text style={styles.title}>Wallet created!</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        testID="enter-wallet-button"
        style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
        onPress={handleEnterWallet}
        disabled={loading}>
        <Text style={styles.ctaButtonText}>Enter wallet</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {fontSize: 13, color: '#F87171', textAlign: 'center', marginBottom: 16},
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A4731',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 36,
    color: '#22C55E',
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 48,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
