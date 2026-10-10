// @vitest-environment happy-dom
import {FLOW, SCREENS, TAB_ONLY, firstRoute, pickStack, routeReducer, type Route} from '../router';

const HOME: Route[] = [{screen: 'tab', tab: 'home'}];

const ADDR = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PREPARED = 'cd'.repeat(16);

// Spec §1.6: an in-memory stack; "No hash causes an action." The send flow's routes (plan 3) carry only what
// the user typed and which account and record a screen reads; the tab's resume route is #20, first route only.
describe('the router', () => {
  it('push, pop (never below the first route), and a tab resets the stack', () => {
    const s1 = routeReducer(HOME, {type: 'push', route: {screen: 'receive'}});
    expect(s1).toEqual([...HOME, {screen: 'receive'}]);
    expect(routeReducer(s1, {type: 'pop'})).toEqual(HOME);
    expect(routeReducer(HOME, {type: 'pop'})).toBe(HOME);
    expect(routeReducer([...s1, {screen: 'about'}], {type: 'tab', tab: 'activity'})).toEqual([{screen: 'tab', tab: 'activity'}]);
  });

  it('the pushable screens are a closed list; the hand-over screens are first routes only; the flow screens own their Esc', () => {
    expect([...SCREENS].sort()).toEqual(['about', 'accounts', 'confirm', 'contacts', 'delete', 'passkey', 'receive', 'review', 'security', 'send', 'status', 'tab', 'tx']);
    expect([...TAB_ONLY].sort()).toEqual(['created', 'imported', 'resume']);
    expect([...FLOW].sort()).toEqual(['confirm', 'resume', 'review', 'send', 'status']);
    for (const route of [{screen: 'created'}, {screen: 'imported'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
  });

  it.each(['resume', 'send/resume', 'sign', 'broadcast'])('refuses a pushed "%s" route: the stack is unchanged', screen => {
    const forged = {screen} as unknown as Route;
    expect(routeReducer(HOME, {type: 'push', route: forged})).toBe(HOME);
  });

  it('B1b-2b §1.4: security, accounts, passkey and delete carry exactly their name — any other key refuses the route', () => {
    for (const screen of ['security', 'accounts', 'passkey', 'delete'] as const) {
      expect(routeReducer(HOME, {type: 'push', route: {screen}})).toEqual([...HOME, {screen}]);
      for (const extra of [{challengeId: 'ab'.repeat(16)}, {index: 1}, {address: ADDR}]) {
        expect(routeReducer(HOME, {type: 'push', route: {screen, ...extra} as unknown as Route})).toBe(HOME);
      }
    }
  });

  // B1b-2b §1.4, plan 2: #15 carries `pick` and nothing else — never an address, a name or a draft (the pick hands the
  // address back through the send route's own draft, review M4).
  it('B1b-2b plan 2: contacts carries exactly {screen, pick: boolean}', () => {
    for (const pick of [true, false]) expect(routeReducer(HOME, {type: 'push', route: {screen: 'contacts', pick}})).toEqual([...HOME, {screen: 'contacts', pick}]);
    for (const bad of [{screen: 'contacts'}, {screen: 'contacts', pick: 'yes'}, {screen: 'contacts', pick: true, address: ADDR}, {screen: 'contacts', pick: false, draft: null}]) {
      expect(routeReducer(HOME, {type: 'push', route: bad as unknown as Route})).toBe(HOME);
    }
  });

  // §1.4 (review M4) and plan 2 review L8: the pick hands the address back through the send route's own draft; with no
  // send route below, null (App pops).
  it('pickStack: the send route under #15 takes the address in its draft, the stack ends there; none below → null', () => {
    const send: Route = {screen: 'send', draft: {token: 'NOC', recipient: '', amount: '2'}, notice: 'start-again'};
    expect(pickStack([...HOME, send, {screen: 'contacts', pick: true}], ADDR)).toEqual([...HOME, {screen: 'send', draft: {token: 'NOC', recipient: ADDR, amount: '2'}, notice: null}]);
    expect(pickStack([...HOME, {screen: 'send', draft: null, notice: null}, {screen: 'contacts', pick: true}], ADDR)).toEqual([...HOME, {screen: 'send', draft: {token: 'SOL', recipient: ADDR, amount: ''}, notice: null}]);
    expect(pickStack([...HOME, {screen: 'contacts', pick: true}], ADDR)).toBeNull();
    const back = pickStack([...HOME, send, {screen: 'contacts', pick: true}], ADDR);
    expect(back === null ? null : routeReducer(HOME, {type: 'reset', routes: back})).toEqual(back);
  });

  it('the flow routes: a draft is the user’s text, an intent an address and a positive u64, a status id 32 hex or null', () => {
    const ok: Route[] = [
      {screen: 'send', draft: null, notice: null},
      {screen: 'send', draft: {token: 'SOL', recipient: 'typed', amount: '1.'}, notice: 'start-again'},
      {screen: 'review', account: ADDR, intent: {token: 'NOC', recipient: ADDR, amount: 1n}, notice: null},
      {screen: 'confirm', account: ADDR, entry: 'flow', preparedId: PREPARED},
      {screen: 'confirm', account: ADDR, entry: 'resume'},
      {screen: 'status', account: ADDR, id: 'ab'.repeat(16), since: 1},
      {screen: 'status', account: ADDR, id: null, since: 1},
    ];
    for (const route of ok) expect(routeReducer(HOME, {type: 'push', route})).toEqual([...HOME, route]);
    const bad = [
      {screen: 'send', draft: {token: 'BONK', recipient: '', amount: ''}, notice: null},
      {screen: 'send', draft: null, notice: 'go'},
      {screen: 'review', account: ADDR, intent: {token: 'SOL', recipient: ADDR, amount: 0n}, notice: null},
      {screen: 'review', account: 'nope', intent: {token: 'SOL', recipient: ADDR, amount: 1n}, notice: null},
      {screen: 'confirm', account: ADDR, entry: 'auto'},
      // #20 from #19 is bound to the prepared send #19 showed, by id (Task 8); a resume is id-less.
      {screen: 'confirm', account: ADDR, entry: 'flow'},
      {screen: 'confirm', account: ADDR, entry: 'flow', preparedId: 'p1'},
      {screen: 'confirm', account: ADDR, entry: 'resume', preparedId: PREPARED},
      // A reference id only, never a prepared send: a route carrying anything more is refused whole.
      {screen: 'confirm', account: ADDR, entry: 'flow', preparedId: PREPARED, prepared: {id: PREPARED, tx: 'AQ=='}},
      {screen: 'review', account: ADDR, intent: {token: 'SOL', recipient: ADDR, amount: 1n}, notice: null, prepared: {}},
      {screen: 'status', account: ADDR, id: 'r1', since: 1},
      {screen: 'status', account: ADDR, id: null, since: Number.NaN},
    ];
    for (const route of bad) expect(routeReducer(HOME, {type: 'push', route: route as unknown as Route})).toBe(HOME);
  });

  it('replace swaps the top route; reset replaces the stack — each refused whole if any route is malformed', () => {
    const send: Route = {screen: 'send', draft: null, notice: null};
    const s1 = routeReducer([...HOME, send], {type: 'replace', route: {screen: 'send', draft: {token: 'SOL', recipient: 'a', amount: '1'}, notice: null}});
    expect(s1).toEqual([...HOME, {screen: 'send', draft: {token: 'SOL', recipient: 'a', amount: '1'}, notice: null}]);
    expect(routeReducer(s1, {type: 'reset', routes: [...HOME, {screen: 'status', account: ADDR, id: null, since: 5}]})).toEqual([...HOME, {screen: 'status', account: ADDR, id: null, since: 5}]);
    expect(routeReducer(s1, {type: 'reset', routes: [...HOME, {screen: 'resume', account: ADDR}]})).toBe(s1);
    expect(routeReducer(s1, {type: 'reset', routes: []})).toBe(s1);
    expect(routeReducer(s1, {type: 'replace', route: {screen: 'created'}})).toBe(s1);
  });

  // Plan 1's "no send route from a hash", made true for plan 3: the flow's routes exist now, but only the app's own
  // handlers push them. A hash reaches firstRoute alone, which yields #7, #40, Home or the id-less resume entry —
  // never #19, #20-from-#19, #21 or #12, and never with an id or an amount. The resume entry it can select is #20,
  // which reads wallet.preparedFor and waits for a tap (sendFlow.test.tsx: no wallet.send without one).
  it.each([
    '#/send',
    '#/confirm',
    '#/review',
    '#/status',
    `#/confirm?account=${ADDR}`,
    `#/send/confirm?account=${ADDR}&entry=flow&preparedId=${PREPARED}`,
    `#/send/resume?account=${ADDR}&preparedId=${PREPARED}`,
    `#/send/resume?account=${ADDR}&send=1`,
    `#/send/status?account=${ADDR}&id=${PREPARED}`,
  ])('a hash selects no flow screen but the id-less resume entry: "%s" is Home', hash => {
    expect(firstRoute('tab', hash)).toEqual(HOME);
  });

  it('the only flow screen a hash can select is resume, an account and nothing else', () => {
    const r = firstRoute('tab', `#/send/resume?account=${ADDR}`);
    expect(r).toEqual([{screen: 'resume', account: ADDR}]);
    expect(Object.keys(r[0] ?? {}).sort()).toEqual(['account', 'screen']);
  });

  it('refuses a route of a known screen with a malformed shape', () => {
    expect(routeReducer(HOME, {type: 'push', route: {screen: 'tx'} as unknown as Route})).toBe(HOME);
    // #27 (fix round 1): the signature and its owner, exactly — no owner, a non-address owner or an extra key is refused whole.
    const tx = {screen: 'tx', signature: 'sig', account: ADDR} as const;
    expect(routeReducer(HOME, {type: 'push', route: tx})).toEqual([...HOME, tx]);
    for (const bad of [{screen: 'tx', signature: 'sig'}, {screen: 'tx', signature: 'sig', account: 'not-an-address'}, {...tx, signature: ''}, {...tx, intent: {}}]) {
      expect(routeReducer(HOME, {type: 'push', route: bad as unknown as Route})).toBe(HOME);
    }
    expect(routeReducer(HOME, {type: 'tab', tab: 'send' as unknown as 'home'})).toBe(HOME);
  });

  it.each(['', '#/home', '#/send', '#/send/resume', '#/resume?id=1', '#/tx/abc', '#/about', '#/send/resume?account=', '#/send/resume?account=not-an-address', `#/send/resume?account=${ADDR}&amount=1`])(
    'the tab’s first route for hash "%s" is Home: a hash never acts',
    hash => {
      expect(firstRoute('tab', hash)).toEqual(HOME);
    },
  );

  it('the tab reads #/created (#7), #/imported (#40) and #/send/resume?account=<address> (#20 after #10); the popup ignores the hash', () => {
    expect(firstRoute('tab', '#/created')).toEqual([{screen: 'created'}]);
    expect(firstRoute('tab', '#/imported')).toEqual([{screen: 'imported'}]);
    expect(firstRoute('tab', `#/send/resume?account=${ADDR}`)).toEqual([{screen: 'resume', account: ADDR}]);
    expect(firstRoute('popup', '#/created')).toEqual(HOME);
    expect(firstRoute()).toEqual(HOME);
  });
});
