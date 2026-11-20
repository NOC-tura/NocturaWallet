import React from 'react';
import {Pressable} from 'react-native';
import {Text} from './ui';
import {cn} from '../utils/cn';
import type {A0CheckAgain} from '../hooks/useA0Shielded';

/** "Check again" (R1-m9; M1c: pending unshields too): the reconciliation now; disabled while the startup step runs or a check is in flight. */
export function CheckAgainLink({checkAgain, testID}: {checkAgain: A0CheckAgain; testID: string}) {
  return (
    <Pressable
      testID={testID}
      onPress={checkAgain.disabled ? undefined : checkAgain.run}
      disabled={checkAgain.disabled}
      accessibilityRole="button"
      accessibilityLabel="Check the pending transaction again"
      accessibilityState={{disabled: checkAgain.disabled}}
      hitSlop={8}
      className="ml-3">
      <Text
        variant="caption"
        className={cn('font-geist-semibold', checkAgain.disabled ? 'text-fg-disabled' : 'text-accent-shielded')}>
        {checkAgain.checking ? 'Checking…' : 'Check again'}
      </Text>
    </Pressable>
  );
}
