import {test, expect} from '@playwright/test';
import {rmSync} from 'node:fs';
import {containNocTura, containSolscan, expectContained, launchContained} from './launch';
import {addPrfAuthenticator} from './virtualAuthenticator';

// B1b-2b §11 item 9 (spec §8.3, M3): plan 1's FIRST E2E task — does the pinned Chromium's virtual authenticator give PRF
// output to the extension, with RP ID wallet.noc-tura.io, in the contained browser (the host unresolvable)? Spec 14's
// passkey steps depend on it; if this fails they FAIL — never skip — and the plan reports it.
test('the PRF probe: create() + get() with RP ID wallet.noc-tura.io return a 32-byte PRF output in the contained browser', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-prf-');
  const nocTura = await containNocTura(ctx);
  const solscan = await containSolscan(ctx);
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/unlock.html?mode=welcome`);
    await addPrfAuthenticator(ctx, page);
    const out = await page.evaluate(async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const created = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {id: 'wallet.noc-tura.io', name: 'Noctura'},
          user: {id: crypto.getRandomValues(new Uint8Array(16)), name: 'probe', displayName: 'probe'},
          pubKeyCredParams: [{type: 'public-key', alg: -7}],
          authenticatorSelection: {userVerification: 'required', residentKey: 'preferred'},
          extensions: {prf: {}} as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      if (created === null) return {created: false, enabled: null, length: 0};
      const enabled = (created.getClientExtensionResults() as {prf?: {enabled?: boolean}}).prf?.enabled ?? null;
      const got = (await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: 'wallet.noc-tura.io',
          allowCredentials: [{type: 'public-key', id: created.rawId}],
          userVerification: 'required',
          extensions: {prf: {eval: {first: salt}}} as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      const first = (got?.getClientExtensionResults() as {prf?: {results?: {first?: ArrayBuffer}}} | undefined)?.prf?.results?.first;
      return {created: true, enabled, length: first === undefined ? 0 : first.byteLength};
    });
    expect(out).toEqual({created: true, enabled: true, length: 32});
    expect(nocTura.hits).toEqual([]);
    expect(solscan.hits).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
