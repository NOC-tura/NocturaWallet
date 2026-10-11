import {CONTENT, classicScriptViolations, devOriginViolations, pageBundleViolations} from '../check-page-bundles.mjs';

const map = (file, ids) => ({chunks: {[file]: ids}});
const PROVIDER = ['node_modules/@wallet-standard/wallet/lib/esm/register.js', 'src/provider/index.ts', 'src/provider/wallet.ts'];

// B1c §6.2: the page-bundle gate and the dev-origin gate, each with its positive control.
describe('page-bundle gate', () => {
  it('accepts the provider with its own sources and @wallet-standard, and the relay with its own sources only', () => {
    expect(CONTENT.provider.packages).toEqual(['@wallet-standard/wallet', '@wallet-standard/base']);
    expect(pageBundleViolations('provider', map('provider.js', PROVIDER))).toEqual([]);
    expect(pageBundleViolations('relay', map('relay.js', ['src/relay/index.ts', 'src/relay/relay.ts']))).toEqual([]);
  });

  it('refuses any module of the background, the vault, the vault page, the popup, the approval window, core/ or web/', () => {
    for (const bad of ['src/background/dapp/classify.ts', 'src/vault/envelope.ts', 'src/unlock/main.ts', 'src/app/engine.ts', 'src/approve/main.tsx', '../core/solana/rpc.ts', '../web/src/ui/Icon.tsx', 'src/relay/protocol.ts']) {
      expect([bad, pageBundleViolations('provider', map('provider.js', [...PROVIDER, bad])).length]).toEqual([bad, 1]);
    }
  });

  it('refuses another package, a package nested inside an allowed one, and @wallet-standard in the relay', () => {
    expect(pageBundleViolations('provider', map('provider.js', [...PROVIDER, 'node_modules/@solana/web3.js/lib/index.browser.esm.js']))).toHaveLength(1);
    expect(pageBundleViolations('provider', map('provider.js', [...PROVIDER, 'node_modules/@wallet-standard/wallet/node_modules/x/index.js']))).toHaveLength(1);
    expect(pageBundleViolations('relay', map('relay.js', ['src/relay/index.ts', 'node_modules/@wallet-standard/base/lib/esm/index.js']))).toHaveLength(1);
  });

  it('is INCONCLUSIVE without a map or without the entry, and refuses a second chunk', () => {
    expect(pageBundleViolations('relay', undefined)[0]).toMatch(/^INCONCLUSIVE/);
    expect(pageBundleViolations('relay', map('relay.js', ['src/relay/relay.ts']))[0]).toMatch(/^INCONCLUSIVE/);
    expect(pageBundleViolations('relay', {chunks: {'relay.js': ['src/relay/index.ts'], 'other.js': []}})).toHaveLength(1);
  });

  it('a content script must be a classic script', () => {
    expect(classicScriptViolations('relay', '(function(){var e=1})();')).toEqual([]);
    expect(classicScriptViolations('relay', 'import{a as b}from"./x.js";b();')).toHaveLength(1);
    expect(classicScriptViolations('relay', 'var a=1;export{a};')).toHaveLength(1);
  });
});

describe('dev-origin gate (§1.3, §6.2)', () => {
  it('a store build’s background names neither localhost nor 127.0.0.1', () => {
    expect(devOriginViolations('const ok = "https:";')).toEqual([]);
    expect(devOriginViolations('if(o==="http://localhost")ok()')).toHaveLength(1);
    expect(devOriginViolations('a="http://127.0.0.1:8080"')).toHaveLength(1);
    expect(devOriginViolations(undefined)[0]).toMatch(/^INCONCLUSIVE/);
  });
});
