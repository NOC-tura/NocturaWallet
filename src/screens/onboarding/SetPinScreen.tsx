import React, {useState, useRef, useEffect} from 'react';
import {View, ActivityIndicator, Alert, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ShieldCheck} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {usePinInput, PinDots, PinKeypad} from '../../components/PinPad';
import {KeychainManager} from '../../modules/keychain/keychainModule';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {cn} from '../../utils/cn';

/**
 * #5 SetPin — Phase B migration · mirror /home/user/Downloads/index.html §s5
 *
 * Layout (mirrors design pin-head + spacer + keypad pattern):
 *   - Top bar
 *   - Step indicator (1/2 active)
 *   - Hero: title + body + PIN dots + helper text
 *   - <flex spacer · pushes keypad to thumb-reachable bottom>
 *   - PinKeypad (anchored bottom)
 *
 * Uses split PinDots + PinKeypad primitives + usePinInput hook so PIN dots
 * sit visually adjacent to the title (immediate feedback as user types) while
 * keypad stays anchored at the bottom for one-hand reach.
 *
 * Two-step flow: enter → confirm. Mismatch path: dots flip --danger + helper
 * "PINs don't match" · auto-reset to step 1 after 600 ms.
 *
 * FLAG_SECURE on mount.
 */

interface SetPinScreenProps {
  onPinSet: () => void;
  onBack?: () => void;
}

const keychainManager = new KeychainManager();
const securityManager = new ScreenSecurityManager();
const PIN_LENGTH = 6;

export function SetPinScreen({onPinSet, onBack}: SetPinScreenProps) {
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const onPinSetRef = useRef(onPinSet);
  onPinSetRef.current = onPinSet;

  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => {
      securityManager.disableSecureScreen();
    };
  }, []);

  const isConfirmStep = firstPin !== null;

  const handlePinComplete = (pin: string) => {
    if (saving) return;

    if (!isConfirmStep) {
      setFirstPin(pin);
      setError(null);
      setResetKey(k => k + 1);
    } else {
      if (pin === firstPin) {
        setSaving(true);
        setTimeout(async () => {
          try {
            await keychainManager.setupPin(pin);
            onPinSetRef.current();
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            Alert.alert('Error', `Failed to save PIN: ${msg}`);
            setFirstPin(null);
            setSaving(false);
            setResetKey(k => k + 1);
          }
        }, 100);
      } else {
        setError("PINs don't match — try again");
        setTimeout(() => {
          setFirstPin(null);
          setError(null);
          setResetKey(k => k + 1);
        }, 600);
      }
    }
  };

  const {digits, handleKey} = usePinInput({
    maxLength: PIN_LENGTH,
    onComplete: handlePinComplete,
    resetKey,
  });

  // Securing state — full-screen during Argon2id hash
  if (saving) {
    return (
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        className="flex-1 bg-bg-base">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-icon-hero bg-accent-transparent-tint items-center justify-center mb-5 border border-accent-transparent">
            <ShieldCheck size={32} color="#B084FC" strokeWidth={1.75} />
          </View>
          <Text variant="h2" className="text-center mb-2">
            Securing your wallet
          </Text>
          <Text variant="body" className="text-center text-fg-secondary mb-6">
            Hashing your PIN with Argon2id · this takes a few seconds.
          </Text>
          <ActivityIndicator color="#B084FC" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const stepActive = isConfirmStep ? 1 : 0;

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
          4 / 5
        </Text>
      </View>

      {/* Step indicator (1 / 2) */}
      <View className="flex-row items-center justify-center gap-2 mt-2 mb-4">
        {[0, 1].map(i => (
          <View
            key={i}
            className={cn(
              'h-2 rounded-pill',
              i === stepActive ? 'w-6 bg-accent-transparent' : 'w-2 bg-bg-surface-3',
            )}
          />
        ))}
      </View>

      {/* Hero · title + body + PIN dots + helper · all grouped at top */}
      <View className="items-center px-6">
        <Text variant="h1" testID="pin-title" className="text-center mb-2">
          {isConfirmStep ? 'Confirm your PIN' : 'Create a PIN'}
        </Text>
        <Text variant="body" className="text-center text-fg-secondary max-w-xs mb-5">
          {isConfirmStep
            ? 'Enter the same 6 digits to verify.'
            : "6 digits. You'll need this to unlock the wallet and to send."}
        </Text>

        <PinDots
          count={digits.length}
          maxLength={PIN_LENGTH}
          error={!!error}
          className="mb-3"
        />

        {/* Helper / error line · reserved height so layout doesn't jump */}
        {error ? (
          <Text variant="caption" className="text-danger text-center">
            {error}
          </Text>
        ) : !isConfirmStep ? (
          <Text variant="caption" className="text-fg-tertiary text-center">
            Choose something memorable but not 111111.
          </Text>
        ) : (
          <View className="h-4" />
        )}
      </View>

      {/* Keypad — pushed toward thumb-reach bottom zone with breathing room
       * from screen edge. Iteration history:
       *   v1: `flex-1 justify-end pb-6` → keypad pinned to absolute bottom
       *       (user reported "preveč dol")
       *   v2: `mt-6 pb-6` → keypad too high · big empty space below
       *       (user reported "previsoko")
       *   v3 (current): `flex-1 justify-end pb-8` → fills remaining space,
       *       aligns keypad to bottom of that space, 32 dp pad from screen
       *       edge — thumb-reach zone (~80-90% from top) without edge crowd
       */}
      <View className="flex-1 justify-end pb-8">
        <PinKeypad onKey={handleKey} />
      </View>
    </SafeAreaView>
  );
}
