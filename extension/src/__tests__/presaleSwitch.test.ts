import * as bgEntry from '../background/presale/api';
import * as bgStub from '../presale-off/background';
import * as appEntry from '../app/presale';
import * as appStub from '../presale-off/app';
import * as unlockEntry from '../unlock/presale';
import * as unlockStub from '../presale-off/unlock';

// B1d §1.1 (review L10): this file runs in both vitest runs — vite.config.ts (presale on) and vitest.nopresale.config.ts
// (off, the run marked NOCTURA_PRESALE=0). In each, the constant and the plugin must agree with the run: on, every entry
// is its own module; off, importing an entry gives the stub's module itself.
const off = process.env.NOCTURA_PRESALE === '0';

// Each stub has exactly its entry's shape, both ways (tsc proves it; nothing here runs).
const shapes: [typeof bgEntry, typeof bgStub, typeof appEntry, typeof appStub, typeof unlockEntry, typeof unlockStub] = [bgStub, bgEntry, appStub, appEntry, unlockStub, unlockEntry];

describe(`the build-time switch in this run (${off ? 'off' : 'on'})`, () => {
  it(`__NOCTURA_PRESALE__ is ${!off}`, () => {
    expect(__NOCTURA_PRESALE__).toBe(!off);
  });

  it(off ? 'each entry resolved to its stub' : 'each entry is its own module, not the stub (positive control)', () => {
    expect([bgEntry === bgStub, appEntry === appStub, unlockEntry === unlockStub]).toEqual([off, off, off]);
    expect(shapes).toHaveLength(6);
  });

  it(off ? 'the stubs export empty values: no message type, no route, no slot, no description' : 'the entries export what B1d-1b has built so far, the stubs empty values', () => {
    // B1d-1b: the background entry's message types (§1.4) — Task 1's three, Task 2's prepare, Task 3's four; the stub adds none.
    expect(bgEntry.PRESALE_MESSAGE_TYPES).toEqual(off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared']);
    expect(bgStub.PRESALE_MESSAGE_TYPES).toEqual([]);
    for (const m of [appEntry, appStub]) {
      expect(m.presaleRoutes).toEqual([]);
      expect(m.presaleSlots).toBeNull();
    }
    for (const m of [unlockEntry, unlockStub]) expect(m.describePresale({kind: 'presale-buy'})).toBeNull();
  });
});
