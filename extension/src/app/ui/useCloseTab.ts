import {useEffect, useRef, useState} from 'react';
import type {Platform} from '../platform';

/** How long to wait before deciding the browser refused window.close() (the tab is still here). */
export const CLOSE_CHECK_MS = 500;

/**
 * [Close this tab] (#7, #40, the resume stand-in): window.close(), and the button hides when the tab is
 * still here a moment later — a browser may refuse to close a tab it did not open (spec §3.7).
 */
export function useCloseTab(platform: Platform): {refused: boolean; close(): void} {
  const [refused, setRefused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return {
    refused,
    close: () => {
      platform.closeWindow();
      timer.current = setTimeout(() => setRefused(true), CLOSE_CHECK_MS);
    },
  };
}
