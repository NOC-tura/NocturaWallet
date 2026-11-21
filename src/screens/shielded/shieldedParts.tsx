import React from 'react';
import {View, Pressable, ActivityIndicator} from 'react-native';
import {AlertTriangle, Check, Clock, Copy, Cpu, Lock, X} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {cn} from '../../utils/cn';

/**
 * The pieces the shielded #18 / #21 screens share (M1c Task 8 fix round 1, I-2 / M-6): the deposit's
 * #18 (`ZkProofScreen`), the deposit's #21 (`ShieldStatusScreen`) and the unshield run
 * (`unshield/UnshieldRunScreen`) draw the same design elements of index.html §s18 / §s21 — the
 * hero ring, the stage row, the status ring and the tx meta row — from this one place.
 */

const ACCENT = '#5BE3C2';
const DANGER = '#FF5C6A';

/** "4Hq7Mb…5e6f" — first 6 + last 4 of a signature (#21's Tx hash row). */
export function shortSignature(sig: string): string {
  return sig.length > 16 ? `${sig.slice(0, 6)}…${sig.slice(-4)}` : sig;
}

/** #18's hero ring (index.html §s18 `.hero-block`): the CPU glyph while proving, a check when ready, an X on failure. */
export function ProofHeroRing({tone, testID}: {tone: 'busy' | 'ready' | 'failed'; testID?: string}) {
  return (
    <View
      testID={testID}
      className={cn(
        'w-[72px] h-[72px] rounded-full items-center justify-center border',
        tone === 'failed' ? 'border-danger' : 'border-accent-shielded',
      )}>
      {tone === 'failed' ? (
        <X size={34} color={DANGER} strokeWidth={2} />
      ) : tone === 'ready' ? (
        <Check size={34} color={ACCENT} strokeWidth={2} />
      ) : (
        // the glyph's wrapper carries the testID (an svg drops it in the test renderer)
        <View testID={testID ? `${testID}-cpu` : undefined}>
          <Cpu size={34} color={ACCENT} strokeWidth={1.75} />
        </View>
      )}
    </View>
  );
}

export type StageRowStatus = 'pending' | 'active' | 'done' | 'errored' | 'skipped';

/** One #18 stage row: the number disc (a check when done), the title, the measured meta line, the mark. */
export function StageRow({
  testID,
  num,
  title,
  status,
  meta,
  mark,
}: {
  testID: string;
  num: number;
  title: string;
  status: StageRowStatus;
  meta: string;
  mark: string;
}) {
  const isActive = status === 'active';
  const isDone = status === 'done';
  const isErrored = status === 'errored';
  return (
    <View
      testID={testID}
      accessibilityLabel={`${title}: ${status}`}
      className={cn(
        'flex-row items-center gap-3 p-3 rounded-md',
        isActive
          ? 'bg-[rgba(91,227,194,0.08)] border border-[rgba(91,227,194,0.32)]'
          : isErrored
            ? 'bg-[rgba(255,92,106,0.08)] border border-[rgba(255,92,106,0.32)]'
            : 'bg-bg-surface-1',
        status === 'skipped' && 'opacity-50',
      )}>
      <View
        className={cn('w-7 h-7 rounded-full items-center justify-center', isDone || isActive ? 'bg-accent-shielded-tint' : 'bg-bg-surface-2')}>
        {isDone ? (
          <View testID={`${testID}-check`}>
            <Check size={14} color={ACCENT} strokeWidth={2} />
          </View>
        ) : isErrored ? (
          <AlertTriangle size={14} color={DANGER} strokeWidth={2} />
        ) : (
          <Text variant="body-sm" mono numeral className={isActive ? 'text-accent-shielded' : 'text-fg-tertiary'}>
            {num}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text variant="body-sm" className="text-fg-primary">
          {title}
        </Text>
        <Text variant="caption" className="text-fg-tertiary" testID={`${testID}-meta`}>
          {meta}
        </Text>
      </View>
      <Text variant="body-sm" mono numeral className={isErrored ? 'text-danger' : 'text-fg-tertiary'}>
        {mark}
      </Text>
    </View>
  );
}

export type StatusTone = 'busy' | 'ok' | 'warn' | 'bad';

/** #21's status ring: the spinner while busy, the ok glyph (a lock for a deposit, a check for an unshield), the X, the dashed clock. */
export function StatusRing({tone, okIcon}: {tone: StatusTone; okIcon: 'lock' | 'check'}) {
  if (tone === 'ok') {
    return (
      <View className="w-32 h-32 rounded-full items-center justify-center border-2 border-accent-shielded bg-[rgba(91,227,194,0.10)]">
        {okIcon === 'lock' ? (
          <Lock size={52} color={ACCENT} strokeWidth={1.75} />
        ) : (
          <Check size={56} color={ACCENT} strokeWidth={2} />
        )}
      </View>
    );
  }
  if (tone === 'bad') {
    return (
      <View className="w-32 h-32 rounded-full items-center justify-center border-2 border-danger bg-[rgba(248,113,113,0.10)]">
        <X size={56} color="#F87171" strokeWidth={2} />
      </View>
    );
  }
  if (tone === 'warn') {
    return (
      <View className="w-32 h-32 rounded-full items-center justify-center bg-[rgba(242,181,59,0.08)] border-[1.5px] border-dashed border-[#F2B53B]">
        <Clock size={52} color="#F2B53B" strokeWidth={1.75} />
      </View>
    );
  }
  return (
    <View className="w-32 h-32 rounded-full items-center justify-center border border-[rgba(91,227,194,0.35)]">
      <ActivityIndicator size="large" color={ACCENT} />
    </View>
  );
}

/** #21's meta row: an overline label, a mono value, an optional copy button. */
export function MetaRow({label, value, onCopy}: {label: string; value: string; onCopy?: () => void}) {
  return (
    <View className="flex-row items-center gap-3 py-3 border-t border-bg-surface-3">
      <Text variant="overline" className="text-fg-tertiary w-[76px]">
        {label}
      </Text>
      <Text variant="body-sm" className="flex-1 font-geist-mono text-fg-secondary" numberOfLines={2}>
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

/**
 * #16's one balance line (Shielded UX part B, decision B-2): "Public balance" on Make private,
 * "Private balance" on Make public. UX-A 1's layout: the label keeps its width, the value takes the
 * rest of the row, right-aligned, and wraps rather than running into the label.
 */
export function BalanceRow({label, value, testID}: {label: string; value: string; testID: string}) {
  return (
    <View className="flex-row items-start justify-between gap-3 mb-3" testID={testID}>
      <Text variant="body-sm" className="text-fg-secondary shrink-0">
        {label}
      </Text>
      <Text variant="body-sm" numeral className="flex-1 text-right font-geist-semibold text-fg-primary" testID={`${testID}-value`}>
        {value}
      </Text>
    </View>
  );
}
