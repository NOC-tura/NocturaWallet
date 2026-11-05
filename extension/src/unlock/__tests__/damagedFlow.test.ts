import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {DELETABLE, F, edited} from '../../shared/__tests__/vaultControls';
import * as damagedFlow from '../damagedFlow';
import {removeDamaged} from '../damagedFlow';
import type {Send} from '../types';

// B1e §2.4: the vault page's half of vault.forgetDamaged, against the REAL background.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const UNLOCK = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};
const digestOf = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');
const UNREADABLE = edited(e => (e.seed = 'damaged'));

async function background(raw: unknown) {
  const ext = fakeExt();
  if (raw !== undefined) await ext.local.set(VAULT_KEY, raw);
  const sent: {type: string; [k: string]: unknown}[] = [];
  const send: Send = async m => {
    sent.push(JSON.parse(JSON.stringify(m)) as {type: string});
    return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK, fakeDeps())) as {ok: boolean; error?: string};
  };
  return {ext, send, sent, readEnvelope: () => ext.local.get(VAULT_KEY)};
}

describe('removeDamaged (B1e §2.4)', () => {
  it('an unreadable value with the digest shown: ONE vault.forgetDamaged carrying only that digest; removed', async () => {
    for (const [name, raw] of DELETABLE) {
      const b = await background(raw);
      expect([name, await removeDamaged(b, digestOf(raw))]).toEqual([name, 'removed']);
      expect([name, b.sent]).toEqual([name, [{type: 'vault.forgetDamaged', expectedDigest: digestOf(raw)}]]);
      expect(await b.readEnvelope()).toBeUndefined();
    }
  });

  it('a readable value (F0–F18) is never sent: not-unreadable, nothing sent, nothing removed', async () => {
    for (const [name, env] of F) {
      const b = await background(env);
      expect([name, await removeDamaged(b, digestOf(env))]).toEqual([name, 'not-unreadable']);
      expect([name, b.sent]).toEqual([name, []]);
      expect(await b.readEnvelope()).toEqual(env);
    }
  });

  it('the value stored now is not the one shown (another digest): changed, nothing sent', async () => {
    const b = await background(UNREADABLE);
    expect(await removeDamaged(b, digestOf(edited(e => (e.password = 'damaged'))))).toBe('changed');
    expect(b.sent).toEqual([]);
    expect(await b.readEnvelope()).toEqual(UNREADABLE);
  });

  it('no wallet, and a read that throws: nothing sent', async () => {
    const b = await background(undefined);
    expect(await removeDamaged(b, digestOf(UNREADABLE))).toBe('no-wallet');
    const failing = {
      send: b.send,
      readEnvelope: async () => {
        throw new Error('Extension context invalidated.');
      },
    };
    expect(await removeDamaged(failing, digestOf(UNREADABLE))).toBe('failed');
    expect(b.sent).toEqual([]);
  });

  it("the background's refusals by name; busy is changed; anything else, or a send that throws, is failed", async () => {
    const b = await background(UNREADABLE);
    for (const [error, out] of [
      ['send-open', 'send-open'],
      ['unlocked', 'unlocked'],
      ['busy', 'changed'],
      ['not-unreadable', 'not-unreadable'],
      ['no-wallet', 'no-wallet'],
      ['malformed', 'failed'],
      ['forbidden', 'failed'],
      ['something-else', 'failed'],
    ] as const) {
      expect([error, await removeDamaged({send: async () => ({ok: false, error}), readEnvelope: b.readEnvelope}, digestOf(UNREADABLE))]).toEqual([error, out]);
    }
    const throwing: Send = async () => {
      throw new Error('gone');
    };
    expect(await removeDamaged({send: throwing, readEnvelope: b.readEnvelope}, digestOf(UNREADABLE))).toBe('failed');
  });
});

// B1e §2.4: vault.forgetDamaged is sent from one screen. damagedFlow.ts builds the message and exports only removeDamaged,
// and only screens/removeDamaged.ts imports it. A TRIPWIRE over source text (a file can spell a name some other way), as
// deleteWallet.test.ts's; the walker's own positive control is that it finds the files it must.
describe('vault.forgetDamaged stays behind its one screen', () => {
  const src = join(__dirname, '..', '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        if (e !== '__tests__') walk(p);
      } else if (/\.tsx?$/.test(e)) files.push(relative(src, p).split(sep).join('/'));
    }
  };
  walk(src);
  const naming = (re: RegExp) => files.filter(f => re.test(readFileSync(join(src, f), 'utf8'))).sort();

  it('damagedFlow exports exactly removeDamaged', () => {
    expect(Object.keys(damagedFlow)).toEqual(['removeDamaged']);
  });

  it('the message type is named by the background (its handler and its lists) and by damagedFlow.ts only', () => {
    expect(files).toEqual(expect.arrayContaining(['background/messages.ts', 'unlock/damagedFlow.ts', 'unlock/screens/removeDamaged.ts', 'app/screens/DeleteWallet.tsx']));
    expect(naming(/vault\.forgetDamaged/)).toEqual(['background/accountsStore.ts', 'background/messages.ts', 'unlock/damagedFlow.ts']);
  });

  it('only screens/removeDamaged.ts imports damagedFlow, and only it calls removeDamaged', () => {
    expect(naming(/damagedFlow/)).toEqual(['unlock/screens/removeDamaged.ts']);
    expect(naming(/\bremoveDamaged\s*\(/)).toEqual(['unlock/damagedFlow.ts', 'unlock/screens/removeDamaged.ts']);
  });
});
