import {addNote, clearMint} from '../noteStore';
import {getShieldedBalances} from '../shieldedBalances';
import {SHIELDED_POOL_MINTS} from '../../../constants/programs';
import {initSecureMmkv} from '../../../store/mmkv/instances';

beforeAll(() => initSecureMmkv('00112233445566778899aabbccddeeff'));

describe('getShieldedBalances', () => {
  it('sums unspent notes per pool mint', () => {
    const mint = SHIELDED_POOL_MINTS[0]!;
    clearMint(mint);
    addNote({commitment: 'a', nullifier: '', mint, amount: 300000000n, index: 0,
      spent: false, createdAt: 1, noteSecret: 's'});
    addNote({commitment: 'b', nullifier: '', mint, amount: 200000000n, index: 1,
      spent: false, createdAt: 2, noteSecret: 's'});
    const rows = getShieldedBalances();
    const row = rows.find(r => r.mint === mint)!;
    expect(row.amount).toBe(500000000n);
    expect(row.symbol.length).toBeGreaterThan(0);
    expect(row.decimals).toBe(9);
  });
});
