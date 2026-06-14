import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Pressable,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {Check, X, AlertTriangle, Copy} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {cn} from '../../utils/cn';
import {getExplorerUrl} from '../../utils/explorerUrl';
import {formatAddress} from '../../utils/formatAddress';
import {ERROR_CODES} from '../../constants/errors';
import {parseTokenAmount, formatTokenAmount} from '../../utils/parseTokenAmount';
import type {TransferIntent} from '../../types/transfer';

// ── In-file constants ─────────────────────────────────────────────────────────
const BASE_FEE_LAMPORTS = 5_000n;
const SOL_DECIMALS = 9;
const MAX_ATTEMPTS = 3;

// ── Lazy imports — wrapped in try/catch so Jest/stub envs don't crash ─────────
let submitTransparentTransfer:
  | typeof import('../../modules/solana/sendTransaction').submitTransparentTransfer
  | null = null;
let loadTransparentScheme:
  | typeof import('../../modules/keyDerivation/derivationScheme').loadTransparentScheme
  | null = null;
let getConnection:
  | typeof import('../../modules/solana/connection').getConnection
  | null = null;
let estimatePriorityFee:
  | typeof import('../../modules/solana/priorityFee').estimatePriorityFee
  | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  submitTransparentTransfer = require('../../modules/solana/sendTransaction').submitTransparentTransfer;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  loadTransparentScheme = require('../../modules/keyDerivation/derivationScheme').loadTransparentScheme;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getConnection = require('../../modules/solana/connection').getConnection;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  estimatePriorityFee = require('../../modules/solana/priorityFee').estimatePriorityFee;
} catch {
  // Modules unavailable in test/stub environment — no-op
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Stage = 'submitting' | 'broadcasting' | 'success' | 'failed' | 'stuck';

export interface TransactionStatusScreenProps {
  intent: TransferIntent;
  onDashboard: () => void;
  onViewDetails?: (signature: string) => void;
}

// ── Private helpers ───────────────────────────────────────────────────────────
function mapErr(err: unknown): string {
  const errStr = JSON.stringify(err);
  if (errStr.includes('InsufficientFunds')) {
    return ERROR_CODES.INSUFFICIENT_SOL.message;
  } else if (errStr.includes('AccountNotFound')) {
    return ERROR_CODES.INVALID_ADDRESS.message;
  }
  return ERROR_CODES.TX_SEND_FAILED.message;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TransactionStatusScreen({
  intent,
  onDashboard,
  onViewDetails,
}: TransactionStatusScreenProps) {
  const [stage, setStage] = useState<Stage>('submitting');
  const [signature, setSignature] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [priorityFeeUsed, setPriorityFeeUsed] = useState(0);

  // Keep a ref to the latest signature for use inside the async poll closure
  const signatureRef = useRef<string | null>(null);
  signatureRef.current = signature;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStage('submitting');
      setErrorMessage(null);

      // Guard: in stub/test env all required modules may be null — exit gracefully
      if (!submitTransparentTransfer || !loadTransparentScheme || !getConnection) {
        return;
      }

      const scheme = loadTransparentScheme();

      // Import PublicKey lazily inline to avoid top-level crash in test env
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {PublicKey} = require('@solana/web3.js') as typeof import('@solana/web3.js');

      const buildParams = (priorityFee: number) =>
        intent.tokenMint === 'native'
          ? {
              kind: 'sol' as const,
              recipient: new PublicKey(intent.recipient),
              lamports: parseTokenAmount(intent.amount, SOL_DECIMALS),
              priorityFee,
              scheme,
            }
          : {
              kind: 'spl' as const,
              recipient: new PublicKey(intent.recipient),
              mint: new PublicKey(intent.tokenMint),
              amount: parseTokenAmount(intent.amount, intent.decimals),
              decimals: intent.decimals,
              createAta: intent.createAta,
              priorityFee,
              scheme,
            };

      const attemptSubmit = async () => {
        const fee = estimatePriorityFee
          ? await estimatePriorityFee(getConnection!(), intent.priorityLevel)
          : 0;
        setPriorityFeeUsed(fee);
        return submitTransparentTransfer!(buildParams(fee));
      };

      let attempt = 1;
      let result: {signature: string; lastValidBlockHeight: number};

      try {
        result = await attemptSubmit();
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e instanceof Error ? e.message : 'Transaction failed');
          setStage('failed');
        }
        return;
      }

      if (cancelled) return;
      setSignature(result.signature);
      setStage('broadcasting');

      let sig = result.signature;
      let lastValidBlockHeight = result.lastValidBlockHeight;
      let attemptStartMs = Date.now();
      let stuckSet = false;
      let i = 0;

      while (!cancelled) {
        await new Promise(r => setTimeout(r, 500));
        if (cancelled) return;
        i++;

        try {
          const r = await getConnection!().getSignatureStatus(sig);
          if (cancelled) return;
          // A landed-but-failed tx has BOTH confirmationStatus AND err — check
          // err FIRST so an on-chain failure is never reported as success.
          if (r?.value?.err) {
            setErrorMessage(mapErr(r.value.err));
            setStage('failed');
            return;
          }
          const st = r?.value?.confirmationStatus;
          if (st === 'confirmed' || st === 'finalized') {
            setSlot(r?.value?.slot ?? null);
            setStage('success');
            return;
          }
        } catch {
          // status hiccup — continue
        }

        // Expiry check every ~10 iterations (~5 s)
        if (i % 10 === 0) {
          try {
            const h = await getConnection!().getBlockHeight();
            if (!cancelled && h > lastValidBlockHeight) {
              if (attempt < MAX_ATTEMPTS) {
                attempt++;
                let resubmitResult: {signature: string; lastValidBlockHeight: number};
                try {
                  resubmitResult = await attemptSubmit();
                } catch (e) {
                  if (!cancelled) {
                    setErrorMessage(e instanceof Error ? e.message : 'Transaction failed');
                    setStage('failed');
                  }
                  return;
                }
                if (cancelled) return;
                sig = resubmitResult.signature;
                lastValidBlockHeight = resubmitResult.lastValidBlockHeight;
                setSignature(sig);
                setStage('broadcasting');
                attemptStartMs = Date.now();
                stuckSet = false;
                i = 0;
                continue;
              } else {
                setErrorMessage(
                  "Transaction expired — the network didn't include it in time. Tap Retry.",
                );
                setStage('failed');
                return;
              }
            }
          } catch {
            // block-height hiccup — skip this check
          }
        }

        if (!stuckSet && Date.now() - attemptStartMs >= 90_000) {
          stuckSet = true;
          setStage('stuck');
        }
      }
    };

    run().catch(() => {
      // Handled inside run() — no unhandled rejection
    });

    return () => {
      cancelled = true;
    };
  }, [intent, retryCount]);

  // ── Derived display values ─────────────────────────────────────────────────
  const truncatedSig =
    signature && signature.length > 16
      ? `${signature.slice(0, 8)}...${signature.slice(-8)}`
      : (signature ?? '');

  // Dynamic fee display: base fee + compute budget cost using actual CU limit
  const CU_LIMIT =
    intent.tokenMint === 'native' ? 1_000 : intent.createAta ? 65_000 : 40_000;
  const computeFeeLamports = BigInt(Math.ceil((priorityFeeUsed * CU_LIMIT) / 1_000_000));
  const feePaid = `${formatTokenAmount(BASE_FEE_LAMPORTS + computeFeeLamports, SOL_DECIMALS)} SOL`;

  // ── Per-stage copy ─────────────────────────────────────────────────────────
  const COPY: Record<Stage, {label: string; sub: string; warn?: boolean}> = {
    submitting:   {label: 'Broadcasting transaction…', sub: 'Submitted to Solana mainnet · waiting for first confirmation'},
    broadcasting: {label: 'Broadcasting transaction…', sub: 'Submitted to Solana mainnet · waiting for first confirmation'},
    success:      {label: 'Sent successfully', sub: 'Confirmed on Solana mainnet'},
    failed:       {label: 'Transaction failed', sub: errorMessage ?? 'The transaction did not go through.'},
    stuck:        {label: 'Taking longer than usual', sub: 'Network is congested · the tx is in the mempool but hasn\'t been included yet', warn: true},
  };
  const copy = COPY[stage];

  // ── Copy helper ────────────────────────────────────────────────────────────
  const handleCopySig = () => {
    if (!signature) return;
    try {
      Clipboard.setString(signature);
      setTimeout(() => Clipboard.setString(''), 30_000);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  // ── Single return ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3">
        <View className="flex-1" />
        {stage === 'success' ? (
          <View className="px-2 py-0.5 rounded-pill bg-[rgba(63,214,139,0.16)]">
            <Text variant="overline" className="text-success">
              CONFIRMED
            </Text>
          </View>
        ) : stage === 'stuck' ? (
          <View className="px-2 py-0.5 rounded-pill bg-[rgba(242,181,59,0.16)]">
            <Text variant="overline" className="text-warning">
              SLOW
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerClassName="flex-grow items-center px-5 pb-8">
        {/* Hero */}
        <View className="items-center justify-center py-8 gap-5 w-full">
          <StatusRing stage={stage} />
          <Text variant="h1" className="text-center">
            {copy.label}
          </Text>
          <Text
            variant="body-sm"
            className={cn('text-center', copy.warn ? 'text-warning' : 'text-fg-secondary')}
            style={{maxWidth: 300}}>
            {copy.sub}
          </Text>
        </View>

        {/* Amount card */}
        <View className="w-full bg-bg-surface-1 rounded-2xl p-5 items-center gap-3 mt-2">
          <Text variant="overline" className="text-fg-tertiary">
            Amount
          </Text>
          <View className="flex-row items-baseline gap-2">
            <Text className="text-fg-primary font-geist-semibold" style={{fontSize: 28}}>
              {intent.amount}
            </Text>
            <Text variant="body" className="text-fg-secondary">
              {intent.tokenSymbol}
            </Text>
          </View>
          <Text variant="caption" className="text-fg-tertiary">
            To {formatAddress(intent.recipient)}
          </Text>
        </View>

        {/* Meta grid — only when we have a signature */}
        {signature ? (
          <View className="w-full bg-bg-surface-1 rounded-lg px-5 mt-3">
            <MetaRow label="Tx hash" value={truncatedSig} mono onCopy={handleCopySig} />
            <MetaRow label="Slot" value={slot != null ? String(slot) : '—'} mono />
            <MetaRow label="Fee paid" value={feePaid} />
          </View>
        ) : null}

        <View className="flex-1" />
      </ScrollView>

      {/* Sticky footer */}
      <View className="px-6 pb-2 pt-2 gap-2">
        {(stage === 'submitting' || stage === 'broadcasting') ? (
          <>
            <Button label="Broadcasting…" variant="primary" disabled onPress={() => {}} />
            <Text variant="caption" className="text-fg-tertiary text-center">
              Don't close the app · this usually takes 8–12 s
            </Text>
          </>
        ) : stage === 'success' ? (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="View details"
                variant="secondary"
                testID="tx-status-details"
                onPress={() => {
                  if (onViewDetails && signature) {
                    onViewDetails(signature);
                  } else if (signature) {
                    Linking.openURL(getExplorerUrl(signature)).catch(() => {});
                  }
                }}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Done"
                variant="primary"
                testID="tx-status-done"
                onPress={onDashboard}
              />
            </View>
          </View>
        ) : stage === 'failed' ? (
          <>
            <Button
              label="Retry"
              variant="primary"
              testID="tx-status-retry"
              onPress={() => setRetryCount(c => c + 1)}
            />
            <Button
              label="Done"
              variant="secondary"
              testID="tx-status-done"
              onPress={onDashboard}
            />
          </>
        ) : (
          /* stuck */
          <>
            <Pressable
              onPress={() => {
                if (signature) {
                  Linking.openURL(getExplorerUrl(signature)).catch(() => {});
                }
              }}>
              <Text className="text-accent-transparent text-center">
                View on Solscan →
              </Text>
            </Pressable>
            <Button
              label="Done"
              variant="primary"
              testID="tx-status-done"
              onPress={onDashboard}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── StatusRing sub-component ──────────────────────────────────────────────────
function StatusRing({stage}: {stage: Stage}) {
  if (stage === 'success') return (
    <View className="w-32 h-32 rounded-full items-center justify-center border-2 border-success bg-[rgba(63,214,139,0.12)]">
      <Check size={56} color="#3FD68B" strokeWidth={2} />
    </View>
  );
  if (stage === 'failed') return (
    <View className="w-32 h-32 rounded-full items-center justify-center border-2 border-danger bg-[rgba(248,113,113,0.10)]">
      <X size={56} color="#F87171" strokeWidth={2} />
    </View>
  );
  if (stage === 'stuck') return (
    <View className="w-32 h-32 rounded-full items-center justify-center bg-[rgba(242,181,59,0.08)]" style={{borderWidth: 1.5, borderColor: '#F2B53B', borderStyle: 'dashed'}}>
      <AlertTriangle size={52} color="#F2B53B" strokeWidth={1.75} />
    </View>
  );
  return (
    <View className="w-32 h-32 rounded-full items-center justify-center border border-[rgba(176,132,252,0.35)]">
      <ActivityIndicator size="large" color="#B084FC" />
    </View>
  );
}

// ── MetaRow sub-component ─────────────────────────────────────────────────────
function MetaRow({label, value, mono, onCopy}: {label: string; value: string; mono?: boolean; onCopy?: () => void}) {
  return (
    <View className="flex-row items-center gap-3 py-3 border-t border-bg-surface-3">
      <Text variant="overline" className="text-fg-tertiary w-[76px]">
        {label}
      </Text>
      <Text
        variant="body-sm"
        className={cn('flex-1 text-fg-primary', mono && 'font-geist-mono text-fg-secondary')}
        numberOfLines={1}>
        {value}
      </Text>
      {onCopy ? (
        <Pressable
          onPress={onCopy}
          className="w-8 h-8 rounded-sm items-center justify-center bg-bg-surface-2"
          accessibilityLabel={`Copy ${label}`}>
          <Copy size={14} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
      ) : null}
    </View>
  );
}
