// @vitest-environment happy-dom
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {sendingReader, setupWallet} from './harness';
import {Confirm} from '../screens/Confirm';
import {createEngine} from '../engine';
import {WalletProvider} from '../WalletContext';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {COUNTERPARTY} from '../../../e2e/historyFixtures';

// #20's `page === null` branch (spec §4.5 step 2): a challenge id reauthPage() will not build a page from never
// opens one — the flow starts again at #12 with the draft. The engine's shape check already refuses such an id,
// so the branch is reached here by making reauthPage refuse a real one.
vi.mock('../platform', async original => ({...(await original<typeof import('../platform')>()), reauthPage: () => null}));

describe('#20 — a challenge reauthPage refuses', () => {
  it('the tap opens nothing, closes nothing, sends nothing: #12 with the draft', async () => {
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}});
    const p = await w.engine.prepareSend(ACCOUNT.publicKey, {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n});
    if (!p.ok || p.data.reauth === null) throw new Error('expected a first-send challenge');
    const sent: string[] = [];
    const engine = createEngine(m => {
      sent.push((m as {type: string}).type);
      return w.transport(m);
    }, async () => undefined);
    const nav = {onBack: vi.fn(), onCancelled: vi.fn(), onTrack: vi.fn(), onReview: vi.fn(), onStartAgain: vi.fn(), onSuperseded: vi.fn()};
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Confirm account={ACCOUNT.publicKey} entry="flow" preparedId={p.data.id} {...nav} />
      </WalletProvider>,
    );
    fireEvent.click(await screen.findByRole('button', {name: /^Send /}));
    await waitFor(() => expect(nav.onStartAgain).toHaveBeenCalledWith({token: 'SOL', recipient: COUNTERPARTY, amount: '0.01'}));
    expect(w.platform.opened).toEqual([]);
    expect(w.platform.navigated).toEqual([]);
    expect(w.platform.closed).toBe(0);
    expect(sent.filter(t => t === 'wallet.send')).toEqual([]);
  });
});
