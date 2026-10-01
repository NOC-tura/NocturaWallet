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
  it('onLeave runs on pagehide', () => {
    const deps = browserPageDeps();
    const left: string[] = [];
    deps.onLeave(() => left.push('left'));
    window.dispatchEvent(new Event('pagehide'));
    expect(left).toEqual(['left']);
  });

  it('onLeave runs on visibilitychange to hidden, and not on visibilitychange to visible', () => {
    const deps = browserPageDeps();
    const left: string[] = [];
    deps.onLeave(() => left.push('left'));
    visibility('visible');
    expect(left).toEqual([]);
    visibility('hidden');
    expect(left).toEqual(['left']);
  });

  it('onReturn runs on visibilitychange to visible and on pageshow, never on hidden', () => {
    const deps = browserPageDeps();
    const back: string[] = [];
    deps.onReturn(() => back.push('back'));
    visibility('hidden');
    expect(back).toEqual([]);
    visibility('visible');
    expect(back).toEqual(['back']);
    window.dispatchEvent(new Event('pageshow'));
    expect(back).toEqual(['back', 'back']);
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
