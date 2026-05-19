import React from 'react';
import {View, ScrollView, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Key, Fingerprint, ShieldCheck} from 'lucide-react-native';
import {Text, Button, Card} from '../../components/ui';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

/**
 * #2 SecurityIntro — Phase B migration · mirror /home/user/Downloads/index.html §s2
 *
 * Single state · idle.
 * Mode-agnostic. No FLAG_SECURE (no seed/PIN material on this screen).
 *
 * Layout (top → bottom):
 *   Top bar
 *     · Back arrow (left, 22 px)
 *     · "Onboarding" eyebrow (center, .noc-overline)
 *     · "1 / 5" step counter (right, .noc-body-sm + tabular numerals)
 *   Scroll area
 *     · Title (.noc-h1): "Three layers protect your wallet"
 *     · Lede (.noc-body, --fg-secondary): "You hold the keys. We never can."
 *     · 3 layer cards (Card primitive · bg-surface-1 · 22 px Lucide icon)
 *         - Key icon · Local PIN
 *         - Fingerprint icon · Biometric (optional)
 *         - ShieldCheck icon · Recovery seed
 *     · Footer disclaimer (.noc-caption, --fg-tertiary):
 *       "If you lose all three, no one — not Noctura, not a Solana validator —
 *        can recover your funds. That's the point."
 *   Sticky bottom
 *     · [Continue] primary CTA (56 dp · sets ONBOARDING_SECURITY_ACK on tap)
 *
 * Compliance: the design replaces the legacy checkbox-gated consent with an
 * educational 3-layer + footer-disclaimer pattern. The user's continued tap on
 * [Continue] still writes the ONBOARDING_SECURITY_ACK MMKV flag for App Store
 * audit-trail parity — just without a separate checkbox UI element.
 */

interface SecurityIntroScreenProps {
  onContinue: () => void;
  onBack?: () => void;
}

interface LayerCardProps {
  Icon: typeof Key;
  title: string;
  body: string;
}

function LayerCard({Icon, title, body}: LayerCardProps) {
  return (
    <Card surface="surface-1" padding="p-4" className="flex-row gap-4 mb-3">
      <View className="w-11 h-11 items-center justify-center rounded-md bg-bg-surface-2">
        <Icon size={22} color="#B084FC" strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text variant="h3" className="mb-1">
          {title}
        </Text>
        <Text variant="body-sm" className="text-fg-secondary">
          {body}
        </Text>
      </View>
    </Card>
  );
}

export function SecurityIntroScreen({onContinue, onBack}: SecurityIntroScreenProps) {
  const handleContinue = () => {
    // Preserve App Store compliance audit trail: write the ack flag on Continue
    // tap (replaces legacy checkbox-gated write — the disclaimer + Continue is
    // the canonical pattern per wallet-ux + Phase 3 design).
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_SECURITY_ACK, 'true');
    onContinue();
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar — back arrow · eyebrow · step counter */}
      <View className="flex-row items-center justify-between px-4 py-3 min-h-touch-min">
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-12 h-12 items-center justify-center -ml-2">
            <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
        ) : (
          <View className="w-12 h-12" />
        )}
        <Text variant="overline" className="text-fg-tertiary">
          Onboarding
        </Text>
        <Text variant="body-sm" numeral className="text-fg-secondary w-12 text-right">
          1 / 5
        </Text>
      </View>

      {/* Scroll area — title · lede · 3 layer cards · disclaimer */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-3 pb-6"
        showsVerticalScrollIndicator={false}>
        <Text variant="h1" className="mb-2">
          Three layers protect your wallet
        </Text>
        <Text variant="body" className="text-fg-secondary mb-6">
          You hold the keys. We never can.
        </Text>

        <LayerCard
          Icon={Key}
          title="Local PIN"
          body="Six digits you choose. Required for every send and signature."
        />
        <LayerCard
          Icon={Fingerprint}
          title="Biometric (optional)"
          body="Fingerprint as a shortcut. Your PIN still gates high-risk actions."
        />
        <LayerCard
          Icon={ShieldCheck}
          title="Recovery seed"
          body="24 words. Written offline. The only way back if this device is lost."
        />

        <Text variant="caption" className="text-fg-tertiary mt-5">
          If you lose all three, no one — not Noctura, not a Solana validator — can
          recover your funds. That's the point.
        </Text>
      </ScrollView>

      {/* Sticky bottom — Continue CTA */}
      <View className="px-6 pb-8">
        <Button
          label="Continue"
          variant="primary"
          onPress={handleContinue}
          testID="continue-button"
        />
      </View>
    </SafeAreaView>
  );
}
