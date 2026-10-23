import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from '../layouts';
import {
  ALLOCATION_ACCOUNT_LENGTH,
  ALLOCATION_REFERRAL_BONUS_OFFSET,
  ALLOCATION_TOTAL_TOKENS_OFFSET,
  CONFIG_ACCOUNT_LENGTH,
  CONFIG_SOL_TREASURY_OFFSET,
} from '../../../../../core/presale/allocation';

const PRESALE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const fieldsOf = (layout: {fields: Record<string, {offset: number; type: string}>}) => Object.entries(layout.fields).map(([name, f]) => `${name}@${f.offset}:${f.type}`);

// B1d §2.1 "Layouts from the IDL": the fields B1d reads, as the spec's table lists them (checked against the IDL and the
// program's structs on 2026-10-18 and by review 1) — the generated file must say exactly this.
describe('the generated account layouts', () => {
  it('Config (370 bytes): every field B1d reads at the spec’s offset', () => {
    expect(CONFIG_LAYOUT.length).toBe(370);
    expect(fieldsOf(CONFIG_LAYOUT)).toEqual(
      expect.arrayContaining([
        'admin@8:pubkey',
        'sale_token@40:pubkey',
        'usdt_address@72:pubkey',
        'usdc_address@104:pubkey',
        'current_stage@168:u8',
        'stage_tokens_sold@169:u64',
        'tokens_sold@177:u64',
        'total_usd_raised_cents@185:u64',
        'presale_start_time@193:i64',
        'presale_active@209:bool',
        'max_per_user_usd@322:u64',
        'min_purchase_usd@330:u64',
        'sol_treasury@338:pubkey',
      ]),
    );
    expect(fieldsOf(CONFIG_LAYOUT)).toHaveLength(29);
  });

  it('PresaleAllocation (117) and UserAccount (58 — review 1): every field, in order', () => {
    expect(PRESALE_ALLOCATION_LAYOUT.length).toBe(117);
    expect(fieldsOf(PRESALE_ALLOCATION_LAYOUT)).toEqual([
      'user@8:pubkey',
      'total_tokens@40:u64',
      'total_spent_cents@48:u64',
      'purchase_count@56:u32',
      'first_purchase_at@60:i64',
      'last_purchase_at@68:i64',
      'referral_bonus_tokens@76:u64',
      'referrer@84:pubkey',
      'claimed@116:bool',
    ]);
    expect(USER_ACCOUNT_LAYOUT.length).toBe(58);
    expect(fieldsOf(USER_ACCOUNT_LAYOUT)).toEqual(['is_blocked@8:bool', 'referrer@9:pubkey', 'has_staked@41:bool', 'total_referrals@42:u64', 'referral_rewards@50:u64']);
  });

  it('each discriminator is sha256("account:<Name>")[0..8] — recomputed here — and the spec’s', () => {
    for (const layout of [CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT]) {
      const expected = [...createHash('sha256').update(`account:${layout.name}`).digest().subarray(0, 8)];
      expect([layout.name, [...layout.discriminator]]).toEqual([layout.name, expected]);
    }
    expect([...CONFIG_LAYOUT.discriminator]).toEqual([155, 12, 170, 224, 30, 250, 204, 130]);
    expect([...PRESALE_ALLOCATION_LAYOUT.discriminator]).toEqual([202, 26, 199, 26, 125, 244, 253, 18]);
    expect([...USER_ACCOUNT_LAYOUT.discriminator]).toEqual([211, 33, 136, 16, 186, 110, 242, 127]);
  });

  it('two independent derivations agree: the generated offsets = core/presale/allocation.ts’s hand constants', () => {
    expect(PRESALE_ALLOCATION_LAYOUT.fields.total_tokens.offset).toBe(ALLOCATION_TOTAL_TOKENS_OFFSET);
    expect(PRESALE_ALLOCATION_LAYOUT.fields.referral_bonus_tokens.offset).toBe(ALLOCATION_REFERRAL_BONUS_OFFSET);
    expect(PRESALE_ALLOCATION_LAYOUT.length).toBe(ALLOCATION_ACCOUNT_LENGTH);
    expect(CONFIG_LAYOUT.fields.sol_treasury.offset).toBe(CONFIG_SOL_TREASURY_OFFSET);
    expect(CONFIG_LAYOUT.length).toBe(CONFIG_ACCOUNT_LENGTH);
  });

  it('no file under presale/ other than the generated layouts.ts names the config’s TGE field (§2.1, D5)', () => {
    const field = ['tge', 'timestamp'].join('_');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else files.push(path);
      }
    };
    walk(PRESALE_DIR);
    const named = files.filter(f => readFileSync(f, 'utf8').includes(field)).map(f => relative(PRESALE_DIR, f));
    expect(named).toEqual(['layouts.ts']);
    expect(files.map(f => relative(PRESALE_DIR, f))).toEqual(expect.arrayContaining(['api.ts', 'state.ts', 'layouts.ts']));
  });
});
