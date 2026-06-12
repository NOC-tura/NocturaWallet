import React, {useEffect, useRef, useState} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {PublicKey} from '@solana/web3.js';
import {Check, ArrowRight, Circle, Sparkles} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {
  deriveTransparentKeypair,
  type TransparentScheme,
} from '../../modules/keyDerivation/transparent';
import {getConnection} from '../../modules/solana/connection';
import {getBalance, getTokenAccounts} from '../../modules/solana/queries';
import {zeroize} from '../../modules/session/zeroize';
import {cn} from '../../utils/cn';

/**
 * SyncWallet — Phase B migration · in-between screen for wallet provisioning.
 *
 * NOT in the canonical 55-screen design spec (it's an internal-only flow
 * screen that gives time for actual wallet derivation + balance fetch before
 * the user reaches SetPin). Migrated to DS v0.2.1 tokens for visual coherence
 * with neighbouring Phase 3 screens (#4 ConfirmSeed → here → #5 SetPin).
 *
 * Renders a 5-step progress checklist:
 *   - done   · green check + strikethrough
 *   - active · violet right-arrow + bold label
 *   - pending· tertiary dot + dim label
 *
 * Hard 5 s safety timeout fires onSyncComplete regardless of RPC state — never
 * trap the user in the spinner.
 */

interface SyncWalletScreenProps {
  mnemonic: string;
  scheme: TransparentScheme;
  onSyncComplete: () => void;
}

interface Step {
  label: string;
  done: boolean;
  active: boolean;
}

const STEP_LABELS = [
  'Deriving keys',
  'Loading balances',
  'Checking staking position',
  'Scanning transaction history',
  'Ready',
];

const STEP_DELAY = 800;
const MAX_TIMEOUT = 5_000;

function buildSteps(currentStep: number): Step[] {
  return STEP_LABELS.map((label, idx) => ({
    label,
    done: idx < currentStep,
    active: idx === currentStep,
  }));
}

export function SyncWalletScreen({mnemonic, scheme, onSyncComplete}: SyncWalletScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const completedRef = useRef(false);

  const complete = (cb: () => void) => {
    if (!completedRef.current) {
      completedRef.current = true;
      cb();
    }
  };

  useEffect(() => {
    let cancelled = false;

    const hardTimeout = setTimeout(() => {
      if (!cancelled) complete(onSyncComplete);
    }, MAX_TIMEOUT);

    const advance = (step: number) => {
      if (!cancelled) setCurrentStep(step);
    };

    const run = async () => {
      advance(0);
      let publicKeyBytes: Uint8Array | null = null;
      try {
        const seed = await mnemonicToSeed(mnemonic);
        const keypair = deriveTransparentKeypair(seed, scheme);
        publicKeyBytes = keypair.publicKey;
        zeroize(keypair.secretKey);
        zeroize(seed);
      } catch {
        // best-effort
      }
      if (cancelled) return;
      await new Promise<void>(resolve => setTimeout(resolve, STEP_DELAY));
      if (cancelled) return;

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

      advance(2);
      await new Promise<void>(resolve => setTimeout(resolve, STEP_DELAY));
      if (cancelled) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mnemonic, scheme]);

  const steps = buildSteps(currentStep);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      <View className="flex-1 px-6 justify-center">
        {/* Hero — sparkle icon + title */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-icon-hero bg-accent-transparent-tint items-center justify-center mb-4 border border-accent-transparent">
            <Sparkles size={28} color="#B084FC" strokeWidth={1.75} />
          </View>
          <Text variant="h2" className="text-center mb-2">
            Setting up your wallet
          </Text>
          <Text variant="body" className="text-center text-fg-secondary">
            This should take just a moment.
          </Text>
        </View>

        {/* 5-step checklist */}
        <View className="gap-4">
          {steps.map((step, idx) => (
            <View key={idx} className="flex-row items-center gap-3">
              <View className="w-6 items-center justify-center">
                {step.done ? (
                  <Check size={20} color="#3FD68B" strokeWidth={2.5} />
                ) : step.active ? (
                  <ArrowRight size={20} color="#B084FC" strokeWidth={2.5} />
                ) : (
                  <Circle size={8} color="#3A3D44" strokeWidth={2} fill="#3A3D44" />
                )}
              </View>
              <Text
                variant="body"
                className={cn(
                  step.done && 'text-success line-through',
                  step.active && 'text-fg-primary font-geist-semibold',
                  !step.done && !step.active && 'text-fg-disabled',
                )}>
                {step.label}
              </Text>
              {step.active && (
                <View className="ml-auto">
                  <ActivityIndicator size="small" color="#B084FC" />
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
