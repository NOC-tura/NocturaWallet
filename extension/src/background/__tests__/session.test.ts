import {setSession, getSession, clearSession, sessionMutex, SESSION_KEY} from '../session';
import {fakeExt} from './fakeExt';

const ACC = [{index: 0, publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', secretKey: 'AAAA'}];

describe('session keys', () => {
  it('round-trips through JSON-serialised storage as strings', async () => {
    const ext = fakeExt();
    await setSession(ext, ACC);
    expect(await getSession(ext)).toEqual(ACC);
    expect(typeof ((await ext.session.get(SESSION_KEY)) as {accounts: {secretKey: unknown}[]}).accounts[0]?.secretKey).toBe('string');
  });
  it('is gone after clear', async () => {
    const ext = fakeExt();
    await setSession(ext, ACC);
    await clearSession(ext);
    expect(await getSession(ext)).toBeNull();
  });
  it('never writes to storage.local', async () => {
    const ext = fakeExt();
    await setSession(ext, ACC);
    expect((ext.local as unknown as {data: Map<string, unknown>}).data.size).toBe(0);
  });
  it('an unlock waits for a critical section on sessionMutex instead of writing into it', async () => {
    const ext = fakeExt();
    let release: () => void = () => undefined;
    const held = sessionMutex(() => new Promise<void>(r => (release = r)));
    const unlock = setSession(ext, ACC);
    await new Promise(r => setTimeout(r, 10));
    expect(await getSession(ext)).toBeNull();
    release();
    await held;
    await unlock;
    expect(await getSession(ext)).toEqual(ACC);
  });
  it('strips unknown fields before storing — never persists more than index/publicKey/secretKey', async () => {
    const ext = fakeExt();
    const dirty = [{...ACC[0], seed: 'do-not-store-me'}] as unknown as typeof ACC;
    await setSession(ext, dirty);
    const raw = (await ext.session.get(SESSION_KEY)) as {accounts: Record<string, unknown>[]};
    expect(Object.keys(raw.accounts[0] ?? {}).sort()).toEqual(['index', 'publicKey', 'secretKey']);
    expect(JSON.stringify(raw)).not.toContain('seed');
  });
});
