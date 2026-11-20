import React, {useState} from 'react';
import {Pressable, View} from 'react-native';
import {Check, Send, UserPlus, Wallet} from 'lucide-react-native';
import {Text} from '../ui';
import {cn} from '../../utils/cn';
import {
  CHANGE,
  DESTINATION_EXTERNAL,
  DESTINATION_EXTERNAL_SUB,
  DESTINATION_FRESH,
  DESTINATION_MAIN,
  RECOMMENDED,
  destinationSummary,
} from '../../copy/modes';

/**
 * The destination of Make public (Shielded UX part B, spec §3.3, decision B-5), replacing the three
 * cards of M1c's #16. Collapsed: "To: {selected} · Change" ("To: Choose a destination" while
 * nothing is chosen — owner decision A1). Change opens the three options with their one-line
 * descriptions; a pick closes them. The selected destination's warning (main / another address)
 * shows under the row whether it is open or not — never behind Change, never inside Details; the
 * fresh account's unavailable reason shows under the collapsed row (open, the option says it).
 *
 * Presentational: WHICH destinations are offered, what is preselected and every refusal rule stay
 * with M1c's code in `UnshieldSide.tsx` (`a0UnshieldDestinationOffer`, `externalOwnerProblem`).
 */

export type DestinationChoice = 'fresh' | 'main' | 'external';

export interface DestinationRowProps {
  testID: string;
  choice: DestinationChoice | null;
  onChoose: (c: DestinationChoice) => void;
  /** no quote yet: nothing can be chosen */
  disabled: boolean;
  /** the fresh account: whether it is offered, and its one-line description (or its unavailable reason) */
  fresh: {available: boolean; sub: string};
  mainSub: string;
  mainMono: boolean;
  /** the reason shown under the COLLAPSED row while the fresh account is unavailable (S9 / S11) */
  freshReason: string | null;
  /** the chosen destination's warning, always visible under the row */
  warning: {testID: string; text: string} | null;
  /** below the row (the "Another address" input) */
  children?: React.ReactNode;
}

function nameOf(choice: DestinationChoice | null): string | null {
  switch (choice) {
    case 'fresh':
      return `${DESTINATION_FRESH}${RECOMMENDED}`;
    case 'main':
      return DESTINATION_MAIN;
    case 'external':
      return DESTINATION_EXTERNAL;
    case null:
      return null;
  }
}

export function DestinationRow({
  testID,
  choice,
  onChoose,
  disabled,
  fresh,
  mainSub,
  mainMono,
  freshReason,
  warning,
  children,
}: DestinationRowProps) {
  const [open, setOpen] = useState(false);
  const pick = (c: DestinationChoice) => {
    onChoose(c);
    setOpen(false);
  };
  return (
    <View className="rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4" testID={testID}>
      <View className="flex-row items-center justify-between gap-3 min-h-touch-min">
        <Text variant="body-sm" className="flex-1 font-geist-semibold text-fg-primary" testID={`${testID}-summary`}>
          {destinationSummary(nameOf(choice))}
        </Text>
        <Pressable
          testID={`${testID}-change`}
          onPress={disabled ? undefined : () => setOpen(o => !o)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={CHANGE}
          accessibilityState={{disabled, expanded: open}}
          hitSlop={8}>
          <Text variant="body-sm" className={cn('font-geist-semibold', disabled ? 'text-fg-disabled' : 'text-accent-shielded')}>
            {CHANGE}
          </Text>
        </Pressable>
      </View>
      {freshReason !== null && !open ? (
        <Text variant="caption" className="text-fg-tertiary mt-1" testID={`${testID}-fresh-reason`}>
          {freshReason}
        </Text>
      ) : null}
      {warning ? (
        <Text variant="caption" className="text-warning mt-2" testID={warning.testID}>
          {warning.text}
        </Text>
      ) : null}
      {open ? (
        <View className="mt-3" testID={`${testID}-options`}>
          <OptionRow
            testID={`${testID}-fresh`}
            Icon={UserPlus}
            title={DESTINATION_FRESH}
            sub={fresh.sub}
            selected={choice === 'fresh'}
            disabled={disabled || !fresh.available}
            onPress={() => pick('fresh')}
          />
          <OptionRow
            testID={`${testID}-main`}
            Icon={Wallet}
            title={DESTINATION_MAIN}
            sub={mainSub}
            mono={mainMono}
            selected={choice === 'main'}
            disabled={disabled}
            onPress={() => pick('main')}
          />
          <OptionRow
            testID={`${testID}-external`}
            Icon={Send}
            title={DESTINATION_EXTERNAL}
            sub={DESTINATION_EXTERNAL_SUB}
            selected={choice === 'external'}
            disabled={disabled}
            onPress={() => pick('external')}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function OptionRow({
  testID,
  Icon,
  title,
  sub,
  mono,
  selected,
  disabled,
  onPress,
}: {
  testID: string;
  Icon: typeof Wallet;
  title: string;
  sub: string;
  mono?: boolean;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{selected, disabled}}
      className={cn(
        'flex-row items-start gap-3 p-3 rounded-md mb-2 min-h-touch-min border',
        selected ? 'border-accent-shielded bg-[rgba(91,227,194,0.08)]' : 'border-bg-surface-3',
        disabled && 'opacity-60',
      )}>
      <View className="w-8 h-8 rounded-pill items-center justify-center bg-bg-surface-2">
        <Icon size={16} color={disabled ? '#6E727A' : '#A8ACB5'} strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text variant="body-sm" className={cn('font-geist-semibold', disabled ? 'text-fg-disabled' : 'text-fg-primary')}>
          {title}
        </Text>
        <Text variant="caption" className={cn('text-fg-tertiary mt-0.5', mono && 'font-geist-mono')} testID={`${testID}-sub`}>
          {sub}
        </Text>
      </View>
      <View
        className={cn(
          'w-5 h-5 rounded-full items-center justify-center border mt-1',
          selected ? 'border-accent-shielded bg-accent-shielded' : 'border-fg-tertiary',
        )}>
        {selected ? <Check size={12} color="#0A0A0A" strokeWidth={2.5} /> : null}
      </View>
    </Pressable>
  );
}
