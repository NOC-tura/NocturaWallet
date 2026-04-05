import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {validateMnemonic} from '../../modules/keyDerivation/mnemonicUtils';

interface ImportSeedScreenProps {
  onMnemonicValidated: (mnemonic: string) => void;
}

const securityManager = new ScreenSecurityManager();

function getWordCount(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export function ImportSeedScreen({onMnemonicValidated}: ImportSeedScreenProps) {
  const [input, setInput] = useState('');

  const wordCount = getWordCount(input);
  const hasWords = wordCount > 0;
  const isExpectedLength = wordCount === 12 || wordCount === 24;
  const isValid = isExpectedLength && validateMnemonic(input.trim());
  const showError = hasWords && !isValid;

  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => {
      securityManager.disableSecureScreen();
    };
  }, []);

  const handleContinue = () => {
    if (isValid) {
      onMnemonicValidated(input.trim());
    }
  };

  let statusText = '';
  let statusColor = '#6C6C80';
  if (hasWords) {
    if (isValid) {
      statusText = `${wordCount} words · Valid recovery phrase`;
      statusColor = '#22C55E';
    } else if (isExpectedLength) {
      statusText = `${wordCount} words · Invalid recovery phrase`;
      statusColor = '#FF6B6B';
    } else {
      statusText = `${wordCount} word${wordCount !== 1 ? 's' : ''} · Enter 12 or 24 words`;
      statusColor = '#F59E0B';
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Import Recovery Phrase</Text>
      <Text style={styles.subtitle}>
        Enter your 12 or 24-word recovery phrase, separated by spaces.
      </Text>

      <View
        style={[
          styles.inputWrapper,
          showError && !isExpectedLength && styles.inputWrapperNeutral,
          isExpectedLength && !isValid && styles.inputWrapperError,
          isValid && styles.inputWrapperValid,
        ]}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="word1 word2 word3 ..."
          placeholderTextColor="#4A4A60"
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          returnKeyType="done"
          accessibilityLabel="Recovery phrase input"
        />
      </View>

      {hasWords && (
        <Text style={[styles.statusText, {color: statusColor}]}>
          {statusText}
        </Text>
      )}

      {isExpectedLength && !isValid && (
        <Text style={styles.errorText}>Invalid recovery phrase</Text>
      )}

      <TouchableOpacity
        style={[styles.ctaButton, !isValid && styles.ctaButtonDisabled]}
        onPress={handleContinue}
        disabled={!isValid}
        accessibilityRole="button"
        accessibilityState={{disabled: !isValid}}>
        <Text style={styles.ctaButtonText}>Continue</Text>
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
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#9999B3',
    lineHeight: 20,
    marginBottom: 28,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: '#2E2E44',
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    padding: 14,
    minHeight: 130,
    marginBottom: 8,
  },
  inputWrapperNeutral: {
    borderColor: '#2E2E44',
  },
  inputWrapperError: {
    borderColor: '#FF6B6B',
  },
  inputWrapperValid: {
    borderColor: '#22C55E',
  },
  textInput: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    minHeight: 100,
  },
  statusText: {
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#FF6B6B',
    marginBottom: 4,
  },
  ctaButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  ctaButtonDisabled: {
    opacity: 0.4,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
