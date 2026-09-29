import {render, PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP} from '../source.mjs';

describe('manifest source', () => {
  it('asks for exactly storage and alarms, each with a reason', () => {
    expect(PERMISSIONS.map(p => p.value)).toEqual(['storage', 'alarms']);
    for (const p of [...PERMISSIONS, ...HOST_PERMISSIONS]) expect(p.reason.length).toBeGreaterThan(20);
  });

  it('asks for exactly the two noc-tura hosts', () => {
    expect(HOST_PERMISSIONS.map(p => p.value)).toEqual([
      'https://api.noc-tura.io/*',
      'https://wallet.noc-tura.io/*',
    ]);
  });

  it('forbids eval and remote script in extension pages, and connects only to the coordinator', () => {
    expect(EXTENSION_CSP).toBe("script-src 'self'; object-src 'self'; connect-src https://api.noc-tura.io");
  });

  it('renders a Chrome MV3 service worker', () => {
    const m = render('chrome');
    expect(m.manifest_version).toBe(3);
    expect(m.background).toEqual({service_worker: 'background.js', type: 'module'});
    expect(m.minimum_chrome_version).toBe('122');
    expect(m.browser_specific_settings).toBeUndefined();
  });

  it('renders a Firefox MV3 event page with the fields AMO requires', () => {
    const m = render('firefox');
    expect(m.background).toEqual({scripts: ['background.js'], type: 'module'});
    expect(m.browser_specific_settings.gecko.id).toBe('wallet@noc-tura.io');
    expect(m.browser_specific_settings.gecko.strict_min_version).toBe('150.0');
    expect(m.browser_specific_settings.gecko.data_collection_permissions.required.length).toBeGreaterThan(0);
  });

  it('gives both browsers the same permissions, hosts, CSP and pages', () => {
    const c = render('chrome');
    const f = render('firefox');
    for (const k of ['permissions', 'host_permissions', 'content_security_policy', 'action', 'name', 'version']) {
      expect(f[k]).toEqual(c[k]);
    }
  });

  it('control: an extra permission would be seen', () => {
    const m = render('chrome');
    m.permissions.push('tabs');
    expect(m.permissions).not.toEqual(PERMISSIONS.map(p => p.value));
  });
});
