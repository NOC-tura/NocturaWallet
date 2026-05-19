import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Pressable,
  TextInput,
  ScrollView,
  Vibration,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  ArrowLeft,
  ShieldCheck,
  ClipboardCheck,
  AlertTriangle,
  Check,
} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {validateMnemonic} from '../../modules/keyDerivation/mnemonicUtils';
import {cn} from '../../utils/cn';

/**
 * #8 Import — Phase B migration · mirror /home/user/Downloads/index.html §s8
 *
 * Scope: Recovery phrase tab ONLY. Backup-file tab deferred until encrypted
 * backup export ships (Phase 3 settings). No segmented control rendered while
 * only one mode is functional — better than a dead/disabled tab that signals
 * broken UX.
 *
 * Layout:
 *   - Top bar (back + "Import wallet" title, no step counter)
 *   - Lede: "Bring an existing wallet onto this device."
 *   - Shield banner: "Screenshots disabled · pasted phrase auto-clears from clipboard."
 *   - Paste-detected toast (transient, 3 s)
 *   - Multiline textarea
 *   - Validation status line (success/warning/danger)
 *   - Idle-timer warning banner (after 60 s no activity → 12 s countdown → wipe)
 *   - Sticky CTA "Continue" (disabled until valid 12 / 24-word BIP-39 phrase)
 *
 * Security:
 *   - FLAG_SECURE on mount (existing ScreenSecurityManager)
 *   - Paste detection: compare onChangeText delta with clipboard contents;
 *     match → immediate Clipboard.setString('') + 3 s toast
 *   - Idle timer: 60 s of inactivity → warning banner → 12 s countdown → field wiped
 *   - "Keep working" tertiary resets the timer
 *
 * Persistence:
 *   - On valid → onMnemonicValidated(trimmed). Downstream (Navigator) routes
 *     into SetPin → BiometricSetup → Success which performs the actual
 *     keychain storage + Zustand setPublicKey + MMKV flags.
 */

interface ImportSeedScreenProps {
  onMnemonicValidated: (mnemonic: string) => void;
  onBack?: () => void;
}

const securityManager = new ScreenSecurityManager();

const IDLE_TIMEOUT_MS = 60_000;
const IDLE_COUNTDOWN_MS = 12_000;
const PASTE_TOAST_MS = 3_000;
const PASTE_HEURISTIC_MIN_CHARS = 20;

function getWords(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  return trimmed.split(/\s+/).filter(w => w.length > 0);
}

type ValidationKind =
  | {kind: 'empty'}
  | {kind: 'partial-under-12'; count: number}
  | {kind: 'partial-13-to-23'; count: number}
  | {kind: 'too-many'; count: number}
  | {kind: 'invalid-checksum-12'; count: number}
  | {kind: 'invalid-checksum-24'; count: number}
  | {kind: 'valid'; count: number};

function validate(input: string): ValidationKind {
  const words = getWords(input);
  if (words.length === 0) return {kind: 'empty'};
  if (words.length < 12) return {kind: 'partial-under-12', count: words.length};
  if (words.length > 24) return {kind: 'too-many', count: words.length};
  if (words.length !== 12 && words.length !== 24) {
    return {kind: 'partial-13-to-23', count: words.length};
  }
  if (validateMnemonic(words.join(' '))) {
    return {kind: 'valid', count: words.length};
  }
  if (words.length === 12) return {kind: 'invalid-checksum-12', count: 12};
  return {kind: 'invalid-checksum-24', count: 24};
}

export function ImportSeedScreen({onMnemonicValidated, onBack}: ImportSeedScreenProps) {
  const [input, setInput] = useState('');
  const [pasteToastVisible, setPasteToastVisible] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState<number | null>(null);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pasteToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInputLenRef = useRef(0);

  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => {
      securityManager.disableSecureScreen();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (pasteToastTimerRef.current) clearTimeout(pasteToastTimerRef.current);
    };
  }, []);

  const clearIdleTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setIdleCountdown(null);
  }, []);

  // Start the idle countdown — 12 s visible warning, ticks down each second.
  const startIdleCountdown = useCallback(() => {
    setIdleCountdown(Math.ceil(IDLE_COUNTDOWN_MS / 1000));
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setIdleCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          // Reached zero — wipe field, bury banner
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setInput('');
          lastInputLenRef.current = 0;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Reset / arm the 60 s idle timer. Called on every input change while text exists.
  const armIdleTimer = useCallback(
    (textPresent: boolean) => {
      clearIdleTimers();
      if (!textPresent) return;
      idleTimerRef.current = setTimeout(() => {
        startIdleCountdown();
      }, IDLE_TIMEOUT_MS);
    },
    [clearIdleTimers, startIdleCountdown],
  );

  // Paste detection: if input grew by ≥ 20 chars in one event AND clipboard
  // contents are contained in the new input, it's a paste. Wipe clipboard,
  // show transient toast.
  const detectPasteAndWipe = useCallback(async (newText: string, prevLen: number) => {
    const delta = newText.length - prevLen;
    if (delta < PASTE_HEURISTIC_MIN_CHARS) return;
    try {
      const clip = await Clipboard.getString();
      if (clip && clip.length >= PASTE_HEURISTIC_MIN_CHARS && newText.includes(clip)) {
        Clipboard.setString('');
        Vibration.vibrate(30);
        setPasteToastVisible(true);
        if (pasteToastTimerRef.current) clearTimeout(pasteToastTimerRef.current);
        pasteToastTimerRef.current = setTimeout(() => {
          setPasteToastVisible(false);
        }, PASTE_TOAST_MS);
      }
    } catch {
      // best-effort — clipboard access failed
    }
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      const prevLen = lastInputLenRef.current;
      lastInputLenRef.current = text.length;
      setInput(text);
      armIdleTimer(text.trim().length > 0);
      detectPasteAndWipe(text, prevLen);
    },
    [armIdleTimer, detectPasteAndWipe],
  );

  const handleResetIdle = useCallback(() => {
    armIdleTimer(input.trim().length > 0);
  }, [armIdleTimer, input]);

  const handleContinue = () => {
    const v = validate(input);
    if (v.kind === 'valid') {
      clearIdleTimers();
      onMnemonicValidated(input.trim().split(/\s+/).join(' '));
    }
  };

  const v = validate(input);
  const ctaEnabled = v.kind === 'valid';

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
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
        <Text variant="h2" className="ml-1 flex-1">
          Import wallet
        </Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow pb-4"
        showsVerticalScrollIndicator={false}>
        {/* Lede */}
        <View className="px-5 mb-4">
          <Text variant="body" className="text-fg-secondary">
            Bring an existing wallet onto this device.
          </Text>
        </View>

        {/* Shield banner (permanent, security context) */}
        <View className="px-5 mb-3">
          <View className="flex-row items-start gap-3 p-4 rounded-md bg-bg-surface-2 border-l-2 border-l-shield-300">
            <ShieldCheck size={18} color="#A6F0DC" strokeWidth={1.75} />
            <Text variant="caption" className="flex-1 text-fg-primary">
              Screenshots disabled · pasted phrase auto-clears from clipboard.
            </Text>
          </View>
        </View>

        {/* Paste-detected toast (transient) */}
        {pasteToastVisible ? (
          <View className="px-5 mb-3">
            <View className="flex-row items-start gap-3 p-4 rounded-md bg-bg-surface-2 border-l-2 border-l-info">
              <ClipboardCheck size={18} color="#7DA8FF" strokeWidth={1.75} />
              <Text variant="body-sm" className="flex-1 text-fg-primary">
                Pasted from clipboard · clipboard cleared.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Idle-timer warning banner */}
        {idleCountdown !== null ? (
          <View className="px-5 mb-3">
            <View className="flex-row items-start gap-3 p-4 rounded-md bg-bg-surface-2 border-l-2 border-l-warning">
              <AlertTriangle size={18} color="#F2B53B" strokeWidth={1.75} />
              <View className="flex-1">
                <Text variant="body-sm" className="text-fg-primary font-geist-semibold">
                  Auto-clearing in {idleCountdown} s
                </Text>
                <Text variant="caption" className="text-fg-secondary mt-1">
                  No activity for 60 s — phrase will be wiped from this field.
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Textarea wrapper */}
        <View className="px-5 mb-2">
          <View
            className={cn(
              'rounded-md border bg-bg-surface-1 p-4 min-h-[160px]',
              v.kind === 'valid' && 'border-success',
              (v.kind === 'invalid-checksum-12' ||
                v.kind === 'invalid-checksum-24' ||
                v.kind === 'too-many') &&
                'border-danger',
              (v.kind === 'empty' ||
                v.kind === 'partial-under-12' ||
                v.kind === 'partial-13-to-23') &&
                'border-bg-surface-3',
            )}>
            <TextInput
              value={input}
              onChangeText={handleChangeText}
              placeholder="word1 word2 word3 …"
              placeholderTextColor="#6E727A"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              accessibilityLabel="Recovery phrase input"
              className="font-geist-mono text-body-sm text-fg-primary min-h-[120px]"
              style={{
                textAlignVertical: 'top',
              }}
            />
          </View>
        </View>

        {/* Validation status */}
        <View className="px-5 mb-3 min-h-[24px]">
          {v.kind === 'valid' ? (
            <View className="flex-row items-center gap-2">
              <Check size={14} color="#3FD68B" strokeWidth={2.5} />
              <Text variant="caption" className="text-success">
                Valid {v.count}-word BIP-39 phrase · checksum OK
              </Text>
            </View>
          ) : v.kind === 'invalid-checksum-12' ? (
            <Text variant="caption" className="text-danger">
              12 words · checksum failed. If your phrase has 24 words, enter all 24.
            </Text>
          ) : v.kind === 'invalid-checksum-24' ? (
            <Text variant="caption" className="text-danger">
              24 words · checksum failed — check word spelling and order
            </Text>
          ) : v.kind === 'partial-13-to-23' ? (
            <Text variant="caption" numeral className="text-fg-tertiary">
              {v.count} of 24 words entered
            </Text>
          ) : v.kind === 'partial-under-12' ? (
            <Text variant="caption" numeral className="text-fg-tertiary">
              {v.count} words entered · need 12 or 24
            </Text>
          ) : v.kind === 'too-many' ? (
            <Text variant="caption" className="text-danger">
              Too many words — phrase is 12 or 24 words
            </Text>
          ) : null}
        </View>

        <View className="flex-1" />
      </ScrollView>

      {/* Sticky CTAs */}
      <View className="px-6 pb-8 pt-2 gap-2">
        <Button
          label="Continue"
          variant="primary"
          onPress={handleContinue}
          disabled={!ctaEnabled}
        />
        {idleCountdown !== null ? (
          <Button
            label="Keep working — reset timer"
            variant="tertiary"
            onPress={handleResetIdle}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
