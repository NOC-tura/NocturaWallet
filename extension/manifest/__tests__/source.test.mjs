import {render, PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP, CONTENT_SCRIPTS} from '../source.mjs';

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
    expect(EXTENSION_CSP).toBe(
      "default-src 'self'; script-src 'self'; object-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
        "connect-src https://api.noc-tura.io; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  });

  // Controller hardening (2026-10-01): the browser, not a text gate, keeps CSS off the vault page —
  // no inline <style>/style="", no remote stylesheet, image or font (a stylesheet with an attribute
  // selector and a url() can read the password field).
  it('names no unsafe-inline, unsafe-eval, unsafe-hashes or wildcard source', () => {
    expect(EXTENSION_CSP).not.toMatch(/unsafe-|\*|\bhttp:|\bblob:|\bfilesystem:/);
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

  // B1c §1.7: the provider (MAIN) and the relay (ISOLATED), every page, top frame only, at document_start — with the reason.
  it('declares exactly the two B1c content scripts, with the reason a reviewer is owed', () => {
    expect(render('chrome').content_scripts).toEqual([
      {matches: ['<all_urls>'], js: ['provider.js'], run_at: 'document_start', all_frames: false, world: 'MAIN'},
      {matches: ['<all_urls>'], js: ['relay.js'], run_at: 'document_start', all_frames: false, world: 'ISOLATED'},
    ]);
    expect(CONTENT_SCRIPTS.reason).toBe(
      'Sites find the wallet through Wallet Standard, which must be present on every page; the scripts read nothing from the page and send nothing unless the site asks the wallet.',
    );
  });

  it('gives both browsers the same permissions, hosts, CSP, pages and content scripts', () => {
    const c = render('chrome');
    const f = render('firefox');
    for (const k of ['permissions', 'host_permissions', 'content_security_policy', 'action', 'name', 'version', 'content_scripts']) {
      expect(f[k]).toEqual(c[k]);
    }
  });

  it('control: an extra permission would be seen', () => {
    const m = render('chrome');
    m.permissions.push('tabs');
    expect(m.permissions).not.toEqual(PERMISSIONS.map(p => p.value));
  });
});
