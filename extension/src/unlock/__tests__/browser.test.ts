// @vitest-environment happy-dom
import {browserPageDeps} from '../browser';

/** Sets what document.visibilityState reads, then fires visibilitychange as the browser would. */
function visibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', {value: state, configurable: true});
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', {value: 'visible', configurable: true});
});

// Spec §3.5's memory rule: what a screen holds is dropped on pagehide AND on visibilitychange to hidden.
describe('browserPageDeps: the page leaving and coming back', () => {
  it('onLeave runs on pagehide, saying so', () => {
    const deps = browserPageDeps();
    const left: string[] = [];
    deps.onLeave(why => left.push(why));
    window.dispatchEvent(new Event('pagehide'));
    expect(left).toEqual(['pagehide']);
  });

  it('onLeave runs on visibilitychange to hidden ("hidden"), and not on visibilitychange to visible', () => {
    const deps = browserPageDeps();
    const left: string[] = [];
    deps.onLeave(why => left.push(why));
    visibility('visible');
    expect(left).toEqual([]);
    visibility('hidden');
    expect(left).toEqual(['hidden']);
  });

  it('onReturn: "visible" on visibilitychange to visible; "restored" on a pageshow from the back/forward cache; nothing on the first load’s pageshow or on hidden', () => {
    const deps = browserPageDeps();
    const back: string[] = [];
    deps.onReturn(why => back.push(why));
    visibility('hidden');
    window.dispatchEvent(Object.assign(new Event('pageshow'), {persisted: false}));
    expect(back).toEqual([]);
    visibility('visible');
    expect(back).toEqual(['visible']);
    window.dispatchEvent(Object.assign(new Event('pageshow'), {persisted: true}));
    expect(back).toEqual(['visible', 'restored']);
  });

  it('one page gate for the whole page, which tells screens when it frees', () => {
    const deps = browserPageDeps();
    const idle: number[] = [];
    deps.gate.onIdle(() => idle.push(1));
    deps.gate.setBusy(true);
    expect(deps.gate.isBusy()).toBe(true);
    deps.gate.setBusy(false);
    expect(idle).toEqual([1]);
  });
});
