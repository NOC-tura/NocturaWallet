/**
 * M1d spec §4.3 (D1; plan A13): Swap, presale and referral stay on the main account. While another
 * account is selected, this line says so, so the user is never surprised; with main selected it
 * renders nothing — no wrapper of the caller's stays mounted, so the line's own spacing comes in
 * through `className`. The main account's own label ("Account 4" for a slip10:3 main).
 */
import React from 'react';
import {Text} from '../ui';
import {cn} from '../../utils/cn';
import {useAccountList, useSelectedAccount} from '../../hooks/useSelectedAccount';
import {USES_MAIN_ACCOUNT, fromMainLine} from '../../copy/accounts';

export function MainAccountLine({variant, testID, className}: {variant: 'from' | 'uses'; testID: string; className?: string}) {
  const selected = useSelectedAccount();
  const list = useAccountList();
  const main = list?.accounts[0];
  if (selected === null || selected.isMain || main === undefined) {
    return null;
  }
  return (
    <Text variant="caption" className={cn('text-fg-secondary', className)} testID={testID}>
      {variant === 'from' ? fromMainLine(main.label) : USES_MAIN_ACCOUNT}
    </Text>
  );
}
