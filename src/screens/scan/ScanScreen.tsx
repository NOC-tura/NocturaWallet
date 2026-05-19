import React, {useEffect, useRef, useState} from 'react';
import {View, Pressable, Animated, Easing} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {X, Zap, ZapOff, Camera, ScanLine} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {cn} from '../../utils/cn';

/**
 * #14 Scan — Phase B migration · mirror /home/user/Downloads/index.html §s14
 *
 * Full Phase 3 visual chrome:
 *   - Top-left X (close) + top-right flashlight toggle (Zap/ZapOff)
 *   - Centered reticle · 240 dp square with 4 accent corner brackets +
 *     animated laser sweep (Animated.Value, 1800 ms loop)
 *   - Bottom hint card · "Point camera at a QR code" + sub-copy listing
 *     supported QR types (addresses, pay-URIs, WalletConnect URIs)
 *   - "Camera coming soon" overlay banner — explicit since the viewport is
 *     a placeholder until react-native-vision-camera integration lands
 *   - Sticky tertiary CTA · "Enter address manually" → dismisses modal,
 *     user types address into Send screen's recipient field
 *
 * Camera integration deferred (separate task):
 *   - react-native-vision-camera + useCodeScanner({codeTypes: ['qr']})
 *   - Android permission flow (Camera permission · rationale dialog ·
 *     denied state with deep link to app settings)
 *   - Flashlight toggle via Camera.torch
 *   - On QR decode → validateRecipientInput() → return to Send with
 *     {recipient, amount?} via route param or pendingScan resolver
 *
 * No FLAG_SECURE (no PIN / seed surface).
 */

interface ScanScreenProps {
  onBack: () => void;
}

const RETICLE_SIZE = 240;
const CORNER_LEN = 28;
const CORNER_WIDTH = 3;
const ACCENT = '#B084FC';

export function ScanScreen({onBack}: ScanScreenProps) {
  const [torchOn, setTorchOn] = useState(false);
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Animated laser sweep top → bottom → top, 1.8 s per cycle, ease-in-out
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [laserAnim]);

  const laserTranslate = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, RETICLE_SIZE - 2],
  });

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        className="flex-1">
        {/* Top controls · X + torch */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            className="w-12 h-12 items-center justify-center rounded-pill bg-[rgba(0,0,0,0.55)]">
            <X size={22} color="#FFFFFF" strokeWidth={1.75} />
          </Pressable>
          <Pressable
            onPress={() => setTorchOn(t => !t)}
            accessibilityRole="button"
            accessibilityLabel={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
            className={cn(
              'w-12 h-12 items-center justify-center rounded-pill',
              torchOn ? 'bg-accent-transparent' : 'bg-[rgba(0,0,0,0.55)]',
            )}>
            {torchOn ? (
              <Zap size={22} color="#0A0A0A" strokeWidth={2} fill="#0A0A0A" />
            ) : (
              <ZapOff size={22} color="#FFFFFF" strokeWidth={1.75} />
            )}
          </Pressable>
        </View>

        {/* Center · reticle + viewport placeholder */}
        <View className="flex-1 items-center justify-center">
          <View
            style={{
              width: RETICLE_SIZE,
              height: RETICLE_SIZE,
            }}>
            {/* Top-left corner */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: CORNER_LEN,
                height: CORNER_WIDTH,
                backgroundColor: ACCENT,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: CORNER_WIDTH,
                height: CORNER_LEN,
                backgroundColor: ACCENT,
              }}
            />
            {/* Top-right corner */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: CORNER_LEN,
                height: CORNER_WIDTH,
                backgroundColor: ACCENT,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: CORNER_WIDTH,
                height: CORNER_LEN,
                backgroundColor: ACCENT,
              }}
            />
            {/* Bottom-left corner */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: CORNER_LEN,
                height: CORNER_WIDTH,
                backgroundColor: ACCENT,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: CORNER_WIDTH,
                height: CORNER_LEN,
                backgroundColor: ACCENT,
              }}
            />
            {/* Bottom-right corner */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: CORNER_LEN,
                height: CORNER_WIDTH,
                backgroundColor: ACCENT,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: CORNER_WIDTH,
                height: CORNER_LEN,
                backgroundColor: ACCENT,
              }}
            />

            {/* Animated laser sweep */}
            <Animated.View
              style={{
                position: 'absolute',
                left: CORNER_WIDTH,
                right: CORNER_WIDTH,
                height: 2,
                backgroundColor: ACCENT,
                shadowColor: ACCENT,
                shadowOpacity: 0.8,
                shadowRadius: 8,
                shadowOffset: {width: 0, height: 0},
                transform: [{translateY: laserTranslate}],
              }}
            />

            {/* Placeholder camera icon in middle (subtle, indicates camera not active) */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.18,
              }}>
              <Camera size={64} color="#FFFFFF" strokeWidth={1.25} />
            </View>
          </View>
        </View>

        {/* Hint card · bottom */}
        <View className="px-6 pb-2 items-center">
          <Text variant="h3" className="text-fg-primary text-center mb-1">
            Point camera at a QR code
          </Text>
          <Text variant="body-sm" className="text-fg-secondary text-center max-w-xs">
            Wallet addresses · pay-URIs · WalletConnect URIs
          </Text>
        </View>

        {/* "Coming soon" notice — explicit since the viewport is placeholder */}
        <View className="px-5 pb-3">
          <View className="flex-row items-center gap-3 p-3 rounded-md bg-[rgba(255,255,255,0.08)] border border-[rgba(176,132,252,0.4)]">
            <ScanLine size={18} color={ACCENT} strokeWidth={1.75} />
            <Text variant="caption" className="flex-1 text-fg-primary">
              Live camera scanner coming soon. For now, tap below to enter the
              address manually.
            </Text>
          </View>
        </View>

        {/* Sticky tertiary · enter manually */}
        <View className="px-6 pb-6">
          <Button
            label="Enter address manually"
            variant="secondary"
            onPress={onBack}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

