import React, {useRef, useState} from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

interface ConfirmSeedScreenProps {
  mnemonic: string;
  onSuccess: () => void;
  onBackToSeed: () => void;
}

/** Pick 3 unique random indices from [0, length). */
function pickThreeIndices(length: number): number[] {
  const indices = new Set<number>();
  while (indices.size < 3) {
    indices.add(Math.floor(Math.random() * length));
  }
  // Return sorted so the instruction reads naturally
  return Array.from(indices).sort((a, b) => a - b);
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
}: ConfirmSeedScreenProps) {
  const words = mnemonic.trim().split(/\s+/);

  // Lazy-initialize so indices and shuffled order are stable across re-renders
  const [chosenIndices] = useState<number[]>(() => pickThreeIndices(words.length));
  const [shuffledWords] = useState<string[]>(() => shuffle(words));

  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [confirmedIndices, setConfirmedIndices] = useState<Set<number>>(new Set());
  const [failureCount, setFailureCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {toValue: -10, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: -10, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: true}),
    ]).start();
  };

  const requiredWords = chosenIndices.map(i => words[i]);

  // Human-readable positions (1-indexed)
  const positionLabels = chosenIndices.map(i => `#${i + 1}`).join(', ');
  const instructionText = `Select word ${positionLabels}`;

  const handleWordPress = (word: string, flatIdx: number) => {
    if (confirmedIndices.has(flatIdx)) return; // Already confirmed — ignore
    const nextSelected = [...selectedWords, word];
    const step = selectedWords.length; // 0-based index of the word we're currently verifying
    const expectedWord = requiredWords[step];

    if (word === expectedWord) {
      const nextConfirmed = new Set(confirmedIndices);
      nextConfirmed.add(flatIdx);
      setConfirmedIndices(nextConfirmed);

      if (nextSelected.length === 3) {
        // All 3 correct
        mmkvPublic.set(MMKV_KEYS.ONBOARDING_SEED_CONFIRMED, 'true');
        onSuccess();
      } else {
        setSelectedWords(nextSelected);
        setError(null);
      }
    } else {
      // Wrong tap
      const newFailures = failureCount + 1;
      setFailureCount(newFailures);
      setSelectedWords([]);
      setConfirmedIndices(new Set());
      setError('Incorrect — try again');
      triggerShake();

      if (newFailures >= 3) {
        onBackToSeed();
      }
    }
  };

  // Build rows of 3 for the grid; keep flat index for testID
  const rows: {word: string; flatIdx: number}[][] = [];
  for (let r = 0; r < Math.ceil(shuffledWords.length / 3); r++) {
    const row = shuffledWords.slice(r * 3, r * 3 + 3).map((word, col) => ({
      word,
      flatIdx: r * 3 + col,
    }));
    rows.push(row);
  }

  const progressLabel = `${selectedWords.length} / 3 selected`;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.instruction}>{instructionText}</Text>

      <Animated.View style={{transform: [{translateX: shakeAnim}]}}>
        <Text style={styles.progress}>{progressLabel}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Animated.View>

      <View style={styles.grid}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map(({word, flatIdx}) => {
              const isConfirmed = confirmedIndices.has(flatIdx);
              return (
                <TouchableOpacity
                  key={flatIdx}
                  testID={`word-cell-${flatIdx}`}
                  style={[styles.wordCell, isConfirmed && styles.wordCellConfirmed]}
                  onPress={() => handleWordPress(word, flatIdx)}
                  disabled={isConfirmed}>
                  <Text style={[styles.wordText, isConfirmed && styles.wordTextConfirmed]}>
                    {word}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0C0C14',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  instruction: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  progress: {
    fontSize: 13,
    color: '#6C6C80',
    textAlign: 'center',
    marginBottom: 16,
  },
  error: {
    fontSize: 13,
    color: '#F87171',
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  wordCell: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E2E44',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  wordCellConfirmed: {
    backgroundColor: '#1B2D1B',
    borderColor: '#44FF44',
  },
  wordText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  wordTextConfirmed: {
    color: '#44FF44',
  },
});
