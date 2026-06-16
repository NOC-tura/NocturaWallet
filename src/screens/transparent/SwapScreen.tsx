import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ArrowUpDown, Check, X} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {TokenLogo} from '../../components/TokenLogo';
import {cn} from '../../utils/cn';
import {formatBalanceForDisplay, formatTokenAmount, parseTokenAmount} from '../../utils/parseTokenAmount';
import {getExplorerUrl} from '../../utils/explorerUrl';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useSwapQuote} from '../../hooks/useSwapQuote';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {SWAP_TOKENS} from '../../modules/swap/swapTokens';
import {TokenPickerSheet} from '../../components/TokenPickerSheet';

// ── Lazy imports — wrapped in try/catch so Jest/stub envs don't crash ─────────
let submitSwap:
  | typeof import('../../modules/swap/submitSwap').submitSwap
  | null = null;
let loadTransparentScheme:
  | typeof import('../../modules/keyDerivation/derivationScheme').loadTransparentScheme
  | null = null;
let getConnection:
  | typeof import('../../modules/solana/connection').getConnection
  | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  submitSwap = require('../../modules/swap/submitSwap').submitSwap;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  loadTransparentScheme = require('../../modules/keyDerivation/derivationScheme').loadTransparentScheme;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getConnection = require('../../modules/solana/connection').getConnection;
} catch {
  // Modules unavailable in test/stub environment — no-op
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SwapState =
  | {kind: 'form'}
  | {kind: 'broadcasting'}
  | {kind: 'success'; signature: string}
  | {kind: 'failed'; reason: string};

/** Map a raw swap error to a short, user-friendly message (no raw RPC JSON). */
function friendlySwapError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/timed out|timeout|-32504|\b504\b/i.test(msg)) return 'Network timed out — please try again';
  if (/blockhash|expired/i.test(msg)) return 'Swap expired — please try again';
  if (/insufficient/i.test(msg)) return 'Insufficient balance for this swap';
  if (/slippage/i.test(msg)) return 'Price moved beyond slippage — try again';
  return 'Swap failed — please try again';
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Slippage presets in basis points: 0.1% / 0.5% / 1.0% */
const SLIPPAGE_OPTIONS = [10, 50, 100] as const;

function slippageLabel(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SwapScreenProps {
  initialFromMint?: string;
  onBack: () => void;
  onDone: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SwapScreen({initialFromMint, onBack, onDone}: SwapScreenProps) {
  const {solBalance, tokenBalances} = useWalletStore();

  const [fromMint, setFromMint] = useState<string>(
    initialFromMint && SWAP_TOKENS.some(t => t.mint === initialFromMint)
      ? initialFromMint
      : 'native',
  );
  const [toMint, setToMint] = useState<string>(
    fromMint === SWAP_TOKENS[1].mint ? 'native' : SWAP_TOKENS[1].mint,
  );
  const [amount, setAmount] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState<number>(() => {
    const n = mmkvPublic.getNumber(MMKV_KEYS.ADVANCED_SLIPPAGE_BPS);
    return n != null && n > 0 ? n : 50;
  });
  const [swapState, setSwapState] = useState<SwapState>({kind: 'form'});
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const lastTapRef = useRef(0);
  const isMountedRef = useRef(true);

  // Clear the mounted flag on unmount so async poll callbacks don't fire after
  // the component has been torn down.
  useEffect(() => () => { isMountedRef.current = false; }, []);

  const from = SWAP_TOKENS.find(t => t.mint === fromMint)!;
  const to = SWAP_TOKENS.find(t => t.mint === toMint)!;
  const fromBalanceRaw =
    fromMint === 'native' ? solBalance : (tokenBalances[fromMint] ?? '0');

  // Debounce amount input so we don't spam Jupiter on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setDebouncedAmount(amount), 400);
    return () => clearTimeout(id);
  }, [amount]);

  const amountRaw = useMemo(() => {
    try {
      return debouncedAmount
        ? parseTokenAmount(debouncedAmount, from.decimals).toString()
        : '0';
    } catch {
      return '0';
    }
  }, [debouncedAmount, from.decimals]);

  const quoteEnabled = amountRaw !== '0' && fromMint !== toMint;
  const quote = useSwapQuote({
    inputMint: fromMint,
    outputMint: toMint,
    amountRaw,
    slippageBps,
    enabled: quoteEnabled,
  });

  const insufficient = (() => {
    try {
      return (
        amountRaw !== '0' && BigInt(amountRaw) > BigInt(fromBalanceRaw || '0')
      );
    } catch {
      return false;
    }
  })();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onFlip = () => {
    setFromMint(toMint);
    setToMint(fromMint);
    setAmount('');
    setDebouncedAmount('');
  };

  const onPickSlippage = (bps: number) => {
    setSlippageBps(bps);
    mmkvPublic.set(MMKV_KEYS.ADVANCED_SLIPPAGE_BPS, bps);
  };

  const onMax = () => {
    let raw: bigint;
    try { raw = BigInt(fromBalanceRaw || '0'); } catch { raw = 0n; }
    if (fromMint === 'native') {
      // Reserve a buffer for the swap network fee + possible wSOL account rent,
      // so MAX on SOL doesn't leave the account unable to pay fees.
      const SWAP_SOL_RESERVE = 2_000_000n; // 0.002 SOL
      const avail = raw > SWAP_SOL_RESERVE ? raw - SWAP_SOL_RESERVE : 0n;
      setAmount(formatTokenAmount(avail, from.decimals));
    } else {
      setAmount(formatTokenAmount(raw, from.decimals));
    }
  };

  const onPickFrom = () => setPicker('from');

  const onPickTo = () => setPicker('to');

  const canSwap =
    quoteEnabled && quote.data != null && !quote.isLoading && !insufficient;

  const onSwap = async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500 || !canSwap || !quote.data) return;
    lastTapRef.current = now;

    // Guard: modules not available in test/stub env
    if (!submitSwap || !loadTransparentScheme || !getConnection) return;

    setSwapState({kind: 'broadcasting'});
    try {
      const {signature, lastValidBlockHeight} = await submitSwap({
        quoteRaw: quote.data.raw,
        scheme: loadTransparentScheme(),
      });
      const connection = getConnection();
      let done = false;
      for (let i = 0; i < 60 && !done; i++) {
        await new Promise(r => setTimeout(r, 500));
        // If the user navigated away while we were sleeping, stop updating state.
        if (!isMountedRef.current) return;
        const st = await connection.getSignatureStatus(signature);
        if (!isMountedRef.current) return;
        const err = st?.value?.err;
        const status = st?.value?.confirmationStatus;
        if (err) {
          setSwapState({kind: 'failed', reason: 'Swap failed'});
          done = true;
        } else if (status === 'confirmed' || status === 'finalized') {
          setSwapState({kind: 'success', signature});
          done = true;
        } else {
          const h = await connection.getBlockHeight();
          if (!isMountedRef.current) return;
          if (lastValidBlockHeight > 0 && h > lastValidBlockHeight) {
            setSwapState({kind: 'failed', reason: 'Swap expired — try again'});
            done = true;
          }
        }
      }
      if (!done && isMountedRef.current) {
        setSwapState({kind: 'failed', reason: 'Timed out — check explorer'});
      }
    } catch (e) {
      if (isMountedRef.current) {
        setSwapState({
          kind: 'failed',
          reason: friendlySwapError(e),
        });
      }
    }
  };

  // ── Derive CTA label ──────────────────────────────────────────────────────

  const ctaLabel = (() => {
    if (insufficient) return `Insufficient ${from.symbol}`;
    if (quote.isError) return 'No route';
    return `Swap ${from.symbol} → ${to.symbol}`;
  })();

  // ── Render: broadcasting ──────────────────────────────────────────────────

  if (swapState.kind === 'broadcasting') {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center gap-4">
        <ActivityIndicator size="large" color="#B084FC" />
        <Text variant="body" className="text-fg-secondary">
          Swapping…
        </Text>
      </SafeAreaView>
    );
  }

  // ── Render: success ───────────────────────────────────────────────────────

  if (swapState.kind === 'success') {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6 gap-6">
        <View className="w-32 h-32 rounded-full items-center justify-center border-2 border-success bg-[rgba(63,214,139,0.12)]">
          <Check size={56} color="#3FD68B" strokeWidth={2} />
        </View>
        <Text variant="h1" className="text-center">
          Swapped
        </Text>
        <Pressable
          onPress={() => {
            if (swapState.kind === 'success') {
              Linking.openURL(getExplorerUrl(swapState.signature)).catch(() => {});
            }
          }}
          accessibilityRole="link"
          accessibilityLabel="View on explorer">
          <Text className="text-accent-transparent text-center">
            View on explorer →
          </Text>
        </Pressable>
        <View className="w-full">
          <Button label="Done" variant="primary" onPress={onDone} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: failed ────────────────────────────────────────────────────────

  if (swapState.kind === 'failed') {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6 gap-6">
        <View className="w-32 h-32 rounded-full items-center justify-center border-2 border-danger bg-[rgba(248,113,113,0.10)]">
          <X size={56} color="#F87171" strokeWidth={2} />
        </View>
        <Text variant="body" className="text-center text-fg-secondary">
          {swapState.reason}
        </Text>
        <View className="w-full">
          <Button
            label="Back"
            variant="primary"
            onPress={() => setSwapState({kind: 'form'})}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: form ──────────────────────────────────────────────────────────

  const priceImpactPct = quote.data
    ? Number(quote.data.priceImpactPct) * 100
    : null;
  const priceImpactClass =
    priceImpactPct == null
      ? 'text-fg-secondary'
      : priceImpactPct > 5
      ? 'text-danger'
      : priceImpactPct > 1
      ? 'text-warning'
      : 'text-fg-secondary';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <Text variant="h1" className="ml-1 flex-1">
          Swap
        </Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── From card ─────────────────────────────────────────────────── */}
          <View className="bg-bg-surface-1 rounded-2xl p-4 gap-3 mb-2">
            <Text variant="overline" className="text-fg-tertiary">
              FROM
            </Text>
            {/* Token selector row */}
            <Pressable
              onPress={onPickFrom}
              accessibilityRole="button"
              accessibilityLabel={`From token ${from.symbol}, tap to change`}
              className="flex-row items-center gap-3 active:opacity-70">
              <TokenLogo symbol={from.symbol} isNoc={false} />
              <Text variant="body-lg" className="flex-1 text-fg-primary font-geist-semibold">
                {from.symbol}
              </Text>
            </Pressable>
            {/* Amount input row */}
            <View className="flex-row items-baseline gap-3">
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#6E727A"
                keyboardType="numeric"
                accessibilityLabel="Amount to swap"
                className="flex-1 font-geist text-balance-lg text-fg-primary"
              />
              <Pressable
                onPress={onMax}
                accessibilityRole="button"
                accessibilityLabel="Max"
                className="px-3 py-1.5 rounded-pill bg-accent-transparent-tint active:opacity-80">
                <Text variant="overline" className="text-accent-transparent">
                  MAX
                </Text>
              </Pressable>
            </View>
            {/* Balance line */}
            <Text variant="caption" className="text-fg-secondary">
              {formatBalanceForDisplay(fromBalanceRaw, from.decimals)} {from.symbol}
            </Text>
          </View>

          {/* ── Flip button ───────────────────────────────────────────────── */}
          <View className="items-center my-1">
            <Pressable
              onPress={onFlip}
              accessibilityRole="button"
              accessibilityLabel="Flip swap direction"
              className="w-11 h-11 rounded-full bg-bg-surface-2 items-center justify-center active:bg-bg-surface-3">
              <ArrowUpDown size={20} color="#A8ACB5" strokeWidth={1.75} />
            </Pressable>
          </View>

          {/* ── To card ───────────────────────────────────────────────────── */}
          <View className="bg-bg-surface-1 rounded-2xl p-4 gap-3 mt-2 mb-4">
            <Text variant="overline" className="text-fg-tertiary">
              TO
            </Text>
            {/* Token selector row */}
            <Pressable
              onPress={onPickTo}
              accessibilityRole="button"
              accessibilityLabel={`To token ${to.symbol}, tap to change`}
              className="flex-row items-center gap-3 active:opacity-70">
              <TokenLogo symbol={to.symbol} isNoc={false} />
              <Text variant="body-lg" className="flex-1 text-fg-primary font-geist-semibold">
                {to.symbol}
              </Text>
            </Pressable>
            {/* Output amount — read-only */}
            <View className="flex-row items-center gap-2">
              {quote.isLoading ? (
                <ActivityIndicator size="small" color="#B084FC" />
              ) : (
                <Text
                  variant="body-lg"
                  numeral
                  className={cn(
                    'text-fg-primary',
                    quote.data ? 'font-geist-semibold' : 'text-fg-tertiary',
                  )}>
                  {quote.data
                    ? `≈ ${formatBalanceForDisplay(quote.data.outAmount, to.decimals)}`
                    : '—'}
                </Text>
              )}
              {!quote.isLoading ? (
                <Text variant="body" className="text-fg-secondary">
                  {to.symbol}
                </Text>
              ) : null}
            </View>
          </View>

          {/* ── Quote row ─────────────────────────────────────────────────── */}
          {quote.data != null ? (
            <View className="flex-row items-center justify-between rounded-lg bg-bg-surface-1 px-4 py-3 mb-4">
              <Text variant="body-sm" className="text-fg-secondary">
                Price impact
              </Text>
              <View className="flex-row items-center gap-2">
                <Text variant="body-sm" numeral className={priceImpactClass}>
                  {priceImpactPct != null ? `${priceImpactPct.toFixed(2)}%` : '—'}
                </Text>
                <Text variant="caption" className="text-fg-tertiary">
                  via Jupiter
                </Text>
              </View>
            </View>
          ) : null}

          {/* ── Slippage chips ────────────────────────────────────────────── */}
          <View className="mb-6">
            <Text variant="overline" className="mb-2 text-fg-secondary">
              Slippage tolerance
            </Text>
            <View className="flex-row gap-2">
              {SLIPPAGE_OPTIONS.map(bps => (
                <SlippageChip
                  key={bps}
                  label={slippageLabel(bps)}
                  active={slippageBps === bps}
                  onPress={() => onPickSlippage(bps)}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        {/* ── Sticky CTA ────────────────────────────────────────────────── */}
        <View className="px-6 pb-8 pt-2 bg-bg-base border-t border-bg-surface-2">
          <Button
            label={ctaLabel}
            variant="primary"
            disabled={!canSwap}
            onPress={() => {
              onSwap().catch(() => {
                // onSwap sets error state internally — no unhandled rejection
              });
            }}
          />
        </View>
      </KeyboardAvoidingView>

      <TokenPickerSheet
        visible={picker !== null}
        title={picker === 'from' ? 'Swap from' : 'Swap to'}
        tokens={SWAP_TOKENS.filter(t =>
          picker === 'from' ? t.mint !== toMint : t.mint !== fromMint,
        )}
        selectedMint={picker === 'from' ? fromMint : toMint}
        balances={{native: solBalance, ...tokenBalances}}
        onSelect={mint => {
          if (picker === 'from') {
            setFromMint(mint);
          } else {
            setToMint(mint);
          }
          setAmount('');
          setDebouncedAmount('');
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

// ── SlippageChip sub-component ────────────────────────────────────────────────

interface SlippageChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function SlippageChip({label, active, onPress}: SlippageChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{selected: active}}
      style={{minHeight: 44}}
      className={cn(
        'flex-1 rounded-md px-3 items-center justify-center border',
        active
          ? 'bg-bg-surface-3 border-accent-transparent'
          : 'bg-bg-surface-1 border-bg-surface-3 active:bg-bg-surface-2',
      )}>
      <Text
        variant="body-sm"
        className={cn(
          'font-geist-semibold',
          active ? 'text-accent-transparent' : 'text-fg-secondary',
        )}>
        {label}
      </Text>
    </Pressable>
  );
}
