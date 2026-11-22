import React, {useEffect} from 'react';
import {View, Pressable, Linking, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Defs, Pattern, Rect, ClipPath, Circle, Line} from 'react-native-svg';
import {X, ShieldCheck, Vault} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Text, Button} from '../../components/ui';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import type {RootStackParamList} from '../../types/navigation';
import {MAKE_PUBLIC, PRIVATE_MARK} from '../../copy/modes';
import {WHO_SEES_CHAIN, WHO_SEES_RELAYER, WHO_SEES_RPC, WHO_SEES_WHAT} from '../../copy/accounts';

const PRIVACY_URL = 'https://noc-tura.io/privacy';
const ACCENT = '#5BE3C2';

const securityManager = new ScreenSecurityManager();

type Props = NativeStackScreenProps<RootStackParamList, 'ShieldedExplainer'>;

export function ShieldedExplainerScreen({navigation}: Props) {
  // FLAG_SECURE on mount so the footer "Screenshots disabled across this flow."
  // matches actual behavior. Spec (D) originally said NO since the screen has
  // no secrets, but the copy is too literal to leave the flag off — PR #4
  // Copilot review caught the inconsistency.
  useEffect(() => {
    void securityManager.enableSecureScreen();
    return () => {
      void securityManager.disableSecureScreen();
    };
  }, []);

  function handleContinue() {
    mmkvPublic.set(MMKV_KEYS.SHIELDED_EXPLAINED, true);
    useShieldedStore.getState().setMode('shielded');
    navigation.replace('ShieldUnshieldModal', {direction: 'private'});
  }

  function handleClose() {
    navigation.goBack();
  }

  function handleLearnMore() {
    void Linking.openURL(PRIVACY_URL);
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-bg-base">
      {/* Top bar: close × · SHIELDED overline · 1/1 */}
      <View className="flex-row items-center justify-between px-5 h-12">
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="w-12 h-12 items-center justify-center -ml-3">
          <X size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
          <Text variant="overline" className="text-accent-shielded">{PRIVATE_MARK}</Text>
        </View>
        <Text variant="overline" className="text-fg-tertiary">1 / 1</Text>
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 24}}>
        <VaultHero />
        {/* Final review I-1: only what the wallet does today — one SPL token (TEST on devnet), so no
            asset symbol; no private send (M2 does not exist yet), so step 3 is the relayed exit. */}
        <Text variant="h1" className="mb-3 mt-6">
          Your private balance, three steps.
        </Text>
        <Text variant="body" className="text-fg-secondary mb-8 max-w-sm">
          When you make tokens private, they move into a pool and become your private balance. Moving
          them in and out is public on chain.
        </Text>

        <ExplainerStep
          n={1}
          title="Move into your private balance"
          body="Deposit tokens from your public address. The deposit is public on chain and signed by your main account."
        />
        <ExplainerStep
          n={2}
          title="Make the proof"
          body="Each move into or out of your private balance needs a proof. Your phone makes the proof itself, on this device."
        />
        <ExplainerStep
          n={3}
          title={MAKE_PUBLIC}
          body={`Move your tokens back to a public address when you want. A relayer sends it for you for a small fee, so no key of yours signs it. Amounts and timing are public. Making them public to your main account links the exit to your deposit.`}
        />
        {/* M1d (M1 spec §11 R11): who sees what — every party that sees a request, nothing softened */}
        <View className="mt-2 mb-2" testID="explainer-who-sees-what">
          <Text variant="h3" className="mb-2">
            {WHO_SEES_WHAT}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary mb-2">
            {WHO_SEES_RELAYER}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary mb-2">
            {WHO_SEES_RPC}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary">
            {WHO_SEES_CHAIN}
          </Text>
        </View>
      </ScrollView>

      {/* Footer note — pulled OUT of scroll so the trust signal is always
          visible above the CTAs, even on devices where step bodies overflow.
          Spec HTML nested it inside .scroll, but UX-wise the assurance about
          screenshots should not require scrolling to read. */}
      <View className="flex-row items-center gap-2 px-5 mb-3">
        <ShieldCheck size={14} color={ACCENT} strokeWidth={1.75} />
        <Text variant="body-sm" className="text-accent-shielded">
          Screenshots disabled across this flow.
        </Text>
      </View>

      {/* Sticky bar */}
      <View className="px-5 pb-4 gap-3">
        <Pressable
          testID="continue-button"
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          className="h-14 rounded-pill bg-accent-shielded items-center justify-center active:opacity-90">
          <Text variant="body-lg" className="font-geist-semibold text-bg-base">
            Continue
          </Text>
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

// ── VaultHero · 88dp disc · accent ring + halo + diagonal stripes + Vault icon ──
function VaultHero() {
  return (
    <View className="items-center mt-2">
      <View
        className="rounded-full items-center justify-center border border-accent-shielded"
        style={{
          width: 88,
          height: 88,
          shadowColor: ACCENT,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: {width: 0, height: 0},
          elevation: 6,
        }}>
        <Svg width={88} height={88} style={{position: 'absolute', top: 0, left: 0}}>
          <Defs>
            <Pattern
              id="stripes"
              patternUnits="userSpaceOnUse"
              width={6}
              height={6}
              patternTransform="rotate(45)">
              <Line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke={ACCENT}
                strokeOpacity={0.06}
                strokeWidth={2}
              />
            </Pattern>
            <ClipPath id="circleClip">
              <Circle cx={44} cy={44} r={43} />
            </ClipPath>
          </Defs>
          <Rect
            width={88}
            height={88}
            fill="url(#stripes)"
            clipPath="url(#circleClip)"
          />
        </Svg>
        <Vault size={44} color={ACCENT} strokeWidth={1.75} />
      </View>
    </View>
  );
}

// ── ExplainerStep · numbered tinted disc + title + body ─────────────────────
interface ExplainerStepProps {
  n: number;
  title: string;
  body: string;
}

function ExplainerStep({n, title, body}: ExplainerStepProps) {
  return (
    <View className="flex-row gap-4 mb-6">
      <View
        className="w-7 h-7 rounded-full bg-accent-shielded-tint items-center justify-center"
        style={{flexShrink: 0}}>
        <Text variant="body-sm" mono numeral className="text-accent-shielded">
          {n}
        </Text>
      </View>
      <View className="flex-1">
        <Text variant="h3" className="mb-1">
          {title}
        </Text>
        <Text variant="body-sm" className="text-fg-secondary">
          {body}
        </Text>
      </View>
    </View>
  );
}
