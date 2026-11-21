import React, {useState} from 'react';
import {Pressable, View} from 'react-native';
import {Text} from '../ui';
import {DETAILS} from '../../copy/modes';

/**
 * "Details ▾" (Shielded UX part B, spec §3.2): the technical rows of a card, collapsed by default.
 * No persisted state — each mount starts collapsed. It never holds a warning or a blocking
 * condition (plan Review Focus 2): those stay outside it, always visible.
 */
export function DetailsDisclosure({testID, children}: {testID: string; children: React.ReactNode}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View testID={testID}>
      <Pressable
        testID={`${testID}-toggle`}
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        accessibilityLabel={DETAILS}
        accessibilityState={{expanded}}
        hitSlop={8}
        className="flex-row items-center min-h-touch-min mt-1">
        <Text variant="body-sm" className="text-fg-secondary">
          {`${DETAILS} ${expanded ? '▴' : '▾'}`}
        </Text>
      </Pressable>
      {expanded ? <View testID={`${testID}-body`}>{children}</View> : null}
    </View>
  );
}
