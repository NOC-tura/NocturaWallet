import {DeepLinkManager} from '../deepLinkModule';

describe('DeepLinkManager', () => {
  let manager: DeepLinkManager;

  beforeEach(() => {
    manager = new DeepLinkManager();
  });

  it('parses noctura://pay with to, amount, token params', () => {
    const action = manager.handleLink('noctura://pay?to=addr&amount=10&token=NOC');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('pay');
    expect(action!.params).toEqual({to: 'addr', amount: '10', token: 'NOC'});
  });

  it('parses noctura://receive with no params', () => {
    const action = manager.handleLink('noctura://receive');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('receive');
    expect(action!.params).toEqual({});
  });

  it('parses noctura://stake with amount and tier', () => {
    const action = manager.handleLink('noctura://stake?amount=100&tier=365');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('stake');
    expect(action!.params).toEqual({amount: '100', tier: '365'});
  });

  it('parses https://noc-tura.io/ref/NOC-A7X2 as referral', () => {
    const action = manager.handleLink('https://noc-tura.io/ref/NOC-A7X2');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('referral');
    expect(action!.params).toEqual({code: 'NOC-A7X2'});
  });

  it('parses noctura://presale with no params', () => {
    const action = manager.handleLink('noctura://presale');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('presale');
  });

  it('parses noctura://presale?ref=NOC-B3C4 with ref param', () => {
    const action = manager.handleLink('noctura://presale?ref=NOC-B3C4');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('presale');
    expect(action!.params).toEqual({ref: 'NOC-B3C4'});
  });

  it('rejects noctura://import?mnemonic=... for security', () => {
    const action = manager.handleLink('noctura://import?mnemonic=word1+word2');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('rejected');
    expect(action!.reason).toMatch(/security/i);
  });

  it('rejects mnemonic param on ANY path (not just import)', () => {
    const action = manager.handleLink('noctura://pay?to=addr&mnemonic=word1+word2');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('rejected');
    expect(action!.reason).toMatch(/security/i);
  });

  it('returns null for empty string', () => {
    const action = manager.handleLink('');
    expect(action).toBeNull();
  });

  it('returns null for non-noctura https URL', () => {
    const action = manager.handleLink('https://google.com');
    expect(action).toBeNull();
  });

  it('handles universal link https://noc-tura.io/wallet/pay as noctura://pay', () => {
    const action = manager.handleLink('https://noc-tura.io/wallet/pay?to=addr&amount=5&token=NOC');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('pay');
    expect(action!.params.to).toBe('addr');
    expect(action!.params.amount).toBe('5');
  });

  it('handles universal link https://noc-tura.io/wallet/receive', () => {
    const action = manager.handleLink('https://noc-tura.io/wallet/receive');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('receive');
  });

  it('handles universal link https://noc-tura.io/wallet/stake', () => {
    const action = manager.handleLink('https://noc-tura.io/wallet/stake?tier=365');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('stake');
    expect(action!.params.tier).toBe('365');
  });

  it('fires onAction callback when handleLink produces an action', () => {
    const cb = jest.fn();
    manager.onAction(cb);
    manager.handleLink('noctura://pay?to=addr&amount=10&token=NOC');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].type).toBe('pay');
  });
});
