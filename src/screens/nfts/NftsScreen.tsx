import React from 'react';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Grid3x3} from 'lucide-react-native';
import {Text} from '../../components/ui';

/**
 * #30 NFTs — placeholder until full migration.
 *
 * Per /home/user/Downloads/index.html §s30, this surface shows the NFT
 * collection grid with floor prices + shielded/transparent provenance badges.
 * Full migration deferred — stub keeps the tab bar functional.
 */
export function NftsScreen() {
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className="flex-1 bg-bg-base">
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-icon-hero bg-accent-transparent-tint items-center justify-center mb-5">
          <Grid3x3 size={36} color="#B084FC" strokeWidth={1.5} />
        </View>
        <Text variant="h2" className="text-center mb-2">
          NFTs
        </Text>
        <Text variant="body" className="text-center text-fg-secondary max-w-sm">
          Your NFT collection with floor prices and provenance. Coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}
