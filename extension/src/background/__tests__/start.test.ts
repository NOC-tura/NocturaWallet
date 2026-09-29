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
});
