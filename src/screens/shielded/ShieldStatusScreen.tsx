import React, {useEffect, useRef, useState} from 'react';
import {View, Pressable, Linking, ScrollView, BackHandler, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {Check, ShieldCheck, FileText} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {cn} from '../../utils/cn';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {submitA0Deposit} from '../../modules/shielded/a0/depositFlow';
import type {A0DepositOutcome, A0SubmitStage} from '../../modules/shielded/a0/depositFlow';
import {a0UnspentBalance} from '../../modules/shielded/a0/noteStore';
import {
  A0_DEPOSIT_FEE_LAMPORTS,
  A0_RHO_MARKER_RENT_LAMPORTS,
  SOL_DECIMALS,
  a0ErrorText,
  displayAmount,
  releasePreparedA0Deposit,
} from '../../modules/shielded/a0/screenSupport';
import {keychainManager} from '../../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {getConnection} from '../../modules/solana/connection';
import type {ShieldIntent} from '../../types/shield';
import {A0} from '../../modules/shielded/a0/constants';
import {explorerTxUrl} from '../../constants/chain';
import {MetaRow, StatusRing, shortSignature} from './shieldedParts';

/**
 * #21 tx-status for the A0 deposit — mirror /home/user/Downloads/index.html §s21: the loading state
 * (state 1), and the SHIELDED success variant (state 4: lock ring, "SHIELDED" amount card, Tx hash /
 * position rows, View details + Done). Its "Sent privately" sub-line (a claim about the sender)
 * does not describe a deposit and is not used (D27; privacyClaims.test refuses it).
 *
 * THIS SCREEN OWNS THE SEND: it TAKES the prepared deposit (`releasePreparedA0Deposit`, once) and
 * calls `submitA0Deposit` with a second keychain read (Task 4). Its `onStage` drives the copy
 * (signing → recorded → submitted → confirming → settling) — the signature is shown from `recorded`
 * on. The outcomes, said as what they are:
 *   - unspent  → "Shielded", the note's position (leaf index) in the pool, the new shielded balance;
 *   - pending  → "Not confirmed yet": the note is kept and settled at the next start — NEVER
 *                "failed" (Task 4: the startup reconciliation is the authority on a pending note);
 *                a pending outcome with `foreignSignature` (M1b final review I-2: another deposit
 *                at our rho after OUR confirmed send) says so, with the other deposit's signature
 *                (M1c Task 8, the copy M1b parked);
 *   - dropped  → "Not shielded": another deposit holds this note's number; no tokens moved;
 *   - a refusal before the send (keychain cancelled, signer mismatch, store refusal) → "Not sent",
 *     its code; nothing was broadcast;
 *   - a note-store refusal AFTER the pending write (the only throw left there, Task 4 a072242) →
 *     "Not confirmed yet" with its code — except E_A0_STORE_CHANGED (a wipe + import while in
 *     flight): "Not in this wallet", the earlier wallet's phrase recovers it.
 * Pending deposits are settled by the startup reconciliation or "Check again" (#16, dashboard).
 *
 * DEPARTURES FROM THE DESIGN (said loudly, R1-m2): "View details" opens the explorer
 * (`explorer.solana.com/tx/<sig>?cluster=devnet`), not #27; there is no ~90 s stuck-tx redirect to
 * #54 — `submitA0Deposit`'s poll ends in an outcome, and a pending deposit is the reconciliation's.
 * No retry and no re-sign on this screen (one prepared deposit → one send); a new shield starts at #16.
 *
 * Back is locked while the send runs (screen.md #21 "Predictive-back LOCKED"): leaving would not stop
 * it, so the gesture explains that instead of pretending to cancel.
 */

type Phase =
  | {kind: 'running'; stage: A0SubmitStage | 'auth'}
  | {kind: 'done'; outcome: A0DepositOutcome}
  /** a throw: before the pending write nothing was broadcast; after it (`recorded`) the note is kept */
  | {kind: 'refused'; code: string | null; message: string; recorded: boolean}
  | {kind: 'missing'};

const STAGE_TEXT: Record<A0SubmitStage | 'auth', string> = {
  auth: 'Unlock with your fingerprint or passcode to sign.',
  signing: 'Signing with your main account.',
  recorded: 'Recorded on this device · sending to Solana devnet.',
  submitted: 'Submitted to Solana devnet · waiting for confirmation.',
  confirming: 'Submitted to Solana devnet · waiting for confirmation.',
  settling: "Confirmed · reading the note's position from the pool.",
};

interface ShieldStatusScreenProps {
  intent: ShieldIntent;
  onDone: () => void;
}

export function ShieldStatusScreen({intent, onDone}: ShieldStatusScreenProps) {
  const [phase, setPhase] = useState<Phase>({kind: 'running', stage: 'auth'});
  const [signature, setSignature] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // one send per mount, whatever re-renders
    started.current = true;
    const prepared = releasePreparedA0Deposit(intent.preparedId);
    if (!prepared) {
      setPhase({kind: 'missing'});
      return;
    }
    (async () => {
      let seed: Uint8Array;
      try {
        seed = await mnemonicToSeed(await keychainManager.retrieveSeed());
      } catch (e) {
        setPhase({kind: 'refused', ...a0ErrorText(e), recorded: false});
        return;
      }
      let recorded = false;
      try {
        const outcome = await submitA0Deposit(getConnection(), prepared, seed, {
          onStage: (stage, sig) => {
            if (stage === 'recorded') recorded = true;
            if (sig) setSignature(sig);
            setPhase({kind: 'running', stage});
          },
        });
        setSignature(outcome.signature);
        if (outcome.status === 'unspent') {
          try {
            setBalance(a0UnspentBalance());
          } catch {
            setBalance(null);
          }
        }
        setPhase({kind: 'done', outcome});
      } catch (e) {
        setPhase({kind: 'refused', ...a0ErrorText(e), recorded});
      }
    })();
  }, [intent.preparedId]);

  const running = phase.kind === 'running';
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (running) {
        Alert.alert('Shield in progress', 'Leaving does not stop it. The result is recorded on this device either way.');
        return true;
      }
      onDone();
      return true;
    });
    return () => sub.remove();
  }, [running, onDone]);

  const amount = `${displayAmount(BigInt(intent.amount), intent.decimals)} ${intent.tokenSymbol}`;
  const view = viewOf(phase);
  const shortSig = signature ? shortSignature(signature) : signature;

  const copySig = () => {
    if (!signature) return;
    try {
      Clipboard.setString(signature);
      setTimeout(() => Clipboard.setString(''), 30_000);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-row items-center px-4 py-3 gap-2">
        <ShieldCheck size={12} color="#5BE3C2" strokeWidth={2} />
        <Text variant="overline" className="text-accent-shielded">
          Shielded
        </Text>
        <Text variant="h2" className="flex-1">
          {running ? 'Shielding…' : 'Shield'}
        </Text>
        {view.badge ? (
          <Text variant="overline" className={view.tone === 'ok' ? 'text-accent-shielded' : 'text-warning'}>
            {view.badge}
          </Text>
        ) : null}
      </View>

      <ScrollView contentContainerClassName="flex-grow items-center px-5 pb-8">
        <View className="items-center justify-center py-8 gap-5 w-full">
          <StatusRing tone={view.tone} okIcon="lock" />
          <Text
            variant="h1"
            testID="shield-status-title"
            className={cn(
              'text-center',
              view.tone === 'ok' ? 'text-accent-shielded' : view.tone === 'bad' ? 'text-danger' : view.tone === 'warn' ? 'text-warning' : '',
            )}>
            {view.title}
          </Text>
          <Text variant="body-sm" className="text-center text-fg-secondary" style={{maxWidth: 320}} testID="shield-status-sub">
            {view.sub}
          </Text>
        </View>

        <View className="w-full rounded-2xl p-5 items-center gap-2 border border-[rgba(91,227,194,0.45)] bg-bg-surface-1">
          <Text variant="overline" className="text-accent-shielded">
            Shielded
          </Text>
          <Text variant="balance-lg" numeral className="text-fg-primary">
            {amount}
          </Text>
          {balance !== null ? (
            <Text variant="caption" className="text-fg-tertiary" testID="shield-status-balance">
              {`Shielded balance now ${displayAmount(balance, intent.decimals)} ${intent.tokenSymbol}`}
            </Text>
          ) : null}
        </View>

        {signature ? (
          <View className="w-full bg-bg-surface-1 rounded-lg px-5 mt-3">
            <MetaRow label="Tx hash" value={shortSig ?? ''} onCopy={copySig} />
            {phase.kind === 'done' && phase.outcome.status === 'unspent' ? (
              <MetaRow label="Position" value={`#${phase.outcome.leafIndex} in the pool`} />
            ) : null}
            <MetaRow
              label="Fees"
              value={`${formatTokenAmount(A0_DEPOSIT_FEE_LAMPORTS, SOL_DECIMALS)} SOL + ≈ ${formatTokenAmount(A0_RHO_MARKER_RENT_LAMPORTS, SOL_DECIMALS)} SOL rent`}
            />
          </View>
        ) : null}
      </ScrollView>

      <View className="px-6 pb-2 pt-2 gap-2">
        {running ? (
          <Button label="Don't close · waiting for confirmation" variant="primary" disabled onPress={() => {}} />
        ) : (
          <View className="flex-row gap-2">
            {signature ? (
              <Pressable
                testID="shield-status-details"
                onPress={() => {
                  Linking.openURL(explorerTxUrl(signature, 'solanaexplorer', A0.cluster)).catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityLabel="View details"
                className="flex-1 min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2 bg-bg-surface-1">
                <FileText size={16} color="#E7E9EE" strokeWidth={1.75} />
                <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
                  View details
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              testID="shield-status-done"
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel="Done"
              className="flex-1 min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2 bg-accent-shielded active:opacity-90">
              <Check size={18} color="#0A0A0A" strokeWidth={2} />
              <Text variant="body-lg" className="font-geist-semibold text-bg-base">
                Done
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

type Tone = 'busy' | 'ok' | 'warn' | 'bad';

function viewOf(phase: Phase): {title: string; sub: string; tone: Tone; badge: string | null} {
  switch (phase.kind) {
    case 'running':
      return {title: 'Shielding…', sub: STAGE_TEXT[phase.stage], tone: 'busy', badge: null};
    case 'missing':
      return {
        title: 'Nothing to send',
        sub: 'This deposit is no longer prepared (it was already sent, or replaced). Start the shield again.',
        tone: 'warn',
        badge: null,
      };
    case 'refused':
      // After the pending write `submitA0Deposit` throws only the note store's refusals (Task 4's
      // fix a072242): a sync or RPC failure is a `pending` outcome, not a throw.
      if (phase.recorded && phase.code === 'E_A0_STORE_CHANGED') {
        return {
          title: 'Not in this wallet',
          sub: 'E_A0_STORE_CHANGED · The wallet on this device was replaced while this deposit was in flight. It was sent from the earlier wallet; restoring that wallet from its recovery phrase recovers it if it landed.',
          tone: 'warn',
          badge: null,
        };
      }
      return phase.recorded
        ? {
            title: 'Not confirmed yet',
            sub: `${phase.code ? `${phase.code} · ` : ''}${phase.message}. It was sent, but this device could not record its result. The wallet settles it the next time it starts.`,
            tone: 'warn',
            badge: 'PENDING',
          }
        : {
            title: 'Not sent',
            sub: `${phase.code ? `${phase.code} · ` : ''}${phase.message}. Nothing was broadcast.`,
            tone: 'bad',
            badge: null,
          };
    case 'done': {
      const o = phase.outcome;
      if (o.status === 'unspent') {
        return {
          title: 'Shielded',
          sub: `Confirmed on Solana devnet · your note is at position #${o.leafIndex} in the pool.`,
          tone: 'ok',
          badge: 'CONFIRMED',
        };
      }
      if (o.status === 'dropped') {
        return {
          title: 'Not shielded',
          sub: 'Another deposit already used this note’s number, so yours did not land. No tokens moved; the network fee may have been charged.',
          tone: 'bad',
          badge: null,
        };
      }
      if (o.foreignSignature) {
        // M1b final review I-2, its #21 copy parked for M1c: our send was reported confirmed, yet the
        // pool's history shows ANOTHER deposit at this note's number — a contradiction (the number's
        // marker can be created once), so nothing is decided here: the note stays pending.
        return {
          title: 'Not confirmed yet',
          sub: `Solana devnet reported this deposit confirmed, but the pool's history shows another deposit (${shortSignature(o.foreignSignature)}) at this note's number. Nothing is decided from that: your deposit stays pending on this device and is settled from the chain the next time the wallet starts, or when you tap Check again.`,
          tone: 'warn',
          badge: 'PENDING',
        };
      }
      const why =
        o.reason === 'send-failed'
          ? 'The network did not accept the transaction.'
          : o.reason === 'not-confirmed'
            ? 'The network has not confirmed it yet.'
            : 'It is confirmed, but the pool’s history does not list it yet.';
      return {
        title: 'Not confirmed yet',
        sub: `${why} Your deposit is kept on this device and will be settled the next time the wallet starts, or when you tap Check again.${o.detail ? ` (${o.detail})` : ''}`,
        tone: 'warn',
        badge: 'PENDING',
      };
    }
  }
}
