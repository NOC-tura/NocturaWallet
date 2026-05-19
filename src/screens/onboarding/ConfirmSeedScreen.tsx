import React, {useEffect, useRef, useState, useCallback} from 'react';
import {View, ScrollView, Pressable, Animated, Vibration} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {wordlist} from '@scure/bip39/wordlists/english.js';
import {ArrowLeft, AlertCircle, Check} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {cn} from '../../utils/cn';

/**
 * #4 ConfirmSeed — Phase B migration · mirror /home/user/Downloads/index.html §s4
 *
 * 3 random slots from the 24-word mnemonic · 9-word pool (3 correct + 6
 * BIP-39 distractors). Reset on wrong answer with 320 ms shake animation.
 * Auto-reset slots ~700 ms after wrong tap so the user can try again.
 *
 * FLAG_SECURE on mount (seed words still in scope as distractor labels).
 *
 * 4-state machine:
 *   - empty           · all 3 slots placeholder; Confirm disabled
 *   - partial-correct · 1+ slots filled correctly; used pool buttons dim
 *   - wrong-answer    · wrong tap · slot flips --danger + shake + helper text
 *   - success         · all 3 correct · full-screen celebratory layout
 *
 * Anti-brute-force safety net preserved from legacy: after 3 cumulative wrong
 * attempts, route back to seed-display so the user re-views the phrase. This
 * protects against accidental confirm-without-writing-down. NOT in design spec
 * but kept as a security backstop.
 */

interface ConfirmSeedScreenProps {
  mnemonic: string;
  onSuccess: () => void;
  onBackToSeed: () => void;
  onBack?: () => void;
}

type ConfirmState = 'empty' | 'partial' | 'wrong' | 'success';

const SLOT_COUNT = 3;
const POOL_SIZE = 9;
const DISTRACTOR_COUNT = POOL_SIZE - SLOT_COUNT; // 6
const AUTO_RESET_MS = 700;
const MAX_FAILURES = 3;

const securityManager = new ScreenSecurityManager();

/** Pick N unique random indices from [0, length). */
function pickRandomIndices(length: number, n: number): number[] {
  const set = new Set<number>();
  while (set.size < n) {
    set.add(Math.floor(Math.random() * length));
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Pick N random words from BIP-39 wordlist that are NOT in `exclude` set. */
function pickDistractors(exclude: Set<string>, n: number): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  while (result.length < n) {
    const word = wordlist[Math.floor(Math.random() * wordlist.length)];
    if (!exclude.has(word) && !seen.has(word)) {
      seen.add(word);
      result.push(word);
    }
  }
  return result;
}

/** Fisher-Yates shuffle — returns a new array. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ConfirmSeedScreen({
  mnemonic,
  onSuccess,
  onBackToSeed,
  onBack,
}: ConfirmSeedScreenProps) {
  const words = mnemonic.trim().split(/\s+/);

  // Stable across re-renders — chosen slots, pool, and shuffle order set once.
  const [chosenPositions] = useState<number[]>(() => pickRandomIndices(words.length, SLOT_COUNT));
  const correctWords = chosenPositions.map(i => words[i]);
  const [pool] = useState<string[]>(() => {
    const distractors = pickDistractors(new Set(words), DISTRACTOR_COUNT);
    return shuffle([...correctWords, ...distractors]);
  });

  const [filledSlots, setFilledSlots] = useState<Array<string | null>>([null, null, null]);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [state, setState] = useState<ConfirmState>('empty');
  const [wrongSlotIndex, setWrongSlotIndex] = useState<number | null>(null);
  const [wrongWord, setWrongWord] = useState<string | null>(null);
  const [failureCount, setFailureCount] = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FLAG_SECURE on mount (seed words present in pool as distractor pool)
  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => {
      securityManager.disableSecureScreen();
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const runShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, {toValue: -8, duration: 60, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 8, duration: 60, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: -6, duration: 60, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 6, duration: 60, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 0, duration: 80, useNativeDriver: true}),
    ]).start();
  }, [shakeAnim]);

  const handleWordPress = useCallback(
    (word: string) => {
      if (state === 'wrong' || state === 'success') return;
      if (usedWords.has(word)) return;

      // Find next empty slot
      const nextSlotIdx = filledSlots.findIndex(s => s === null);
      if (nextSlotIdx === -1) return;

      const expectedWord = correctWords[nextSlotIdx];
      const isCorrect = word === expectedWord;

      if (isCorrect) {
        const newFilled = [...filledSlots];
        newFilled[nextSlotIdx] = word;
        const newUsed = new Set(usedWords);
        newUsed.add(word);

        setFilledSlots(newFilled);
        setUsedWords(newUsed);

        // Check if all slots filled correctly
        if (newFilled.every(s => s !== null)) {
          mmkvPublic.set(MMKV_KEYS.ONBOARDING_SEED_CONFIRMED, 'true');
          setState('success');
        } else {
          setState('partial');
        }
      } else {
        // Wrong tap — fill slot visually with red, shake, then auto-reset
        const newFilled = [...filledSlots];
        newFilled[nextSlotIdx] = word;
        setFilledSlots(newFilled);
        setWrongSlotIndex(nextSlotIdx);
        setWrongWord(word);
        setState('wrong');
        runShake();
        Vibration.vibrate(80);

        const newFailures = failureCount + 1;
        setFailureCount(newFailures);

        // Auto-reset after 700 ms
        resetTimerRef.current = setTimeout(() => {
          if (newFailures >= MAX_FAILURES) {
            // Anti-brute-force: route back to seed display
            onBackToSeed();
          } else {
            setFilledSlots([null, null, null]);
            setUsedWords(new Set());
            setWrongSlotIndex(null);
            setWrongWord(null);
            setState('empty');
          }
        }, AUTO_RESET_MS);
      }
    },
    [state, filledSlots, usedWords, correctWords, failureCount, runShake, onBackToSeed],
  );

  // Success state — full-screen layout replaces slot/pool
  if (state === 'success') {
    return (
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        className="flex-1 bg-bg-base">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-24 h-24 rounded-pill bg-success/15 items-center justify-center mb-5 border-2 border-success">
            <Check size={36} color="#3FD68B" strokeWidth={2.5} />
          </View>
          <Text variant="h2" className="text-center mb-2">
            Phrase verified
          </Text>
          <Text variant="body" className="text-center text-fg-secondary max-w-xs">
            All three words matched. Now lock the wallet with a PIN.
          </Text>
        </View>
        <View className="px-6 pb-8">
          <Button
            label="Continue"
            variant="primary"
            onPress={onSuccess}
            testID="confirm-seed-success-continue"
          />
        </View>
      </SafeAreaView>
    );
  }

  const allFilled = filledSlots.every(s => s !== null);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar — back · eyebrow · step */}
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
          3 / 5
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-3 pb-6"
        showsVerticalScrollIndicator={false}>
        <Text variant="h1" className="mb-2">
          Confirm phrase
        </Text>
        {state === 'wrong' ? (
          <Text variant="body" className="text-danger mb-4">
            That's not the right word — let's start over.
          </Text>
        ) : (
          <Text variant="body" className="text-fg-secondary mb-4">
            Tap the correct word for each position.
          </Text>
        )}

        {/* 3 slots with animated shake */}
        <Animated.View
          style={{transform: [{translateX: shakeAnim}]}}
          className="gap-2 mb-3">
          {chosenPositions.map((pos, slotIdx) => {
            const filled = filledSlots[slotIdx];
            const isWrong = state === 'wrong' && wrongSlotIndex === slotIdx;
            const isCorrect = !!filled && !isWrong && state !== 'wrong';

            return (
              <View
                key={slotIdx}
                className={cn(
                  'flex-row items-center justify-between px-4 py-3 rounded-md min-h-touch-min',
                  'bg-bg-surface-2',
                  isCorrect && filled && 'border border-success',
                  isWrong && 'border border-danger',
                  !filled && !isWrong && 'border border-bg-surface-3',
                )}>
                <Text variant="body-sm" className="text-fg-secondary">
                  Word{' '}
                  <Text variant="body-sm" numeral className="text-fg-secondary">
                    #{pos + 1}
                  </Text>
                </Text>
                <Text
                  mono
                  variant="body-sm"
                  className={cn(
                    !filled && 'text-fg-disabled',
                    isWrong && 'text-danger',
                    isCorrect && 'text-fg-primary',
                  )}>
                  {filled ?? '— select —'}
                </Text>
              </View>
            );
          })}
        </Animated.View>

        {state === 'wrong' && wrongSlotIndex !== null && (
          <View className="flex-row gap-2 items-start mb-3">
            <AlertCircle size={14} color="#FF5C6A" strokeWidth={2} className="mt-0.5" />
            <Text variant="caption" className="text-danger flex-1">
              Word #{chosenPositions[wrongSlotIndex] + 1} was wrong. Slots will
              reset in a moment.
            </Text>
          </View>
        )}

        {/* 9-word pool · 3-col grid · 48 dp height */}
        <View className="flex-row flex-wrap gap-2 mt-2">
          {pool.map((word, idx) => {
            const isUsed = usedWords.has(word);
            const isWrongWord = state === 'wrong' && wrongWord === word;
            // state === 'success' branch already returned earlier; TS narrows
            // `state` to 'empty' | 'partial' | 'wrong' here.
            const isDisabled = isUsed || state === 'wrong';

            return (
              <Pressable
                key={`${word}-${idx}`}
                onPress={() => handleWordPress(word)}
                disabled={isDisabled}
                testID={`word-cell-${idx}`}
                accessibilityRole="button"
                accessibilityLabel={`Select word ${word}`}
                accessibilityState={{disabled: isDisabled}}
                className={cn(
                  'rounded-md px-3 min-h-touch-min items-center justify-center',
                  // 3-column grid: (100% - 2*gap) / 3 ≈ 30.5% per cell
                  'flex-grow basis-[30%]',
                  isUsed && !isWrongWord && 'bg-bg-surface-2 opacity-40',
                  isWrongWord && 'bg-bg-surface-2 border border-danger',
                  !isUsed && !isWrongWord && 'bg-bg-surface-1 border border-bg-surface-3 active:bg-bg-surface-2',
                )}>
                <Text
                  mono
                  variant="body-sm"
                  className={cn(
                    isWrongWord && 'text-danger',
                    isUsed && !isWrongWord && 'text-fg-disabled',
                    !isUsed && !isWrongWord && 'text-fg-primary',
                  )}>
                  {word}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {failureCount > 0 && failureCount < MAX_FAILURES && (
          <Text variant="caption" className="text-fg-tertiary text-center mt-4">
            Attempts remaining:{' '}
            <Text variant="caption" numeral className="text-fg-tertiary">
              {MAX_FAILURES - failureCount}
            </Text>
          </Text>
        )}
      </ScrollView>

      {/* Sticky bottom — Confirm (disabled until all 3 slots filled correctly) */}
      <View className="px-6 pb-8">
        <Button
          label="Confirm"
          variant="primary"
          onPress={() => {
            // Confirm button is decorative when in partial-correct state · onSuccess
            // is triggered automatically when the 3rd correct word is tapped.
            if (allFilled && state === 'partial') {
              mmkvPublic.set(MMKV_KEYS.ONBOARDING_SEED_CONFIRMED, 'true');
              setState('success');
            }
          }}
          disabled={!allFilled || state !== 'partial'}
          testID="confirm-seed-button"
        />
      </View>
    </SafeAreaView>
  );
}
