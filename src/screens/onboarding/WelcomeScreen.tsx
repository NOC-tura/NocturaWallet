import React from 'react';
import {View, Linking, Image} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Lock, Key, ShieldCheck} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {cn} from '../../utils/cn';

const NOC_LOGO = require('../../assets/tokens/noc-logo.png');

/**
 * #1 Welcome — Phase B migration · mirror /home/user/Downloads/index.html §s1
 *
 * Single state · idle.
 * Mode-agnostic (ModeContainer not mounted yet).
 * No FLAG_SECURE (first sensitive surface is #3 seed-display).
 *
 * Layout (top to bottom):
 *   - Hero block (center-aligned vertical)
 *       · "N" mark logo (synthetic, no third-party logo, anti-AI-slop)
 *       · "Noctura" wordmark (.noc-h1 32 px display weight)
 *       · Tagline (.noc-body)
 *       · 3 trust chips (Lock + Key + ShieldCheck Lucide icons @ 14 px)
 *   - Terms/Privacy disclaimer (.noc-caption · ABOVE CTAs per spec)
 *   - Sticky bottom bar — 2 CTAs in column:
 *       · [Create new wallet] primary  → security-intro (Round 2a nav fix)
 *       · [I have a wallet]  secondary → security-intro (App Store compliance)
 *
 * Touch targets: both CTAs 56 dp (Button primitive --touch-target-rec).
 * Bottom padding: --inset-bottom respected via SafeAreaView edges.
 */

interface WelcomeScreenProps {
  onCreate: () => void;
  onImport: () => void;
}

const TERMS_URL = 'https://noctura.app/terms';
const PRIVACY_URL = 'https://noctura.app/privacy';

interface TrustChipProps {
  Icon: typeof Lock;
  label: string;
}

function TrustChip({Icon, label}: TrustChipProps) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-2 px-3 py-2 rounded-pill',
        'bg-bg-surface-2 border border-bg-surface-3',
        'min-h-touch-min', // 48 dp wrap per spec D-block
      )}>
      <Icon size={14} color="#A8ACB5" strokeWidth={1.75} />
      <Text variant="body-sm" className="text-fg-secondary">
        {label}
      </Text>
    </View>
  );
}

export function WelcomeScreen({onCreate, onImport}: WelcomeScreenProps) {
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Hero — center-aligned vertical block, takes remaining space */}
      <View className="flex-1 items-center justify-center px-6">
        {/* Noctura brand mark · 3D "N" logo with mint/violet gradient inside
            a dark `bg-surface-1` rounded badge frame for visual coherence
            with the rest of onboarding hero rings (BiometricSetup, Success). */}
        <View
          className={cn(
            'w-24 h-24 mb-6',
            'rounded-icon-hero', // 16 px · DS v0.2.1 token
            'bg-bg-surface-1',
            'items-center justify-center',
            'border border-bg-surface-3',
          )}>
          <Image
            source={NOC_LOGO}
            style={{width: 72, height: 72}}
            resizeMode="contain"
            accessibilityLabel="Noctura logo"
          />
        </View>

        {/* Wordmark + tagline */}
        <Text variant="h1" className="mb-2">
          Noctura
        </Text>
        <Text
          variant="body"
          className="text-fg-secondary text-center px-2 mb-6">
          A Solana wallet built for private, non-custodial holding.
        </Text>

        {/* Trust chips row · 3 chips wrap to multi-row on narrow screens */}
        <View className="flex-row flex-wrap items-center justify-center gap-2">
          <TrustChip Icon={Lock} label="E2E encrypted" />
          <TrustChip Icon={Key} label="Non-custodial" />
          <TrustChip Icon={ShieldCheck} label="ZK-private" />
        </View>
      </View>

      {/* Terms/Privacy disclaimer — ABOVE sticky bar per spec L4509 */}
      <View className="px-6 pb-3">
        <Text
          variant="caption"
          className="text-fg-tertiary text-center">
          By continuing you agree to the{' '}
          <Text
            variant="caption"
            className="text-accent-transparent"
            onPress={() => Linking.openURL(TERMS_URL)}>
            Terms
          </Text>{' '}
          and{' '}
          <Text
            variant="caption"
            className="text-accent-transparent"
            onPress={() => Linking.openURL(PRIVACY_URL)}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      {/* Sticky bottom bar — 2 CTAs in column · 56 dp each · 12 px gap
       * Horizontal padding 24 (--space-6) matches design hero padding for visual
       * alignment with the "N" monogram + wordmark stack above. Bottom padding 8
       * (--space-8 = 48 px) sits comfortably above the system gesture indicator;
       * SafeAreaView edges=['bottom'] adds any extra device-specific safe inset
       * on top of this base padding. */}
      <View className="px-6 pb-8 gap-3">
        <Button
          label="Create new wallet"
          variant="primary"
          onPress={onCreate}
          testID="create-wallet-button"
        />
        <Button
          label="I have a wallet"
          variant="secondary"
          onPress={onImport}
          testID="import-wallet-button"
        />
      </View>
    </SafeAreaView>
  );
}
