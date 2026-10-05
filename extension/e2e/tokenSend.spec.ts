import {test, expect} from '@playwright/test';
import {base58, base64} from '@scure/base';
import {contained, launchPopup} from './popupHarness';
import {ATA_PROGRAM, TOKEN_PROGRAM, parseV0} from './fakeCoordinator';
import {ACCOUNT, NOC_HOLDING, NOC_MINT, RECIPIENT, associatedTokenAddress, realWallet} from './sendHelpers';

// Spec B1b-2a §8.5, plan 3 final review (carry d): spec 13 — a token send through the real extension. The owner's NOC
// sits in two accounts, as on the user's own wallet (non-canonical token accounts): a holding that is NOT the derived
// ATA with the larger balance, and the derived ATA with a smaller one. The recipient is known and the amount under
// both thresholds, so no re-authentication. The one broadcast wire is decoded here, by hand (no core/ import): the
// transfer spends from the largest holding, never the derived ATA, and the recipient's ATA — which does not exist —
// is created before the transfer goes to it.

const SENT = 10_000_000_000n; // 10 NOC, 9 decimals
const SYSTEM_PROGRAM = '11111111111111111111111111111111';

test('13 · a token send: #11 → #12 → #43 picks NOC → #19 → #20 → one tap → #21 success — spent from the largest holding (non-canonical), never the derived ATA; the recipient’s ATA created', async () => {
  const h = await launchPopup('noctura-e2e-token-');
  try {
    await realWallet(h, {known: true});
    const ownAta = associatedTokenAddress(ACCOUNT, NOC_MINT);
    const recipientAta = associatedTokenAddress(RECIPIENT, NOC_MINT);
    expect(ownAta).not.toBe(NOC_HOLDING);
    // 1 000 NOC in the non-canonical holding (the largest), 200 NOC in the derived ATA. The recipient holds no NOC
    // account: the fake's getAccountInfo answers null for its ATA.
    h.fake.tokenAccounts.set(ACCOUNT, [
      {pubkey: ownAta, mint: NOC_MINT, amount: '200000000000', decimals: 9},
      {pubkey: NOC_HOLDING, mint: NOC_MINT, amount: '1000000000000', decimals: 9},
    ]);

    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    await popup.getByRole('button', {name: 'Send', exact: true}).click();
    // #43: NOC is the sum of both accounts, as the balance shows it.
    await popup.getByRole('button', {name: 'Token: SOL'}).click();
    const sheet = popup.getByRole('dialog', {name: 'Choose a token'});
    await expect(sheet.locator('.app-token-row').nth(1).locator('.amt')).toHaveText('1,200.00');
    await sheet.getByText('Noctura').click();
    await expect(popup.getByRole('button', {name: 'Token: NOC'})).toBeVisible();
    await popup.getByLabel('Recipient', {exact: true}).fill(RECIPIENT);
    await popup.getByLabel('Amount').fill('10');
    await expect(popup.locator('.sticky-bar button')).toHaveText('Send 10 NOC');
    await popup.locator('.sticky-bar button').click();

    // #19: the simulation the fake answered — the source holding's 1 000 NOC less 10 — and Continue.
    await expect(popup.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    expect(h.fake.simulations.at(-1)).toEqual([ACCOUNT, NOC_HOLDING]);
    await popup.getByRole('button', {name: 'Continue to confirm'}).click();

    // #20: no re-authentication (a known recipient, under 5 % and the dollar threshold) — one tap sends.
    const send = popup.getByRole('button', {name: /^Send .* NOC$/});
    await expect(send).toBeVisible({timeout: 30_000});
    await expect(popup.getByText("You've never sent to this address")).toHaveCount(0);
    await expect(popup.getByText('Confirmation opens in a new tab.')).toHaveCount(0);
    // The new token account's rent is a fee row (the recipient has no NOC account).
    await expect(popup.locator('.fee-row', {hasText: 'New token account'})).toBeVisible();
    expect(h.fake.broadcasts).toEqual([]);
    await send.click();
    await expect(popup.getByText('Sent successfully')).toBeVisible({timeout: 30_000});

    // Exactly one broadcast, decoded here.
    expect(h.fake.broadcasts).toHaveLength(1);
    const [wire] = h.fake.broadcastWires;
    if (wire === undefined) throw new Error('no broadcast wire');
    const {keys, instructions} = parseV0(base64.decode(wire));
    expect(keys[0]).toBe(ACCOUNT);
    const named = instructions.map(ix => ({program: keys[ix.program], accounts: ix.accounts.map(a => keys[a]), data: ix.data}));

    // The transfer: TransferChecked (12) from the LARGEST holding — the non-canonical one, never the derived ATA —
    // of NOC's mint, to the recipient's ATA, the owner signing, exactly 10 NOC at 9 decimals.
    const transfers = named.filter(ix => ix.program === TOKEN_PROGRAM);
    expect(transfers).toHaveLength(1);
    const transfer = transfers[0];
    if (transfer === undefined) throw new Error('no transfer');
    expect(transfer.data[0]).toBe(12);
    expect(transfer.accounts).toEqual([NOC_HOLDING, NOC_MINT, recipientAta, ACCOUNT]);
    expect(transfer.accounts[0]).not.toBe(ownAta);
    expect(new DataView(transfer.data.buffer, transfer.data.byteOffset, transfer.data.byteLength).getBigUint64(1, true)).toBe(SENT);
    expect(transfer.data[9]).toBe(9);
    expect(transfer.data).toHaveLength(10);

    // The recipient's ATA is created first: the ATA program's Create (no data), the owner paying, for the recipient
    // and NOC's mint — and nothing touches the owner's derived ATA.
    const creates = named.filter(ix => ix.program === ATA_PROGRAM);
    expect(creates).toHaveLength(1);
    const create = creates[0];
    if (create === undefined) throw new Error('no create');
    expect(create.data).toHaveLength(0);
    expect(create.accounts).toEqual([ACCOUNT, recipientAta, RECIPIENT, NOC_MINT, SYSTEM_PROGRAM, TOKEN_PROGRAM]);
    expect(named.indexOf(create)).toBeLessThan(named.indexOf(transfer));
    expect(keys).not.toContain(ownAta);
    // No SOL moves anywhere: the only System instruction a token send may carry is the treasury markup, and no
    // Noctura fee is charged today (every extension send is "status unknown", 0 lamports).
    expect(named.filter(ix => ix.program === SYSTEM_PROGRAM)).toEqual([]);
    // The signature the route answered is the wire's own.
    expect(h.fake.broadcasts[0]).toBe(base58.encode(base64.decode(wire).subarray(1, 65)));
    contained(h);
  } finally {
    await h.close();
  }
});
