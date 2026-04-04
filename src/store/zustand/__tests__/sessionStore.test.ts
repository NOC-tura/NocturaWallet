import {useSessionStore} from '../sessionStore';

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().lock();
  });

  it('starts locked', () => {
    expect(useSessionStore.getState().isUnlocked).toBe(false);
  });

  it('unlock sets isUnlocked and timestamps', () => {
    const before = Date.now();
    useSessionStore.getState().unlock();
    const state = useSessionStore.getState();
    expect(state.isUnlocked).toBe(true);
    expect(state.unlockedAt).toBeGreaterThanOrEqual(before);
    expect(state.lastActiveAt).toBeGreaterThanOrEqual(before);
    expect(state.sessionExpiresAt).toBeGreaterThan(before);
  });

  it('lock resets all state', () => {
    useSessionStore.getState().unlock();
    useSessionStore.getState().lock();
    const state = useSessionStore.getState();
    expect(state.isUnlocked).toBe(false);
    expect(state.unlockedAt).toBeNull();
    expect(state.lastActiveAt).toBeNull();
    expect(state.sessionExpiresAt).toBeNull();
  });

  it('touchActivity updates lastActiveAt', () => {
    useSessionStore.getState().unlock();
    const firstActive = useSessionStore.getState().lastActiveAt;
    useSessionStore.getState().touchActivity();
    expect(useSessionStore.getState().lastActiveAt).toBeGreaterThanOrEqual(firstActive!);
  });

  it('isExpired returns true when past sessionExpiresAt', () => {
    useSessionStore.getState().unlock();
    useSessionStore.setState({sessionExpiresAt: Date.now() - 1000});
    expect(useSessionStore.getState().isExpired()).toBe(true);
  });
});
