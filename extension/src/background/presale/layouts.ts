/**
 * The presale program's account layouts (program 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt), generated from its Anchor IDL by
 * scripts/gen-presale-idl.mjs — never edited by hand (spec B1d §2.1: one source of truth). The IDL lives in the ICO
 * repository (lib/idl.json at 75450df, sha256 f31122758227e59673ad165aea75856d2ebb37be03a70d4c7e72c36c5e53c86a). Each discriminator is sha256("account:" + name)[0..8], checked
 * against the IDL's by the generator; each field's offset is the 8-byte discriminator plus the Borsh sizes of the fields
 * before it, in the IDL's order; `length` is the whole account's data length.
 */
export type LayoutFieldType = 'pubkey' | 'u8' | 'u32' | 'u64' | 'i64' | 'bool';

export const CONFIG_LAYOUT = {
  name: 'Config',
  discriminator: [155, 12, 170, 224, 30, 250, 204, 130],
  length: 370,
  fields: {
    admin: {offset: 8, type: 'pubkey'},
    sale_token: {offset: 40, type: 'pubkey'},
    usdt_address: {offset: 72, type: 'pubkey'},
    usdc_address: {offset: 104, type: 'pubkey'},
    sol_price_for_token: {offset: 136, type: 'u64'},
    sol_price_for_stablecoin: {offset: 144, type: 'u64'},
    usdt_ratio: {offset: 152, type: 'u64'},
    usdc_ratio: {offset: 160, type: 'u64'},
    current_stage: {offset: 168, type: 'u8'},
    stage_tokens_sold: {offset: 169, type: 'u64'},
    tokens_sold: {offset: 177, type: 'u64'},
    total_usd_raised_cents: {offset: 185, type: 'u64'},
    presale_start_time: {offset: 193, type: 'i64'},
    tge_timestamp: {offset: 201, type: 'i64'},
    presale_active: {offset: 209, type: 'bool'},
    total_penalty_collected: {offset: 210, type: 'u64'},
    min_stake_amount: {offset: 218, type: 'u64'},
    total_staked: {offset: 226, type: 'u64'},
    total_staked_tier_a: {offset: 234, type: 'u64'},
    total_rewards_distributed: {offset: 242, type: 'u64'},
    total_stakers: {offset: 250, type: 'u64'},
    next_stake_id: {offset: 258, type: 'u64'},
    referral_reward_percentage: {offset: 266, type: 'u64'},
    total_referral_bonuses: {offset: 274, type: 'u64'},
    coordinator: {offset: 282, type: 'pubkey'},
    cross_chain_tokens_sold: {offset: 314, type: 'u64'},
    max_per_user_usd: {offset: 322, type: 'u64'},
    min_purchase_usd: {offset: 330, type: 'u64'},
    sol_treasury: {offset: 338, type: 'pubkey'},
  },
} as const;

export const PRESALE_ALLOCATION_LAYOUT = {
  name: 'PresaleAllocation',
  discriminator: [202, 26, 199, 26, 125, 244, 253, 18],
  length: 117,
  fields: {
    user: {offset: 8, type: 'pubkey'},
    total_tokens: {offset: 40, type: 'u64'},
    total_spent_cents: {offset: 48, type: 'u64'},
    purchase_count: {offset: 56, type: 'u32'},
    first_purchase_at: {offset: 60, type: 'i64'},
    last_purchase_at: {offset: 68, type: 'i64'},
    referral_bonus_tokens: {offset: 76, type: 'u64'},
    referrer: {offset: 84, type: 'pubkey'},
    claimed: {offset: 116, type: 'bool'},
  },
} as const;

export const USER_ACCOUNT_LAYOUT = {
  name: 'UserAccount',
  discriminator: [211, 33, 136, 16, 186, 110, 242, 127],
  length: 58,
  fields: {
    is_blocked: {offset: 8, type: 'bool'},
    referrer: {offset: 9, type: 'pubkey'},
    has_staked: {offset: 41, type: 'bool'},
    total_referrals: {offset: 42, type: 'u64'},
    referral_rewards: {offset: 50, type: 'u64'},
  },
} as const;
