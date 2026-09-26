import {useEffect, useState} from 'react';
import {Icon} from './Icon';

type State = 'idle' | 'copied' | 'failed';

/**
 * Copies one value, and says "Copied" only when the clipboard accepted it.
 *
 * A confirmation that fires regardless is worse than none here: the reader goes on to
 * paste whatever was on their clipboard before, and on a page about payments that may be
 * an address. So a refusal, or a browser with no clipboard API, reads "Copy failed".
 */
export function CopyButton({value, label}: {value: string; label: string}) {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const name = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label;

  function copy() {
    const clip: Clipboard | undefined = navigator.clipboard;
    if (!clip) {
      setState('failed');
      return;
    }
    clip.writeText(value).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  }

  return (
    <button type="button" className="icon-btn" aria-label={name} title={name} onClick={copy}>
      <Icon name={state === 'copied' ? 'check' : state === 'failed' ? 'x' : 'copy'} size={16} />
    </button>
  );
}
