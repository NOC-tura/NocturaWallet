import {deepLinkConfig} from '../deepLinkConfig';

describe('deepLinkConfig shielded gating', () => {
  it('does not expose shielded screens as deep links when shielded is gated', () => {
    const screens = (deepLinkConfig.config as {screens: Record<string, unknown>}).screens;
    expect(screens.Deposit).toBeUndefined();
    expect(screens.ShieldedTransfer).toBeUndefined();
    expect(screens.Withdraw).toBeUndefined();
  });

  it('still exposes core transparent deep links', () => {
    const screens = (deepLinkConfig.config as {screens: Record<string, unknown>}).screens;
    expect(screens.ReceiveModal).toBe('receive');
    expect(screens.MainTabs).toBeDefined();
  });
});
