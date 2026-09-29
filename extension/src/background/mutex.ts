export type Mutex = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Runs read-modify-write sequences one at a time. storage.session has no transactions, and two
 * messages handled concurrently (two "Send" taps, a send racing the poller) must not interleave.
 */
export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}
