// @vitest-environment happy-dom
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {useState} from 'react';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {DeleteWallet, firstAccount} from '../screens/DeleteWallet';
import {HoldButton, type HoldClock} from '../ui/HoldButton';
import {ENV, renderInWallet, walletReader} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {PENDING_KEY} from '../../background/pendingStore';
import {SETTINGS_KEY} from '../../background/settings';
import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {fakeReader} from '../../background/__tests__/fakeDeps';
import {useWallet, type WalletModel} from '../WalletContext';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';

// B1b-2b §5 (#37; D9, D11, C13, C17): typed DELETE and a 1 s hold open the vault tab's proof.
const SELECTORS = selectorsOf(UI_SHEETS);

/** A clock the test moves (the hold's fake timers): every tick the hold registered runs at each 30 ms step. */
function manualClock() {
  let t = 0;
  const jobs = new Set<() => void>();
  const clock: HoldClock = {now: () => t, every: (_ms, f) => (jobs.add(f), () => void jobs.delete(f))};
  return {
    clock,
    advance: (ms: number) =>
      act(() => {
        for (let step = 0; step < ms; step += 30) {
          t += 30;
          for (const f of [...jobs]) f();
        }
      }),
  };
}
async function shown(o: Parameters<typeof renderInWallet>[1] = {}) {
  const c = manualClock();
  let backs = 0;
  let current: WalletModel | null = null;
  function Probe() {
    current = useWallet();
    return null;
  }
  const w = await renderInWallet(
    <>
      <DeleteWallet onBack={() => void (backs += 1)} clock={c.clock} />
      <Probe />
    </>,
    o,
  );
  await screen.findByText('Delete this wallet?');
  const model = (): WalletModel => {
    if (current === null) throw new Error('no model yet');
    return current;
  };
  return {...w, ...c, model, backs: () => backs};
}
const field = () => screen.getByRole('textbox', {name: 'Type DELETE here'}) as HTMLInputElement;
const typeIn = (v: string) => fireEvent.change(field(), {target: {value: v}});
const cta = () => document.querySelector('.sticky-bar .btn-primary') as HTMLButtonElement;
const holdCta = () => document.querySelector('.app-hold') as HTMLButtonElement;
const cancel = () => screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement;
const settle = () => act(async () => new Promise(r => setTimeout(r, 30)));
const FUNDED = 'This wallet holds funds';
const UNKNOWN = 'Balances could not all be checked — this wallet may hold funds.';
const SEND_OPEN = 'A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.';
/**
 * D29 (owner, 2026-10-08): the send-open banner is a bold title + a regular body, as the funds banner — the approved
 * string split at its first sentence, no word added or dropped.
 */
const SEND_OPEN_TITLE = 'A transaction from this wallet is still pending.';
const SEND_OPEN_BODY = 'Wait until it confirms or expires — about two minutes — then try again.';
async function sendOpenBanner(): Promise<HTMLElement> {
  const title = await screen.findByText(SEND_OPEN_TITLE, {selector: '.banner-title'});
  const banner = title.closest('.banner.warning') as HTMLElement;
  expect(banner).not.toBeNull();
  expect(banner.querySelector('.banner-line')?.textContent).toBe(SEND_OPEN_BODY);
  expect(`${title.textContent} ${banner.querySelector('.banner-line')?.textContent}`).toBe(SEND_OPEN);
  return banner;
}

/** Holds the first message of `type` matching `match` until released; counts every message by type. */
function hold(type: string, match: (m: Record<string, unknown>) => boolean = () => true) {
  let release: () => void = () => undefined;
  let held = false;
  const seen: Record<string, unknown>[] = [];
  const gate = async (raw: unknown) => {
    const m = raw as Record<string, unknown>;
    seen.push(m);
    if (!held && m.type === type && match(m)) {
      held = true;
      await new Promise<void>(r => (release = r));
    }
  };
  const count = (t: string, f: (m: Record<string, unknown>) => boolean = () => true) => seen.filter(m => m.type === t && f(m)).length;
  return {gate, release: () => release(), isHeld: () => held, count};
}

describe('#37 delete wallet', () => {
  it('37a idle: the adapted copy, the two bullets (no staking, no dApps, no backup file), the typed field, the CTA greyed and disabled', async () => {
    await shown();
    expect(screen.getByText('Delete wallet', {selector: '.top-bar .title'})).toBeTruthy();
    expect(document.querySelector('.app-delete-card .noc-body')?.textContent).toBe('This removes all encrypted keys and local data from this browser.');
    expect([...document.querySelectorAll('.app-delete-card .noc-body b')].map(b => b.textContent)).toEqual(['all encrypted keys', 'local data']);
    const bullets = [...document.querySelectorAll('.app-delete-bullets li')].map(li => li.textContent);
    expect(bullets).toEqual([
      "Your assets won't be lost on-chain — but you'll need your recovery phrase to access them again.",
      'Local settings, cached balances and the list of addresses you have sent to are erased and not recoverable.',
    ]);
    expect(document.body.textContent).not.toMatch(/staking|dApp|backup file|seed phrase/);
    expect(document.querySelector('.app-delete-eyebrow')?.textContent).toBe('Type DELETE to confirm');
    expect(field().getAttribute('autocapitalize')).toBe('characters');
    expect(field().getAttribute('autocomplete')).toBe('off');
    expect(field().getAttribute('spellcheck')).toBe('false');
    expect(screen.getByText('Case-sensitive · must match exactly.')).toBeTruthy();
    expect(cta().textContent).toBe('Delete wallet');
    expect(cta().disabled).toBe(true);
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('C17: the first account is the LOWEST index — not the first row of the display order', async () => {
    await shown({before: async ext => ext.local.set(SETTINGS_KEY, {accountOrder: [1, 0]})});
    expect(firstAccount([{index: 1, name: 'B', publicKey: RECIPIENT}, {index: 0, name: 'A', publicKey: ACCOUNT.publicKey}])?.publicKey).toBe(ACCOUNT.publicKey);
    expect(firstAccount([])).toBeNull();
    // Neither the first nor the last of the list: the lowest index wherever it stands.
    const three = [{index: 2, name: 'C', publicKey: 'c'}, {index: 0, name: 'A', publicKey: 'a'}, {index: 1, name: 'B', publicKey: 'b'}];
    expect(firstAccount(three)?.index).toBe(0);
    expect(firstAccount([{index: 5, name: 'F', publicKey: 'f'}, {index: 3, name: 'D', publicKey: 'd'}, {index: 4, name: 'E', publicKey: 'e'}])?.index).toBe(3);
    await waitFor(() => expect([...document.querySelectorAll('.app-delete-first .addr-groups span')].map(s => s.textContent).join('')).toBe(ACCOUNT.publicKey));
    expect(screen.getByText("This wallet's first account")).toBeTruthy();
  });

  it('negative controls: "DELET", "delete", "DELETE " and "DEL" keep the CTA disabled', async () => {
    await shown();
    for (const v of ['DELET', 'delete', 'DELETE ', 'DEL', 'Delete']) {
      typeIn(v);
      expect(cta().disabled).toBe(true);
      expect(document.querySelector('.app-hold')).toBeNull();
    }
  });

  it('37b partial: the body collapses, "3 of 6 characters · keep going"; not a prefix: O66 (case-sensitive: "del" is not a prefix)', async () => {
    await shown();
    typeIn('DEL');
    expect(document.querySelector('.app-delete-bullets')).toBeNull();
    expect(document.querySelector('.app-delete-help')?.textContent).toBe('3 of 6 characters · keep going');
    expect([...document.querySelectorAll('.app-delete-help .noc-numeral')].map(n => n.textContent)).toEqual(['3', '6']);
    expect(document.querySelector('.s7-pw')?.classList.contains('app-pw-active')).toBe(true);
    typeIn('DEX');
    expect(screen.getByText('Type DELETE exactly — it is case-sensitive.')).toBeTruthy();
    expect(screen.queryByText(/keep going/)).toBeNull();
    typeIn('del');
    expect(screen.getByText('Type DELETE exactly — it is case-sensitive.')).toBeTruthy();
  });

  it('37c matched: the hold copy, "Confirmation matched", the caption; a 0.9 s hold opens nothing; the full second opens the proof and closes', async () => {
    const w = await shown();
    typeIn('DELETE');
    expect(screen.getByText('Hold the red button below — release to cancel, hold for the full second to delete.')).toBeTruthy();
    expect(document.querySelector('.app-delete-eyebrow')?.textContent?.trim()).toBe('Confirmation matched');
    expect(document.querySelector('.s7-pw')?.classList.contains('app-pw-ok')).toBe(true);
    expect(screen.getByText('Hold the red button to delete · release to cancel')).toBeTruthy();
    expect(screen.getByText('Confirmation opens in a new tab.')).toBeTruthy();
    const hold = holdCta();
    expect(hold.textContent).toBe('Hold to delete');
    fireEvent.pointerDown(hold, {button: 0});
    w.advance(600);
    expect(hold.textContent).toBe('Hold to delete · 0.4 s');
    // Task 20 visual pass: the label and its count are ONE run beside the icon, as ix:15089 draws "Hold to delete · 0.4 s"
    // — not two flex items, which the label's icon gap set 8 px apart ("delete ·  0.4 s").
    const flexItems = [...(hold.querySelector('.app-hold-label') as HTMLElement).childNodes];
    expect(flexItems.map(n => (n instanceof Element ? n.tagName.toLowerCase() : '#text'))).toEqual(['svg', 'span']);
    expect(flexItems[1]?.textContent).toBe('Hold to delete · 0.4 s');
    expect(flexItems[1] instanceof Element && flexItems[1].querySelector('.noc-numeral')?.textContent).toBe('0.4 s');
    expect((hold.querySelector('.fill') as HTMLElement).style.transform).toBe('scaleX(0.6)');
    expect(cancel().disabled).toBe(true);
    w.advance(300);
    fireEvent.pointerUp(hold);
    expect(w.platform.opened).toEqual([]);
    expect(hold.textContent).toBe('Hold to delete');
    expect((hold.querySelector('.fill') as HTMLElement).style.transform).toBe('scaleX(0)');
    expect(cancel().disabled).toBe(false);
    // A release long ago counts nothing toward the next hold.
    w.advance(2_000);
    expect(w.platform.opened).toEqual([]);
    fireEvent.pointerDown(hold, {button: 0});
    w.advance(1_020);
    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
    expect(w.platform.closed).toBe(1);
    expect(field().value).toBe('');
  });

  it('the full second, not less: released at 990 ms nothing opens', async () => {
    const w = await shown();
    typeIn('DELETE');
    const hold = holdCta();
    fireEvent.pointerDown(hold, {button: 0});
    w.advance(990);
    expect(hold.textContent).toBe('Hold to delete · 0.0 s');
    fireEvent.pointerUp(hold);
    w.advance(1_000);
    expect(w.platform.opened).toEqual([]);
  });

  it('the pointer leaving the CTA, a cancel and a blur each release; a secondary button does not hold', async () => {
    const w = await shown();
    typeIn('DELETE');
    const hold = holdCta();
    for (const end of [() => fireEvent.pointerLeave(hold), () => fireEvent.pointerCancel(hold), () => fireEvent.blur(hold)]) {
      fireEvent.pointerDown(hold, {button: 0});
      w.advance(600);
      end();
      w.advance(600);
      expect(w.platform.opened).toEqual([]);
      expect(hold.textContent).toBe('Hold to delete');
    }
    fireEvent.pointerDown(hold, {button: 2});
    w.advance(1_020);
    expect(w.platform.opened).toEqual([]);
  });

  it('the keyboard: Space held on the focused CTA holds; keyup releases; key repeats are ignored', async () => {
    const w = await shown();
    typeIn('DELETE');
    const hold = holdCta();
    fireEvent.keyDown(hold, {key: ' '});
    w.advance(500);
    fireEvent.keyDown(hold, {key: ' ', repeat: true});
    fireEvent.keyUp(hold, {key: ' '});
    w.advance(600);
    expect(w.platform.opened).toEqual([]);
    // Held with the OS's key repeats: the repeats neither release nor restart it — it opens at the full second.
    fireEvent.keyDown(hold, {key: 'Enter'});
    for (let i = 0; i < 10; i += 1) {
      w.advance(90);
      fireEvent.keyDown(hold, {key: 'Enter', repeat: true});
    }
    expect(w.platform.opened).toEqual([]);
    expect(hold.textContent).toBe('Hold to delete · 0.1 s');
    w.advance(120);
    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
  });

  it('funded (D11, C13): "This wallet holds funds", the summed balances, the USD total and O64 — above the overline — and the hold still works', async () => {
    const w = await shown();
    await waitFor(() => expect(screen.getByText(FUNDED)).toBeTruthy());
    // Two accounts × walletReader (62.4821 SOL, 4 200 NOC, 740.21 USDC): 124.9642 SOL, 8,400.00 NOC, 1,480.42 USDC.
    await waitFor(() => expect(document.querySelector('.app-delete-funds')?.textContent).toBe('124.9642 SOL8,400.00 NOC1,480.42 USDC$20,225.05They stay on Solana. Only your recovery phrase reaches them after this.'));
    // §5: above the overline ("Type DELETE to confirm"), after the warning card and the first account (F13).
    const banner = screen.getByText(FUNDED).closest('.banner') as HTMLElement;
    const overline = document.querySelector('.app-delete-eyebrow') as HTMLElement;
    expect(banner.compareDocumentPosition(overline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((document.querySelector('.app-delete-first') as HTMLElement).compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The funds inform; they never gate (D11): the hold is still required, and still enough.
    typeIn('DELETE');
    expect(screen.getByText(FUNDED)).toBeTruthy();
    const hold = holdCta();
    expect(hold.disabled).toBe(false);
    fireEvent.pointerDown(hold, {button: 0});
    w.advance(900);
    fireEvent.pointerUp(hold);
    expect(w.platform.opened).toEqual([]);
    fireEvent.pointerDown(hold, {button: 0});
    w.advance(1_020);
    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
  });

  it('balances unknown: a read failed — O65', async () => {
    await shown({reader: walletReader({getBalance: async () => Promise.reject(new Error('x'))})});
    expect(await screen.findByText(UNKNOWN)).toBeTruthy();
  });

  it('balances unknown: a fresh read failed although every account has a cached row — O65 still (the cache is not a check)', async () => {
    const at = Date.now() - 5_000;
    const row = {sol: '62482100000', noc: '0', usdc: '0', usdt: '0', at};
    await shown({
      reader: walletReader({getBalance: async () => Promise.reject(new Error('x'))}),
      before: async ext => ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: row, [RECIPIENT]: row}),
    });
    expect(await screen.findByText(UNKNOWN)).toBeTruthy();
    // The cached rows still inform: 2 × 62.4821 SOL.
    await waitFor(() => expect(document.querySelector('.app-delete-funds')?.textContent).toMatch(/^124\.9642 SOL/));
  });

  // Fix round 1, I1: a skipped fresh pass is not a check — stale cached zeros never read as "this wallet is empty".
  for (const [why, error] of [
    ['refused (the 403 cool-down)', () => new RpcForbidden('getBalance')],
    ['unreachable', () => new RequestUnreachable('getBalance', 'timeout')],
  ] as const) {
    it(`fresh pass skipped (${why}), every account cached at zero: O65, not silence`, async () => {
      const zero = {sol: '0', noc: '0', usdc: '0', usdt: '0', at: Date.now() - 3_600_000};
      // The screen's pass waits on Savings' cached read until the provider's own fresh read has put the app into
      // the refused / unreachable state: then the pass skips its fresh reads (useAccountBalances' `away`).
      const h = hold('wallet.cached', m => m.account === RECIPIENT);
      const w = await shown({
        gate: h.gate,
        reader: walletReader({getBalance: async () => Promise.reject(error())}),
        before: async ext => ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: zero, [RECIPIENT]: zero}),
      });
      await waitFor(() => expect(h.isHeld()).toBe(true));
      await waitFor(() => expect(w.model().net.mode).toBe(why === 'unreachable' ? 'unreachable' : 'refused'));
      const asked = h.count('wallet.balances');
      h.release();
      expect(await screen.findByText(UNKNOWN)).toBeTruthy();
      // Skipped indeed: the screen asked for no fresh balance, and nothing funded is claimed.
      expect(h.count('wallet.balances')).toBe(asked);
      expect(screen.queryByText(FUNDED)).toBeNull();
    });
  }

  it('nothing funded and everything read: neither banner', async () => {
    await shown({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []})});
    await settle();
    await settle();
    expect(screen.queryByText(FUNDED)).toBeNull();
    expect(screen.queryByText(UNKNOWN)).toBeNull();
  });

  it('send open: the pending banner; the typed gate usable; the CTA disabled — and a hold with `disabled` lifted opens nothing', async () => {
    const open = pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
    const w = await shown({before: async ext => ext.local.set(PENDING_KEY, [open])});
    await sendOpenBanner();
    typeIn('DELETE');
    const hold = holdCta();
    expect(hold.disabled).toBe(true);
    hold.disabled = false;
    fireEvent.pointerDown(hold, {button: 0});
    fireEvent.keyDown(hold, {key: 'Enter'});
    w.advance(1_500);
    expect(w.platform.opened).toEqual([]);
    expect(hold.textContent).toBe('Hold to delete');
  });

  it('a stuck send is open too: the pending banner and the CTA disabled', async () => {
    const stuck = pendingRecord({account: RECIPIENT, signature: '6'.repeat(88), state: 'stuck', intent: {token: 'SOL', recipient: ACCOUNT.publicKey, amount: '1'}});
    await shown({before: async ext => ext.local.set(PENDING_KEY, [stuck])});
    await sendOpenBanner();
    typeIn('DELETE');
    expect(holdCta().disabled).toBe(true);
  });

  it('Cancel leaves with the typed text wiped', async () => {
    const w = await shown({env: ENV});
    typeIn('DELE');
    fireEvent.click(cancel());
    expect(w.backs()).toBe(1);
    expect(field().value).toBe('');
  });

  // Task 20 (Task 15 M6): design-ext's `.s7-pw input {outline: 0}` left the EMPTY field with no focus indicator. app.css
  // gives the focused field 37b's accent ring; a matched field keeps its success border. The real app.css is loaded (each
  // color-mix(…) swapped for a plain colour, which happy-dom cannot parse — the selectors and their order are app.css's own).
  // happy-dom matches `:focus` but not `:focus-within` (probed: `label.matches(':focus-within')` is false with its input
  // focused), so the pseudo-class is stood in for by a class the test sets while the input has the focus. The real
  // pseudo-class is checked computed in Chromium by e2e/visual-settings.spec.ts (37a-focused).
  it('the empty DELETE field shows a focus ring (1 px accent border); unfocused it has none; matched keeps the success border', async () => {
    const swap = (css: string): string => {
      let out = '';
      for (let i = 0; i < css.length; ) {
        if (!css.startsWith('color-mix(', i)) {
          out += css[i++];
          continue;
        }
        let depth = 0;
        let j = i + 'color-mix'.length;
        do {
          if (css[j] === '(') depth++;
          else if (css[j] === ')') depth--;
          j++;
        } while (depth > 0);
        out += 'rgb(0, 128, 0)';
        i = j;
      }
      return out;
    };
    const style = document.createElement('style');
    const css = swap(readFileSync(join(__dirname, '..', 'app.css'), 'utf8'));
    expect(css).toContain('.s7-pw:focus-within');
    style.textContent = `:root { --accent: rgb(1, 2, 3); }\n${css.replaceAll(':focus-within', '.focus-within-standin')}`;
    document.head.append(style);
    try {
      await shown({env: ENV});
      const label = field().closest('.s7-pw') as HTMLElement;
      expect(getComputedStyle(label).borderTopStyle).not.toBe('solid');
      field().focus();
      expect(document.activeElement).toBe(field());
      label.classList.add('focus-within-standin');
      expect(getComputedStyle(label).borderTopWidth).toBe('1px');
      expect(getComputedStyle(label).borderTopStyle).toBe('solid');
      expect(getComputedStyle(label).borderTopColor).toBe('rgb(1, 2, 3)');
      typeIn('DELETE');
      field().focus();
      // React rewrote the label's className on the re-render: the stand-in for the still-focused field goes back on.
      label.classList.add('focus-within-standin');
      expect(label.classList.contains('app-pw-ok')).toBe(true);
      expect(label.classList.contains('focus-within-standin')).toBe(true);
      expect(getComputedStyle(label).borderTopColor).toBe('rgb(0, 128, 0)');
    } finally {
      style.remove();
    }
  });

  it('Back leaves with the typed text wiped', async () => {
    const w = await shown({env: ENV});
    typeIn('DELETE');
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(w.backs()).toBe(1);
    expect(field().value).toBe('');
    expect(w.platform.opened).toEqual([]);
  });

  describe('rule 6: every action is protected (`disabled` lifted, a second press does nothing)', () => {
    it('the gated [Delete wallet]: no action at all', async () => {
      const w = await shown();
      typeIn('DELET');
      const gated = cta();
      gated.disabled = false;
      fireEvent.click(gated);
      fireEvent.pointerDown(gated, {button: 0});
      w.advance(1_500);
      expect(w.platform.opened).toEqual([]);
    });

    it('the hold: a second press while held does not restart it; one open per completed hold, none after', async () => {
      const c = manualClock();
      let held = 0;
      render(<HoldButton label="Hold to delete" holdMs={1_000} disabled={false} onHeld={() => void (held += 1)} clock={c.clock} />);
      const b = screen.getByRole('button') as HTMLButtonElement;
      fireEvent.pointerDown(b, {button: 0});
      c.advance(600);
      fireEvent.pointerDown(b, {button: 0});
      fireEvent.keyDown(b, {key: ' '});
      c.advance(300);
      // Not restarted: the count goes on from the first press.
      expect(b.textContent).toBe('Hold to delete · 0.1 s');
      c.advance(120);
      expect(held).toBe(1);
      b.disabled = false;
      fireEvent.pointerDown(b, {button: 0});
      c.advance(1_500);
      fireEvent.keyDown(b, {key: 'Enter'});
      c.advance(1_500);
      expect(held).toBe(1);
    });

    it('the hold: `disabled` while held releases it (a send opened meanwhile)', async () => {
      const c = manualClock();
      let held = 0;
      const ui = (disabled: boolean) => <HoldButton label="Hold to delete" holdMs={1_000} disabled={disabled} onHeld={() => void (held += 1)} clock={c.clock} />;
      const r = render(ui(false));
      const b = screen.getByRole('button') as HTMLButtonElement;
      fireEvent.pointerDown(b, {button: 0});
      c.advance(600);
      r.rerender(ui(true));
      c.advance(1_000);
      expect(held).toBe(0);
      expect(b.textContent).toBe('Hold to delete');
    });

    it('the hold: unmounted while held (Esc, a lock), its tick stops — nothing opens later', async () => {
      const c = manualClock();
      let held = 0;
      const r = render(<HoldButton label="Hold to delete" holdMs={1_000} disabled={false} onHeld={() => void (held += 1)} clock={c.clock} />);
      fireEvent.pointerDown(screen.getByRole('button'), {button: 0});
      c.advance(600);
      r.unmount();
      c.advance(1_000);
      expect(held).toBe(0);
    });

    it('Enter held across a send opening and closing: the OS repeats that follow neither start nor complete a hold', async () => {
      const c = manualClock();
      let held = 0;
      const ui = (disabled: boolean) => <HoldButton label="Hold to delete" holdMs={1_000} disabled={disabled} onHeld={() => void (held += 1)} clock={c.clock} />;
      const r = render(ui(false));
      const b = screen.getByRole('button') as HTMLButtonElement;
      fireEvent.keyDown(b, {key: 'Enter'});
      c.advance(300);
      r.rerender(ui(true));
      expect(b.textContent).toBe('Hold to delete');
      r.rerender(ui(false));
      for (let i = 0; i < 20; i += 1) {
        fireEvent.keyDown(b, {key: 'Enter', repeat: true});
        c.advance(90);
      }
      expect(b.textContent).toBe('Hold to delete');
      expect(held).toBe(0);
    });

    it('unmounted mid-press: onPressing(false), so the screen does not keep Cancel disabled', async () => {
      const c = manualClock();
      const seen: boolean[] = [];
      const r = render(<HoldButton label="Hold to delete" holdMs={1_000} disabled={false} onHeld={() => undefined} onPressing={p => void seen.push(p)} clock={c.clock} />);
      fireEvent.pointerDown(screen.getByRole('button'), {button: 0});
      c.advance(300);
      r.unmount();
      expect(seen).toEqual([true, false]);
    });

    it('on #37: the hold unmounted mid-press (the typed word edited) leaves Cancel enabled', async () => {
      const w = await shown();
      typeIn('DELETE');
      fireEvent.pointerDown(holdCta(), {button: 0});
      w.advance(300);
      expect(cancel().disabled).toBe(true);
      typeIn('DELET');
      expect(document.querySelector('.app-hold')).toBeNull();
      expect(cancel().disabled).toBe(false);
      w.advance(1_000);
      expect(w.platform.opened).toEqual([]);
    });

    it('a release that already happened wins: a tick already queued when the press ended (a stalled clock) completes nothing', async () => {
      // A clock whose stop lands one step late: the tick queued before the release still runs once after it.
      let t = 0;
      const jobs = new Set<() => void>();
      const late: (() => void)[] = [];
      const clock: HoldClock = {now: () => t, every: (_ms, f) => (jobs.add(f), () => void late.push(() => jobs.delete(f)))};
      const step = (ms: number) =>
        act(() => {
          t += ms;
          for (const f of [...jobs]) f();
          for (const drop of late.splice(0)) drop();
        });
      let held = 0;
      render(<HoldButton label="Hold to delete" holdMs={1_000} disabled={false} onHeld={() => void (held += 1)} clock={clock} />);
      const b = screen.getByRole('button') as HTMLButtonElement;
      fireEvent.pointerDown(b, {button: 0});
      step(900);
      fireEvent.pointerUp(b);
      // The stall: the queued tick runs after the release, with the clock past the full second.
      step(300);
      expect(held).toBe(0);
      expect(b.textContent).toBe('Hold to delete');
      // Positive control: held through on the same clock, it completes.
      fireEvent.pointerDown(b, {button: 0});
      step(1_000);
      expect(held).toBe(1);
    });

    it('[Cancel]: one leave', async () => {
      const w = await shown();
      const c = cancel();
      fireEvent.click(c);
      // A LockedButton: locked at the click.
      expect(c.disabled).toBe(true);
      c.disabled = false;
      fireEvent.click(c);
      expect(w.backs()).toBe(1);
    });

    it('Back: one leave, and none after a Cancel', async () => {
      const w = await shown();
      const back = screen.getByRole('button', {name: 'Back'});
      fireEvent.click(back);
      fireEvent.click(back);
      fireEvent.click(cancel());
      expect(w.backs()).toBe(1);
    });

    it('[Cancel] while held: disabled, and with `disabled` lifted it does not leave', async () => {
      const w = await shown();
      typeIn('DELETE');
      fireEvent.pointerDown(holdCta(), {button: 0});
      w.advance(300);
      const c = cancel();
      expect(c.disabled).toBe(true);
      c.disabled = false;
      fireEvent.click(c);
      expect(w.backs()).toBe(0);
    });
  });

  it('send open from an account not selected: the screen reads wallet.pending itself, and the CTA enables when the send closes', async () => {
    // Savings is not selected: the provider polls wallet.pending only for Main's sends.
    const open = pendingRecord({account: RECIPIENT, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: ACCOUNT.publicKey, amount: '1'}});
    const w = await shown({before: async ext => ext.local.set(PENDING_KEY, [open])});
    typeIn('DELETE');
    await waitFor(() => expect(holdCta().disabled).toBe(true));
    await w.ext.local.set(PENDING_KEY, [{...open, state: 'confirmed'}]);
    await waitFor(() => expect(holdCta().disabled).toBe(false), {timeout: 4_000});
    expect(screen.queryByText(SEND_OPEN_TITLE)).toBeNull();
  }, 10_000);

  describe('every await is guarded (the balances pass, the pending read)', () => {
    it('lock mid-pass: the pass stops and says nothing (no "could not all be checked")', async () => {
      const h = hold('wallet.balances', m => m.account === RECIPIENT);
      const w = await shown({gate: h.gate});
      await waitFor(() => expect(h.isHeld()).toBe(true));
      await act(async () => void (await w.model().lock()));
      await waitFor(() => expect(w.model().phase).toBe('locked'));
      h.release();
      await settle();
      await settle();
      expect(screen.queryByText(UNKNOWN)).toBeNull();
    });

    /** The provider settled first, then the screen mounts: the first wallet.pending after `armed` is the screen's own. */
    async function heldPendingRead() {
      let armed = false;
      const h = hold('wallet.pending', () => armed);
      const open = pendingRecord({account: RECIPIENT, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: ACCOUNT.publicKey, amount: '1'}});
      let current: WalletModel | null = null;
      let show: (on: boolean) => void = () => undefined;
      function Host() {
        const [on, setOn] = useState(false);
        show = setOn;
        current = useWallet();
        return on ? <DeleteWallet onBack={() => undefined} /> : null;
      }
      const w = await renderInWallet(<Host />, {gate: h.gate, before: async ext => ext.local.set(PENDING_KEY, [open])});
      await waitFor(() => expect(current?.phase).toBe('unlocked'));
      await settle();
      armed = true;
      act(() => show(true));
      await waitFor(() => expect(h.isHeld()).toBe(true));
      const model = (): WalletModel => {
        if (current === null) throw new Error('no model yet');
        return current;
      };
      return {...w, h, model, hide: () => act(() => show(false))};
    }

    it('pending read · unmount: no poll scheduled', async () => {
      const {h, hide} = await heldPendingRead();
      hide();
      const before = h.count('wallet.pending');
      h.release();
      await act(async () => new Promise(r => setTimeout(r, 2_500)));
      expect(h.count('wallet.pending')).toBe(before);
    }, 10_000);

    it('pending read · lock: no poll scheduled', async () => {
      const {h, model} = await heldPendingRead();
      await act(async () => void (await model().lock()));
      await waitFor(() => expect(model().phase).toBe('locked'));
      const before = h.count('wallet.pending');
      h.release();
      await act(async () => new Promise(r => setTimeout(r, 2_500)));
      expect(h.count('wallet.pending')).toBe(before);
    }, 10_000);

    it('pending read · positive control: unlocked and shown, the open send is polled again', async () => {
      const {h} = await heldPendingRead();
      const before = h.count('wallet.pending');
      h.release();
      await waitFor(() => expect(h.count('wallet.pending')).toBeGreaterThan(before), {timeout: 4_000});
    }, 10_000);

    it('unmount mid-pass: nothing read after', async () => {
      // Savings is not selected: only the screen's pass reads it (the provider reads the selected account).
      const h = hold('wallet.cached', m => m.account === RECIPIENT);
      await shown({gate: h.gate});
      await waitFor(() => expect(h.isHeld()).toBe(true));
      cleanup();
      const before = h.count('wallet.balances');
      h.release();
      await settle();
      // The whole tree went (the provider too): no read at all after the release.
      expect(h.count('wallet.balances')).toBe(before);
    });
  });
});
