import {REQUIRED_CONNECT_SRC, comparePermissions, connectSrcViolations} from '../check-permissions.mjs';
import {EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION, render} from '../../manifest/source.mjs';

describe('permissions gate', () => {
  it('accepts the rendered manifests', () => {
    expect(comparePermissions(render('chrome'), 'chrome')).toEqual([]);
    expect(comparePermissions(render('firefox'), 'firefox')).toEqual([]);
  });

  it('refuses an added permission', () => {
    const m = render('chrome');
    m.permissions = [...m.permissions, 'tabs'];
    expect(comparePermissions(m, 'chrome')).toEqual(['permissions differ: storage,alarms,tabs']);
  });

  it('refuses an added host', () => {
    const m = render('firefox');
    m.host_permissions = [...m.host_permissions, '<all_urls>'];
    expect(comparePermissions(m, 'firefox')[0]).toMatch(/^host_permissions differ/);
  });

  it('refuses a loosened CSP', () => {
    const m = render('chrome');
    m.content_security_policy = {extension_pages: "script-src 'self' 'unsafe-eval'"};
    expect(comparePermissions(m, 'chrome')[0]).toMatch(/^CSP differs/);
  });

  // Fix round 3: the runtime backstop for check-rpc-methods.mjs's text-based checks. Pinned
  // independent of EXTENSION_CSP (REQUIRED_CONNECT_SRC is its own hardcoded list, not read from
  // it), so a loosened EXTENSION_CSP is caught here too, not just a manifest that drifted from it.
  it('requires connect-src to be exactly the coordinator host, nothing else', () => {
    expect(REQUIRED_CONNECT_SRC).toEqual(['https://api.noc-tura.io']);
    expect(connectSrcViolations(EXTENSION_CSP)).toEqual([]);
    expect(connectSrcViolations("script-src 'self'; object-src 'self'")).toEqual([
      'connect-src is "(missing)", want exactly "https://api.noc-tura.io"',
    ]);
    expect(connectSrcViolations("script-src 'self'; connect-src https://api.noc-tura.io https://evil.example")).toEqual([
      'connect-src is "https://api.noc-tura.io https://evil.example", want exactly "https://api.noc-tura.io"',
    ]);
    expect(connectSrcViolations("script-src 'self'; connect-src *")).toEqual([
      'connect-src is "*", want exactly "https://api.noc-tura.io"',
    ]);
    expect(connectSrcViolations("script-src 'self'; connect-src 'self' https://api.noc-tura.io")).toEqual([
      'connect-src is "\'self\' https://api.noc-tura.io", want exactly "https://api.noc-tura.io"',
    ]);
  });

  it('refuses a built manifest whose CSP is missing connect-src', () => {
    const m = render('chrome');
    m.content_security_policy = {extension_pages: "script-src 'self'; object-src 'self'"};
    expect(comparePermissions(m, 'chrome')).toEqual(
      expect.arrayContaining(['connect-src is "(missing)", want exactly "https://api.noc-tura.io"']),
    );
  });

  it('refuses a Firefox manifest without gecko.id', () => {
    const m = render('firefox');
    delete m.browser_specific_settings.gecko.id;
    expect(comparePermissions(m, 'firefox')).toContain('firefox: gecko.id missing');
  });

  it('pins the minimum browsers to the plan: Chrome 122, Firefox 150', () => {
    expect(MIN_CHROME_VERSION).toBe('122');
    expect(MIN_FIREFOX_VERSION).toBe('150.0');
  });

  it('refuses a Chrome manifest with a different or missing minimum_chrome_version', () => {
    const lowered = render('chrome');
    lowered.minimum_chrome_version = '100';
    expect(comparePermissions(lowered, 'chrome')).toEqual(['chrome: minimum_chrome_version differs: 100']);
    const missing = render('chrome');
    delete missing.minimum_chrome_version;
    expect(comparePermissions(missing, 'chrome')).toEqual(['chrome: minimum_chrome_version differs: undefined']);
  });

  it('refuses a Firefox manifest with a different or missing gecko.strict_min_version', () => {
    const lowered = render('firefox');
    lowered.browser_specific_settings.gecko.strict_min_version = '128.0';
    expect(comparePermissions(lowered, 'firefox')).toEqual(['firefox: gecko.strict_min_version differs: 128.0']);
    const missing = render('firefox');
    delete missing.browser_specific_settings.gecko.strict_min_version;
    expect(comparePermissions(missing, 'firefox')).toEqual(['firefox: gecko.strict_min_version differs: undefined']);
  });
});
