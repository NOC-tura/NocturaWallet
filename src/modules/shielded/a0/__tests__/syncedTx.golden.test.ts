/**
 * The §9 `SyncedTx` record, every field, decoded from transactions that LANDED on devnet (spec
 * §14 JS: "every field of §9 decoded from recorded fixtures of a landed deposit and a landed
 * relayed withdraw_with_change (3UfCx5TD…), and refusal of a failed tx or a blob from another
 * program").
 *
 * Sources, none of them the code under test:
 *   - fixtures/devnet-tree-5URd.json — the RPC's answers, recorded once (treeAccount.test.ts pins
 *     its digest), served to the REAL web3.js Connection by __testing__/recordedRpc.ts;
 *   - fixtures/relayer-a0-golden-vectors.json — the program side's golden vectors (their
 *     docs/zk-contract at 5fa2379, sha256 pinned below): the decoded payloads, the grant, the
 *     program order of each landed withdraw / transfer;
 *   - the program side's devnet-a0-deployed-contract.json `landed.deposit` public inputs and the
 *     facts of the ICO state file (2026-11-08/09), copied below as literals.
 */
import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
import type {VersionedTransactionResponse} from '@solana/web3.js';
import {
  appendTopLevelIx,
  blobsOf,
  fromHex,
  leafBlob,
  setBlob,
  txOf,
} from '../__testing__/chainEdits';
import {chainFrom, recordedConnection} from '../__testing__/recordedRpc';
import type {RecordedChain, RecordedFixture} from '../__testing__/recordedRpc';
import {A0} from '../constants';
import {toBe32Hex} from '../fieldEquations';
import {parseA0SyncedTx} from '../syncedTx';
import type {A0SyncedTx} from '../syncedTx';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name));
const TREE = JSON.parse(fx('devnet-tree-5URd.json').toString('utf8')) as RecordedFixture;
const GOLDEN_RAW = fx('relayer-a0-golden-vectors.json');
interface GoldenWithdraw {
  landedSignature: string;
  programOrder?: string[];
  gasGrant?: {from: string; to: string; lamports: number};
  payload: {
    merkleRoot: string;
    nullifier: string;
    withdrawAmount: string;
    destination: string;
    destinationOwner?: string;
    changeCommitment: string;
    fee: string;
  };
}
const GOLDEN = JSON.parse(GOLDEN_RAW.toString('utf8')) as {
  vectors: {withdraw_change: GoldenWithdraw; transfer: {payload: {outCommitment0: string; outCommitment1: string}}};
  relayerLanded: {feePayer: string; vectors: {withdraw_change: GoldenWithdraw}};
  relayerLandedP1P2: {feePayer: string; vectors: {withdraw_change: GoldenWithdraw; withdraw_change_existing: GoldenWithdraw}};
};

const CB = 'ComputeBudget111111111111111111111111111111';
const SYS = '11111111111111111111111111111111';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const GOBAM = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd'; // pool authority, the acceptance payer
const RELAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
const RELAYER_FEE_ATA = '9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9';
const EVIL = 'Stake11111111111111111111111111111111111111'; // any other program id
const LEGACY_DEPOSIT_DISC = '3ecdf2aff4a98834';

/** devnet-a0-deployed-contract.json landed.deposit: [commitment, amount, mintHash, rho] (decimal). */
const LANDED_DEPOSIT = {
  commitment: 1832099858828464171255386012686455982544889024198594493159238616499632609709n,
  amount: 1000000n,
  rho: 2682398932710728289451863586583737043718296808864885766580558010318135811237n,
};

async function fetchTx(chain: RecordedChain, sig: string): Promise<VersionedTransactionResponse> {
  const {connection} = recordedConnection(chain);
  const tx = await connection.getTransaction(sig, {commitment: 'confirmed', maxSupportedTransactionVersion: 0});
  if (!tx) {
    throw new Error(`no ${sig}`);
  }
  return tx;
}

async function synced(prefix: string, edit?: (chain: RecordedChain, sig: string) => void): Promise<A0SyncedTx | null> {
  const chain = chainFrom(TREE);
  const {sig} = txOf(chain, prefix);
  edit?.(chain, sig);
  return parseA0SyncedTx(sig, await fetchTx(chain, sig));
}

async function must(prefix: string): Promise<A0SyncedTx> {
  const r = await synced(prefix);
  if (!r) {
    throw new Error(`${prefix} decoded as failed`);
  }
  return r;
}

const pre = (r: A0SyncedTx, address: string) => r.preBalances.find(p => p.address === address)?.lamports;

describe('the program side\'s golden vectors fixture', () => {
  it('is their relayer-a0-golden-vectors.json at 5fa2379', () => {
    expect(createHash('sha256').update(GOLDEN_RAW).digest('hex')).toBe(
      '5378f57643e9b5c545d7b2110d16233e7e1bb47d9492c176e5a94ceb27d97966',
    );
  });
});

describe('a landed deposit — 3DR6F7oW… (slot 520075903), every field', () => {
  let r: A0SyncedTx;
  beforeAll(async () => {
    r = await must('3DR6F7oW');
  });

  it('signature, slot, blockTime (Task 1 measured: 520075903, 1794154066)', () => {
    expect(r.signature).toBe(
      '3DR6F7oWXS4D5RSsDJAQMbYtQM4EW5Kp2qkJRVSHH72x2GPB4N4G93JkNK9uGGK9CpFeGuy7vtBVeaDHiVQ7b8sm',
    );
    expect(r.slot).toBe(520075903);
    expect(r.blockTime).toBe(1794154066);
  });

  it('signers / feePayer = the depositor GoBAm…, the only signer', () => {
    expect(r.signers).toEqual([GOBAM]);
    expect(r.feePayer).toBe(GOBAM);
  });

  it('top-level programs: ComputeBudget, FeGSS…', () => {
    expect(r.topLevelPrograms).toEqual([CB, A0.programId]);
  });

  it('deposit args + depositor equal the program side\'s landed public inputs', () => {
    expect(r.deposits).toEqual([
      {
        amount: LANDED_DEPOSIT.amount,
        commitment: toBe32Hex(LANDED_DEPOSIT.commitment),
        rho: toBe32Hex(LANDED_DEPOSIT.rho),
        depositor: GOBAM,
        depositorTokenAccount: '9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn',
      },
    ]);
  });

  it('one LeafInserted: the deposit\'s commitment at leaf 0; nothing else admitted', () => {
    expect(r.leafInserted).toHaveLength(1);
    expect(r.leafInserted[0]!.commitment).toBe(toBe32Hex(LANDED_DEPOSIT.commitment));
    expect(r.leafInserted[0]!.leafIndex).toBe(0);
    expect(r.leafInserted[0]!.root).toMatch(/^[0-9a-f]{64}$/);
    expect(r.withdrawNullifiers).toEqual([]);
    expect(r.withdrawals).toEqual([]);
  });

  it('no top-level transfer / create-ATA (the rho marker\'s createAccount is an INNER system call, not counted)', () => {
    expect(r.systemTransfers).toEqual([]);
    expect(r.createAtaIdempotent).toEqual([]);
  });

  it('preBalances: every listed account, the rho marker HuGYn… at 0 (it is created here)', () => {
    expect(r.preBalances).toHaveLength(10);
    expect(pre(r, 'HuGYnybHtrksKL4LEhB6HSRddFw2KEmbGosTtcmku3Ez')).toBe(0n);
    expect(pre(r, A0.merkleTree)).toBe(17678400n); // rent of 3352 bytes
  });

  it('the vault received the amount: +1,000,000', () => {
    expect(r.vaultTokenDelta).toBe(1000000n);
  });
});

describe('a relayed withdraw_with_change — 3UfCx5TD… (the relayer\'s first, create-ATA, no grant), every field', () => {
  const g = GOLDEN.relayerLanded.vectors.withdraw_change;
  let r: A0SyncedTx;
  beforeAll(async () => {
    r = await must('3UfCx5TD');
  });

  it('is the golden vector\'s landed signature', () => {
    expect(r.signature).toBe(g.landedSignature);
    expect(typeof r.slot).toBe('number');
    expect(r.blockTime).toBe(TREE.signatures.find(s => s.signature === r.signature)!.blockTime);
  });

  it('signers / feePayer = the relayer key only', () => {
    expect(r.signers).toEqual([GOLDEN.relayerLanded.feePayer]);
    expect(r.feePayer).toBe(RELAYER);
  });

  it('top-level programs = the golden programOrder', () => {
    expect(r.topLevelPrograms).toEqual(g.programOrder);
  });

  it('withdraw_with_change args, destination, fee payer and fee destination = the golden payload', () => {
    expect(r.withdrawals).toEqual([
      {
        merkleRoot: g.payload.merkleRoot,
        nullifier: g.payload.nullifier,
        amount: BigInt(g.payload.withdrawAmount),
        changeCommitment: g.payload.changeCommitment,
        fee: BigInt(g.payload.fee),
        destination: g.payload.destination,
        feePayer: RELAYER,
        feeDestination: RELAYER_FEE_ATA,
        destinationTokenDelta: BigInt(g.payload.withdrawAmount),
      },
    ]);
  });

  it('LeafInserted carries the change commitment; Withdraw carries the nullifier', () => {
    expect(r.leafInserted.map(l => l.commitment)).toEqual([g.payload.changeCommitment]);
    expect(r.withdrawNullifiers).toEqual([g.payload.nullifier]);
    expect(r.deposits).toEqual([]);
  });

  it('create-ATA-idempotent {payer relayer, ata destination, owner destinationOwner, mint}; no grant', () => {
    expect(r.createAtaIdempotent).toEqual([
      {payer: RELAYER, ata: g.payload.destination, owner: g.payload.destinationOwner, mint: A0.mint},
    ]);
    expect(r.systemTransfers).toEqual([]);
  });

  it('preBalances: the relayer was funded with 2 SOL (ICO state), the destination did not exist', () => {
    expect(pre(r, RELAYER)).toBe(2_000_000_000n);
    expect(pre(r, g.payload.destination)).toBe(0n);
    expect(pre(r, g.payload.destinationOwner!)).toBe(0n);
  });

  it('the vault paid amount + fee', () => {
    expect(r.vaultTokenDelta).toBe(-(BigInt(g.payload.withdrawAmount) + BigInt(g.payload.fee)));
  });
});

describe('a relayed withdraw_with_change to a fresh owner — 47k56… (P1/P2: create-ATA + grant)', () => {
  const g = GOLDEN.relayerLandedP1P2.vectors.withdraw_change;
  let r: A0SyncedTx;
  beforeAll(async () => {
    r = await must('47k56');
  });

  it('the grant is the one top-level SystemProgram.transfer, = the golden gasGrant', () => {
    expect(r.topLevelPrograms).toEqual(g.programOrder);
    expect(r.systemTransfers).toEqual([
      {from: g.gasGrant!.from, to: g.gasGrant!.to, lamports: BigInt(g.gasGrant!.lamports)},
    ]);
    expect(g.gasGrant!.to).toBe(g.payload.destinationOwner);
  });

  it('the owner\'s pre-balance was 0 (ICO: "owner 0 → 3,000,000")', () => {
    expect(pre(r, g.payload.destinationOwner!)).toBe(0n);
  });

  it('withdraw fields and create-ATA = the golden payload', () => {
    expect(r.withdrawals).toHaveLength(1);
    expect(r.withdrawals[0]).toMatchObject({
      merkleRoot: g.payload.merkleRoot,
      nullifier: g.payload.nullifier,
      amount: BigInt(g.payload.withdrawAmount),
      changeCommitment: g.payload.changeCommitment,
      fee: BigInt(g.payload.fee),
      destination: g.payload.destination,
      feePayer: GOLDEN.relayerLandedP1P2.feePayer,
      feeDestination: RELAYER_FEE_ATA,
      destinationTokenDelta: 400000n, // ICO: "destination +400,000"
    });
    expect(r.createAtaIdempotent).toEqual([
      {payer: RELAYER, ata: g.payload.destination, owner: g.payload.destinationOwner, mint: A0.mint},
    ]);
    expect(r.signers).toEqual([RELAYER]);
  });
});

describe('a relayed withdraw_with_change to an existing owner — 3oHkt… (create-ATA no-op, no grant)', () => {
  const g = GOLDEN.relayerLandedP1P2.vectors.withdraw_change_existing;
  it('decodes the golden payload; no grant; the owner held SOL', async () => {
    const r = await must('3oHktG2X');
    expect(r.topLevelPrograms).toEqual(g.programOrder);
    expect(r.systemTransfers).toEqual([]);
    expect(r.createAtaIdempotent).toEqual([
      {payer: RELAYER, ata: g.payload.destination, owner: g.payload.destinationOwner, mint: A0.mint},
    ]);
    expect(r.withdrawals[0]).toMatchObject({
      amount: BigInt(g.payload.withdrawAmount),
      fee: BigInt(g.payload.fee),
      destination: g.payload.destination,
      destinationTokenDelta: 400000n,
    });
    expect(pre(r, g.payload.destinationOwner!)! > 0n).toBe(true);
  });
});

describe('a direct withdraw_with_change with fee — 2mfMYnbt… (fee 50,000, destination 700,000)', () => {
  const g = GOLDEN.vectors.withdraw_change;
  it('decodes the golden payload; the acceptance payer signs and takes the fee', async () => {
    const r = await must('2mfMYnbt');
    expect(r.signers).toEqual([GOBAM]);
    expect(r.withdrawals).toEqual([
      {
        merkleRoot: g.payload.merkleRoot,
        nullifier: g.payload.nullifier,
        amount: 700000n,
        changeCommitment: g.payload.changeCommitment,
        fee: 50000n,
        destination: g.payload.destination,
        feePayer: GOBAM,
        feeDestination: '9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn', // ATA(GoBAm…, mint)
        destinationTokenDelta: 700000n,
      },
    ]);
    expect(r.vaultTokenDelta).toBe(-750000n);
    expect(r.createAtaIdempotent).toEqual([]);
  });
});

describe('a transfer (M2) — 2Av5eFNY…: its two leaves are admitted, nothing else', () => {
  it('two LeafInserted = the golden outCommitments; NoteCiphertext / Transfer not admitted', async () => {
    const r = await must('2Av5eFNY');
    const p = GOLDEN.vectors.transfer.payload;
    expect(r.leafInserted.map(l => l.commitment)).toEqual([p.outCommitment0, p.outCommitment1]);
    expect(r.leafInserted.map(l => l.leafIndex)).toEqual([3, 4]);
    expect(r.withdrawNullifiers).toEqual([]);
    expect(r.deposits).toEqual([]);
    expect(r.withdrawals).toEqual([]);
  });
});

describe('refusals', () => {
  it('a failed tx (meta.err set) is not kept: null', async () => {
    const r = await synced('3DR6F7oW', (chain, sig) => {
      chain.transactions[sig]!.meta.err = {InstructionError: [1, {Custom: 6000}]};
    });
    expect(r).toBeNull();
  });

  it('a LeafInserted one byte short or long from the pool\'s own frame refuses the sync', async () => {
    for (const cut of [79, 81]) {
      await expect(
        synced('3DR6F7oW', (chain, sig) => {
          const tx = chain.transactions[sig]!;
          const [b] = blobsOf(tx);
          const bytes = cut < 80 ? b!.bytes.subarray(0, cut) : Uint8Array.from([...b!.bytes, 0]);
          setBlob(tx, b!.line, bytes);
        }),
      ).rejects.toMatchObject({code: 'E_A0_EVENT_LENGTH'});
    }
  });

  it('a Withdraw one byte short refuses the sync', async () => {
    await expect(
      synced('3UfCx5TD', (chain, sig) => {
        const tx = chain.transactions[sig]!;
        const w = blobsOf(tx)[1]!;
        setBlob(tx, w.line, w.bytes.subarray(0, 39));
      }),
    ).rejects.toMatchObject({code: 'E_A0_EVENT_LENGTH'});
  });

  it('a deposit instruction of another length refuses the sync', async () => {
    await expect(
      synced('3DR6F7oW', (chain, sig) => {
        const ix = chain.transactions[sig]!.transaction.message.instructions[1]!;
        const {base58} = jest.requireActual<typeof import('@scure/base')>('@scure/base');
        ix.data = base58.encode(base58.decode(ix.data).subarray(0, 339));
      }),
    ).rejects.toMatchObject({code: 'E_A0_IX_DECODE'});
  });

  it('a pre-balance list that does not match the keys refuses', async () => {
    await expect(
      synced('3DR6F7oW', (chain, sig) => {
        chain.transactions[sig]!.meta.preBalances.pop();
      }),
    ).rejects.toMatchObject({code: 'E_A0_TX_SHAPE'});
  });

  /** A next-leaf blob a stranger could emit: well-formed, leaf 17, in an extra top-level frame. */
  const extra = (program: string, accounts: string[], disc = '59f3d408d7bfbb98', leafIndex = 17) =>
    (chain: RecordedChain, sig: string) =>
      appendTopLevelIx(chain.transactions[sig]!, {
        program,
        accounts,
        data: fromHex('00'.repeat(8)),
        blobs: [leafBlob(disc, '01'.repeat(32), leafIndex, '02'.repeat(32))],
      });

  it('POSITIVE CONTROL: the same extra frame from FeGSS… listing our tree IS admitted', async () => {
    const r = await synced('5vWuKtLF', extra(A0.programId, [A0.pool, A0.merkleTree]));
    expect(r!.leafInserted.map(l => l.leafIndex)).toEqual([14, 17]);
  });

  it('an event from a foreign program\'s instruction listing our tree is not admitted', async () => {
    const r = await synced('5vWuKtLF', extra(EVIL, [A0.pool, A0.merkleTree]));
    expect(r!.leafInserted.map(l => l.leafIndex)).toEqual([14]);
  });

  it('an event from a FeGSS… instruction that does not list our tree (another pool) is not admitted', async () => {
    const r = await synced('5vWuKtLF', extra(A0.programId, [A0.pool]));
    expect(r!.leafInserted.map(l => l.leafIndex)).toEqual([14]);
  });

  // R1-I1 (Fable review 1): listing 5URd… somewhere in a FeGSS… instruction is not enough — the
  // events are admitted only from an instruction whose accounts at the IDL positions are
  // [pool 8VMe…, merkle_tree 5URd…], the same predicate as the instruction decode. The reviewer's
  // probe: accounts [vault, pool, 5URd…] and a LeafInserted at leaf 0.
  it('R1-I1 probe: a FeGSS… instruction listing our tree at another position ([vault, pool, 5URd…]) is not admitted', async () => {
    const r = await synced('5vWuKtLF', extra(A0.programId, [A0.vault, A0.pool, A0.merkleTree], undefined, 0));
    expect(r!.leafInserted.map(l => l.leafIndex)).toEqual([14]);
  });

  it('R1-I1: [tree, pool] (the IDL positions swapped) is not admitted either', async () => {
    const r = await synced('5vWuKtLF', extra(A0.programId, [A0.merkleTree, A0.pool], undefined, 0));
    expect(r!.leafInserted.map(l => l.leafIndex)).toEqual([14]);
  });

  it('R1-I1 POSITIVE CONTROL: the probe\'s blob from [pool, 5URd…, vault] (the IDL positions) IS admitted', async () => {
    const r = await synced('5vWuKtLF', extra(A0.programId, [A0.pool, A0.merkleTree, A0.vault], undefined, 0));
    expect(r!.leafInserted.map(l => l.leafIndex)).toEqual([14, 0]);
  });

  it('the v1 depositLegacy discriminator (m8) is not admitted, from the pool\'s own frame', async () => {
    const r = await synced('5vWuKtLF', extra(A0.programId, [A0.pool, A0.merkleTree], LEGACY_DEPOSIT_DISC));
    expect(r!.leafInserted.map(l => l.leafIndex)).toEqual([14]);
  });

  it('a deposit-discriminated FeGSS… instruction on ANOTHER pool is not decoded (and cannot refuse the sync)', async () => {
    const r = await synced('5vWuKtLF', (chain, sig) => {
      const tx = chain.transactions[sig]!;
      // accounts [tree, pool]: the IDL positions do not hold our pool / tree; data: the deposit
      // discriminator and nothing else — decoding it would refuse with E_A0_IX_DECODE.
      appendTopLevelIx(tx, {
        program: A0.programId,
        accounts: [A0.merkleTree, A0.pool],
        data: fromHex('f223c68952e1f2b6'),
        blobs: [],
      });
    });
    expect(r!.deposits).toHaveLength(1);
  });

  it('a stranger\'s undecodable system / ATA instruction never throws (it is skipped)', async () => {
    const r = await synced('5vWuKtLF', (chain, sig) => {
      appendTopLevelIx(chain.transactions[sig]!, {program: SYS, accounts: [GOBAM], data: fromHex('02000000'), blobs: []});
      appendTopLevelIx(chain.transactions[sig]!, {program: ATA_PROGRAM, accounts: [GOBAM], data: fromHex('01'), blobs: []});
    });
    expect(r!.systemTransfers).toEqual([]);
    expect(r!.createAtaIdempotent).toEqual([]);
    expect(r!.topLevelPrograms.slice(-2)).toEqual([SYS, ATA_PROGRAM]);
  });

  it('only SystemProgram instruction 2 is a transfer: a top-level createAccount (0) is not counted', async () => {
    const r = await synced('5vWuKtLF', (chain, sig) => {
      // createAccount: u32 0 | lamports u64 | space u64 | owner [32] = 52 bytes, accounts [from, new]
      const data = new Uint8Array(52);
      data[4] = 0x40; // 64 lamports
      appendTopLevelIx(chain.transactions[sig]!, {program: SYS, accounts: [GOBAM, A0.vault], data, blobs: []});
    });
    expect(r!.systemTransfers).toEqual([]);
    expect(r!.topLevelPrograms[r!.topLevelPrograms.length - 1]).toBe(SYS);
  });
});
