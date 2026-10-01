import {useEffect, useState} from 'react';

const systemNow = (): number => Date.now();

/** The current time, re-read every `ms` — for "cached 2 s ago" and the offline counters. */
export function useNow(ms = 1_000, now: () => number = systemNow): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    const i = setInterval(() => setT(now()), ms);
    return () => clearInterval(i);
  }, [ms, now]);
  return t;
}
