import {test, expect, type BrowserContext, type Page} from '@playwright/test';
import {readFileSync, rmSync} from 'node:fs';
import {BLOCKHASH_LIFETIME, installFakeCoordinator, type FakeCoordinator} from './fakeCoordinator';
import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';
import {containNocTura, containSolscan, expectContained, launchContained} from './launch';
// Read from the source rather than imported: core/ has no package.json "type", so Playwright's loader
// on Node 22 (CI) treats core/solana/rpc.ts as CommonJS and cannot take a named export from it.
// The same literal the RPC-method gate parses; not found means it moved — fail loudly.
const ALLOWED_RPC_METHODS: readonly string[] = (() => {
  const text = readFileSync(new URL('../../core/solana/rpc.ts', import.meta.url), 'utf8');
  const m = /ALLOWED_RPC_METHODS\s*=\s*\[([^\]]*)\]\s*as\s+const/.exec(text);
  const list = m === null ? [] : [...(m[1] ?? '').matchAll(/['"`]([^'"`]+)['"`]/g)].map(x => x[1] ?? '');
  if (list.length !== 11) throw new Error(`expected the 11 allowed RPC methods in core/solana/rpc.ts, found ${list.length}`);
  return list;
})();

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
};

const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
/** makeEnvelope's wallet: the ABANDON phrase, SLIP-0010 account 0. */
const E2E_ACCOUNT = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const NEW_PASSWORD = 'a long enough e2e password';
/** A slow runner may pass the engine's 30 s PREPARED_TTL_MS; the contract is to prepare again, never a longer TTL. */
const MAX_ATTEMPTS = 3;
type Reply = {ok: boolean; error?: string; data?: unknown};
type PreparedView = {id: string; fees: Record<string, string>; reauth: {challengeId: string; reasons: string[]} | null};
type PendingView = {id: string; signature: string; state: string; detail: string | null; lastValidBlockHeight: number};

async function launch() {
  // Two layers: the fake coordinator's ctx.route answers every api.noc-tura.io request, and
  // launchContained makes every noc-tura.io name unresolvable, so one the route misses fails locally.
  const {ctx, profile} = await launchContained('noctura-e2e-wallet-');
  // Every noc-tura.io name the fake does not answer: counted and aborted. Installed first, so the
  // fake's route (registered later, run first) keeps answering api.noc-tura.io.
  const nocTura = await containNocTura(ctx);
  const fake = await installFakeCoordinator(ctx);
  // The one external link (#27's Explorer) is never followed: anything addressed to solscan.io is
  // recorded and aborted here, under the resolver rule, and each test asserts the count is zero.
  const solscan = await containSolscan(ctx);
  await expectContained(ctx);
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const id = new URL(sw.url()).host;
  // An extension page (own origin), so its messages are privileged. B1b-2a: the UI tab, wallet.html —
  // the popup, with no wallet yet, would open the welcome page and close itself (spec §1.6).
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${id}/wallet.html#/home`);
  return {ctx, fake, sw, id, popup, profile, solscan, nocTura};
}

const msg = async (page: Page, m: unknown): Promise<Reply> => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as Reply;

async function pendingRecord(page: Page, signature: string): Promise<PendingView | undefined> {
  const r = await msg(page, {type: 'wallet.pending'});
  return (r.data as PendingView[]).find(p => p.signature === signature);
}
const pendingState = async (page: Page, signature: string): Promise<string | undefined> => (await pendingRecord(page, signature))?.state;

/** Re-authenticate a challenge through the real vault page in reauth mode. */
async function reauthenticate(ctx: BrowserContext, id: string, challengeId: string, password: string): Promise<void> {
  const vault = await ctx.newPage();
  try {
    await vault.goto(`chrome-extension://${id}/unlock.html?mode=reauth&challenge=${challengeId}`);
    await vault.fill('#reauth-password', password);
    await vault.click('#reauth-btn');
    await expect(vault.locator('#status')).toHaveText('Confirmed. You can close this tab.', {timeout: 60_000});
  } finally {
    await vault.close();
  }
}

/** Prepare and send with no re-authentication expected; prepares again on 'prepared-expired'. */
async function prepareAndSend(page: Page, account: string, intent: object): Promise<{signature: string; id: string}> {
  for (let attempt = 1; ; attempt++) {
    const prep = await msg(page, {type: 'wallet.prepareSend', account, intent});
    expect(prep.ok).toBe(true);
    const view = prep.data as PreparedView;
    expect(view.reauth).toBeNull(); // known recipient, small amount, priced
    const sent = await msg(page, {type: 'wallet.send', id: view.id});
    if (!sent.ok && sent.error === 'prepared-expired' && attempt < MAX_ATTEMPTS) continue;
    expect(sent.ok).toBe(true);
    return sent.data as {signature: string; id: string};
  }
}

function onlyTheSimulatedCoordinator(fake: FakeCoordinator, solscan: {hits: string[]}, nocTura: {hits: string[]}): void {
  // Not vacuous: the route really saw the service worker's requests.
  expect(fake.hits.length).toBeGreaterThan(0);
  expect(fake.unexpected).toEqual([]);
  expect(solscan.hits).toEqual([]);
  expect(nocTura.hits).toEqual([]);
  for (const h of fake.hits) {
    expect(h.url.startsWith('https://api.noc-tura.io/api/v1/')).toBe(true);
    if (h.rpcMethod !== null) expect(ALLOWED_RPC_METHODS).toContain(h.rpcMethod);
  }
}

test('create a wallet, unlock it, re-authenticate a first send, send SOL: pending → confirmed', async () => {
  const {ctx, fake, id, popup, sw, profile, solscan, nocTura} = await launch();
  try {
    // 1. Onboarding: the vault page's create mode.
    const vault = await ctx.newPage();
    await vault.goto(`chrome-extension://${id}/unlock.html?mode=create`);
    await expect(vault.locator('#words li')).toHaveCount(24);
    await vault.check('#saved');
    await vault.fill('#new-password', NEW_PASSWORD);
    await vault.fill('#new-password2', NEW_PASSWORD);
    await vault.click('#create-btn');
    await expect(vault.locator('#status')).toHaveText('Wallet created. You can close this tab.', {timeout: 60_000});
    await expect(vault.locator('#words li')).toHaveCount(0);

    // 2. Lock, then unlock with the password (B1a's unlock mode).
    expect((await msg(popup, {type: 'vault.lock'})).ok).toBe(true);
    expect(((await msg(popup, {type: 'wallet.state'})).data as {unlocked: boolean}).unlocked).toBe(false);
    await vault.goto(`chrome-extension://${id}/unlock.html`);
    await vault.fill('#password', NEW_PASSWORD);
    await vault.click('#unlock');
    await expect(vault.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});
    const state = (await msg(popup, {type: 'wallet.state'})).data as {hasWallet: boolean; unlocked: boolean; accounts: {publicKey: string}[]};
    expect(state.hasWallet).toBe(true);
    expect(state.unlocked).toBe(true);
    const account = state.accounts[0]!.publicKey;

    // 3–5. Prepare: fee lines up front; a first send to a new address needs re-authentication; the
    // send is refused until the vault page's reauth mode proves the password — once.
    const intent = {token: 'SOL', recipient: RECIPIENT, amount: '10000000'};
    const prep = await msg(popup, {type: 'wallet.prepareSend', account, intent});
    expect(prep.ok).toBe(true);
    const view = prep.data as PreparedView;
    expect(view.fees).toMatchObject({networkLamports: '5050', priorityLamports: '50', rentLamports: '0', markupLamports: '0', markupReason: 'status-unknown'});
    expect(view.reauth?.reasons).toEqual(['first-send']);
    const challengeId = view.reauth!.challengeId;
    expect(await msg(popup, {type: 'wallet.send', id: view.id})).toEqual({ok: false, error: 'reauth-required', data: {challengeId}});
    expect(fake.broadcasts).toEqual([]);

    await reauthenticate(ctx, id, challengeId, NEW_PASSWORD);

    // A popup reopened after the re-authentication finds the prepared send and its challenge.
    expect(await msg(popup, {type: 'wallet.preparedFor', account})).toMatchObject({ok: true, data: {intent, reauth: {challengeId}}});
    // A human re-authentication routinely outlives the 30 s prepared send, so the popup prepares
    // again carrying the challenge: the proof carries over to the fresh message (no second
    // re-authentication). Only a 'prepared-expired' on a slow runner prepares once more.
    let sent: Reply | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const again = await msg(popup, {type: 'wallet.prepareSend', account, intent, challengeId});
      expect(again.ok).toBe(true);
      expect((again.data as PreparedView).reauth?.challengeId).toBe(challengeId);
      sent = await msg(popup, {type: 'wallet.send', id: (again.data as PreparedView).id});
      if (sent.ok || sent.error !== 'prepared-expired') break;
    }
    expect(sent?.ok).toBe(true);
    const {signature} = sent!.data as {signature: string};
    expect((await pendingRecord(popup, signature))?.state).toBe('pending');
    await expect.poll(() => pendingState(popup, signature), {timeout: 30_000, intervals: [1_000]}).toBe('confirmed');
    expect(fake.broadcasts).toEqual([signature]);
    // E6: a confirmed recipient is stored with the time of the confirmation.
    expect(await sw.evaluate(() => chrome.storage.local.get('v1_known_recipients'))).toEqual({v1_known_recipients: [{address: RECIPIENT, at: expect.any(Number)}]});
    // E2: every simulation asked for the sender's post-state.
    expect(fake.simulations.length).toBeGreaterThan(0);
    for (const s of fake.simulations) expect(s).toEqual([account]);
    // Owner decision A: the record lives in storage.local, where a lock or a restart cannot drop it.
    const stored = (await sw.evaluate(() => chrome.storage.local.get('v1_pending'))) as {v1_pending?: {signature: string; state: string}[]};
    expect(stored.v1_pending?.map(r => [r.signature, r.state])).toEqual([[signature, 'confirmed']]);
    onlyTheSimulatedCoordinator(fake, solscan, nocTura);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});

test('an unconfirmed send expires: "no funds moved", nothing re-sent, and only then a new transaction', async () => {
  const {ctx, fake, id, popup, sw, profile, solscan, nocTura} = await launch();
  try {
    fake.mode = 'expire';
    await sw.evaluate(({env, recipient}) => chrome.storage.local.set({v1_vault: env, v1_known_recipients: [recipient]}), {env: await makeEnvelope(), recipient: RECIPIENT});
    const vault = await ctx.newPage();
    await vault.goto(`chrome-extension://${id}/unlock.html`);
    await vault.fill('#password', E2E_PASSWORD);
    await vault.click('#unlock');
    await expect(vault.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});

    const intent = {token: 'SOL', recipient: RECIPIENT, amount: '1000000'};
    const {signature, id: pendingId} = await prepareAndSend(popup, E2E_ACCOUNT, intent);
    const first = (await pendingRecord(popup, signature))!;
    expect(first.state).toBe('pending');
    expect(first.lastValidBlockHeight).toBe(fake.blockHeight + BLOCKHASH_LIFETIME);
    // While it is pending, no new transaction for the account.
    expect(await msg(popup, {type: 'wallet.prepareSend', account: E2E_ACCOUNT, intent})).toMatchObject({ok: false, error: 'in-flight'});

    // At lastValidBlockHeight + 32 the transaction is not yet past its margin: polling goes on
    // (statuses are asked), but no full-history check and no expiry.
    fake.blockHeight = first.lastValidBlockHeight + 32;
    const polled = fake.hits.filter(h => h.rpcMethod === 'getSignatureStatuses').length;
    await expect.poll(() => fake.hits.filter(h => h.rpcMethod === 'getSignatureStatuses').length, {timeout: 15_000}).toBeGreaterThanOrEqual(polled + 2);
    expect(await pendingState(popup, signature)).toBe('pending');
    expect(fake.historyChecks).toEqual([]);
    expect(await msg(popup, {type: 'wallet.prepareSend', account: E2E_ACCOUNT, intent})).toMatchObject({ok: false, error: 'in-flight'});

    // One block further, the blockhash is past its life with margin: two null full-history rounds
    // at least 2 s apart, and only then expired.
    fake.blockHeight = first.lastValidBlockHeight + 33;
    await expect.poll(() => pendingState(popup, signature), {timeout: 30_000, intervals: [500]}).toBe('expired');
    const checks = fake.historyChecks.filter(c => c.signature === signature);
    expect(checks.length).toBeGreaterThanOrEqual(2);
    expect(checks[checks.length - 1]!.at - checks[0]!.at).toBeGreaterThanOrEqual(2_000);
    const record = await pendingRecord(popup, signature);
    expect(record?.detail).toBe('Not confirmed — no funds moved.');
    expect(await msg(popup, {type: 'wallet.resend', id: pendingId})).toEqual({ok: false, error: 'not-open'});
    // Exactly one set of bytes for the first intent: never re-signed, never re-sent before expiry.
    expect(fake.broadcasts).toEqual([signature]);
    expect(fake.broadcastWires).toHaveLength(1);

    // Only after expiry may a new transaction be built for the same intent: a new blockhash, so a
    // new signature — pending under its own, later lastValidBlockHeight.
    const second = await prepareAndSend(popup, E2E_ACCOUNT, intent);
    expect(second.signature).not.toBe(signature);
    expect(fake.broadcasts).toEqual([signature, second.signature]);
    expect(new Set(fake.broadcastWires).size).toBe(2);
    const secondRecord = await pendingRecord(popup, second.signature);
    expect(secondRecord?.state).toBe('pending');
    expect(secondRecord?.lastValidBlockHeight).toBe(fake.blockHeight + BLOCKHASH_LIFETIME);
    expect(await pendingState(popup, signature)).toBe('expired');
    onlyTheSimulatedCoordinator(fake, solscan, nocTura);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
