import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View, Pressable, Share, TextInput, ScrollView, Vibration} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import {ArrowLeft, Share2, Copy, Check, X, AlertTriangle} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {cn} from '../../utils/cn';

const NOC_LOGO = require('../../assets/tokens/noc-logo.png');

/**
 * #13 Receive — Phase B migration · mirror /home/user/Downloads/index.html §s13
 *
 * Sections (top to bottom):
 *   - Top bar (back · "Receive" title · share icon)
 *   - Mode strip overline ("Transparent · public address" / pay request)
 *   - QR card · 240 dp real QR (react-native-qrcode-svg) + NOC monogram
 *     center + URI helper line; renders solana: URI when amount empty, falls
 *     back to pay-request URI with amount param when amount provided.
 *   - Address card · full mono address (untruncated · DS §1) · tap to copy
 *     with 30 s auto-clear · success border + ✓ icon while copy is active.
 *   - Amount card · optional decimal-pad input · accent border when amount > 0
 *     · clear-X button to wipe.
 *   - Sticky bar · [Copy address/link] secondary + [Share] primary
 *
 * Clipboard policy: 30 s `setTimeout(clear)` — NO AppState background-wipe
 * (per `feedback_clipboard_no_background_clear`, the address is public data
 * and clearing on backround sabotages the legitimate paste-into-other-app
 * flow).
 *
 * No FLAG_SECURE (public address is shareable by definition).
 *
 * Deferred:
 *   - Shielded payment-code variant (#13.shielded) — separate when ZK lands
 *   - Solana Pay URI label param (`?label=Noctura&message=…`)
 *   - Fiat estimate next to amount (needs price oracle)
 */

interface ReceiveScreenProps {
  address: string;
  onBack?: () => void;
}

const CLIPBOARD_CLEAR_MS = 30_000;
const COPIED_FEEDBACK_MS = 2_000;

function buildUri(address: string, amount: string): string {
  const cleaned = amount.trim();
  if (!cleaned) return `solana:${address}`;
  // Solana Pay URI · spec: solana:<recipient>?amount=N&label=Noctura
  return `solana:${address}?amount=${encodeURIComponent(cleaned)}&label=Noctura`;
}

function truncateMiddle(s: string, head = 8, tail = 8): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function ReceiveScreen({address, onBack}: ReceiveScreenProps) {
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const hasAddress = address.trim().length > 0;

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const uri = useMemo(() => buildUri(address, amount), [address, amount]);
  const isPayRequest = amount.trim().length > 0;
  const uriTruncated = useMemo(() => truncateMiddle(uri, 12, 6), [uri]);

  const stopCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  }, []);

  const handleCopy = useCallback(
    (payload: string) => {
      Clipboard.setString(payload);
      Vibration.vibrate(30);
      setCopied(true);

      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

      // 30 s clipboard auto-clear + visible countdown
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      stopCountdown();

      setCountdown(Math.ceil(CLIPBOARD_CLEAR_MS / 1000));
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      clearTimerRef.current = setTimeout(() => {
        Clipboard.setString('');
        clearTimerRef.current = null;
      }, CLIPBOARD_CLEAR_MS);
    },
    [stopCountdown],
  );

  const handleCopyAddress = useCallback(() => {
    handleCopy(isPayRequest ? uri : address);
  }, [handleCopy, address, isPayRequest, uri]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: isPayRequest ? uri : address,
        title: isPayRequest ? 'Noctura payment request' : 'My Solana address',
      });
    } catch {
      // user cancelled
    }
  }, [address, isPayRequest, uri]);

  const handleClearAmount = useCallback(() => {
    setAmount('');
  }, []);

  // Empty-state guard — if wallet hasn't loaded publicKey yet (cold-launch
  // race, broken persist, etc.) show a clear error instead of an empty QR
  // and silent copy that does nothing.
  if (!hasAddress) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        className="flex-1 bg-bg-base">
        <View className="flex-row items-center px-4 py-3 min-h-touch-min">
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-12 h-12 items-center justify-center -ml-2">
            <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
          <Text variant="h1" className="ml-1 flex-1">
            Receive
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-icon-hero bg-[rgba(255,92,106,0.18)] items-center justify-center mb-5">
            <AlertTriangle size={36} color="#FF5C6A" strokeWidth={1.75} />
          </View>
          <Text variant="h2" className="text-center mb-2">
            No wallet address
          </Text>
          <Text variant="body" className="text-center text-fg-secondary max-w-sm">
            Your wallet hasn't finished loading. Try restarting the app, or
            re-import your recovery phrase from Welcome.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
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
          <View className="w-12 h-12 -ml-2" />
        )}
        <Text variant="h1" className="ml-1 flex-1">
          Receive
        </Text>
        <Pressable
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share"
          className="w-12 h-12 items-center justify-center -mr-2">
          <Share2 size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Mode strip eyebrow */}
        <Text variant="overline" className="mb-3">
          {isPayRequest ? 'Transparent · pay request' : 'Transparent · public address'}
        </Text>

        {/* QR card */}
        <View className="bg-bg-surface-1 rounded-lg border border-bg-surface-3 p-5 items-center mb-4">
          {isPayRequest ? (
            <View className="mb-4 px-3 py-1.5 rounded-pill bg-accent-transparent-tint border border-accent-transparent">
              <Text variant="caption" numeral className="text-accent-transparent font-geist-semibold">
                PAY · {amount} SOL
              </Text>
            </View>
          ) : null}

          {/* Real QR code · white background per QR scanner contrast requirement.
           * NOC logo in center (ECC-H = 30% error correction tolerates the
           * overlay). */}
          <View className="bg-white rounded-md p-3">
            <QRCode
              value={uri}
              size={200}
              backgroundColor="#FFFFFF"
              color="#000000"
              ecl="H"
              logo={NOC_LOGO}
              logoSize={40}
              logoBackgroundColor="#FFFFFF"
              logoBorderRadius={8}
              logoMargin={4}
            />
          </View>

          {/* URI helper line */}
          <Text variant="caption" className="text-fg-tertiary mt-3" numberOfLines={1}>
            URI ·{' '}
            <Text variant="caption" mono className="text-fg-secondary">
              {uriTruncated}
            </Text>
          </Text>
        </View>

        {/* Address card · tap to copy */}
        <Pressable
          onPress={() => handleCopy(address)}
          accessibilityRole="button"
          accessibilityLabel="Copy wallet address"
          testID="copy-address-card"
          className={cn(
            'rounded-lg p-4 mb-4 border',
            copied
              ? 'border-success bg-[rgba(63,214,139,0.06)]'
              : 'border-bg-surface-3 bg-bg-surface-1 active:bg-bg-surface-2',
          )}>
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              {copied ? (
                <Check size={14} color="#3FD68B" strokeWidth={2.5} />
              ) : null}
              <Text
                variant="overline"
                className={copied ? 'text-success' : ''}>
                {copied ? 'Copied to clipboard' : 'Wallet address'}
              </Text>
            </View>
            <Text variant="caption" numeral className="text-fg-tertiary">
              {countdown !== null ? `auto-clears in ${countdown} s` : 'tap to copy'}
            </Text>
          </View>
          <Text variant="body-sm" mono selectable className="text-fg-primary">
            {address}
          </Text>
        </Pressable>

        {/* Amount card · optional pay-request */}
        <View
          className={cn(
            'rounded-lg p-4 mb-4 border',
            isPayRequest
              ? 'border-accent-transparent bg-bg-surface-1'
              : 'border-bg-surface-3 bg-bg-surface-1',
          )}>
          <View className="flex-row items-center justify-between mb-2">
            <Text
              variant="overline"
              className={isPayRequest ? 'text-accent-transparent' : ''}>
              {isPayRequest ? 'Requested amount' : 'Request amount (optional)'}
            </Text>
            {isPayRequest ? (
              <Pressable
                onPress={handleClearAmount}
                accessibilityRole="button"
                accessibilityLabel="Clear amount"
                className="w-8 h-8 items-center justify-center rounded-pill active:bg-bg-surface-2">
                <X size={14} color="#A8ACB5" strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          <View className="flex-row items-baseline gap-2">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.0"
              placeholderTextColor="#6E727A"
              keyboardType="decimal-pad"
              accessibilityLabel="Request amount"
              className="flex-1 font-geist text-balance-md text-fg-primary"
            />
            <Text variant="body" className="text-fg-secondary">
              SOL
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom CTAs · row */}
      <View className="px-6 pb-8 pt-2 flex-row gap-3 border-t border-bg-surface-2 bg-bg-base">
        <Pressable
          onPress={handleCopyAddress}
          accessibilityRole="button"
          accessibilityLabel={isPayRequest ? 'Copy link' : 'Copy address'}
          className="flex-1 min-h-touch-rec rounded-pill bg-bg-surface-2 items-center justify-center flex-row gap-2 active:opacity-80">
          {copied ? (
            <Check size={18} color="#F4F5F7" strokeWidth={2} />
          ) : (
            <Copy size={18} color="#F4F5F7" strokeWidth={1.75} />
          )}
          <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
            {copied ? 'Copied' : isPayRequest ? 'Copy link' : 'Copy address'}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel={isPayRequest ? 'Share request' : 'Share'}
          className="flex-1 min-h-touch-rec rounded-pill bg-accent-transparent items-center justify-center flex-row gap-2 active:opacity-90">
          <Share2 size={18} color="#0A0A0A" strokeWidth={2} />
          <Text variant="body-lg" className="font-geist-semibold text-bg-base">
            {isPayRequest ? 'Share request' : 'Share'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
