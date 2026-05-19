import React from 'react';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {PieChart} from 'lucide-react-native';
import {Text} from '../../components/ui';

/**
 * #25 Portfolio — placeholder until full migration.
 *
 * Per /home/user/Downloads/index.html §s25, this surface shows the holdings
 * breakdown (tokens with mode split: transparent vs shielded vs LP). Full
 * migration deferred — this stub keeps the tab bar functional and signals
 * that the feature is coming.
 */
export function PortfolioScreen() {
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className="flex-1 bg-bg-base">
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-icon-hero bg-accent-transparent-tint items-center justify-center mb-5">
          <PieChart size={36} color="#B084FC" strokeWidth={1.5} />
        </View>
        <Text variant="h2" className="text-center mb-2">
          Portfolio
        </Text>
        <Text variant="body" className="text-center text-fg-secondary max-w-sm">
          Holdings breakdown, allocation by token, and shielded/transparent
          split. Coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}
