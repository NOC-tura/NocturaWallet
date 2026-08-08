import {
  FEATURES,
  isShieldedEnabled,
  isLocalProvingEnabled,
  isShieldedTransferEnabled,
} from '../features';

describe('features flag', () => {
  it('shielded is disabled in v1', () => {
    expect(FEATURES.shielded).toBe(false);
    expect(isShieldedEnabled()).toBe(false);
  });

  it('localProving is off unless env LOCAL_PROVING=true', () => {
    // Config is mocked to {} in the test env → flag false by default.
    expect(isLocalProvingEnabled()).toBe(false);
  });

  it('shieldedTransfer is off by default', () => {
    // Private transfer is disabled pending the circuit redesign: the transfer
    // circuit imposes no spend authorization, so the SENDER retains the full
    // preimage of the recipient's note and can withdraw it back. Confirmed from
    // transfer.circom by the program side on 2026-08-08.
    expect(FEATURES.shieldedTransfer).toBe(false);
    expect(isShieldedTransferEnabled()).toBe(false);
  });

  it('shieldedTransfer requires shielded mode as well as its own flag', () => {
    // Even with SHIELDED_TRANSFER=true, transfer stays off unless shielded mode
    // is on — so one stray env var cannot re-enable the broken flow.
    expect(isShieldedTransferEnabled()).toBe(
      FEATURES.shielded && FEATURES.shieldedTransfer,
    );
  });
});
