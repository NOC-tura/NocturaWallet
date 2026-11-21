import React from 'react';
import {View} from 'react-native';
import {AlertTriangle} from 'lucide-react-native';
import {Text} from '../ui';

/** spec §3.4: over the limit only with an amount above `max` (MAX itself, exactly `max`, is allowed). BigInt. */
export function overLimit(amount: bigint | null, max: bigint): boolean {
  return amount !== null && amount > max;
}

/**
 * Nothing while the amount is at most `max`; above it, `message` in the danger tone (Shielded UX
 * part B, spec §3.4, decision B-4). The caller disables its CTA with `overLimit` — one rule, one
 * function. The message is the caller's (spec ambiguity A5): Make public passes `makePublicLimit`.
 */
export function AmountLimitHint({
  amount,
  max,
  message,
  testID,
}: {
  amount: bigint | null;
  max: bigint;
  message: string;
  testID: string;
}) {
  if (!overLimit(amount, max)) {
    return null;
  }
  return (
    <View className="flex-row items-center gap-2" testID={`${testID}-row`}>
      <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
      <Text variant="caption" className="text-danger" testID={testID}>
        {message}
      </Text>
    </View>
  );
}
