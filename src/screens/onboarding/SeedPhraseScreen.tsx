import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

interface SeedPhraseScreenProps {
  mnemonic: string;
  onConfirm: () => void;
}

const securityManager = new ScreenSecurityManager();

const WARNINGS = [
  '❗ Never share these words with anyone',
  '❗ Anyone with this phrase controls your funds',
  '❗ Store them offline — never in a photo or cloud',
];

export function SeedPhraseScreen({mnemonic, onConfirm}: SeedPhraseScreenProps) {
  const words = mnemonic.trim().split(/\s+/);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => {
      securityManager.disableSecureScreen();
    };
  }, []);

  const toggleReveal = (index: number) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_SEED_DISPLAYED, 'true');
    onConfirm();
  };

  // Build 8 rows × 3 columns (up to 24 words)
  const rows: number[][] = [];
  for (let row = 0; row < 8; row++) {
    const cols: number[] = [];
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (idx < words.length) {
        cols.push(idx);
      }
    }
    if (cols.length > 0) {
      rows.push(cols);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}>
      {WARNINGS.map((warning, i) => (
        <Text key={i} style={styles.warning}>
          {warning}
        </Text>
      ))}

      <View style={styles.grid}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map(idx => (
              <TouchableOpacity
                key={idx}
                style={styles.wordCell}
                onPress={() => toggleReveal(idx)}>
                <Text style={styles.wordNumber}>{idx + 1}</Text>
                <Text style={styles.wordText}>
                  {revealed.has(idx) ? words[idx] : '•••'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.ctaButton} onPress={handleConfirm}>
        <Text style={styles.ctaButtonText}>I've written them down</Text>
      </TouchableOpacity>
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
  warning: {
    fontSize: 13,
    color: '#FF6B6B',
    marginBottom: 8,
    lineHeight: 18,
  },
  grid: {
    marginTop: 24,
    marginBottom: 32,
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  wordNumber: {
    fontSize: 10,
    color: '#6C6C80',
    marginBottom: 2,
  },
  wordText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  ctaButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
