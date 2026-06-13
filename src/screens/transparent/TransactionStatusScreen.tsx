import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
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

  const handleViewOnSolscan = () => {
    if (!signature) return;
    Linking.openURL(getExplorerUrl(signature)).catch(() => {});
  };

  // Dynamic fee display: base fee + compute budget cost using actual CU limit
  const CU_LIMIT =
    intent.tokenMint === 'native' ? 1_000 : intent.createAta ? 65_000 : 40_000;
  const computeFeeLamports = BigInt(Math.ceil((priorityFeeUsed * CU_LIMIT) / 1_000_000));
  const feePaid = `${formatTokenAmount(BASE_FEE_LAMPORTS + computeFeeLamports, SOL_DECIMALS)} SOL`;

  // ── Render: submitting / broadcasting ────────────────────────────────────
  if (stage === 'submitting' || stage === 'broadcasting') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}>
        <ActivityIndicator color="#6C47FF" size="large" style={styles.spinner} />
        <Text style={styles.titlePending}>Broadcasting transaction…</Text>
        <Text style={styles.subtitleMuted}>
          Submitted to Solana mainnet · waiting for first confirmation
        </Text>

        {/* Amount card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountText}>
            {intent.amount} {intent.tokenSymbol}
          </Text>
          <Text style={styles.amountSub}>To {formatAddress(intent.recipient)}</Text>
        </View>

        {/* Tx hash row — appears once we have a signature */}
        {signature ? (
          <>
            <Text style={styles.txHash}>{truncatedSig}</Text>
            <TouchableOpacity onPress={handleViewOnSolscan} activeOpacity={0.75}>
              <Text style={styles.link}>View on Solscan →</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <Text style={styles.hint}>Don't close the app · this usually takes 8–12 s</Text>
      </ScrollView>
    );
  }

  // ── Render: success ───────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconCircleSuccess}>
          <Text style={styles.iconTextSuccess}>✓</Text>
        </View>
        <Text style={styles.titleSuccess}>Sent successfully</Text>

        {/* Amount card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountText}>
            {intent.amount} {intent.tokenSymbol}
          </Text>
          <Text style={styles.amountSub}>To {formatAddress(intent.recipient)}</Text>
        </View>

        {/* Meta rows */}
        <View style={styles.metaCard}>
          <MetaRow label="Tx hash" value={truncatedSig} />
          <MetaRow label="Slot" value={slot != null ? String(slot) : '—'} />
          <MetaRow label="Fee paid" value={feePaid} />
        </View>

        <TouchableOpacity
          testID="tx-status-details"
          style={styles.ghostButton}
          onPress={() => {
            if (onViewDetails && signature) {
              onViewDetails(signature);
            } else {
              handleViewOnSolscan();
            }
          }}
          activeOpacity={0.75}>
          <Text style={styles.ghostButtonText}>View details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="tx-status-done"
          style={styles.primaryButton}
          onPress={onDashboard}
          activeOpacity={0.75}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Render: failed ────────────────────────────────────────────────────────
  if (stage === 'failed') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconCircleFailed}>
          <Text style={styles.iconTextFailed}>✗</Text>
        </View>
        <Text style={styles.titleFailed}>Transaction failed</Text>
        {errorMessage ? (
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        ) : null}

        <TouchableOpacity
          testID="tx-status-retry"
          style={styles.primaryButton}
          onPress={() => setRetryCount(c => c + 1)}
          activeOpacity={0.75}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="tx-status-done"
          style={styles.ghostButton}
          onPress={onDashboard}
          activeOpacity={0.75}>
          <Text style={styles.ghostButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Render: stuck ─────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.iconCircleTimeout}>
        <Text style={styles.iconTextTimeout}>⚠</Text>
      </View>
      <Text style={styles.titleTimeout}>Taking longer than usual</Text>
      <Text style={styles.subtitle}>
        Network is congested · the tx is in the mempool but hasn't been included yet
      </Text>
      {signature ? (
        <>
          <Text style={styles.txHash}>{truncatedSig}</Text>
          <TouchableOpacity onPress={handleViewOnSolscan} activeOpacity={0.75}>
            <Text style={styles.linkAccent}>View on Solscan →</Text>
          </TouchableOpacity>
        </>
      ) : null}

      <TouchableOpacity
        testID="tx-status-done"
        style={styles.primaryButton}
        onPress={onDashboard}
        activeOpacity={0.75}>
        <Text style={styles.primaryButtonText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Private sub-components ────────────────────────────────────────────────────
function MetaRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
  },
  contentContainer: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 24,
  },
  titlePending: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  titleSuccess: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ADE80',
    marginBottom: 8,
    marginTop: 16,
  },
  titleFailed: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F87171',
    marginBottom: 8,
    marginTop: 16,
  },
  titleTimeout: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FBBF24',
    marginBottom: 8,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitleMuted: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
    textAlign: 'center',
  },
  txHash: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  link: {
    fontSize: 14,
    color: '#6C47FF',
    marginBottom: 8,
  },
  linkAccent: {
    fontSize: 14,
    color: '#A78BFA',
    marginBottom: 24,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 16,
    textAlign: 'center',
  },
  amountCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  amountSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  metaCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  metaValue: {
    fontSize: 13,
    color: '#E7E9EE',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  iconCircleSuccess: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 2,
    borderColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleFailed: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderWidth: 2,
    borderColor: '#F87171',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleTimeout: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 2,
    borderColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTextSuccess: {
    fontSize: 48,
    color: '#4ADE80',
    lineHeight: 56,
  },
  iconTextFailed: {
    fontSize: 48,
    color: '#F87171',
    lineHeight: 56,
  },
  iconTextTimeout: {
    fontSize: 36,
    color: '#FBBF24',
    lineHeight: 44,
  },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ghostButton: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ghostButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },
});
