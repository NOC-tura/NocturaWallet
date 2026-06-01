import {FEATURES, isShieldedEnabled, SHIELDED_ROUTES, isShieldedRoute} from '../features';

describe('features flag', () => {
  it('shielded is disabled in v1', () => {
    expect(FEATURES.shielded).toBe(false);
    expect(isShieldedEnabled()).toBe(false);
  });

  it('identifies shielded routes', () => {
    expect(isShieldedRoute('ZkProof')).toBe(true);
    expect(isShieldedRoute('ShieldedExplainer')).toBe(true);
    expect(isShieldedRoute('ShieldUnshieldModal')).toBe(true);
  });

  it('does not flag transparent routes as shielded', () => {
    expect(isShieldedRoute('Dashboard')).toBe(false);
    expect(isShieldedRoute('Send')).toBe(false);
  });

  it('SHIELDED_ROUTES covers the full shielded set', () => {
    for (const r of [
      'ShieldedExplainer', 'ShieldedBalance', 'ShieldedTransfer',
      'ShieldUnshield', 'ShieldUnshieldModal', 'Deposit', 'Withdraw', 'ZkProof',
    ]) {
      expect(SHIELDED_ROUTES).toContain(r);
    }
  });
});
