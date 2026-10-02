import {test, expect, type Worker} from '@playwright/test';
import {rmSync} from 'node:fs';
import {containNocTura, containSolscan, expectContained, launchContained} from './launch';
import {installFakeCoordinator} from './fakeCoordinator';
import {COUNTERPARTY, failedTx, sentSol, sig} from './historyFixtures';

// The positive control for every spec's "counter is 0" (Task 17 fix round 1, B4): a zero means
// nothing was asked only if a request, when made, IS counted. Here each counter is made to see exactly
// one request of its own, and that request fails inside the browser. Unwiring either counter (its
// ctx.route) turns this spec red — the mutation was run in a scratch copy (task-17-report.md).

/** A fetch from the extension's service worker (its host permission; the fake routes the worker's requests). */
const swFetch = (sw: Worker, url: string, body?: object): Promise<string> =>
  sw.evaluate(
    ({u, b}) =>
      fetch(u, b === undefined ? {} : {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(b)}).then(
        r => r.text(),
        (e: unknown) => `failed: ${String(e)}`,
      ),
    {u: url, b: body},
  );

test('containment: a Solscan navigation and noc-tura.io requests are each counted once and fail locally', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-containment-');
  const nocTura = await containNocTura(ctx);
  const solscan = await containSolscan(ctx);
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));

    // #27's Explorer URL, followed as a top-level navigation: caught, counted, failed.
    const tx = `https://solscan.io/tx/${sig(1)}`;
    const page = await ctx.newPage();
    await expect(page.goto(tx)).rejects.toThrow(/net::ERR_/);
    expect(solscan.hits).toEqual([tx]);
    expect(nocTura.hits).toEqual([]);

    // The coordinator's host, fetched by the worker, and the bare domain navigated: each caught.
    const api = 'https://api.noc-tura.io/api/v1/wallet/prices';
    expect(await swFetch(sw, api)).toMatch(/^failed: /);
    expect(nocTura.hits).toEqual([api]);
    await expect(page.goto('https://noc-tura.io/')).rejects.toThrow(/net::ERR_/);
    expect(nocTura.hits).toEqual([api, 'https://noc-tura.io/']);
    expect(solscan.hits).toEqual([tx]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});

// The fake answers as a node does where the engine could tell the difference (Task 17 fix round 1, E17/E18).
test('the fake coordinator: -32601 for a method it lacks; an unknown `before` is an empty page; err and blockTime per entry', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-fake-');
  const nocTura = await containNocTura(ctx);
  const fake = await installFakeCoordinator(ctx);
  const solscan = await containSolscan(ctx);
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const rpc = async (method: string, params: unknown[]) =>
      JSON.parse(await swFetch(sw, 'https://api.noc-tura.io/api/v1/rpc', {jsonrpc: '2.0', id: 7, method, params})) as {id: number; result?: unknown; error?: {code: number}};

    const missing = await rpc('getSlotLeaders', [0, 1]);
    expect(missing).toEqual({jsonrpc: '2.0', id: 7, error: {code: -32601, message: 'Method not allowed'}});
    expect('result' in missing).toBe(false);
    expect(fake.unexpected).toEqual(['rpc getSlotLeaders']);
    fake.unexpected.length = 0;

    const owner = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
    fake.history.set(owner, [
      {signature: sig(1), tx: sentSol(owner, COUNTERPARTY, 1_000, 1_780_000_000)},
      {signature: sig(2), tx: failedTx(owner, 1_779_000_000)},
    ]);
    const page1 = (await rpc('getSignaturesForAddress', [owner, {limit: 10}])).result as {signature: string; err: unknown; blockTime: number | null}[];
    expect(page1.map(e => [e.signature, e.err === null, e.blockTime])).toEqual([
      [sig(1), true, 1_780_000_000],
      [sig(2), false, 1_779_000_000],
    ]);
    expect(page1[1]?.err).toEqual({InstructionError: [0, 'Custom']});
    expect((await rpc('getSignaturesForAddress', [owner, {limit: 10, before: sig(1)}])).result).toHaveLength(1);
    // A cursor the fake never handed out: nothing — not the first page again.
    expect((await rpc('getSignaturesForAddress', [owner, {limit: 10, before: sig(9)}])).result).toEqual([]);
    expect(fake.unexpected).toEqual([]);
    expect(nocTura.hits).toEqual([]);
    expect(solscan.hits).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
