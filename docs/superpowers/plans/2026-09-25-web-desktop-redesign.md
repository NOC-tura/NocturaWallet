# Web desktop redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved desktop/phone redesign into `web/src` so the presale page has visible depth, balanced columns and every designed state, without weakening any security or honesty property the page already has.

**Architecture:** Styling-first port. New tokens and surfaces go into `web/src/styles/design-system.css` (the one stylesheet the motion test and CSP gate read). Components keep their data flow and copy; they gain the design's class names and structure. Two small new units carry the only new behaviour: `AddressGroups` (full address in 4-character groups, no emphasis) and `CopyButton` (clipboard with confirmation).

**Tech Stack:** React 19 + Vite, vitest + @testing-library/react, plain CSS (no inline `style`), @solana/wallet-adapter-react-ui (vendored CSS in `web/src/wallet/wallet-adapter.css`).

**Spec:** `/home/user/Downloads/Noctura Desktop Redesign/Noctura Desktop Redesign.html` (the non-standalone file; the `(standalone)` one is the OLD version). Its CSS is the source for every value below. The design's review in the 2026-09-24/25 conversation sets the deviations listed under Global Constraints.

## Global Constraints

- **Copy is never taken from the mockup.** Every string stays the one the code renders today. The mockup's placeholders are NOT ported: "Presale paused" → keep `Presale is paused`; the invented unconfirmed-row note ("Nothing was debited…") → keep the coordinator's `status_reason` / our `Not found on chain…` sentence.
- **The mockup's treasury address `6ZiaVPmN6Ttz…qkJXo6Vd` is FABRICATED** (written from memory into the design prompt). The only treasury is the constant `MAINNET_SOL_TREASURY = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd'` (`core/presale/addresses.ts:13`). Never paste an address from the mockup.
- **No end-emphasis on addresses.** The mockup brightens the first and last four characters. An active poisoning address (`6ZiahdPaj8K4gFNRdisMtZjzvDjje1bXdzWwkoSoo6Vd`) matches the Squads vault on exactly those characters. Addresses render in equal-weight 4-char groups instead (Task 4).
- No `style=` props, no inline scripts, no external hosts (CSP + `no-external-hosts` gate). The existing `style={{color:'var(--accent)'}}` in BuyForm and the progress `<i style={{width}}>` are removed by this plan.
- Every rule that sets `animation`/`transition` must also appear in the `@media (prefers-reduced-motion: reduce)` block (`src/__tests__/motion.test.ts` enforces it).
- Web only. `tailwind.config.js` and the Android app are not touched. `--fg-tertiary` becomes `#878B94` on the web only.
- **Phone order is NOT reordered visually.** The mockup uses `display:contents` + `order` to lift the wallet above the buy form on phone, which makes keyboard focus order differ from visual order (the designer flagged it). The DOM keeps desktop column order and phone shows it as-is. This is a deliberate deviation.
- Laptop breakpoint uses `@media (min-width: 900px)` (existing), not the mockup's container query.
- `npm run verify` in `web/` must pass after every task (build, 325+ tests, bundle, scan, CSP, nginx, reproducible, manifest).
- Commits: `feat(web)`/`fix(web)` style of recent history, message body says why; end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File map

| File | Change |
|---|---|
| `web/src/styles/design-system.css` | tokens, surfaces, buttons, progress, layout, every component block |
| `web/src/ui/Icon.tsx` | +12 icons copied path-for-path from the spec sprite |
| `web/src/ui/AddressGroups.tsx` (new) | equal-weight grouped address |
| `web/src/ui/CopyButton.tsx` (new) | clipboard button with confirmation |
| `web/src/presale/PresalePanel.tsx` | native `<progress>`, paused badge, allocation layout, states |
| `web/src/presale/BuyForm.tsx` | wells, signing summary, field messages, step labels, tx boxes |
| `web/src/wallet/ConnectPanel.tsx` | wallet card, address field + copy, no-wallet aside |
| `web/src/portfolio/PortfolioPanel.tsx`, `PurchaseHistory.tsx`, `Sparkline.tsx` | holdings list, market-value footer, one divided purchases list |
| `web/src/tge/Countdown.tsx`, `web/src/referral/ReferralPanel.tsx`, `web/src/App.tsx` | TGE row, referral link field + copy, referral moves to main column |

---

### Task 1: Tokens, surfaces, buttons (the visible fix)

**Files:**
- Modify: `web/src/styles/design-system.css` (`:root` block ~l.43-90; `.noc-card` ~l.156; `.noc-card-quiet` ~l.174; `.btn*` ~l.130-140; `html`/`body` background)
- Create: `web/src/__tests__/contrast.test.ts`

**Interfaces:** Produces tokens used by every later task: `--elev-1 --elev-2 --elev-3 --well --border-subtle --border-default --border-strong --edge-highlight --shadow-card --grad-card --accent-soft --accent-border --accent-hover --glow-accent --danger-soft --warning-soft --page-wash --layout-max`.

- [ ] **Step 1: Write the failing contrast test** — it parses `:root` hex tokens and asserts the AA claims the design makes.

```ts
import {readFileSync} from 'node:fs';

const CSS = readFileSync('src/styles/design-system.css', 'utf8');
const token = (name: string): string => {
  const m = CSS.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`${name} not found as a hex token`);
  return m[1] as string;
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe('text contrast on the card surface (WCAG AA, 4.5:1)', () => {
  it.each(['--fg-primary', '--fg-secondary', '--fg-tertiary'])('%s on --elev-1', t => {
    expect(ratio(token(t), token('--elev-1'))).toBeGreaterThanOrEqual(4.5);
  });
  it('disabled button label (--fg-tertiary on --elev-2)', () => {
    expect(ratio(token('--fg-tertiary'), token('--elev-2'))).toBeGreaterThanOrEqual(4.5);
  });
  it('control: the old tertiary would fail, so this test can fail', () => {
    expect(ratio('#6E727A', '#111114')).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 2: Run** `cd web && npx vitest run src/__tests__/contrast.test.ts` — Expected: FAIL (`--elev-1 not found`).

- [ ] **Step 3: Add the tokens** to `:root` (values copied from the spec CSS l.18-30) and change `--fg-tertiary: #878B94;` with a comment that it is web-only and why (3.9:1 → 5.3:1). Page: `html { background: #050507; }` and the page floor `background: var(--page-wash), var(--bg-base)` on the existing body/shell floor rule.

- [ ] **Step 4: Replace the two card rules** (keep the existing comment, update its last paragraph to say the edge is now `--border-default` + shadow, per the redesign):

```css
.noc-card, .noc-card-quiet {
  background: var(--grad-card), var(--elev-1);
  border: 1px solid var(--border-default);
  box-shadow: var(--edge-highlight), var(--shadow-card);
}
.noc-card       { border-radius: var(--radius-xl); /* gap/padding unchanged */ }
.noc-card-accent { border-color: color-mix(in oklab, var(--accent) 22%, var(--border-default)); }
```

- [ ] **Step 5: Buttons** — spec l.102-113: `.btn-primary` gets `box-shadow: inset 0 1px 0 rgb(255 255 255 / .25), var(--glow-accent)`, hover `background: var(--accent-hover)` (delete the `filter: brightness` hover); `.btn[disabled]` → `background: var(--elev-2); color: var(--fg-tertiary); box-shadow: inset 0 0 0 1px var(--border-strong)`; add `.btn.is-busy { background: var(--accent-soft); color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent-border); cursor: progress; }`. Any new `transition` goes into the reduced-motion block too.

- [ ] **Step 6: Run** `npx vitest run src/__tests__/contrast.test.ts src/__tests__/motion.test.ts` — Expected: PASS.

- [ ] **Step 7: Screenshot check** — headless shell at 1280×900 against `http://127.0.0.1:5173/`; cards must visibly separate from the page.

- [ ] **Step 8: `npm run verify`, commit** `feat(web): card depth and AA text from the desktop redesign`.

---

### Task 2: Icons + AddressGroups + CopyButton (the new units)

**Files:**
- Modify: `web/src/ui/Icon.tsx`
- Create: `web/src/ui/AddressGroups.tsx`, `web/src/ui/CopyButton.tsx`
- Test: `web/src/ui/__tests__/AddressGroups.test.tsx`, `web/src/ui/__tests__/CopyButton.test.tsx`

**Interfaces:**
- Produces `IconName` += `'alert' | 'check' | 'x' | 'copy' | 'ext' | 'history' | 'link' | 'lock' | 'logout' | 'swap' | 'chev' | 'pause'`.
- Produces `AddressGroups({address}: {address: string})` — `<span class="addr-groups noc-mono">` of `<span>` children, 4 chars each, textContent === address.
- Produces `CopyButton({value, label}: {value: string; label: string})` — `<button class="icon-btn" aria-label={label}>`; after success its accessible name becomes `Copied`, for 2 s.

- [ ] **Step 1: Failing AddressGroups test**

```tsx
import {render} from '@testing-library/react';
import {AddressGroups} from '../AddressGroups';

const VAULT = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
const POISON = '6ZiahdPaj8K4gFNRdisMtZjzvDjje1bXdzWwkoSoo6Vd';

describe('AddressGroups', () => {
  it('copies as the exact address: no spaces in the text', () => {
    const {container} = render(<AddressGroups address={VAULT} />);
    expect(container.textContent).toBe(VAULT);
  });
  it('groups by four, every group the same element and class', () => {
    const {container} = render(<AddressGroups address={VAULT} />);
    const groups = [...container.querySelectorAll('.addr-groups > span')];
    expect(groups.map(g => g.textContent)).toEqual(VAULT.match(/.{1,4}/g));
    expect(new Set(groups.map(g => g.className)).size).toBe(1);
  });
  it('emphasises nothing — the ends are where a poisoning address matches', () => {
    const {container} = render(<AddressGroups address={VAULT} />);
    expect(container.querySelector('b, strong, em, mark')).toBeNull();
  });
  it('control: the vault and the poisoning address differ inside, not at the ends', () => {
    expect(VAULT.slice(0, 4)).toBe(POISON.slice(0, 4));
    expect(VAULT.slice(-4)).toBe(POISON.slice(-4));
    expect(VAULT).not.toBe(POISON);
  });
});
```

- [ ] **Step 2: Run** → FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
/**
 * A full address in groups of four, every group the same weight.
 *
 * The redesign brightened the first and last four characters "so a buyer can check the
 * ends". An address-poisoning account watching this wallet since 2026-09 matches the
 * Squads vault on exactly those eight characters (6Zia…o6Vd both ways), so emphasis there
 * would train a reader to check the part that was forged. Groups make the MIDDLE readable
 * instead. Spacing is CSS margin, not a space character, so a copy is the exact address.
 */
export function AddressGroups({address}: {address: string}) {
  const groups = address.match(/.{1,4}/g) ?? [];
  return (
    <span className="addr-groups noc-mono">
      {groups.map((g, i) => (
        <span key={i}>{g}</span>
      ))}
    </span>
  );
}
```

CSS: `.addr-groups { display: inline-flex; flex-wrap: wrap; column-gap: .6ch; row-gap: 2px; font: 400 12px/20px var(--font-mono); color: var(--fg-primary); user-select: all; }`

- [ ] **Step 4: Failing CopyButton test**

```tsx
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {CopyButton} from '../CopyButton';

describe('CopyButton', () => {
  it('writes the exact value and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {writeText}});
    render(<CopyButton value="abc" label="Copy address" />);
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    expect(writeText).toHaveBeenCalledWith('abc');
    await waitFor(() => expect(screen.getByRole('button', {name: 'Copied'})).toBeTruthy());
  });
  it('does not claim a copy that failed', async () => {
    Object.assign(navigator, {clipboard: {writeText: vi.fn().mockRejectedValue(new Error('denied'))}});
    render(<CopyButton value="abc" label="Copy address" />);
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    await waitFor(() => expect(screen.getByRole('button', {name: 'Copy failed'})).toBeTruthy());
  });
});
```

- [ ] **Step 5: Implement**

```tsx
import {useEffect, useState} from 'react';
import {Icon} from './Icon';

type State = 'idle' | 'copied' | 'failed';

/** Never says "Copied" unless the clipboard accepted it; a silent failure here means
 *  someone pastes whatever was on their clipboard before, which may be an address. */
export function CopyButton({value, label}: {value: string; label: string}) {
  const [state, setState] = useState<State>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);
  const name = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label;
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={name}
      title={name}
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => setState('copied'),
          () => setState('failed'),
        );
      }}
    >
      <Icon name={state === 'copied' ? 'check' : state === 'failed' ? 'x' : 'copy'} size={16} />
    </button>
  );
}
```

CSS `.icon-btn` from spec l.110-113 (+ its transition into the reduced-motion block).

- [ ] **Step 6: Icons** — add the 12 names to `IconName` and `PATHS`, paths copied verbatim from the spec sprite (`<symbol id="i-alert">` … `i-logout`, lines ~317-332 of the spec file). Update the header comment's count ("Six icons" → "Eighteen").

- [ ] **Step 7: Run** `npx vitest run src/ui` → PASS. **Mutation:** wrap the first group in `<b>` → the "emphasises nothing" test must fail; revert.

- [ ] **Step 8: verify + commit** `feat(web): grouped addresses without end-emphasis, and a copy button that never lies`.

---

### Task 3: Presale stage card + allocation + page layout

**Files:**
- Modify: `web/src/presale/PresalePanel.tsx`, `web/src/App.tsx`, `web/src/styles/design-system.css`
- Test: `web/src/presale/__tests__/PresalePanel.test.tsx`, `web/src/__tests__/App.test.tsx`

**Interfaces:** Consumes Icon `'pause' | 'alert'`. Produces the `.stage`, `.alloc`, `.read-error`, `.reading` classes Task 5/6 reuse.

- [ ] **Step 1: Failing tests** (add to PresalePanel.test.tsx)

```tsx
it('draws progress with a native <progress>, no inline width', () => {
  const {container} = render(<PresalePanel stats={STATS} allocation={{status: 'disconnected'}} />);
  const bar = container.querySelector('progress');
  expect(bar?.getAttribute('max')).toBe('100');
  expect(container.querySelector('[style]')).toBeNull();
});
it('keeps the price visible when paused, and says so in its own words', () => {
  const {container} = render(<PresalePanel stats={{...STATS, isPaused: true}} allocation={{status: 'disconnected'}} />);
  expect(container.textContent).toContain('Presale is paused');
  expect(container.textContent).toContain(`$${STATS.pricePerNocUsd}`);
  expect(container.querySelector('.stage.is-paused')).not.toBeNull();
});
```
(`STATS` = the fixture already in that file.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — stage card: `<div className={`noc-card noc-card-accent stage${stats.isPaused ? ' is-paused' : ''}`}>`; top row `.stage-top` with the eyebrow and, when paused, `<span className="badge badge-paused"><Icon name="pause" />Presale is paused</span>`; price `.price` + `.per`; `<progress className="noc-progress" max={100} value={Math.min(100, pct)} aria-label={`${pct}% of this stage sold`} />` replaces the `<div role="img"><i style/></div>`. Allocation: `.alloc` card, amount as `<span className="amt-lg"><span className="noc-balance-lg noc-numeral">549.8534</span><span className="noc-ticker">NOC</span></span>` (split `formatAmount(...).text` on the last space); credits list gets `.credits`. Loading → `<p className="reading">Reading…</p>`; error → `<p className="read-error noc-body-sm"><Icon name="alert" />Your allocation could not be read. This is a connection problem, not a zero balance.</p>`.

- [ ] **Step 4: CSS** — spec l.86-99 (stage, price, per, progress incl. `::-webkit-progress-*`/`::-moz-progress-bar`), l.193-208 (reading, read-error, badge, paused), laptop overrides l.220-232 translated to `@media (min-width: 900px)`: `.shell{max-width:var(--layout-max)}`, `.cols{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}`, `.price{font-size:44px;line-height:50px}`. Delete the old `.noc-progress > i` rule. `.reading::before` animation → reduced-motion block.

- [ ] **Step 5: App layout** — move `<Referral />` from `col-side` to the end of `col-main` (design balance: left = presale, buy, referral; right = wallet, balances, chart, purchases, TGE). Add to App.test: the referral section is inside `.col-main`.

- [ ] **Step 6: Run** tests → PASS; screenshot 1280 + 440.

- [ ] **Step 7: verify + commit** `feat(web): stage card with a native progress bar, paused state, balanced columns`.

---

### Task 4: Buy form

**Files:**
- Modify: `web/src/presale/BuyForm.tsx`, `web/src/styles/design-system.css`
- Test: `web/src/presale/__tests__/BuyForm.test.tsx`

**Interfaces:** Consumes `AddressGroups`, Icon `'alert' | 'check'`. Produces `busyLabel(state: BuyState): string`, exported from BuyForm.tsx.

- [ ] **Step 1: Failing tests**

```tsx
import {busyLabel} from '../BuyForm';

it.each([
  ['checking', 'Checking…'],
  ['simulating', 'Checking…'],
  ['signing', 'Waiting for wallet signature'],
  ['confirming', 'Confirming on chain…'],
] as const)('busy label for %s', (s, label) => expect(busyLabel(s)).toBe(label));

it('shows both addresses in full, grouped, from the constants', async () => {
  // render with an amount typed (use the file's existing connected-wallet setup)
  const summary = screen.getByRole('list', {name: 'What you are signing'});
  expect(summary.textContent).toContain(MAINNET_PROGRAM_ID);
  expect(summary.textContent).toContain(MAINNET_SOL_TREASURY);
  expect(summary.querySelectorAll('.addr-groups').length).toBe(2);
  expect(summary.querySelector('b, strong')).not.toBeNull(); // amounts are bold …
  expect([...summary.querySelectorAll('.addr-groups b, .addr-groups strong')]).toHaveLength(0); // … addresses never
});

it('has no inline style anywhere in the form', () => {
  expect(container.querySelector('[style]')).toBeNull();
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```ts
export function busyLabel(state: BuyState): string {
  if (state === 'signing') return 'Waiting for wallet signature';
  if (state === 'confirming') return 'Confirming on chain…';
  return 'Checking…';
}
```
Button: `className={`btn btn-primary${busy ? ' is-busy' : ''}`}`, `aria-busy={busy || undefined}`, label `busy ? busyLabel(state) : `Buy NOC with ${token}``. Summary `<ul className="signing">` items: `Paying <b>{amount} {token}</b> (about $…)`, `Receiving <b>{noc} NOC</b> at stage …`, then two `<li className="sign-addr"><span className="sign-label">To the presale program</span><AddressGroups address={MAINNET_PROGRAM_ID} /></li>` and `Treasury` likewise. Gate reason → `<p role="status" className="field-msg field-warn"><Icon name="alert" />{gate.reason}</p>` placed directly under `.buy-amount`. Error → `<p role="alert" className="tx-msg tx-error"><Icon name="alert" />{error}</p>`. Success → `<p className="tx-msg tx-success"><Icon name="check" /><span>Sent:<br /><span className="noc-mono">{signature}</span></span></p>`. Remove the `style={{color:'var(--accent)'}}` NOC ticker (class `noc-ticker noc-accent`, add `.noc-accent{color:var(--accent)}`). Unavailable states: "Connect a wallet to buy." → `<p className="noc-card connect-to-buy"><Icon name="lock" />Connect a wallet to buy.</p>`.

- [ ] **Step 4: CSS** — spec l.115-129 (buy, seg, wells, amount focus ring), l.236-253 (signing, sign-addr, field-msg, tx-msg). Drop spec l.243-244 (`.addr-full b`) entirely. Transitions → reduced-motion block.

- [ ] **Step 5: Run** → PASS. **Mutation:** render the treasury with a literal string instead of the constant → the "from the constants" test fails; revert.

- [ ] **Step 6: verify + commit** `feat(web): buy form wells, signing summary with grouped addresses, named steps`.

---

### Task 5: Wallet card, dropdown, modal

**Files:**
- Modify: `web/src/wallet/ConnectPanel.tsx`, `web/src/styles/design-system.css` (adapter overrides ~l.440-640)
- Test: `web/src/wallet/__tests__/ConnectPanel.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
it('connected: full address with a copy button, recovery-phrase line inside the card', () => {
  // existing connected setup
  expect(screen.getByRole('button', {name: 'Copy address'})).toBeTruthy();
  const card = container.querySelector('.wallet-card');
  expect(card?.textContent).toContain('Noctura will never ask for your recovery phrase.');
});
it('no wallet: the Android note is a separate aside and there are still no links', () => {
  // existing unavailable setup
  expect(container.querySelector('.no-wallet-aside')?.textContent).toMatch(/Using Noctura for Android\?/);
  expect(container.querySelectorAll('a').length).toBe(0);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — connected: `<div className="noc-card wallet-card is-connected">` holding `WalletMultiButton`, `<div className="addr-field"><span className="addr noc-mono">{address}</span><CopyButton value={address} label="Copy address" /></div>`, then the phrase note (moved inside the card, `Icon name="shield-check"`). Available / searching / none states keep their copy; the no-wallet state gets `.no-wallet` and the Android paragraph becomes `<p className="no-wallet-aside noc-body-sm">`. The phrase note sits inside the card in all states.

- [ ] **Step 4: CSS** — `.wallet-card.is-connected .wallet-adapter-button-trigger` = secondary surface (spec l.133-135); `.addr-field`, `.addr`, `.phrase-note` (l.137-140); dropdown l.263-268 mapped onto the adapter's real classes (`.wallet-adapter-dropdown-list`, `-item`, last item red via `:last-child`); modal l.271-275 onto `.wallet-adapter-modal-wrapper` / `-list`. Keep the existing `!important` pattern where the vendored sheet needs overriding.

- [ ] **Step 5: Run** → PASS; manual check in the browser with Solflare: dropdown open, modal open.

- [ ] **Step 6: verify + commit** `feat(web): wallet card with copyable address, dropdown and modal from the redesign`.

---

### Task 6: Balances, chart, purchases

**Files:**
- Modify: `web/src/portfolio/PortfolioPanel.tsx`, `PurchaseHistory.tsx`, `Sparkline.tsx`, `web/src/styles/design-system.css`
- Test: `web/src/portfolio/__tests__/PortfolioPanel.test.tsx`, `PurchaseHistory.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// PortfolioPanel
it('holdings lead; market value is the footer row', () => {
  const {container} = render(<PortfolioPanel stagePriceUsd={0.1501} />);
  const card = container.querySelector('.holdings')!.closest('.noc-card')!;
  expect(card.lastElementChild?.classList.contains('holding-total')).toBe(true);
});
// PurchaseHistory
it('renders the purchases as one list card, rows marked by what the chain said', () => {
  verdicts = {[REAL]: 'confirmed', [PHANTOM]: 'missing'};
  const {container} = render(<PurchaseHistory />);
  expect(container.querySelectorAll('ol.buys.noc-card').length).toBe(1);
  expect(container.querySelector(`[data-testid="amount-${PHANTOM}"]`)!.closest('.buy-row')!.classList.contains('is-unconfirmed')).toBe(true);
});
it('a failed row is is-failed, not is-unconfirmed', () => {
  verdicts = {[REAL]: 'failed', [PHANTOM]: 'confirmed'};
  const {container} = render(<PurchaseHistory />);
  const row = container.querySelector(`[data-testid="amount-${REAL}"]`)!.closest('.buy-row')!;
  expect(row.classList.contains('is-failed')).toBe(true);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — Balances: `<ul className="holdings">` of `<li className="holding">` (`amt-md` number + ticker, value right), then `<div className="holding-total"><span className="noc-overline noc-dim">Market value</span><span className="mv">{usd(total)}</span></div>` as the card's last child. Chart card `.noc-card.spark-card`, Sparkline 160×44 on laptop via CSS width (keep viewBox logic). Purchases: `<ol className="buys noc-card">`, each `<li className="buy-row">` with `.buy-row-main` (amount `<b>` + `.buy-tk`, date) and `.buy-row-sub` (payment line, `.sig` link + `Icon name="ext"`). Class: `is-failed` when verdict `failed`, `is-unconfirmed` when `missing`; keep the `<s>` inside and the `data-testid`. Notes become `.buy-note` boxes (coordinator reason + our missing sentence: warning tint + `alert` icon; our failed sentence: `x` icon, danger tint via `.is-failed`). Empty state: `<p className="noc-card empty"><Icon name="history" />No purchases recorded for this wallet yet.</p>`.

- [ ] **Step 4: CSS** — spec l.143-178 and l.257-262. Drop `.buy-row.is-unconfirmed .buy-amt b{text-decoration}` (the `<s>` already strikes) but keep the colour.

- [ ] **Step 5: Run** full `src/portfolio` → PASS (all earlier strike/settled tests included).

- [ ] **Step 6: verify + commit** `feat(web): holdings-first balances and one divided purchases list`.

---

### Task 7: TGE + referral

**Files:**
- Modify: `web/src/tge/Countdown.tsx`, `web/src/referral/ReferralPanel.tsx`, `web/src/styles/design-system.css`
- Test: `web/src/tge/__tests__/Countdown.test.tsx`, `web/src/referral/__tests__/ReferralPanel.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// ReferralPanel
it('link splits base and address so a break never lands inside the address', () => {
  const {container} = render(<ReferralPanel address={ADDR} stats={STATS} />);
  expect(container.querySelector('.link-base')?.textContent).toBe('https://noc-tura.io?ref=');
  expect(container.querySelector('.link-ref')?.textContent).toBe(ADDR);
  expect(screen.getByTestId('referral-link').textContent).toBe(buildReferralLink(ADDR));
  expect(screen.getByRole('button', {name: 'Copy link'})).toBeTruthy();
});
// Countdown
it('not set and passed render inside the TGE card, not bare', () => {
  const {container} = render(<Countdown tgeUnix={null} />);
  expect(container.querySelector('.noc-card')?.textContent).toContain('The TGE date is not set yet.');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — Referral: `.ref-head` (overline + `CopyButton value={link} label="Copy link"`), `<p data-testid="referral-link" className="link-field noc-mono"><span className="link-base">{base}</span><span className="link-ref">{address}</span></p>` where `base = link.slice(0, link.length - address.length)`; stat cards `.stat`. Countdown: all three states inside one `noc-card tge` with the `clock` overline; laptop row layout via CSS.

- [ ] **Step 4: CSS** — spec l.180-190 + laptop `.tge{flex-direction:row;…}`.

- [ ] **Step 5: Run** → PASS.

- [ ] **Step 6: verify + commit** `feat(web): TGE card for every state, referral link that copies and never breaks mid-address`.

---

### Task 8: Final check

- [ ] `cd web && npm run verify` — all gates, record the digest.
- [ ] Headless screenshots at 1280 and 440 (disconnected), compared against the spec's artboards 02.
- [ ] Ask the user to check the connected state in their browser with Solflare (headless has no wallet): wallet dropdown, modal, typing an amount, the signing summary.
- [ ] `grep -rn "style=" web/src --include=*.tsx` → no hits.
- [ ] `grep -rn "6ZiaVPmN" web/ core/` → no hits (the fabricated address never entered the code).
