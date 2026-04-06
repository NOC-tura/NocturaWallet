import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {BackupManager} from '../../modules/backup/backupModule';

const backupManager = new BackupManager();

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function BackupSettingsScreen() {
  const navigation = useNavigation();
  const [cloudEnabled, setCloudEnabled] = useState(() =>
    backupManager.isCloudBackupEnabled(),
  );
  const [lastBackup, setLastBackup] = useState<number | null>(() =>
    backupManager.lastCloudBackupAt(),
  );
  const [forceLoading, setForceLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    setCloudEnabled(backupManager.isCloudBackupEnabled());
    setLastBackup(backupManager.lastCloudBackupAt());
  }, []);

  const handleCloudToggle = useCallback(
    async (value: boolean) => {
      try {
        if (value) {
          await backupManager.enableCloudBackup();
        } else {
          await backupManager.disableCloudBackup();
        }
        setCloudEnabled(value);
      } catch {
        Alert.alert('Error', 'Failed to update cloud backup setting.');
      }
    },
    [],
  );

  const handleForceBackup = useCallback(async () => {
    if (forceLoading) return;
    setForceLoading(true);
    try {
      await backupManager.performCloudBackup();
      setLastBackup(backupManager.lastCloudBackupAt());
      Alert.alert('Success', 'Backup completed successfully.');
    } catch {
      Alert.alert('Error', 'Backup failed. Please try again.');
    } finally {
      setForceLoading(false);
    }
  }, [forceLoading]);

  const handleExportEncrypted = useCallback(async () => {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      // Prompt for password via Alert — deep native share sheet wired in integration step
      Alert.prompt(
        'Set Backup Password',
        'Enter a password to encrypt your backup file.',
        async (password: string | undefined) => {
          if (!password) {
            setExportLoading(false);
            return;
          }
          try {
            await backupManager.exportToFile(password);
            Alert.alert(
              'Exported',
              'Encrypted backup ready. Share it via the system sheet.',
            );
          } catch {
            Alert.alert('Error', 'Export failed. Please try again.');
          } finally {
            setExportLoading(false);
          }
        },
        'secure-text',
      );
    } catch {
      setExportLoading(false);
    }
  }, [exportLoading]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Cloud Backup ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Cloud Backup</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Enable cloud backup</Text>
          <Switch
            testID="cloud-toggle"
            value={cloudEnabled}
            onValueChange={handleCloudToggle}
            thumbColor="#6C47FF"
            trackColor={{false: '#333', true: '#6C47FF55'}}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Last backup</Text>
          <Text testID="last-backup" style={styles.rowValue}>
            {lastBackup === null ? 'Never' : formatTimestamp(lastBackup)}
          </Text>
        </View>
      </View>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Actions</Text>
        <TouchableOpacity
          testID="force-backup-button"
          style={[styles.actionRow, forceLoading && styles.rowDisabled]}
          onPress={handleForceBackup}
          disabled={forceLoading}
          activeOpacity={0.7}>
          <Text style={styles.rowLabel}>
            {forceLoading ? 'Backing up…' : 'Force Backup Now'}
          </Text>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="export-button"
          style={[styles.actionRow, exportLoading && styles.rowDisabled]}
          onPress={handleExportEncrypted}
          disabled={exportLoading}
          activeOpacity={0.7}>
          <Text style={styles.rowLabel}>
            {exportLoading ? 'Exporting…' : 'Export Encrypted Backup'}
          </Text>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Info ─────────────────────────────────────────────────────── */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Backups are AES-256-GCM encrypted and never contain raw private keys.
          Store your exported file in a safe location.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}>
        <Text style={styles.doneText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0C0C14'},
  content: {paddingBottom: 40},
  section: {marginTop: 24},
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
  rowLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    color: '#888888',
    marginLeft: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E1E2E',
  },
  rowDisabled: {
    opacity: 0.5,
  },
  chevron: {
    fontSize: 20,
    color: '#888',
    marginLeft: 8,
  },
  infoBox: {
    margin: 20,
    padding: 14,
    backgroundColor: '#1E1E2E',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 18,
  },
  doneButton: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: {
    fontSize: 15,
    color: '#888888',
  },
});
