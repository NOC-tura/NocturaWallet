/**
 * The presale program's instructions (program 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt), generated from its Anchor IDL — never edited by hand
 * (spec B1c §3.3: "the presale program, by Anchor discriminator from the IDL"). The IDL lives in the ICO repository
 * (Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp, lib/idl.json at 75450df, sha256 f31122758227e59673ad165aea75856d2ebb37be03a70d4c7e72c36c5e53c86a); the wallet repository has no
 * copy, so this table is the wallet's own. Each discriminator is sha256("global:" + name)[0..8], which
 * __tests__/presaleIdl.test.ts recomputes; the argument and account lists are the IDL's, in order.
 */
export type PresaleArgType = 'u8' | 'u64' | 'i64' | 'bool' | 'pubkey' | 'tier' | {bytes: number};
export interface PresaleInstruction {
  name: string;
  discriminator: readonly number[];
  args: readonly {name: string; type: PresaleArgType}[];
  accounts: readonly string[];
}

/** StakeTier's variants, by their Borsh index. */
export const STAKE_TIERS: readonly string[] = ['TierA', 'TierB', 'TierC'];

export const PRESALE_INSTRUCTIONS: readonly PresaleInstruction[] = [
  {name: 'admin_add_allocation', discriminator: [27, 155, 127, 15, 165, 194, 167, 158], args: [{name: 'token_amount', type: 'u64'}], accounts: ['config', 'admin', 'recipient', 'user_allocation', 'system_program']},
  {name: 'admin_claim_for_user', discriminator: [157, 200, 115, 242, 113, 65, 176, 240], args: [], accounts: ['config', 'user_allocation', 'ico_ata_for_ico_program', 'ico_ata_for_user', 'ico_mint', 'user', 'admin', 'token_program']},
  {name: 'claim_and_stake', discriminator: [233, 67, 32, 226, 229, 36, 163, 133], args: [{name: 'tier', type: 'tier'}], accounts: ['config', 'user_account', 'user_allocation', 'stake_account', 'ico_ata_for_ico_program', 'ico_mint', 'user', 'token_program', 'system_program']},
  {name: 'claim_cross_chain_allocation', discriminator: [216, 254, 17, 131, 123, 155, 252, 26], args: [], accounts: ['config', 'cross_chain_allocation', 'ico_ata_for_ico_program', 'ico_ata_for_user', 'ico_mint', 'user', 'token_program']},
  {name: 'claim_presale_allocation', discriminator: [100, 176, 47, 202, 135, 93, 149, 105], args: [], accounts: ['config', 'user_allocation', 'ico_ata_for_ico_program', 'ico_ata_for_user', 'ico_mint', 'user', 'token_program']},
  {name: 'claim_team_tokens', discriminator: [137, 104, 44, 247, 225, 216, 99, 11], args: [], accounts: ['config', 'team_vesting', 'ico_ata_for_ico_program', 'team_member_ata', 'ico_mint', 'team_member', 'token_program']},
  {name: 'coordinator_mint_and_vest_stake', discriminator: [87, 177, 240, 52, 64, 111, 34, 9], args: [{name: 'buyer_eth_address', type: {bytes: 20}}, {name: 'chain_id', type: 'u8'}, {name: 'noc_amount', type: 'u64'}, {name: 'usd_cents', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'cross_chain_allocation', 'stake_account', 'beneficiary', 'ico_mint', 'ico_ata_for_ico_program', 'stake_pool_ata', 'stake_pool_authority', 'coordinator', 'token_program', 'associated_token_program', 'system_program']},
  {name: 'create_team_vesting', discriminator: [198, 20, 215, 193, 36, 155, 16, 105], args: [{name: 'allocation_amount', type: 'u64'}], accounts: ['config', 'team_vesting', 'team_member', 'admin', 'system_program']},
  {name: 'finalize_unstake', discriminator: [11, 165, 26, 80, 219, 175, 236, 227], args: [], accounts: ['config', 'user_account', 'stake_account', 'ico_ata_for_user', 'ico_ata_for_ico_program', 'ico_mint', 'user', 'token_program', 'system_program']},
  {name: 'get_team_vesting_status', discriminator: [184, 10, 21, 96, 58, 39, 64, 75], args: [], accounts: ['config', 'team_vesting']},
  {name: 'harvest_rewards', discriminator: [213, 164, 27, 71, 21, 69, 10, 104], args: [], accounts: ['config', 'user_account', 'stake_account', 'ico_ata_for_user', 'ico_ata_for_ico_program', 'ico_mint', 'user', 'token_program', 'system_program']},
  {name: 'initialize', discriminator: [175, 175, 109, 31, 13, 152, 155, 237], args: [{name: 'ico_amount', type: 'u64'}, {name: 'tge_timestamp', type: 'i64'}], accounts: ['config', 'ico_ata_for_ico_program', 'ico_mint', 'ico_ata_for_admin', 'admin', 'system_program', 'token_program', 'rent']},
  {name: 'initiate_unstake', discriminator: [229, 79, 19, 159, 232, 206, 96, 210], args: [], accounts: ['config', 'user_account', 'stake_account', 'user', 'system_program']},
  {name: 'link_solana_wallet', discriminator: [64, 35, 6, 191, 6, 58, 17, 135], args: [{name: 'eth_address', type: {bytes: 20}}, {name: 'chain_id', type: 'u8'}], accounts: ['cross_chain_allocation', 'user']},
  {name: 'presale_purchase_and_vest_stake', discriminator: [208, 213, 110, 52, 157, 222, 196, 234], args: [{name: 'sol_amount', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'user_account', 'user_allocation', 'stake_account', 'pyth_sol_usd_price', 'user', 'sol_treasury', 'system_program']},
  {name: 'presale_purchase_usdc_and_vest_stake', discriminator: [151, 51, 169, 158, 39, 240, 7, 214], args: [{name: 'usdc_amount', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'user_account', 'user_allocation', 'stake_account', 'stablecoin_ata_for_user', 'stablecoin_ata_for_admin', 'user', 'token_program', 'system_program']},
  {name: 'presale_purchase_usdt_and_vest_stake', discriminator: [22, 252, 18, 234, 123, 234, 114, 91], args: [{name: 'usdt_amount', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'user_account', 'user_allocation', 'stake_account', 'stablecoin_ata_for_user', 'stablecoin_ata_for_admin', 'user', 'token_program', 'system_program']},
  {name: 'presale_purchase_with_sol', discriminator: [161, 153, 65, 238, 160, 236, 43, 165], args: [{name: 'sol_amount', type: 'u64'}], accounts: ['config', 'user_account', 'user_allocation', 'referrer_allocation', 'pyth_sol_usd_price', 'user', 'sol_treasury', 'system_program']},
  {name: 'presale_purchase_with_usdc', discriminator: [150, 34, 181, 239, 229, 123, 187, 128], args: [{name: 'usdc_amount', type: 'u64'}], accounts: ['config', 'user_account', 'user_allocation', 'referrer_allocation', 'stablecoin_ata_for_user', 'stablecoin_ata_for_admin', 'stablecoin_mint', 'user', 'token_program', 'system_program']},
  {name: 'presale_purchase_with_usdt', discriminator: [209, 3, 170, 172, 219, 182, 149, 89], args: [{name: 'usdt_amount', type: 'u64'}], accounts: ['config', 'user_account', 'user_allocation', 'referrer_allocation', 'stablecoin_ata_for_user', 'stablecoin_ata_for_admin', 'stablecoin_mint', 'user', 'token_program', 'system_program']},
  {name: 'record_cross_chain_purchase', discriminator: [63, 205, 228, 88, 240, 205, 177, 176], args: [{name: 'buyer_eth_address', type: {bytes: 20}}, {name: 'chain_id', type: 'u8'}, {name: 'noc_amount', type: 'u64'}, {name: 'usd_cents', type: 'u64'}, {name: '_tx_hash', type: {bytes: 32}}, {name: '_stage', type: 'u8'}, {name: 'referrer_eth', type: {bytes: 20}}], accounts: ['config', 'cross_chain_allocation', 'referrer_cross_chain_allocation', 'coordinator', 'system_program']},
  {name: 'register_referrer', discriminator: [122, 229, 215, 169, 100, 145, 198, 120], args: [{name: 'referrer', type: 'pubkey'}], accounts: ['user_account', 'user_allocation', 'user', 'system_program']},
  {name: 'resize_config', discriminator: [198, 164, 124, 15, 186, 11, 212, 150], args: [], accounts: ['config', 'admin', 'system_program']},
  {name: 'set_block_status', discriminator: [85, 228, 227, 164, 211, 200, 107, 143], args: [{name: 'blocked', type: 'bool'}], accounts: ['config', 'user_account', 'target_user', 'admin', 'system_program']},
  {name: 'set_coordinator', discriminator: [3, 248, 224, 239, 81, 218, 95, 214], args: [{name: 'coordinator', type: 'pubkey'}], accounts: ['config', 'admin']},
  {name: 'set_presale_active', discriminator: [145, 96, 184, 126, 86, 145, 75, 58], args: [{name: 'active', type: 'bool'}], accounts: ['config', 'admin']},
  {name: 'set_stablecoin_addresses', discriminator: [202, 82, 158, 52, 194, 193, 175, 17], args: [{name: 'usdt_address', type: 'pubkey'}, {name: 'usdc_address', type: 'pubkey'}], accounts: ['config', 'admin', 'usdt_mint', 'usdc_mint']},
  {name: 'stake_tokens', discriminator: [136, 126, 91, 162, 40, 131, 13, 127], args: [{name: 'amount', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'user_account', 'stake_account', 'ico_ata_for_user', 'ico_ata_for_ico_program', 'ico_mint', 'user', 'token_program', 'system_program']},
  {name: 'toggle_auto_compound', discriminator: [136, 162, 130, 163, 228, 36, 56, 20], args: [], accounts: ['stake_account', 'user']},
  {name: 'update_max_per_user', discriminator: [35, 69, 86, 104, 43, 106, 16, 175], args: [{name: 'max_usd_cents', type: 'u64'}], accounts: ['config', 'admin']},
  {name: 'update_min_purchase', discriminator: [213, 12, 226, 45, 229, 135, 30, 114], args: [{name: 'min_usd_cents', type: 'u64'}], accounts: ['config', 'admin']},
  {name: 'update_presale_start_time', discriminator: [202, 241, 147, 42, 120, 74, 133, 56], args: [{name: 'new_start_time', type: 'i64'}], accounts: ['config', 'admin']},
  {name: 'update_sol_treasury', discriminator: [129, 47, 255, 66, 61, 34, 183, 131], args: [{name: 'new_treasury', type: 'pubkey'}], accounts: ['config', 'admin']},
  {name: 'update_tge_timestamp', discriminator: [162, 180, 93, 107, 6, 27, 240, 231], args: [{name: 'new_tge_timestamp', type: 'i64'}], accounts: ['config', 'admin']},
  {name: 'update_token_price', discriminator: [155, 148, 125, 15, 147, 1, 126, 60], args: [{name: 'new_price', type: 'u64'}], accounts: ['config', 'admin']},
  {name: 'withdraw_tokens', discriminator: [2, 4, 225, 61, 19, 182, 106, 170], args: [{name: 'amount', type: 'u64'}], accounts: ['config', 'ico_ata_for_ico_program', 'ico_ata_for_admin', 'ico_mint', 'admin', 'token_program']},
];
