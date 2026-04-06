import React, {useCallback} from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSecureSettingsStore} from '../../store/zustand/secureSettingsStore';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {sessionManager} from '../../modules/session/sessionModule';

type RootStackParamList = {
  ChangePin: undefined;
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Minimum/maximum session timeout in minutes
const TIMEOUT_MIN = 1;
const TIMEOUT_MAX = 30;

function TimeoutSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  // Render simple decrement/increment controls — no native slider dependency required.
  const decrement = useCallback(() => {
    onChange(Math.max(TIMEOUT_MIN, value - 1));
  }, [value, onChange]);

  const increment = useCallback(() => {
    onChange(Math.min(TIMEOUT_MAX, value + 1));
  }, [value, onChange]);

  return (
    <View style={styles.sliderRow} testID="timeout-slider">
      <TouchableOpacity onPress={decrement} style={styles.sliderBtn} activeOpacity={0.7}>
        <Text style={styles.sliderBtnText}>{'−'}</Text>
      </TouchableOpacity>
      <Text style={styles.sliderValue}>{value} min</Text>
      <TouchableOpacity onPress={increment} style={styles.sliderBtn} activeOpacity={0.7}>
        <Text style={styles.sliderBtnText}>{'+'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function SecuritySettingsScreen() {
  const navigation = useNavigation<NavProp>();

  const {
    biometricEnabled,
    sessionTimeoutMinutes,
    autoLockOnBackground,
    setBiometricEnabled,
    setSessionTimeoutMinutes,
    setAutoLockOnBackground,
  } = useSecureSettingsStore();

  const jailbreakDetected =
    mmkvPublic.getBoolean(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED) === true;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {jailbreakDetected && (
        <View style={styles.jailbreakBanner} testID="jailbreak-warning">
          <Text style={styles.jailbreakText}>
            ⚠ Jailbreak / root detected. This device may not be secure. Using the
            wallet on a compromised device is strongly discouraged.
          </Text>
        </View>
      )}

      {/* ── Biometric ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Biometric Unlock</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Enable biometric authentication</Text>
          <Switch
            testID="biometric-toggle"
            value={biometricEnabled}
            onValueChange={setBiometricEnabled}
            thumbColor="#6C47FF"
            trackColor={{false: '#333', true: '#6C47FF55'}}
          />
        </View>
      </View>

      {/* ── Session Timeout ───────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Session Timeout</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            Auto-lock after: {sessionTimeoutMinutes} min
          </Text>
        </View>
        <TimeoutSlider
          value={sessionTimeoutMinutes}
          onChange={useCallback((value: number) => {
            sessionManager.setTimeoutMinutes(value);
            setSessionTimeoutMinutes(value);
          }, [setSessionTimeoutMinutes])}
        />
      </View>

      {/* ── Auto-lock ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Auto-lock</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Lock when app goes to background</Text>
          <Switch
            testID="autolock-toggle"
            value={autoLockOnBackground}
            onValueChange={setAutoLockOnBackground}
            thumbColor="#6C47FF"
            trackColor={{false: '#333', true: '#6C47FF55'}}
          />
        </View>
      </View>

      {/* ── PIN ───────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PIN</Text>
        <TouchableOpacity
          testID="change-pin-button"
          style={styles.navRow}
          onPress={() => navigation.navigate('ChangePin')}
          activeOpacity={0.7}>
          <Text style={styles.rowLabel}>Change PIN</Text>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0C0C14'},
  content: {paddingBottom: 40},
  jailbreakBanner: {
    margin: 16,
    padding: 14,
    backgroundColor: '#FF4D4D22',
    borderWidth: 1,
    borderColor: '#FF4D4D',
    borderRadius: 8,
  },
  jailbreakText: {
    color: '#FF4D4D',
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E1E2E',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E1E2E',
  },
  rowLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    color: '#888',
    marginLeft: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 24,
  },
  sliderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: {
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 26,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 70,
    textAlign: 'center',
  },
});
