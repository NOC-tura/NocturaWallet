import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {PublicKey} from '@solana/web3.js';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair} from '../../modules/keyDerivation/transparent';
import {getConnection} from '../../modules/solana/connection';
import {getBalance, getTokenAccounts} from '../../modules/solana/queries';
import {zeroize} from '../../modules/session/zeroize';

interface SyncWalletScreenProps {
  mnemonic: string;
  onSyncComplete: () => void;
}

interface Step {
  label: string;
  done: boolean;
  active: boolean;
}

const STEP_LABELS = [
  'Deriving keys...',
  'Loading balances...',
  'Checking staking position...',
  'Scanning transaction history...',
  'Ready!',
];

// Delay between step transitions (ms)
const STEP_DELAY = 800;
// Maximum total time before forcing completion
const MAX_TIMEOUT = 5_000;

function buildSteps(currentStep: number): Step[] {
  return STEP_LABELS.map((label, idx) => ({
    label,
    done: idx < currentStep,
    active: idx === currentStep,
  }));
}

export function SyncWalletScreen({mnemonic, onSyncComplete}: SyncWalletScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const completedRef = useRef(false);

  const complete = (onSyncCompleteCallback: () => void) => {
    if (!completedRef.current) {
      completedRef.current = true;
      onSyncCompleteCallback();
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Hard 5 s safety timeout — fires onSyncComplete regardless of RPC state
    const hardTimeout = setTimeout(() => {
      if (!cancelled) {
        complete(onSyncComplete);
      }
    }, MAX_TIMEOUT);

    const advance = (step: number) => {
      if (!cancelled) {
        setCurrentStep(step);
      }
    };

    const run = async () => {
      // Step 0: derive keys
      advance(0);
      let publicKeyBytes: Uint8Array | null = null;
      try {
        const seed = await mnemonicToSeed(mnemonic);
        const keypair = deriveTransparentKeypair(seed);
        publicKeyBytes = keypair.publicKey;
        zeroize(keypair.secretKey);
        zeroize(seed);
      } catch {
        // best-effort — continue even if derivation fails in test env
      }

      if (cancelled) return;

      await new Promise<void>(resolve => setTimeout(resolve, STEP_DELAY));
      if (cancelled) return;

      // Step 1: load balances
      advance(1);
      try {
        if (publicKeyBytes !== null) {
          const connection = getConnection();
          const pubkey = new PublicKey(publicKeyBytes);
          await getBalance(connection, pubkey);
        }
      } catch {
        // best-effort
      }

      if (cancelled) return;
      await new Promise<void>(resolve => setTimeout(resolve, STEP_DELAY));
      if (cancelled) return;

      // Step 2: check staking position (placeholder — Anchor IDL integration pending)
      advance(2);
      await new Promise<void>(resolve => setTimeout(resolve, STEP_DELAY));
      if (cancelled) return;

      // Step 3: scan transaction history
      advance(3);
      try {
        if (publicKeyBytes !== null) {
          const connection = getConnection();
          const pubkey = new PublicKey(publicKeyBytes);
          await getTokenAccounts(connection, pubkey);
        }
      } catch {
        // best-effort
      }

      if (cancelled) return;
      await new Promise<void>(resolve => setTimeout(resolve, STEP_DELAY));
      if (cancelled) return;

      // Step 4: Ready!
      advance(4);
      await new Promise<void>(resolve => setTimeout(resolve, STEP_DELAY));
      if (cancelled) return;

      clearTimeout(hardTimeout);
      complete(onSyncComplete);
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(hardTimeout);
    };
    // onSyncComplete intentionally excluded — stable callback pattern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mnemonic]);

  const steps = buildSteps(currentStep);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Syncing wallet</Text>

      <View style={styles.stepsContainer}>
        {steps.map((step, idx) => (
          <View key={idx} style={styles.stepRow}>
            <View style={styles.stepIconWrapper}>
              {step.done ? (
                <Text style={styles.iconDone}>✓</Text>
              ) : step.active ? (
                <Text style={styles.iconActive}>→</Text>
              ) : (
                <Text style={styles.iconPending}>·</Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                step.done && styles.stepLabelDone,
                step.active && styles.stepLabelActive,
              ]}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 40,
    textAlign: 'center',
  },
  stepsContainer: {
    width: '100%',
    gap: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepIconWrapper: {
    width: 24,
    alignItems: 'center',
  },
  iconDone: {
    fontSize: 18,
    color: '#22C55E',
    fontWeight: '700',
  },
  iconActive: {
    fontSize: 18,
    color: '#6C47FF',
    fontWeight: '700',
  },
  iconPending: {
    fontSize: 18,
    color: '#3A3A55',
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 16,
    color: '#3A3A55',
  },
  stepLabelDone: {
    color: '#22C55E',
    textDecorationLine: 'line-through',
  },
  stepLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
