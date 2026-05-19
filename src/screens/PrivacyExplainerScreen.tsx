import React from 'react';
import {View, Pressable, Linking} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ShieldCheck, ArrowRight} from 'lucide-react-native';
import {Text, Button} from '../components/ui';
import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';

/**
 * Privacy Mode explainer — modal shown the first time the user toggles to
 * Shielded mode on the dashboard. Sets PRIVACY_EXPLAINER_SHOWN flag so it
 * never fires again; subsequent toggles flip mode directly.
 *
 * Phase 3 chrome: ShieldCheck hero ring on mint tint, UI Button primitives,
 * design tokens throughout.
 */

const PRIVACY_URL = 'https://noc-tura.io/privacy';

interface PrivacyExplainerScreenProps {
  onDismiss: () => void;
}

const BULLETS = [
  'Your balance is hidden on-chain',
  'Transactions are not traceable',
  'Only you can see your history',
];

export function PrivacyExplainerScreen({onDismiss}: PrivacyExplainerScreenProps) {
  function handleGotIt() {
    mmkvPublic.set(MMKV_KEYS.PRIVACY_EXPLAINER_SHOWN, true);
    onDismiss();
  }

  function handleLearnMore() {
    void Linking.openURL(PRIVACY_URL);
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      <View className="flex-1 px-6 justify-center">
        {/* Hero ring · mint tint with ShieldCheck */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-[rgba(91,227,194,0.14)] items-center justify-center">
            <ShieldCheck size={44} color="#5BE3C2" strokeWidth={1.75} />
          </View>
        </View>

        {/* Title + body */}
        <View className="items-center mb-7">
          <Text variant="h1" className="text-center mb-2">
            Privacy mode
          </Text>
          <Text variant="body" className="text-center text-fg-secondary max-w-sm">
            Shielded sends use ZK proofs so your balance and history stay private.
          </Text>
        </View>

        {/* Bullet list */}
        <View className="gap-3 mb-6">
          {BULLETS.map(bullet => (
            <View key={bullet} className="flex-row items-start gap-3">
              <View className="w-1.5 h-1.5 rounded-pill bg-accent-shielded mt-2" />
              <Text variant="body" className="flex-1 text-fg-primary">
                {bullet}
              </Text>
            </View>
          ))}
        </View>

        {/* How it works card */}
        <View className="bg-bg-surface-1 rounded-lg p-4 mb-8 border-l-2 border-l-accent-shielded">
          <Text variant="overline" className="mb-2">
            How it works
          </Text>
          <Text variant="body-sm" className="text-fg-secondary">
            Your funds are protected using zero-knowledge cryptography — the
            same tech used by leading privacy protocols.
          </Text>
        </View>
      </View>

      {/* Sticky CTAs */}
      <View className="px-6 pb-8 gap-3">
        <Pressable
          onPress={handleGotIt}
          accessibilityRole="button"
          accessibilityLabel="Got it"
          testID="got-it-button"
          className="min-h-touch-rec rounded-pill bg-accent-shielded items-center justify-center flex-row gap-2 active:opacity-90">
          <Text variant="body-lg" className="font-geist-semibold text-bg-base">
            Got it
          </Text>
          <ArrowRight size={18} color="#0A0A0A" strokeWidth={2} />
        </Pressable>
        <Button
          label="Learn more"
          variant="tertiary"
          onPress={handleLearnMore}
          testID="learn-more-button"
        />
      </View>
    </SafeAreaView>
  );
}
