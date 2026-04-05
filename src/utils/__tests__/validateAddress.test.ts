import {validateRecipientInput} from '../validateAddress';

describe('validateRecipientInput', () => {
  it('validates a valid Solana address', () => {
    const result = validateRecipientInput('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    expect(result.type).toBe('solana');
    expect(result.address).toBe('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
  });

  it('parses a Solana Pay URI with address, amount, and spl-token', () => {
    const uri =
      'solana:9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM?amount=1.5&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const result = validateRecipientInput(uri);
    expect(result.type).toBe('solana_pay');
    expect(result.address).toBe('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    expect(result.amount).toBe('1.5');
    expect(result.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('identifies a shielded address (noc1...)', () => {
    const result = validateRecipientInput('noc1abc123xyz');
    expect(result.type).toBe('shielded');
    expect(result.address).toBe('noc1abc123xyz');
  });

  it('returns invalid for empty input', () => {
    const result = validateRecipientInput('');
    expect(result.type).toBe('invalid');
  });

  it('identifies an ETH address as non_solana', () => {
    const result = validateRecipientInput('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    expect(result.type).toBe('non_solana');
    expect(result.error).toBeTruthy();
  });

  it('returns invalid for a random invalid string', () => {
    const result = validateRecipientInput('not-a-valid-address!!!');
    expect(result.type).toBe('invalid');
  });
});
