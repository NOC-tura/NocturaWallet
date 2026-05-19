import React, {useEffect, useRef, useState, useCallback} from 'react';
import {View, ScrollView, Pressable, Vibration} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ShieldCheck, AlertCircle, Clock, EyeOff} from 'lucide-react-native';
import {Text, Button, Card} from '../../components/ui';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

/**
 * #3 SeedPhrase — Phase B migration · mirror /home/user/Downloads/index.html §s3
 * (Round 2a · revised — 2×12 grid + pre-reveal modal + auto re-blur)
 *
 * FLAG_SECURE on mount (screenshots blocked on Android).
 *
 * INTENTIONAL DEVIATION from design's "hold-to-reveal" pattern (wallet-ux §1):
 * the design specified PressIn / PressOut hold-to-reveal with 20 s auto-blur.
 * In practice this is HOSTILE for the canonical seed-writing use case — the
 * user needs both hands free to copy 24 words to paper. Forcing them to hold
 * the phone with a third hand is unworkable. User feedback during Phase B
 * confirmed this pattern was unusable.
 *
 * REVISED PATTERN (preserves all three security concerns from wallet-ux §1):
 *   - Screenshot blocking — preserved by FLAG_SECURE (unchanged)
 *   - Anti-shoulder-surfing — preserved by pre-reveal modal warning + countdown
 *   - Accidental exposure — preserved by 90 s auto-blur (was 20 s in design)
 *
 * Interaction:
 *   - TAP to reveal entire grid (no hold)
 *   - 90 s countdown starts; chip shows remaining seconds (red at 10 s)
 *   - User can write words at their own pace; both hands free
 *   - Tap "Hide" button OR wait for auto-blur to dismiss
 *   - Tap grid again to re-reveal (fresh 90 s window)
 *
 * 5 states machine:
 *   - pre-reveal   · modal gates entry (route-level guard simulated in-screen)
 *   - idle         · grid blurred, awaiting first tap
 *   - revealing    · grid visible, countdown active
 *   - still-looking· 90 s auto-fired, grid re-blurred, "Still looking?" prompt
 *   - confirmed    · at least one successful reveal → Continue enabled
 *
 * Grid: 2 columns × 12 rows · column-major reading (1-12 left, 13-24 right)
 *
 * Per design D-block: aria-live throttle to 30 s + 10 s milestones (TODO v0.3 ·
 * RN doesn't expose aria-live natively; AccessibilityInfo.announceForAccessibility
 * approximates but needs careful timing).
 */

interface SeedPhraseScreenProps {
  mnemonic: string;
  onConfirm: () => void;
}

// 90 s reveal window — enough time to write 24 words at average handwriting speed
// (~25 words/min × ~1 min for the words + some reading time). User can re-tap
// for additional 90 s if needed for last few words. Design originally said 20 s
// — revised to 90 s based on Phase B real-user feedback.
const REVEAL_DURATION_MS = 90_000;
// Show danger-colored countdown when ≤10 s remain (was 5 s in 20-s design;
// scaled proportionally to the longer window).
const DANGER_THRESHOLD_S = 10;
const TICK_INTERVAL_MS = 1000;

type SeedState = 'pre-reveal' | 'idle' | 'revealing' | 'still-looking' | 'confirmed';

const securityManager = new ScreenSecurityManager();

export function SeedPhraseScreen({mnemonic, onConfirm}: SeedPhraseScreenProps) {
  const words = mnemonic.trim().split(/\s+/);
  const [state, setState] = useState<SeedState>('pre-reveal');
  const [secondsRemaining, setSecondsRemaining] = useState(REVEAL_DURATION_MS / 1000);
  const hasRevealedOnceRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FLAG_SECURE lifecycle — engage at modal mount (BEFORE seed grid renders)
  // so there's no flash-frame between modal dismiss and seed mount that could
  // be screenshot-able. Per Round 2a F-block contract.
  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => {
      securityManager.disableSecureScreen();
      clearTimers();
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoBlurTimerRef.current !== null) {
      clearTimeout(autoBlurTimerRef.current);
      autoBlurTimerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    clearTimers();
    setSecondsRemaining(REVEAL_DURATION_MS / 1000);

    // Countdown tick — updates visible chip every second.
    intervalRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        const next = prev - 1;
        // Warning haptic at 10 s remaining (threshold scaled to longer window)
        if (next === DANGER_THRESHOLD_S) {
          Vibration.vibrate(50);
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    // Auto-blur fire at 90 s
    autoBlurTimerRef.current = setTimeout(() => {
      clearTimers();
      Vibration.vibrate([0, 100, 50, 100]); // double-pulse pattern
      setState('still-looking');
    }, REVEAL_DURATION_MS);
  }, [clearTimers]);

  // Tap-to-reveal: single tap on the grid reveals + starts 90 s countdown.
  // Hands stay free for writing words to paper. User can tap "Hide" or
  // wait for auto-blur to dismiss.
  const handleRevealTap = useCallback(() => {
    if (state === 'pre-reveal' || state === 'revealing') return;
    Vibration.vibrate(20); // light tap on reveal-start
    setState('revealing');
    hasRevealedOnceRef.current = true;
    startCountdown();
  }, [state, startCountdown]);

  // Explicit hide button — user dismisses reveal before auto-blur fires.
  const handleHideTap = useCallback(() => {
    if (state !== 'revealing') return;
    clearTimers();
    // hasRevealedOnceRef is already true (we got to 'revealing'), so mark confirmed
    setState('confirmed');
  }, [state, clearTimers]);

  const handleAckModal = () => {
    setState('idle');
  };

  const handleContinue = () => {
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_SEED_DISPLAYED, 'true');
    onConfirm();
  };

  const isGridRevealed = state === 'revealing';
  const isCountdownDanger = secondsRemaining <= DANGER_THRESHOLD_S;
  const continueEnabled = state === 'confirmed';

  // 2×12 column-major grid: left col = 1-12, right col = 13-24
  const leftCol = words.slice(0, 12).map((w, i) => ({n: i + 1, w}));
  const rightCol = words.slice(12, 24).map((w, i) => ({n: i + 13, w}));

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {state === 'pre-reveal' && (
        <PreRevealModal onAck={handleAckModal} />
      )}

      {state !== 'pre-reveal' && (
        <>
          {/* Top FLAG_SECURE banner — explicit security cue */}
          <View className="flex-row items-center gap-2 mx-4 mt-3 px-3 py-2 rounded-md bg-bg-surface-1 border border-shield-300">
            <ShieldCheck size={14} color="#A6F0DC" strokeWidth={1.75} />
            <Text variant="caption" className="text-shield-300 flex-1">
              Screenshots disabled · screen-recording blocked while phrase is visible
            </Text>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="px-6 pt-5 pb-6"
            showsVerticalScrollIndicator={false}>
            <Text variant="h2" className="mb-2">
              Your 24-word recovery phrase
            </Text>
            <Text variant="body-sm" className="text-fg-secondary mb-5">
              Tap the grid to reveal. Words stay visible for 90 seconds — enough
              time to write them down on paper. Tap "Hide" or wait for auto-blur
              to dismiss.
            </Text>

            {/* Tap-to-reveal grid */}
            <Pressable
              onPress={handleRevealTap}
              accessibilityRole="button"
              accessibilityLabel={
                isGridRevealed
                  ? `Recovery phrase revealed · ${secondsRemaining} seconds remaining`
                  : 'Tap to reveal recovery phrase'
              }
              className="relative">
              <Card surface="surface-1" padding="p-4">
                <View className="flex-row gap-3">
                  {/* Left column · words 1-12 */}
                  <View className="flex-1 gap-2">
                    {leftCol.map(({n, w}) => (
                      <WordCell
                        key={n}
                        index={n}
                        word={w}
                        revealed={isGridRevealed}
                      />
                    ))}
                  </View>
                  {/* Right column · words 13-24 */}
                  <View className="flex-1 gap-2">
                    {rightCol.map(({n, w}) => (
                      <WordCell
                        key={n}
                        index={n}
                        word={w}
                        revealed={isGridRevealed}
                      />
                    ))}
                  </View>
                </View>
              </Card>

              {/* Countdown chip (top-right · only during revealing) */}
              {isGridRevealed && (
                <View
                  className={`absolute top-2 right-2 flex-row items-center gap-1 px-2 py-1 rounded-pill ${
                    isCountdownDanger ? 'bg-danger/20' : 'bg-warning/20'
                  }`}>
                  <Clock
                    size={12}
                    color={isCountdownDanger ? '#FF5C6A' : '#F2B53B'}
                    strokeWidth={2}
                  />
                  <Text
                    variant="caption"
                    numeral
                    className={isCountdownDanger ? 'text-danger' : 'text-warning'}>
                    {secondsRemaining}s · auto-blur
                  </Text>
                </View>
              )}

              {/* Idle overlay · "Tap to reveal" hint */}
              {state === 'idle' && (
                <View className="absolute inset-0 items-center justify-center rounded-lg bg-bg-base/85">
                  <ShieldCheck size={28} color="#B084FC" strokeWidth={1.75} />
                  <Text variant="h3" className="mt-2">
                    Tap to reveal
                  </Text>
                  <Text variant="body-sm" className="text-fg-secondary mt-1">
                    Words stay visible 90 seconds · hands free to write
                  </Text>
                </View>
              )}

              {/* Still-looking overlay · after 90 s auto-blur */}
              {state === 'still-looking' && (
                <View className="absolute inset-0 items-center justify-center rounded-lg bg-warning/10 px-4">
                  <Clock size={28} color="#F2B53B" strokeWidth={1.75} />
                  <Text variant="h3" className="mt-2">
                    Still looking?
                  </Text>
                  <Text
                    variant="body-sm"
                    className="text-fg-secondary text-center mt-1">
                    Tap to reveal again for another 90 seconds, or continue if
                    you've already written everything down.
                  </Text>
                </View>
              )}

              {/* Confirmed badge · after first successful reveal */}
              {state === 'confirmed' && (
                <View className="absolute inset-0 items-center justify-center rounded-lg bg-bg-base/85">
                  <ShieldCheck size={28} color="#3FD68B" strokeWidth={1.75} />
                  <Text variant="h3" className="mt-2">
                    Acknowledged
                  </Text>
                  <Text variant="body-sm" className="text-fg-secondary mt-1">
                    Tap the grid to reveal again, or continue.
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Hide button — explicit dismiss while revealing */}
            {isGridRevealed && (
              <Pressable
                onPress={handleHideTap}
                accessibilityRole="button"
                accessibilityLabel="Hide recovery phrase"
                className="flex-row items-center justify-center gap-2 mt-3 py-3 rounded-md bg-bg-surface-2 border border-bg-surface-3 min-h-touch-min">
                <EyeOff size={16} color="#A8ACB5" strokeWidth={1.75} />
                <Text variant="body-sm" className="text-fg-secondary">
                  Hide now
                </Text>
              </Pressable>
            )}

            {/* Footer hint */}
            <Text variant="caption" className="text-fg-tertiary text-center mt-4">
              Tap to reveal · Hands free to write · Auto-blurs after 90 s
            </Text>
          </ScrollView>

          {/* Sticky bottom · Continue CTA gated by confirmed state */}
          <View className="px-6 pb-8">
            <Button
              label="I've written them down"
              variant="primary"
              onPress={handleContinue}
              disabled={!continueEnabled}
              testID="seed-continue-button"
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

interface WordCellProps {
  index: number;
  word: string;
  revealed: boolean;
}

function WordCell({index, word, revealed}: WordCellProps) {
  return (
    <View className="bg-bg-surface-2 rounded-md px-3 py-2.5 min-h-touch-min flex-row items-center gap-2">
      <Text
        variant="caption"
        numeral
        className="text-fg-tertiary w-5 text-right">
        {index}
      </Text>
      <Text variant="body-sm" className="flex-1" mono>
        {revealed ? word : '••••••'}
      </Text>
    </View>
  );
}

interface PreRevealModalProps {
  onAck: () => void;
}

function PreRevealModal({onAck}: PreRevealModalProps) {
  return (
    <View className="flex-1 justify-center px-6 bg-bg-base/95">
      <Card surface="surface-1" padding="p-6" className="items-center">
        <View className="w-16 h-16 rounded-icon-hero bg-accent-transparent-tint items-center justify-center mb-4 border border-accent-transparent">
          <ShieldCheck size={32} color="#B084FC" strokeWidth={1.75} />
        </View>

        <Text variant="h2" className="text-center mb-3">
          About to show your recovery phrase
        </Text>

        <Text variant="body" className="text-center text-fg-secondary mb-4">
          Move to a private place. Anyone who sees these 24 words can spend
          everything in this wallet, forever.
        </Text>

        <View className="flex-row gap-2 p-3 bg-bg-surface-2 rounded-md mb-5 border border-shield-300/30">
          <AlertCircle size={16} color="#A6F0DC" strokeWidth={1.75} />
          <Text variant="caption" className="text-shield-300 flex-1">
            We can't recover this for you if someone takes it. Screenshots are
            blocked on this screen — your only copy is the one you write by hand.
          </Text>
        </View>

        <View className="w-full gap-3">
          <Button
            label="I'm in a safe place — continue"
            variant="primary"
            onPress={onAck}
            testID="seed-modal-ack-button"
          />
        </View>
      </Card>
    </View>
  );
}
