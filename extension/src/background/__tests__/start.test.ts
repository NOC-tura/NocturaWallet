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
});
