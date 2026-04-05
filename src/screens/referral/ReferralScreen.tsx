import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Share,
  Clipboard,
  StyleSheet,
  Alert,
} from 'react-native';
import {useWalletStore} from '../../store/zustand/walletStore';
import {usePresaleStore} from '../../store/zustand/presaleStore';
import {generateReferralCode} from '../../utils/generateReferralCode';
import {mmkvSecure, initSecureMmkv} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

interface Props {
  onBack?: () => void;
}

export function ReferralScreen({onBack}: Props) {
  const publicKey = useWalletStore(s => s.publicKey);
  const referralBonusTokens = usePresaleStore(s => s.referralBonusTokens);

  const myCode = publicKey ? generateReferralCode(publicKey) : 'NOC-0000';

  const [applyInput, setApplyInput] = useState('');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  // Persist my code and check if a code was already applied
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  useEffect(() => {
    const store = mmkvSecure();
    if (!store) return;
    // Persist generated code
    const stored = store.getString(MMKV_KEYS.REFERRAL_CODE_MINE);
    if (!stored && publicKey) {
      store.set(MMKV_KEYS.REFERRAL_CODE_MINE, myCode);
    }
    // Check if a code was already applied
    const applied = store.getString(MMKV_KEYS.REFERRAL_CODE_APPLIED);
    if (applied) {
      setAlreadyApplied(true);
      setAppliedCode(applied);
    }
  }, [myCode, publicKey]);

  function handleCopy() {
    Clipboard.setString(myCode);
    Alert.alert('Copied', `${myCode} copied to clipboard`);
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join Noctura: noctura://ref/${myCode}`,
      });
    } catch {
      // ignore user cancellation
    }
  }

  function handleApplyCode() {
    const trimmed = applyInput.trim().toUpperCase();
    if (!trimmed) {
      setApplyMessage('Please enter a referral code');
      return;
    }
    // Block self-referral
    if (trimmed === myCode) {
      setApplyMessage('You cannot apply your own referral code');
      return;
    }
    const store = mmkvSecure();
    if (!store) {
      setApplyMessage('Storage not available');
      return;
    }
    const existing = store.getString(MMKV_KEYS.REFERRAL_CODE_APPLIED);
    if (existing) {
      setApplyMessage('Code already applied');
      setAlreadyApplied(true);
      setAppliedCode(existing);
      return;
    }
    store.set(MMKV_KEYS.REFERRAL_CODE_APPLIED, trimmed);
    setAlreadyApplied(true);
    setAppliedCode(trimmed);
    setApplyMessage(`Code ${trimmed} applied successfully!`);
    setApplyInput('');
  }

  // Estimate friends count: each referral bonus represents one referral
  // (simplified — real count would come from on-chain data)
  const rewardsDisplay = referralBonusTokens !== '0' ? referralBonusTokens : '0';

  return (
    <View style={styles.container}>
      {/* Header */}
      {onBack && (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* MY REFERRAL CODE */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Referral Code</Text>
        <Text style={styles.codeDisplay} testID="referral-code">
          {myCode}
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleCopy}
            accessibilityRole="button"
            testID="copy-button"
          >
            <Text style={styles.actionBtnText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={handleShare}
            accessibilityRole="button"
            testID="share-button"
          >
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* REFERRAL STATS */}
      <View style={styles.section} testID="referral-stats">
        <Text style={styles.sectionTitle}>Referral Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Referrals</Text>
            <Text style={styles.statValue}>
              {referralBonusTokens !== '0' ? '1+' : '0'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Rewards earned</Text>
            <Text style={styles.statValue}>{rewardsDisplay} NOC</Text>
          </View>
        </View>
      </View>

      {/* APPLY CODE */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Apply a Referral Code</Text>
        {alreadyApplied ? (
          <View>
            <Text style={styles.appliedText}>
              Code already applied: {appliedCode}
            </Text>
          </View>
        ) : (
          <View style={styles.applyRow}>
            <TextInput
              style={styles.applyInput}
              value={applyInput}
              onChangeText={setApplyInput}
              placeholder="Enter referral code"
              placeholderTextColor="#6b7280"
              autoCapitalize="characters"
              testID="apply-code-input"
              editable={!alreadyApplied}
            />
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={handleApplyCode}
              accessibilityRole="button"
              testID="apply-code-button"
              disabled={alreadyApplied}
            >
              <Text style={styles.applyBtnText}>Apply code</Text>
            </TouchableOpacity>
          </View>
        )}
        {applyMessage && (
          <Text
            style={[
              styles.applyMessage,
              applyMessage.includes('successfully') && styles.applyMessageSuccess,
            ]}
            testID="apply-message"
          >
            {applyMessage}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d', padding: 20},
  backBtn: {marginBottom: 16},
  backText: {color: '#a78bfa', fontSize: 16},
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  codeDisplay: {
    color: '#a78bfa',
    fontSize: 32,
    fontWeight: '800',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionRow: {flexDirection: 'row', gap: 12},
  actionBtn: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnPrimary: {backgroundColor: '#7c3aed'},
  actionBtnText: {color: '#ffffff', fontWeight: '600', fontSize: 14},
  statsRow: {flexDirection: 'row', gap: 12},
  statBox: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  statLabel: {color: '#6b7280', fontSize: 12, marginBottom: 6},
  statValue: {color: '#ffffff', fontSize: 22, fontWeight: '700'},
  applyRow: {gap: 10},
  applyInput: {
    backgroundColor: '#0d0d0d',
    color: '#ffffff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  applyBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: {color: '#ffffff', fontWeight: '700', fontSize: 15},
  applyMessage: {color: '#ef4444', fontSize: 13, marginTop: 8},
  applyMessageSuccess: {color: '#10b981'},
  appliedText: {color: '#9ca3af', fontSize: 14},
});
