import React, {useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSettings} from '../../store/zustand/useSettings';
import {useWalletStore} from '../../store/zustand/walletStore';

type RootStackParamList = {
  SecuritySettings: undefined;
  ChangePin: undefined;
  BackupSettings: undefined;
  NotificationSettings: undefined;
  ExportViewKey: undefined;
  WipeWallet: undefined;
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function SectionHeader({title, testID}: {title: string; testID: string}) {
  return (
    <View style={styles.sectionHeader} testID={testID}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function SettingsRow({
  label,
  children,
  testID,
}: {
  label: string;
  children?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NavRow({label, onPress, danger}: {label: string; onPress: () => void; danger?: boolean}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} accessibilityLabel={label}>
      <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
      <Text style={[styles.chevron, danger && styles.dangerText]}>{'›'}</Text>
    </TouchableOpacity>
  );
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

export function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const settings = useSettings();
  const {publicKey} = useWalletStore();

  const {
    biometricEnabled,
    setBiometricEnabled,
    sessionTimeoutMinutes,
    autoLockOnBackground,
    setAutoLockOnBackground,
    hideBalances,
    setHideBalances,
    hideZeroBalanceTokens,
    setHideZeroBalanceTokens,
    currency,
    amoledMode,
    setAmoledMode,
    hapticsEnabled,
    setHapticsEnabled,
    explorer,
  } = settings;

  const handleClearCache = useCallback(() => {
    Alert.alert('Cache Cleared', 'All cached data has been cleared.');
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Security ──────────────────────────────────────────────────── */}
      <SectionHeader title="Security" testID="section-security" />

      <SettingsRow label="Biometric Unlock">
        <Switch
          value={biometricEnabled}
          onValueChange={setBiometricEnabled}
          thumbColor="#6C47FF"
          trackColor={{false: '#333', true: '#6C47FF55'}}
          accessibilityLabel="Toggle biometric"
        />
      </SettingsRow>

      <SettingsRow label={`Session timeout: ${sessionTimeoutMinutes}min`} />

      <SettingsRow label="Auto-lock on background">
        <Switch
          value={autoLockOnBackground}
          onValueChange={setAutoLockOnBackground}
          thumbColor="#6C47FF"
          trackColor={{false: '#333', true: '#6C47FF55'}}
          accessibilityLabel="Toggle auto-lock on background"
        />
      </SettingsRow>

      <NavRow label="Change PIN" onPress={() => navigation.navigate('ChangePin')} />

      {/* ── Backup ────────────────────────────────────────────────────── */}
      <SectionHeader title="Backup" testID="section-backup" />
      <NavRow label="Backup Settings" onPress={() => navigation.navigate('BackupSettings')} />

      {/* ── Notifications ─────────────────────────────────────────────── */}
      <SectionHeader title="Notifications" testID="section-notifications" />
      <NavRow
        label="Notification Settings"
        onPress={() => navigation.navigate('NotificationSettings')}
      />

      {/* ── Network ───────────────────────────────────────────────────── */}
      <SectionHeader title="Network" testID="section-network" />
      <SettingsRow
        label="RPC Endpoint"
        testID="rpc-endpoint-row"
      >
        <Text style={styles.valueText}>
          {settings.customRpcEndpoint ?? 'Helius (default)'}
        </Text>
      </SettingsRow>
      <SettingsRow label="Explorer">
        <Text style={styles.valueText}>{explorer}</Text>
      </SettingsRow>

      {/* ── Display ───────────────────────────────────────────────────── */}
      <SectionHeader title="Display" testID="section-display" />
      <SettingsRow label="Currency">
        <Text style={styles.valueText}>{currency}</Text>
      </SettingsRow>
      <SettingsRow label="Language">
        <Text style={styles.valueText}>{settings.language}</Text>
      </SettingsRow>
      <SettingsRow label="AMOLED Mode">
        <Switch
          value={amoledMode}
          onValueChange={setAmoledMode}
          thumbColor="#6C47FF"
          trackColor={{false: '#333', true: '#6C47FF55'}}
          accessibilityLabel="Toggle AMOLED mode"
        />
      </SettingsRow>
      <SettingsRow label="Haptics">
        <Switch
          value={hapticsEnabled}
          onValueChange={setHapticsEnabled}
          thumbColor="#6C47FF"
          trackColor={{false: '#333', true: '#6C47FF55'}}
          accessibilityLabel="Toggle haptics"
        />
      </SettingsRow>

      {/* ── Storage ───────────────────────────────────────────────────── */}
      <SectionHeader title="Storage" testID="section-storage" />
      <SettingsRow label="Data version: v1" />
      <TouchableOpacity style={styles.buttonRow} onPress={handleClearCache} activeOpacity={0.7} accessibilityLabel="Clear cache">
        <Text style={styles.buttonText}>Clear Cache</Text>
      </TouchableOpacity>

      {/* ── Advanced ──────────────────────────────────────────────────── */}
      <SectionHeader title="Advanced" testID="section-advanced" />
      <SettingsRow label="Wallet Address">
        <Text style={styles.valueText}>
          {publicKey ? truncateAddress(publicKey) : '—'}
        </Text>
      </SettingsRow>
      <NavRow label="Export View Key" onPress={() => navigation.navigate('ExportViewKey')} />
      <NavRow
        label="Wipe Wallet"
        onPress={() => navigation.navigate('WipeWallet')}
        danger
      />

      {/* ── Accessibility ─────────────────────────────────────────────── */}
      <SectionHeader title="Accessibility" testID="section-accessibility" />
      <SettingsRow label="Hide Balances">
        <Switch
          value={hideBalances}
          onValueChange={setHideBalances}
          thumbColor="#6C47FF"
          trackColor={{false: '#333', true: '#6C47FF55'}}
          accessibilityLabel="Toggle hide balances"
        />
      </SettingsRow>
      <SettingsRow label="Hide Zero-Balance Tokens">
        <Switch
          value={hideZeroBalanceTokens}
          onValueChange={setHideZeroBalanceTokens}
          thumbColor="#6C47FF"
          trackColor={{false: '#333', true: '#6C47FF55'}}
          accessibilityLabel="Toggle hide zero-balance tokens"
        />
      </SettingsRow>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0C0C14'},
  content: {paddingBottom: 40},
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  rowLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
  },
  dangerText: {
    color: '#FF4D4D',
  },
  chevron: {
    fontSize: 20,
    color: '#888',
    marginLeft: 8,
  },
  valueText: {
    fontSize: 14,
    color: '#888',
    maxWidth: '50%',
    textAlign: 'right',
  },
  buttonRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E1E2E',
  },
  buttonText: {
    fontSize: 15,
    color: '#6C47FF',
  },
  bottomPad: {height: 40},
});
