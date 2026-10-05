import type {Timers} from '../page';

/**
 * A manual clock for the vault page's timers: nothing runs until `advance(ms)`, which fires every due
 * timeout and interval in time order. Deterministic — no real time passes in a screen test.
 */
export function fakeTimers(start = 1_000_000): Timers & {advance(ms: number): void; skip(ms: number): void; pending(): number} {
  let now = start;
  let next = 1;
  const jobs = new Map<number, {at: number; every: number | null; f: () => void}>();
  const timers = {
    now: () => now,
    setTimeout(f: () => void, ms: number) {
      const id = next++;
      jobs.set(id, {at: now + ms, every: null, f});
      return id;
    },
    clearTimeout(id: number) {
      jobs.delete(id);
    },
    setInterval(f: () => void, ms: number) {
      const id = next++;
      jobs.set(id, {at: now + ms, every: Math.max(1, ms), f});
      return id;
    },
    clearInterval(id: number) {
      jobs.delete(id);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let due: [number, {at: number; every: number | null; f: () => void}] | undefined;
        for (const e of jobs) if (e[1].at <= end && (due === undefined || e[1].at < due[1].at)) due = e;
        if (due === undefined) break;
        const [id, job] = due;
        now = job.at;
        if (job.every === null) jobs.delete(id);
        else job.at += job.every;
        job.f();
      }
      now = end;
    },
    /**
     * B1b-2b C20: the clock moves on and NO timer fires — a background tab whose timers the browser throttled. A screen
     * that relies on its timer alone keeps whatever the timer was to drop.
     */
    skip(ms: number) {
      now += ms;
    },
    pending: () => jobs.size,
  };
  return timers;
}
