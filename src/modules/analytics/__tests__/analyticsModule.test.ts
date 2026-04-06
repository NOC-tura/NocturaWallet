import {AnalyticsManager} from '../analyticsModule';
import type {AnalyticsPayload} from '../types';

jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));

let mockOptOut = false;
jest.mock('../../../store/zustand/publicSettingsStore', () => ({
  usePublicSettingsStore: {
    getState: jest.fn(() => ({analyticsOptOut: mockOptOut})),
  },
}));

const {pinnedFetch} = jest.requireMock('../../sslPinning/pinnedFetch') as {
  pinnedFetch: jest.Mock;
};

describe('AnalyticsManager', () => {
  let manager: AnalyticsManager;

  beforeEach(() => {
    mockOptOut = false;
    manager = new AnalyticsManager();
    pinnedFetch.mockReset();
    pinnedFetch.mockResolvedValue({status: 200});
  });

  it('track adds event to queue', () => {
    expect(manager.queueSize).toBe(0);
    manager.track('app_open');
    expect(manager.queueSize).toBe(1);
    manager.track('wallet_created');
    expect(manager.queueSize).toBe(2);
  });

  it('track is no-op when opted out', () => {
    mockOptOut = true;
    manager.track('app_open');
    manager.track('wallet_created');
    expect(manager.queueSize).toBe(0);
  });

  it('flush POSTs batched events to /v1/analytics/event', async () => {
    manager.track('app_open');
    manager.track('wallet_created');
    await manager.flush();

    expect(pinnedFetch).toHaveBeenCalledTimes(1);
    const [url, options] = pinnedFetch.mock.calls[0] as [string, {method: string; body: string}];
    expect(url).toContain('/v1/analytics/event');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body) as {events: AnalyticsPayload[]};
    expect(body.events).toHaveLength(2);
    expect(body.events[0].event).toBe('app_open');
    expect(body.events[1].event).toBe('wallet_created');
  });

  it('flush sends max 50 events per call', async () => {
    for (let i = 0; i < 75; i++) {
      manager.track('app_open');
    }
    await manager.flush();

    expect(pinnedFetch).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(
      (pinnedFetch.mock.calls[0] as [string, {body: string}])[1].body,
    ) as {events: AnalyticsPayload[]};
    const secondBody = JSON.parse(
      (pinnedFetch.mock.calls[1] as [string, {body: string}])[1].body,
    ) as {events: AnalyticsPayload[]};

    expect(firstBody.events).toHaveLength(50);
    expect(secondBody.events).toHaveLength(25);
  });

  it('flush clears queue on success', async () => {
    manager.track('app_open');
    manager.track('app_background');
    expect(manager.queueSize).toBe(2);
    await manager.flush();
    expect(manager.queueSize).toBe(0);
  });

  it('flush is no-op when queue is empty', async () => {
    await manager.flush();
    expect(pinnedFetch).not.toHaveBeenCalled();
  });

  it('event payload contains only event, timestamp_utc, app_version, platform', async () => {
    manager.track('wallet_imported');
    await manager.flush();

    const body = JSON.parse(
      (pinnedFetch.mock.calls[0] as [string, {body: string}])[1].body,
    ) as {events: AnalyticsPayload[]};
    const payload = body.events[0];
    const keys = Object.keys(payload).sort();
    expect(keys).toEqual(['app_version', 'event', 'platform', 'timestamp_utc']);
  });

  it('event payload does NOT contain address, balance, or txHash fields', async () => {
    manager.track('send_transparent');
    await manager.flush();

    const body = JSON.parse(
      (pinnedFetch.mock.calls[0] as [string, {body: string}])[1].body,
    ) as {events: Array<Record<string, unknown>>};
    const payload = body.events[0];
    expect(payload).not.toHaveProperty('address');
    expect(payload).not.toHaveProperty('balance');
    expect(payload).not.toHaveProperty('txHash');
  });
});
