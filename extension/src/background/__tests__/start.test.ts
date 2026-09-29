// The background's start-up, run against a fake chrome.*: before anything else, storage.session
// is pinned to trusted contexts (Fable review, Minor 10), and the listeners are registered.
describe('background start', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('pins storage.session to TRUSTED_CONTEXTS when the service worker starts', async () => {
    const accessLevels: unknown[] = [];
    const listeners: string[] = [];
    const on = (name: string) => ({addListener: () => void listeners.push(name)});
    const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
    vi.stubGlobal('chrome', {
      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onStartup: on('onStartup')},
      storage: {session: {...area(), setAccessLevel: async (o: unknown) => void accessLevels.push(o)}, local: area()},
      alarms: {create: () => undefined, clear: async () => true, onAlarm: on('onAlarm')},
      windows: {getAll: async () => [], onRemoved: on('onRemoved')},
    });
    await import('../index');
    expect(accessLevels).toEqual([{accessLevel: 'TRUSTED_CONTEXTS'}]);
    expect(listeners.sort()).toEqual(['onAlarm', 'onMessage', 'onRemoved', 'onStartup']);
  });

  // Fable re-review: pinSessionAccess() was fired with `void`, not awaited or caught — a
  // rejecting setAccessLevel (e.g. an older Chrome, or Firefox mid-migration) became an
  // unhandled promise rejection at start-up instead of a warning, and vitest fails a test on
  // any unhandled rejection that surfaces during it.
  it('does not unhandled-reject when pinning storage.session fails, and still registers every listener', async () => {
    const listeners: string[] = [];
    const on = (name: string) => ({addListener: () => void listeners.push(name)});
    const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
    const warnings: unknown[] = [];
    vi.spyOn(console, 'warn').mockImplementation((...args) => void warnings.push(args));
    vi.stubGlobal('chrome', {
      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onStartup: on('onStartup')},
      storage: {
        session: {
          ...area(),
          setAccessLevel: async () => {
            throw new Error('storage.session access level not supported here');
          },
        },
        local: area(),
      },
      alarms: {create: () => undefined, clear: async () => true, onAlarm: on('onAlarm')},
      windows: {getAll: async () => [], onRemoved: on('onRemoved')},
    });
    await import('../index');
    // Let the rejected pinSessionAccess() promise's .catch handler run.
    await Promise.resolve();
    await Promise.resolve();
    expect(listeners.sort()).toEqual(['onAlarm', 'onMessage', 'onRemoved', 'onStartup']);
    expect(warnings).toEqual([['storage.session access level not pinned', expect.any(Error)]]);
  });

  // Ruling 5: a service worker stopped while a send was open must resume watching it when it starts.
  it('resumes polling at start-up when a pending send is open, and the pending alarm reaches onPendingAlarm', async () => {
    vi.useFakeTimers();
    try {
      const record = {
        id: 'r1',
        account: 'A',
        signature: 's1',
        wire: 'AQ==',
        lastValidBlockHeight: 1000,
        createdAt: 0,
        lastSentAt: 0,
        state: 'pending',
        detail: null,
        intent: {token: 'SOL', recipient: 'R', amount: '1'},
        expiryNullSeenAt: null,
      };
      const local = new Map<string, unknown>([['v1_pending', [record]]]);
      const created: string[] = [];
      const cleared: string[] = [];
      let onAlarm: ((a: {name: string}) => void) | undefined;
      const bodies: string[] = [];
      // A stubbed fetch: nothing here leaves the process.
      vi.stubGlobal('fetch', async (url: string, init: {body?: string}) => {
        bodies.push(`${url} ${init.body ?? ''}`);
        return {status: 500, json: async () => null};
      });
      const on = () => ({addListener: () => undefined});
      vi.stubGlobal('chrome', {
        runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onStartup: on()},
        storage: {
          session: {get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined, setAccessLevel: async () => undefined},
          local: {
            get: async (k: string) => (local.has(k) ? {[k]: local.get(k)} : {}),
            set: async (items: Record<string, unknown>) => {
              for (const [k, v] of Object.entries(items)) local.set(k, v);
            },
            remove: async (k: string) => void local.delete(k),
            clear: async () => local.clear(),
          },
        },
        alarms: {
          create: (name: string) => void created.push(name),
          clear: async (name: string) => (cleared.push(name), true),
          onAlarm: {addListener: (cb: (a: {name: string}) => void) => void (onAlarm = cb)},
        },
        windows: {getAll: async () => [], onRemoved: on()},
      });
      await import('../index');
      await vi.advanceTimersByTimeAsync(0);
      expect(created).toEqual(['pending-poll']);
      expect(bodies).toEqual([]);
      // The poller's first round, one poll interval later: it asks for the open record's status.
      await vi.advanceTimersByTimeAsync(2_000);
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toContain('https://api.noc-tura.io/api/v1/rpc');
      expect(bodies[0]).toContain('"method":"getSignatureStatuses"');
      expect(bodies[0]).toContain('"s1"');

      // The alarm listener hands the pending alarm to onPendingAlarm: with nothing open it clears it.
      local.set('v1_pending', []);
      onAlarm?.({name: 'pending-poll'});
      await vi.advanceTimersByTimeAsync(0);
      expect(cleared).toEqual(['pending-poll']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts no poller and arms no alarm when nothing is open', async () => {
    const created: string[] = [];
    const on = () => ({addListener: () => undefined});
    const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
    vi.stubGlobal('chrome', {
      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onStartup: on()},
      storage: {session: {...area(), setAccessLevel: async () => undefined}, local: area()},
      alarms: {create: (name: string) => void created.push(name), clear: async () => true, onAlarm: on()},
      windows: {getAll: async () => [], onRemoved: on()},
    });
    await import('../index');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(created).toEqual([]);
  });
});
