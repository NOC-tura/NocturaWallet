import React from 'react';
import {View, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Bell} from 'lucide-react-native';
import {Text} from '../../components/ui';

/**
 * #29 Notifications — placeholder until full migration.
 *
 * Per /home/user/Downloads/index.html §s29, this surface shows the
 * notifications inbox (incoming tx, staking rewards, security alerts) with
 * filter chips, read/unread state, and tap-to-action routing. Full migration
 * deferred — stub keeps the bell button on Dashboard meaningful.
 */
interface NotificationsScreenProps {
  onBack: () => void;
}

export function NotificationsScreen({onBack}: NotificationsScreenProps) {
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <Text variant="h2" className="ml-1 flex-1">
          Notifications
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-icon-hero bg-accent-transparent-tint items-center justify-center mb-5">
          <Bell size={36} color="#B084FC" strokeWidth={1.5} />
        </View>
        <Text variant="h2" className="text-center mb-2">
          No notifications yet
        </Text>
        <Text variant="body" className="text-center text-fg-secondary max-w-sm">
          Incoming transactions, staking rewards, and security alerts will
          appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
