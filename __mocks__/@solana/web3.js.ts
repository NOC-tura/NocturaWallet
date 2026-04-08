/**
 * Comprehensive Jest mock for @solana/web3.js
 *
 * @solana/web3.js contains native bindings (secp256k1, ed25519) that cannot
 * run inside Jest/Node without a full native build.  This mock provides
 * deterministic in-memory replacements for every symbol used across the
 * Noctura Wallet Solana module.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LAMPORTS_PER_SOL = 1_000_000_000;

export const TOKEN_PROGRAM_ID = {
  toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  toBytes: () => new Uint8Array(32).fill(5),
  equals: (other: unknown) =>
    (other as {toBase58: () => string}).toBase58?.() ===
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  toString: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
};

export const clusterApiUrl = jest.fn((cluster?: string) => {
  const map: Record<string, string> = {
    mainnet: 'https://api.mainnet-beta.solana.com',
    'mainnet-beta': 'https://api.mainnet-beta.solana.com',
    devnet: 'https://api.devnet.solana.com',
    testnet: 'https://api.testnet.solana.com',
  };
  return map[cluster ?? 'mainnet-beta'] ?? 'https://api.mainnet-beta.solana.com';
});

// ---------------------------------------------------------------------------
// PublicKey
// ---------------------------------------------------------------------------

export class PublicKey {
  private readonly _bytes: Uint8Array;
  private readonly _b58: string;

  constructor(value: string | Uint8Array | number[]) {
    if (typeof value === 'string') {
      this._b58 = value;
      this._bytes = new Uint8Array(32).fill(0);
    } else {
      const arr = value instanceof Uint8Array ? value : new Uint8Array(value);
      this._bytes = arr.length === 32 ? arr : new Uint8Array(32).fill(0);
      this._b58 = `mock-pubkey-${Buffer.from(this._bytes).toString('hex').slice(0, 8)}`;
    }
  }

  toBase58(): string {
    return this._b58;
  }

  toString(): string {
    return this._b58;
  }

  toBytes(): Uint8Array {
    return this._bytes;
  }

  toBuffer(): Buffer {
    return Buffer.from(this._bytes);
  }

  equals(other: PublicKey): boolean {
    return this._b58 === other._b58;
  }

  static default = new PublicKey('11111111111111111111111111111111');

  static findProgramAddress = jest.fn(
    async (seeds: Uint8Array[], _programId: PublicKey) => {
      const seedStr = seeds.map(s => Buffer.from(s).toString('hex')).join('');
      return [
        new PublicKey(`mock-pda-${seedStr.slice(0, 16)}`),
        255,
      ] as [PublicKey, number];
    },
  );

  static findProgramAddressSync = jest.fn(
    (seeds: Uint8Array[], _programId: PublicKey): [PublicKey, number] => {
      const seedStr = seeds.map(s => Buffer.from(s).toString('hex')).join('');
      return [new PublicKey(`mock-pda-${seedStr.slice(0, 16)}`), 255];
    },
  );

  static createWithSeed = jest.fn(
    async (_from: PublicKey, seed: string, _programId: PublicKey) =>
      new PublicKey(`mock-seed-${seed.slice(0, 8)}`),
  );
}

// ---------------------------------------------------------------------------
// Keypair
// ---------------------------------------------------------------------------

export class Keypair {
  readonly publicKey: PublicKey;
  readonly secretKey: Uint8Array;

  constructor(keypair?: {publicKey: PublicKey; secretKey: Uint8Array}) {
    this.publicKey = keypair?.publicKey ?? new PublicKey('mock-keypair-pubkey');
    this.secretKey = keypair?.secretKey ?? new Uint8Array(64).fill(1);
  }

  static generate = jest.fn(() => new Keypair());

  static fromSecretKey = jest.fn((secretKey: Uint8Array) => {
    const pub = new PublicKey(secretKey.slice(32, 64));
    return new Keypair({publicKey: pub, secretKey});
  });

  static fromSeed = jest.fn((seed: Uint8Array) => {
    const combined = new Uint8Array(64);
    combined.set(seed.slice(0, 32));
    combined.set(seed.slice(0, 32), 32);
    return Keypair.fromSecretKey(combined);
  });
}

// ---------------------------------------------------------------------------
// TransactionInstruction (minimal shape for mocks)
// ---------------------------------------------------------------------------

interface ITransactionInstruction {
  programId: PublicKey;
  keys: Array<{pubkey: PublicKey; isSigner: boolean; isWritable: boolean}>;
  data: Uint8Array;
}

// ---------------------------------------------------------------------------
// TransactionInstruction
// ---------------------------------------------------------------------------

export class TransactionInstruction implements ITransactionInstruction {
  readonly programId: PublicKey;
  readonly keys: Array<{pubkey: PublicKey; isSigner: boolean; isWritable: boolean}>;
  readonly data: Uint8Array;

  constructor(opts: {
    programId: PublicKey;
    keys: Array<{pubkey: PublicKey; isSigner: boolean; isWritable: boolean}>;
    data: Uint8Array | Buffer;
  }) {
    this.programId = opts.programId;
    this.keys = opts.keys;
    this.data = opts.data instanceof Uint8Array ? opts.data : new Uint8Array(opts.data);
  }
}

// ---------------------------------------------------------------------------
// SystemProgram
// ---------------------------------------------------------------------------

export const SystemProgram = {
  programId: new PublicKey('11111111111111111111111111111111'),

  transfer: jest.fn(
    (params: {
      fromPubkey: PublicKey;
      toPubkey: PublicKey;
      lamports: number | bigint;
    }): ITransactionInstruction => ({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [
        {pubkey: params.fromPubkey, isSigner: true, isWritable: true},
        {pubkey: params.toPubkey, isSigner: false, isWritable: true},
      ],
      data: new Uint8Array(12),
    }),
  ),

  createAccount: jest.fn(
    (params: {
      fromPubkey: PublicKey;
      newAccountPubkey: PublicKey;
      lamports: number | bigint;
      space: number;
      programId: PublicKey;
    }): ITransactionInstruction => ({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [
        {pubkey: params.fromPubkey, isSigner: true, isWritable: true},
        {pubkey: params.newAccountPubkey, isSigner: true, isWritable: true},
      ],
      data: new Uint8Array(52),
    }),
  ),
};

// ---------------------------------------------------------------------------
// ComputeBudgetProgram
// ---------------------------------------------------------------------------

export const ComputeBudgetProgram = {
  programId: new PublicKey('ComputeBudget111111111111111111111111111111'),

  setComputeUnitPrice: jest.fn(
    (_params: {microLamports: number | bigint}): ITransactionInstruction => ({
      programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
      keys: [],
      data: new Uint8Array([3, ...new Array(8).fill(0)]),
    }),
  ),

  setComputeUnitLimit: jest.fn(
    (_params: {units: number}): ITransactionInstruction => ({
      programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
      keys: [],
      data: new Uint8Array([2, ...new Array(4).fill(0)]),
    }),
  ),
};

// ---------------------------------------------------------------------------
// MessageV0 / TransactionMessage / VersionedTransaction
// ---------------------------------------------------------------------------

export class MessageV0 {
  readonly recentBlockhash: string;
  readonly instructions: ITransactionInstruction[];
  readonly staticAccountKeys: PublicKey[];

  constructor(opts: {
    recentBlockhash: string;
    instructions: ITransactionInstruction[];
    staticAccountKeys?: PublicKey[];
  }) {
    this.recentBlockhash = opts.recentBlockhash;
    this.instructions = opts.instructions;
    this.staticAccountKeys = opts.staticAccountKeys ?? [];
  }

  static compile = jest.fn(
    (opts: {
      payerKey: PublicKey;
      recentBlockhash: string;
      instructions: ITransactionInstruction[];
      addressLookupTableAccounts?: AddressLookupTableAccount[];
    }) =>
      new MessageV0({
        recentBlockhash: opts.recentBlockhash,
        instructions: opts.instructions,
        staticAccountKeys: [opts.payerKey],
      }),
  );
}

export class TransactionMessage {
  readonly payerKey: PublicKey;
  readonly recentBlockhash: string;
  readonly instructions: ITransactionInstruction[];

  constructor(opts: {
    payerKey: PublicKey;
    recentBlockhash: string;
    instructions: ITransactionInstruction[];
  }) {
    this.payerKey = opts.payerKey;
    this.recentBlockhash = opts.recentBlockhash;
    this.instructions = opts.instructions;
  }

  compileToV0Message(addressLookupTableAccounts?: AddressLookupTableAccount[]): MessageV0 {
    return MessageV0.compile({
      payerKey: this.payerKey,
      recentBlockhash: this.recentBlockhash,
      instructions: this.instructions,
      addressLookupTableAccounts,
    });
  }

  compileToLegacyMessage() {
    return {
      recentBlockhash: this.recentBlockhash,
      accountKeys: [this.payerKey],
      instructions: this.instructions,
    };
  }
}

export class VersionedTransaction {
  message: MessageV0;
  signatures: Uint8Array[];

  constructor(message: MessageV0, signatures?: Uint8Array[]) {
    this.message = message;
    this.signatures = signatures ?? [new Uint8Array(64).fill(0)];
  }

  sign(signers: Array<{publicKey: PublicKey; secretKey: Uint8Array}>): void {
    this.signatures = signers.map(() => new Uint8Array(64).fill(0xab));
  }

  serialize(): Uint8Array {
    // Deterministic mock serialization — real bytes not required in tests
    const payload = JSON.stringify({
      recentBlockhash: this.message?.recentBlockhash ?? 'mock-blockhash',
      instructionCount: this.message?.instructions?.length ?? 0,
    });
    return new TextEncoder().encode(payload);
  }

  static deserialize = jest.fn((_bytes: Uint8Array) => {
    const msg = new MessageV0({
      recentBlockhash: 'deserialized-mock-blockhash',
      instructions: [],
    });
    return new VersionedTransaction(msg);
  });
}

// ---------------------------------------------------------------------------
// AddressLookupTableAccount
// ---------------------------------------------------------------------------

export class AddressLookupTableAccount {
  readonly key: PublicKey;
  readonly state: {addresses: PublicKey[]};

  constructor(opts: {key: PublicKey; state: {addresses: PublicKey[]}}) {
    this.key = opts.key;
    this.state = opts.state;
  }

  isActive(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export class Connection {
  readonly rpcEndpoint: string;

  constructor(endpoint: string, _commitmentOrConfig?: unknown) {
    this.rpcEndpoint = endpoint;
  }

  getBalance = jest.fn(async (_publicKey: PublicKey): Promise<number> => {
    return 1_000_000_000; // 1 SOL
  });

  getLatestBlockhash = jest.fn(
    async (_commitmentOrConfig?: unknown): Promise<{
      blockhash: string;
      lastValidBlockHeight: number;
    }> => ({
      blockhash: `mock-blockhash-${Date.now()}`,
      lastValidBlockHeight: 999_999,
    }),
  );

  confirmTransaction = jest.fn(
    async (
      _strategyOrSignature: unknown,
      _commitment?: unknown,
    ): Promise<{value: {err: null}}> => ({
      value: {err: null},
    }),
  );

  sendRawTransaction = jest.fn(
    async (
      _rawTransaction: Uint8Array | Buffer | number[],
      _options?: unknown,
    ): Promise<string> => {
      return `mock-signature-${Date.now()}`;
    },
  );

  getSignatureStatus = jest.fn(
    async (
      _signature: string,
      _config?: unknown,
    ): Promise<{
      value: {confirmationStatus: string; err: null} | null;
    }> => ({
      value: {confirmationStatus: 'confirmed', err: null},
    }),
  );

  getSignatureStatuses = jest.fn(
    async (
      _signatures: string[],
      _config?: unknown,
    ): Promise<{
      value: Array<{confirmationStatus: string; err: null} | null>;
    }> => ({
      value: [{confirmationStatus: 'confirmed', err: null}],
    }),
  );

  simulateTransaction = jest.fn(
    async (
      _transaction: VersionedTransaction,
      _config?: unknown,
    ): Promise<{value: {err: null; logs: string[]; unitsConsumed?: number}}> => ({
      value: {err: null, logs: [], unitsConsumed: 200_000},
    }),
  );

  getRecentPrioritizationFees = jest.fn(
    async (_lockedWritableAccounts?: PublicKey[]): Promise<
      Array<{slot: number; prioritizationFee: number}>
    > => [
      {slot: 100, prioritizationFee: 1000},
      {slot: 101, prioritizationFee: 1200},
      {slot: 102, prioritizationFee: 900},
    ],
  );

  getAccountInfo = jest.fn(
    async (
      _publicKey: PublicKey,
      _commitment?: unknown,
    ): Promise<{
      data: Buffer;
      executable: boolean;
      lamports: number;
      owner: PublicKey;
      rentEpoch: number;
    } | null> => null,
  );

  getParsedAccountInfo = jest.fn(
    async (_publicKey: PublicKey, _commitment?: unknown) => ({
      value: null,
    }),
  );

  getTokenAccountsByOwner = jest.fn(
    async (
      _ownerAddress: PublicKey,
      _filter: unknown,
      _commitment?: unknown,
    ) => ({value: []}),
  );

  getParsedTokenAccountsByOwner = jest.fn(
    async (
      _ownerAddress: PublicKey,
      _filter: unknown,
      _commitment?: unknown,
    ) => ({value: []}),
  );

  getTokenAccountBalance = jest.fn(
    async (_tokenAddress: PublicKey, _commitment?: unknown) => ({
      value: {amount: '0', decimals: 9, uiAmount: 0, uiAmountString: '0'},
    }),
  );

  getParsedTransactions = jest.fn(
    async (_signatures: string[], _config?: unknown) => [],
  );

  getTransaction = jest.fn(
    async (_signature: string, _config?: unknown) => null,
  );

  getSlot = jest.fn(async (_commitment?: unknown): Promise<number> => 102);

  getMinimumBalanceForRentExemption = jest.fn(
    async (_dataLength: number, _commitment?: unknown): Promise<number> =>
      890_880,
  );

  getAddressLookupTable = jest.fn(
    async (
      _accountKey: PublicKey,
      _config?: unknown,
    ): Promise<{value: AddressLookupTableAccount | null}> => ({
      value: null,
    }),
  );

  getFeeForMessage = jest.fn(
    async (_message: MessageV0, _commitment?: unknown) => ({
      value: 5000,
    }),
  );

  getSignaturesForAddress = jest.fn(
    async (
      _address: PublicKey,
      _options?: {limit?: number; before?: string; until?: string},
    ): Promise<
      Array<{
        signature: string;
        slot: number;
        blockTime: number | null;
        confirmationStatus: string | null;
        err: unknown;
      }>
    > => [],
  );
}
