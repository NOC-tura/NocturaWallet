import * as bgEntry from '../background/presale/api';
import * as bgStub from '../presale-off/background';
import * as appEntry from '../app/presale';
import * as appStub from '../presale-off/app';
import * as unlockEntry from '../unlock/presale';
import * as unlockStub from '../presale-off/unlock';
import {MAINNET_SOL_TREASURY} from '../../../core/presale/addresses';

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
    // B1d-1b Tasks 4–6: the popup entry's routes — #23 (`presale`), #20's purchase variant (`presale-confirm`) and #50b
    // (`geo`) — and its slots (the record words, the resume, #11's banner and Buy); the stub adds none.
    expect(appEntry.presaleRoutes.map(r => r.screen)).toEqual(off ? [] : ['presale', 'presale-confirm', 'geo']);
    expect(appStub.presaleRoutes).toEqual([]);
    expect(appEntry.presaleSlots === null).toBe(off);
    expect(appStub.presaleSlots).toBeNull();
    // B1d-1b Task 5: the vault page's entry describes a purchase challenge (a valid one); the stub nothing.
    const about = {
      kind: 'presale-buy',
      account: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
      currency: 'SOL',
      amount: '2000000000',
      stage: 0,
      priceTicks: '1501',
      nocBase: '2643837441705',
      spentCents: '39684',
      destination: MAINNET_SOL_TREASURY,
      networkLamports: '5050',
      priorityLamports: '50',
      rentLamports: '0',
      reasons: ['first-purchase'],
      thresholdCents: 10_000,
    };
    expect(unlockEntry.describePresale(about) === null).toBe(off);
    expect(unlockStub.describePresale(about)).toBeNull();
    for (const m of [unlockEntry, unlockStub]) expect(m.describePresale({kind: 'presale-buy'})).toBeNull();
  });
});
