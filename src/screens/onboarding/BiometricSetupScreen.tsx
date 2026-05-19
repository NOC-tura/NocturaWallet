import React, {useState} from 'react';
import {View, Pressable, Vibration, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Fingerprint, Check, ShieldCheck, Info} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {KeychainManager} from '../../modules/keychain/keychainModule';

const keychainManager = new KeychainManager();

/**
 * #6 BiometricSetup — Phase B migration · mirror /home/user/Downloads/index.html §s6
 *
 * Optional fingerprint / Face ID enrollment for fast unlock convenience. PIN
 * still gates all high-risk actions (sends, signing, settings). User can skip
 * and use PIN-only mode.
 *
 * Layout (per design):
 *   - Top bar (back · "Onboarding" · "5 / 5")
 *   - Hero · 56 px Fingerprint icon · centered
 *   - Title (.noc-h1): "Unlock Noctura with fingerprint"
 *     (iOS variant resolves to "Face ID" / "Touch ID" via LocalAuthentication.
 *      biometryType — handled in iOS-phase migration; Android always shows
 *      "fingerprint")
 *   - Body: "Adds convenience. Your PIN is still required for sends, signing,
 *     and any high-risk action."
 *   - 3 feature rows:
 *       · Check icon · "Faster unlock" · "Tap the sensor instead of typing 6 digits."
 *       · Shield-Lock icon · "PIN still wins" · "Sends, signs, and changes always re-prompt for the PIN."
 *       · Info icon · "Resets on enrollment change" · "Adding, removing, or
 *         changing any fingerprint or face on this device clears biometric
 *         access. You'll need to re-enter your PIN to set it up again."
 *   - Sticky bottom: [Enable fingerprint] primary + [Skip — use PIN only] secondary
 *
 * The Enable action persists MMKV flag (SECURITY_BIOMETRIC_ENABLED) which
 * UnlockScreen checks on mount to decide whether to auto-fire biometric prompt.
 * The actual seed is stored by SuccessScreen with BIOMETRY_ANY_OR_DEVICE_PASSCODE
 * access control via KeychainManager — so the OS-level biometric requirement
 * is set at seed storage time, not here.
 *
 * Named security property (per Round 2d Fix 4): enrollment-change invalidation
 * via .biometryCurrentSet (iOS) / setInvalidatedByBiometricEnrollment(true)
 * (Android KeyGenParameterSpec). Both produce the same semantic — biometric
 * access invalidates if user adds/removes/changes any enrolled fingerprint
 * or face. PIN unlock continues to work; spend key re-wraps under new
 * biometric-gated cipher on re-enrollment.
 */

interface BiometricSetupScreenProps {
  onEnable: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

interface FeatureRowProps {
  Icon: typeof Check;
  title: string;
  body: string;
}

function FeatureRow({Icon, title, body}: FeatureRowProps) {
  return (
    <View className="flex-row gap-3 items-start py-2">
      <View className="w-9 h-9 items-center justify-center rounded-md bg-bg-surface-2 mt-0.5">
        <Icon size={18} color="#B084FC" strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text variant="body-lg" className="mb-1">
          {title}
        </Text>
        <Text variant="body-sm" className="text-fg-secondary">
          {body}
        </Text>
      </View>
    </View>
  );
}

export function BiometricSetupScreen({
  onEnable,
  onSkip,
  onBack,
}: BiometricSetupScreenProps) {
  const [enabling, setEnabling] = useState(false);

  const handleEnable = async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      // Fire the native BiometricPrompt as verification. User must touch the
      // sensor for this to succeed — confirms biometry works on this device
      // before we commit the flag.
      const ok = await keychainManager.testBiometric();
      if (!ok) {
        // User cancelled or sensor failed — stay on screen, no flag set
        setEnabling(false);
        return;
      }
      mmkvPublic.set(MMKV_KEYS.SECURITY_BIOMETRIC_ENABLED, 'true');
      Vibration.vibrate(50); // CONFIRM-equivalent haptic on success
      onEnable();
    } catch (e) {
      setEnabling(false);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Biometric setup failed', msg);
    }
  };

  const handleSkip = () => {
    mmkvPublic.set(MMKV_KEYS.SECURITY_BIOMETRIC_ENABLED, 'false');
    onSkip();
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
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
          5 / 5
        </Text>
      </View>

      {/* Hero · Fingerprint icon */}
      <View className="items-center mt-6 mb-2">
        <View className="w-24 h-24 rounded-icon-hero bg-accent-transparent-tint items-center justify-center border border-accent-transparent">
          <Fingerprint size={56} color="#B084FC" strokeWidth={1.5} />
        </View>
      </View>

      {/* Title + body */}
      <View className="items-center px-6 mt-5 mb-7">
        <Text variant="h1" className="text-center mb-2">
          Unlock Noctura with fingerprint
        </Text>
        <Text variant="body" className="text-center text-fg-secondary max-w-sm">
          Adds convenience. Your PIN is still required for sends, signing, and
          any high-risk action.
        </Text>
      </View>

      {/* 3 feature rows */}
      <View className="px-6 gap-1">
        <FeatureRow
          Icon={Check}
          title="Faster unlock"
          body="Tap the sensor instead of typing 6 digits."
        />
        <FeatureRow
          Icon={ShieldCheck}
          title="PIN still wins"
          body="Sends, signs, and changes always re-prompt for the PIN."
        />
        <FeatureRow
          Icon={Info}
          title="Resets on enrollment change"
          body="Adding, removing, or changing any fingerprint or face on this device clears biometric access. You'll need to re-enter your PIN to set it up again."
        />
      </View>

      {/* Spacer pushes sticky CTAs to bottom */}
      <View className="flex-1" />

      {/* Sticky bottom · 2 CTAs */}
      <View className="px-6 pb-8 gap-3">
        <Button
          label="Enable fingerprint"
          variant="primary"
          onPress={handleEnable}
          loading={enabling}
          testID="biometric-enable-button"
        />
        <Button
          label="Skip — use PIN only"
          variant="secondary"
          onPress={handleSkip}
          disabled={enabling}
          testID="biometric-skip-button"
        />
      </View>
    </SafeAreaView>
  );
}
