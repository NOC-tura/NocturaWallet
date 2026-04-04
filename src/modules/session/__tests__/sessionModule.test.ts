import {SessionManager} from '../sessionModule';

describe('SessionManager', () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager();
  });

  afterEach(() => {
    session.lock();
  });

  describe('unlock / lock lifecycle', () => {
    it('starts locked', () => {
      expect(session.isActive()).toBe(false);
    });

    it('unlock activates session with keypair', () => {
      const fakeKeypair = new Uint8Array(64);
      fakeKeypair.fill(0xaa);
      session.unlock(fakeKeypair);
      expect(session.isActive()).toBe(true);
    });

    it('lock deactivates session', () => {
      const fakeKeypair = new Uint8Array(64);
      fakeKeypair.fill(0xaa);
      session.unlock(fakeKeypair);
      session.lock();
      expect(session.isActive()).toBe(false);
    });

    it('lock zeroizes the keypair bytes', () => {
      const fakeKeypair = new Uint8Array(64);
      fakeKeypair.fill(0xaa);
      session.unlock(fakeKeypair);
      session.lock();
      expect(fakeKeypair.every(b => b === 0)).toBe(true);
    });

    it('getKeypair returns the keypair when active', () => {
      const fakeKeypair = new Uint8Array(64);
      fakeKeypair.fill(0xbb);
      session.unlock(fakeKeypair);
      const kp = session.getKeypair();
      expect(kp).not.toBeNull();
      expect(kp![0]).toBe(0xbb);
    });

    it('getKeypair returns null when locked', () => {
      expect(session.getKeypair()).toBeNull();
    });
  });

  describe('timeout', () => {
    it('sessionExpiresIn returns 0 when locked', () => {
      expect(session.sessionExpiresIn()).toBe(0);
    });

    it('sessionExpiresIn returns positive when active', () => {
      session.unlock(new Uint8Array(64));
      expect(session.sessionExpiresIn()).toBeGreaterThan(0);
    });

    it('touchActivity extends the session timeout', () => {
      session.unlock(new Uint8Array(64));
      const before = session.sessionExpiresIn();
      session.touchActivity();
      const after = session.sessionExpiresIn();
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('isActive auto-locks when expired', () => {
      session.unlock(new Uint8Array(64));
      // Force expiry by setting timeout to 0
      session.setTimeoutMinutes(0);
      session.touchActivity(); // recalculate expiresAt to now
      // Now isActive should auto-lock
      expect(session.isActive()).toBe(false);
    });
  });

  describe('double lock safety', () => {
    it('locking twice does not throw', () => {
      session.unlock(new Uint8Array(64));
      session.lock();
      expect(() => session.lock()).not.toThrow();
    });
  });
});
