import {comparePermissions} from '../check-permissions.mjs';
import {render} from '../../manifest/source.mjs';

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

  it('refuses a Firefox manifest without gecko.id', () => {
    const m = render('firefox');
    delete m.browser_specific_settings.gecko.id;
    expect(comparePermissions(m, 'firefox')).toContain('firefox: gecko.id missing');
  });
});
