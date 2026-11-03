import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'vite';
import {RPC_WEBSOCKETS_STUB, rpcWebsocketsAlias} from '../rpcWebsockets.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WEB3 = join(ROOT, 'node_modules/@solana/web3.js/lib/index.browser.esm.js');
const BUILD_MS = 120_000;

// B1e §4.2 (E16): @solana/web3.js's browser build — the file the extension bundles — bundled under the extension's own
// alias, then run: what the extension uses works, and a Connection (the one maker of a socket client) throws the stub's
// error, which proves the alias took.
let dir;
let probe;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'noctura-rpc-ws-'));
  const entry = join(dir, 'probe.mjs');
  writeFileSync(
    entry,
    [
      `import {Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from ${JSON.stringify(WEB3)};`,
      `import {CommonClient, WebSocket} from 'rpc-websockets';`,
      // The whole namespace too, so the stub's export list is checked exactly (final review, ledger T6 M3).
      `import * as stub from 'rpc-websockets';`,
      'export {Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, CommonClient, WebSocket, stub};',
    ].join('\n'),
  );
  await build({
    configFile: false,
    logLevel: 'silent',
    root: dir,
    resolve: {alias: rpcWebsocketsAlias(ROOT)},
    build: {outDir: join(dir, 'out'), lib: {entry, formats: ['es'], fileName: () => 'probe.mjs'}, minify: false, target: 'es2022'},
  });
  probe = await import(pathToFileURL(join(dir, 'out', 'probe.mjs')).href);
}, BUILD_MS);
afterAll(() => rmSync(dir, {recursive: true, force: true}));

describe('rpc-websockets resolves to the stub (B1e §4.2, E16)', () => {
  it('names the stub inside the package', () => {
    expect(rpcWebsocketsAlias(ROOT)).toEqual([{find: /^rpc-websockets$/, replacement: join(ROOT, RPC_WEBSOCKETS_STUB)}]);
  });

  it('web3.js evaluates under it, and what the extension uses works: PublicKey, SystemProgram, TransactionMessage, VersionedTransaction', () => {
    const {Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} = probe;
    const from = Keypair.fromSeed(new Uint8Array(32).fill(7));
    const to = new PublicKey('11111111111111111111111111111112');
    const message = new TransactionMessage({
      payerKey: from.publicKey,
      recentBlockhash: '11111111111111111111111111111111',
      instructions: [SystemProgram.transfer({fromPubkey: from.publicKey, toPubkey: to, lamports: 1n})],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([from]);
    const back = VersionedTransaction.deserialize(tx.serialize());
    expect(back.message.staticAccountKeys.map(k => k.toBase58())).toEqual([from.publicKey.toBase58(), to.toBase58(), SystemProgram.programId.toBase58()]);
    expect(back.signatures[0]).toEqual(tx.signatures[0]);
  });

  it('a Connection — the one thing that makes a socket client — throws the stub’s error', () => {
    expect(() => new probe.Connection('http://127.0.0.1:9')).toThrow('rpc-websockets is not part of Noctura: the extension opens no WebSocket');
  });

  it('exactly two exports: CommonClient a class that throws when constructed, WebSocket a function that throws when called', () => {
    // Exactly these two names and no other: a third export would fail here (M-A).
    expect(Object.keys(probe.stub).sort()).toEqual(['CommonClient', 'WebSocket']);
    expect(probe.stub.CommonClient).toBe(probe.CommonClient);
    expect(probe.stub.WebSocket).toBe(probe.WebSocket);
    const {CommonClient, WebSocket} = probe;
    expect(Function.prototype.toString.call(CommonClient)).toMatch(/^class\b/);
    class Sub extends CommonClient {}
    expect(() => new Sub()).toThrow('rpc-websockets is not part of Noctura');
    expect(() => new CommonClient()).toThrow('rpc-websockets is not part of Noctura');
    expect(typeof WebSocket).toBe('function');
    expect(() => WebSocket('ws://127.0.0.1:9')).toThrow('rpc-websockets is not part of Noctura');
  });
});
