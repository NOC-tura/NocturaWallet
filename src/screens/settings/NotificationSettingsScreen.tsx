import React, {useState, useCallback} from 'react';
import {View, Text, Switch, ScrollView, StyleSheet} from 'react-native';
import {notificationManager} from '../../modules/notifications/notificationModule';
import type {NotificationType} from '../../modules/notifications/types';

type RowConfig = {
  type: NotificationType;
  label: string;
  subtext?: string;
  subtextTestID?: string;
};

const ROWS: RowConfig[] = [
  {type: 'incoming_tx', label: 'Incoming transactions'},
  {type: 'staking_reward', label: 'Staking rewards'},
  {type: 'tx_confirmed', label: 'Transaction confirmed'},
  {
    type: 'security_alert',
    label: 'Security alerts',
    subtext: 'Always recommended ON',
    subtextTestID: 'security-hint',
  },
];

export function NotificationSettingsScreen() {
  // Mirror toggle state locally so the UI updates immediately on press.
  const [enabled, setEnabled] = useState<Record<NotificationType, boolean>>(() => ({
    incoming_tx: notificationManager.isEnabled('incoming_tx'),
    staking_reward: notificationManager.isEnabled('staking_reward'),
    tx_confirmed: notificationManager.isEnabled('tx_confirmed'),
    security_alert: notificationManager.isEnabled('security_alert'),
  }));

  const handleToggle = useCallback(
    async (type: NotificationType, value: boolean) => {
      // Persist first so getEnabledTypes() reflects the new state in registerToken()
      notificationManager.setEnabled(type, value);

      // If turning ON and no other type was previously enabled → request permission
      if (value) {
        const previouslyAnyEnabled = Object.entries(enabled).some(
          ([k, v]) => k !== type && v,
        );
        if (!previouslyAnyEnabled) {
          await notificationManager.requestPermission();
          await notificationManager.registerToken();
        }
      }

      setEnabled(prev => ({...prev, [type]: value}));
    },
    [enabled],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Notifications</Text>

        {ROWS.map(row => (
          <View key={row.type} style={styles.rowWrapper}>
            <View style={styles.row}>
              <View style={styles.labelWrapper}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                {row.subtext !== undefined && (
                  <Text
                    testID={row.subtextTestID}
                    style={styles.rowSubtext}>
                    {row.subtext}
                  </Text>
                )}
              </View>
              <Switch
                testID={`toggle-${row.type}`}
                value={enabled[row.type]}
                onValueChange={value => {
                  void handleToggle(row.type, value);
                }}
                thumbColor="#6C47FF"
                trackColor={{false: '#333', true: '#6C47FF55'}}
                accessibilityLabel={`Toggle ${row.label.toLowerCase()}`}
              />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0C0C14'},
  content: {paddingBottom: 40},
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
  rowWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E1E2E',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  labelWrapper: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  rowSubtext: {
    fontSize: 12,
    color: '#FFAA00',
    marginTop: 3,
  },
});
