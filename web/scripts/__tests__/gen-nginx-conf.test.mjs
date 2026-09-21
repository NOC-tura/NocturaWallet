import {readFileSync} from 'node:fs';
import {render, OUT_PATH} from '../gen-nginx-conf.mjs';
import {SECURITY_HEADERS, CSP_DIRECTIVES, csp} from '../../deploy/security-headers.mjs';

const conf = render();

/**
 * nginx's add_header does not merge. One add_header inside a location block discards EVERY
 * add_header inherited from the server block — so a Cache-Control on /assets/ would serve the
 * bundle with no CSP, no HSTS and no Permissions-Policy, and nothing anywhere would say so.
 * The config would look right, the site would look right, and the headers would be gone.
 *
 * This is the reason the parser below exists rather than a grep: the first version of this
 * check was a grep, and it reported the server-level headers as offenders because a one-line
 * `location … { root …; }` had opened a block it never saw close.
 */
function addHeadersInsideLocations(source) {
  const offenders = [];
  let depth = 0;
  const locationOpenedAt = [];

  for (const raw of source.split('\n')) {
    const line = raw.replace(/#.*$/, '');
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (/^\s*location\b/.test(line) && opens > 0) locationOpenedAt.push(depth);
    depth += opens;

    if (/\badd_header\b/.test(line) && locationOpenedAt.length > 0) offenders.push(raw.trim());

    depth -= closes;
    while (locationOpenedAt.length > 0 && locationOpenedAt.at(-1) >= depth) locationOpenedAt.pop();
  }
  return offenders;
}

describe('the add_header trap', () => {
  it('finds no add_header inside any location block', () => {
    expect(addHeadersInsideLocations(conf)).toEqual([]);
  });

  it('would find one if it were there (negative control — the parser is a check, not a pass)', () => {
    const broken = conf.replace(
      '    location / {\n        try_files',
      '    location / {\n        add_header Cache-Control "no-cache" always;\n        try_files',
    );
    expect(addHeadersInsideLocations(broken).length).toBe(1);
  });

  it('is not confused by a location that opens and closes on one line', () => {
    // The ACME block is written this way, and it is what broke the first version of the check.
    const oneLine = 'server {\n  location ^~ /x/ { root /var/www; }\n  add_header A "b" always;\n}\n';
    expect(addHeadersInsideLocations(oneLine)).toEqual([]);
  });
});

describe('the headers that get served', () => {
  it.each(SECURITY_HEADERS.map(h => [h.name, h.value]))('serves %s', (name, value) => {
    expect(conf).toContain(`add_header ${name} "${value}" always;`);
  });

  it('marks every add_header `always`, or nginx drops it on 4xx and 5xx', () => {
    // A CSP that vanishes on the error page is a CSP that vanishes exactly when a page is
    // rendering something unexpected.
    const withoutAlways = conf
      .split('\n')
      .filter(l => /\badd_header\b/.test(l.replace(/#.*$/, '')) && !/\balways;\s*$/.test(l));
    expect(withoutAlways).toEqual([]);
  });

  it('carries the reason for each header into the served file', () => {
    // The config is what someone reads at 2am on the VPS; the reasoning has to travel with it.
    for (const h of SECURITY_HEADERS) {
      expect(conf.split(/\s+/).join(' ')).toContain(h.why.split(/\s+/).slice(0, 6).join(' '));
    }
  });
});

describe('the policy itself', () => {
  it('denies everything by default', () => {
    expect(CSP_DIRECTIVES['default-src']).toBe("'none'");
  });

  it.each([
    ['script-src', "'self'"],
    ['style-src', "'self'"],
    ['connect-src', "'self'"],
    ['base-uri', "'none'"],
    ['form-action', "'none'"],
    ['frame-ancestors', "'none'"],
  ])('%s is %s', (directive, value) => {
    expect(CSP_DIRECTIVES[directive]).toBe(value);
  });

  it("allows data: images, because a Wallet Standard icon can only be a data URI", () => {
    // Drop this and the connect dialog lists Phantom and Solflare with blank icons.
    expect(CSP_DIRECTIVES['img-src']).toBe("'self' data:");
  });

  it.each(['unsafe-inline', 'unsafe-eval', 'wasm-unsafe-eval'])('never contains %s', token => {
    expect(csp()).not.toContain(token);
  });

  it('names no external origin anywhere', () => {
    // connect-src 'self' is only correct while /api and /rpc are proxied by this host. If an
    // absolute coordinator URL ever appears here, the same-origin assumption has changed.
    expect(csp()).not.toMatch(/https?:\/\//);
  });

  it('declares no font-src, so fonts inherit default-src none', () => {
    // The built CSS has no @font-face and no url(); adding font-src here would loosen the
    // policy for nothing, and it is how the Google Fonts request would quietly come back.
    expect(CSP_DIRECTIVES['font-src']).toBeUndefined();
  });
});

describe('caching and proxying', () => {
  it('caches content-hashed assets forever and revalidates the entry point', () => {
    expect(conf).toContain('"~^/assets/"');
    expect(conf).toContain('public, max-age=31536000, immutable');
    expect(conf).toMatch(/"\/index\.html"\s+"no-cache"/);
  });

  it('revalidates the published manifest, or the digest stops describing what is served', () => {
    expect(conf).toMatch(/"\/build-manifest\.json"\s+"no-cache"/);
  });

  it('emits no Cache-Control of its own on the proxied paths', () => {
    // An empty value makes nginx add nothing, so the coordinator's own header survives.
    expect(conf).toMatch(/"~\^\/\(api\/\|rpc\$\)"\s+"";/);
  });

  it('sends SNI upstream, without which the handshake lands on the wrong vhost', () => {
    const proxyBlocks = conf.match(/proxy_pass[^}]*/g) ?? [];
    expect(proxyBlocks.length).toBe(2);
    for (const block of proxyBlocks) expect(block).toContain('proxy_ssl_server_name on;');
  });

  it('pins the Origin the coordinator allowlists rather than forwarding the browser\'s', () => {
    expect(conf).toContain('proxy_set_header Origin https://wallet.noc-tura.io;');
  });

  it('exposes /rpc as an exact location, not a prefix', () => {
    expect(conf).toContain('location = /rpc {');
    expect(conf).not.toContain('location /rpc/ {');
  });

  it('404s unknown paths instead of answering with the app', () => {
    expect(conf).toContain('try_files $uri $uri/ =404;');
    expect(conf).not.toContain('/index.html;');
  });
});

describe('the committed file', () => {
  it('matches what the generator produces right now', () => {
    expect(readFileSync(OUT_PATH, 'utf8')).toBe(conf);
  });

  it('is rendered from the source, not frozen (the assertions above are computed, not literal)', () => {
    // Every header assertion in this file is built from SECURITY_HEADERS and csp() at run
    // time, never typed out. So a generator that stopped consulting security-headers.mjs and
    // emitted a fixed string would fail the moment a directive changed — which is the failure
    // a suite of hand-copied literals would sail straight past.
    expect(conf).toContain(csp());
    expect(csp()).toContain(CSP_DIRECTIVES['connect-src']);
  });
});
