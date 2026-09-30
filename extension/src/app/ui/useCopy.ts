import {useEffect, useState} from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Copy with web/src/ui/CopyButton.tsx's honesty: "Copied" only when the clipboard accepted it, "Copy
 * failed" when it refused or there is no clipboard API; back to idle after 2 s. The clipboard is never
 * cleared afterwards (spec §4), and the screens say so.
 */
export function useCopy(): [CopyState, (value: string) => void] {
  const [state, setState] = useState<CopyState>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);
  const copy = (value: string) => {
    const clip: Clipboard | undefined = navigator.clipboard;
    if (!clip) {
      setState('failed');
      return;
    }
    clip.writeText(value).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  };
  return [state, copy];
}
