import {NotificationManager, setNavigationRef} from '../notificationModule';

jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));

const mockState: Record<string, boolean> = {
  notifIncomingTx: false,
  notifStakingReward: false,
  notifTxConfirmed: false,
  notifSecurityAlert: false,
};

jest.mock('../../../store/zustand/secureSettingsStore', () => ({
  useSecureSettingsStore: {
    getState: jest.fn(() => ({
      ...mockState,
      setNotifIncomingTx: (v: boolean) => {
        mockState.notifIncomingTx = v;
      },
      setNotifStakingReward: (v: boolean) => {
        mockState.notifStakingReward = v;
      },
      setNotifTxConfirmed: (v: boolean) => {
        mockState.notifTxConfirmed = v;
      },
      setNotifSecurityAlert: (v: boolean) => {
        mockState.notifSecurityAlert = v;
      },
    })),
  },
}));

const {pinnedFetch} = jest.requireMock('../../sslPinning/pinnedFetch') as {
  pinnedFetch: jest.Mock;
};

describe('NotificationManager', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    manager = new NotificationManager();
    // Reset mock state before each test
    mockState.notifIncomingTx = false;
    mockState.notifStakingReward = false;
    mockState.notifTxConfirmed = false;
    mockState.notifSecurityAlert = false;
    pinnedFetch.mockReset();
    pinnedFetch.mockResolvedValue({status: 200});
  });

  it('isEnabled returns false by default', () => {
    expect(manager.isEnabled('incoming_tx')).toBe(false);
    expect(manager.isEnabled('staking_reward')).toBe(false);
    expect(manager.isEnabled('tx_confirmed')).toBe(false);
    expect(manager.isEnabled('security_alert')).toBe(false);
  });

  it('setEnabled updates store', () => {
    manager.setEnabled('incoming_tx', true);
    expect(mockState.notifIncomingTx).toBe(true);

    manager.setEnabled('staking_reward', true);
    expect(mockState.notifStakingReward).toBe(true);

    manager.setEnabled('incoming_tx', false);
    expect(mockState.notifIncomingTx).toBe(false);
  });

  it('getEnabledTypes returns only enabled', () => {
    expect(manager.getEnabledTypes()).toEqual([]);

    mockState.notifIncomingTx = true;
    mockState.notifTxConfirmed = true;

    const enabled = manager.getEnabledTypes();
    expect(enabled).toContain('incoming_tx');
    expect(enabled).toContain('tx_confirmed');
    expect(enabled).not.toContain('staking_reward');
    expect(enabled).not.toContain('security_alert');
  });

  it('registerToken POSTs with enabled types', async () => {
    mockState.notifIncomingTx = true;
    mockState.notifStakingReward = true;

    await manager.registerToken();

    expect(pinnedFetch).toHaveBeenCalledTimes(1);
    const [url, options] = pinnedFetch.mock.calls[0] as [string, {method: string; body: string}];
    expect(url).toContain('/v1/notifications/register');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body) as {types: string[]};
    expect(body.types).toContain('incoming_tx');
    expect(body.types).toContain('staking_reward');
    expect(body.types).not.toContain('tx_confirmed');
    expect(body.types).not.toContain('security_alert');
  });

  it('unregisterToken DELETEs', async () => {
    await manager.unregisterToken();

    expect(pinnedFetch).toHaveBeenCalledTimes(1);
    const [url, options] = pinnedFetch.mock.calls[0] as [string, {method: string}];
    expect(url).toContain('/v1/notifications/unregister');
    expect(options.method).toBe('DELETE');
  });

  it('registerToken includes platform field', async () => {
    mockState.notifIncomingTx = true;
    await manager.registerToken();

    expect(pinnedFetch).toHaveBeenCalledTimes(1);
    const [, options] = pinnedFetch.mock.calls[0] as [string, {body: string}];
    const body = JSON.parse(options.body) as {platform: string};
    expect(body.platform).toBeDefined();
    expect(typeof body.platform).toBe('string');
  });

  it('handleNotification routes incoming_tx to MainTabs', () => {
    const mockNavigate = jest.fn();
    setNavigationRef({navigate: mockNavigate});

    manager.handleNotification({type: 'incoming_tx'});

    expect(mockNavigate).toHaveBeenCalledWith('MainTabs');

    setNavigationRef(null);
  });

  it('handleNotification routes security_alert to SettingsTab', () => {
    const mockNavigate = jest.fn();
    setNavigationRef({navigate: mockNavigate});

    manager.handleNotification({type: 'security_alert'});

    expect(mockNavigate).toHaveBeenCalledWith('SettingsTab');

    setNavigationRef(null);
  });
});
