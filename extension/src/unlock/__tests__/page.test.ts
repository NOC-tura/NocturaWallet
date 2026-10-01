import {LOCK_MS, exclusive, resumeTarget} from '../page';
import type {BusyGate} from '../orchestrate';

// Spec §7.6, rule 6 on the vault page: the page's one busy gate, plus the same 500 ms floor.
describe('exclusive (rule 6)', () => {
  function page() {
    let busy = false;
    const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
    const sleeps: (() => void)[] = [];
    const sleep = (ms: number) => {
      expect(ms).toBe(LOCK_MS);
      return new Promise<void>(r => sleeps.push(r));
    };
    const renders: boolean[] = [];
    const render = () => renders.push(busy);
    return {gate, sleep, sleeps, render, renders, busy: () => busy};
  }

  it('a second click before the action settles does nothing', async () => {
    const p = page();
    let runs = 0;
    let finish: () => void = () => undefined;
    const action = () => (runs++, new Promise<void>(r => (finish = r)));
    const first = exclusive(p, p.render, action);
    expect(await exclusive(p, p.render, action)).toBe('busy');
    expect(runs).toBe(1);
    finish();
    p.sleeps.forEach(r => r());
    await first;
    expect(p.busy()).toBe(false);
  });

  it('a second click inside 500 ms does nothing, although the action already settled; the screen re-renders on both edges', async () => {
    const p = page();
    let runs = 0;
    const first = exclusive(p, p.render, async () => void runs++);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(1);
    expect(await exclusive(p, p.render, async () => void runs++)).toBe('busy');
    expect(runs).toBe(1);
    expect(p.busy()).toBe(true);
    p.sleeps.forEach(r => r());
    await first;
    expect(p.busy()).toBe(false);
    expect(p.renders[0]).toBe(true);
    expect(p.renders.at(-1)).toBe(false);
  });

  it('a rejecting action still holds the gate for the floor; the gate then frees for a second press', async () => {
    const p = page();
    let runs = 0;
    const boom = new Error('boom');
    let reject: (e: unknown) => void = () => undefined;
    const action = () => (runs++, new Promise<void>((_, rj) => (reject = rj)));
    const first = exclusive(p, p.render, action);
    expect(await exclusive(p, p.render, action)).toBe('busy');
    expect(runs).toBe(1);
    reject(boom);
    // The action settled (rejected), but the 500 ms floor has not: the button stays locked.
    await Promise.resolve();
    await Promise.resolve();
    expect(p.busy()).toBe(true);
    expect(await exclusive(p, p.render, action)).toBe('busy');
    expect(runs).toBe(1);
    p.sleeps.forEach(r => r());
    await expect(first).rejects.toBe(boom);
    expect(p.busy()).toBe(false);
    // The gate is free again: a second press runs the action.
    const second = exclusive(p, p.render, async () => void runs++);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(2);
    p.sleeps.forEach(r => r());
    await second;
    expect(p.busy()).toBe(false);
  });
});

describe('resumeTarget', () => {
  it('builds the resume route only for an address; nothing else can name a page', () => {
    expect(resumeTarget('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk')).toBe('wallet.html#/send/resume?account=HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    for (const bad of ['', 'x', 'https://evil.example', 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk&amount=1', '0OIl'.repeat(10)]) expect(resumeTarget(bad)).toBeNull();
  });
});
