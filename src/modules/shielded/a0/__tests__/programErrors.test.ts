/**
 * The A0 program's errors (programErrors.ts; the controller's update R1′, 2026-11-17): the table's
 * codes and names are held to the IDL of the deployed binary — `fixtures/shielded-pool-a0-idl.json`,
 * the program side's byte copy at f3f8eff (its digest is pinned in depositIx.golden.test.ts) —
 * and a code is attributed to FeGSS… only when the runtime says FeGSS… raised it.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {A0_PROGRAM_ERRORS, a0ProgramError, a0ProgramErrorOf, a0ProgramErrorText} from '../programErrors';

const IDL = JSON.parse(readFileSync(join(__dirname, 'fixtures/shielded-pool-a0-idl.json'), 'utf8')) as {
  errors: Array<{code: number; name: string; msg: string}>;
};
const FEGSS = 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('the table is the IDL’s, code by code and name by name', () => {
  it('thirteen errors, 6000…6012, in the IDL’s order', () => {
    expect(A0_PROGRAM_ERRORS.map(e => [e.code, e.name])).toEqual(IDL.errors.map(e => [e.code, e.name]));
    expect(A0_PROGRAM_ERRORS.map(e => e.code)).toEqual([...Array(13).keys()].map(i => 6000 + i));
  });
  it('the two the upgrade appended: 6011 CpiNotAllowed, 6012 UnexpectedAccounts — each with the wallet’s message', () => {
    expect(IDL.errors.slice(-2).map(e => [e.code, e.name])).toEqual([
      [6011, 'CpiNotAllowed'],
      [6012, 'UnexpectedAccounts'],
    ]);
    expect(a0ProgramError(6011)?.message).toMatch(/top level.*built it wrong; nothing was spent/);
    expect(a0ProgramError(6012)?.message).toMatch(/more accounts.*built it wrong; nothing was spent/);
  });
  it('every message is the wallet’s own sentence (non-empty, not the IDL’s text)', () => {
    for (const e of A0_PROGRAM_ERRORS) {
      expect(e.message.length).toBeGreaterThan(10);
      expect(e.message).not.toBe(IDL.errors.find(i => i.code === e.code)!.msg);
    }
  });
  it('a number the binary does not raise is not mapped', () => {
    expect(a0ProgramError(6013)).toBeNull();
    expect(a0ProgramError(1)).toBeNull();
  });
});

describe('a0ProgramErrorOf: attribution', () => {
  it('a log line naming FeGSS… (a SendTransactionError’s logs)', () => {
    const e = Object.assign(new Error('Simulation failed.'), {
      transactionLogs: [`Program ${FEGSS} invoke [1]`, `Program ${FEGSS} failed: custom program error: 0x177b`],
    });
    expect(a0ProgramErrorOf(e)?.name).toBe('CpiNotAllowed');
    expect(a0ProgramErrorOf({logs: [`Program ${FEGSS} failed: custom program error: 0x177c`]})?.name).toBe('UnexpectedAccounts');
  });
  it('the same number from another program is not ours', () => {
    expect(a0ProgramErrorOf({logs: [`Program ${TOKEN} failed: custom program error: 0x177b`]})).toBeNull();
  });
  it('the runtime’s message, only at the FeGSS… instruction’s index', () => {
    const e = new Error(
      'Simulation failed. \nMessage: Transaction simulation failed: Error processing Instruction 1: custom program error: 0x177c. \n',
    );
    expect(a0ProgramErrorOf(e, 1)?.code).toBe(6012);
    expect(a0ProgramErrorOf(e, 0)).toBeNull();
    expect(a0ProgramErrorOf(e)).toBeNull();
  });
  it('a TransactionError object {InstructionError: [i, {Custom: n}]}', () => {
    expect(a0ProgramErrorOf({InstructionError: [1, {Custom: 6011}]}, 1)?.name).toBe('CpiNotAllowed');
    expect(a0ProgramErrorOf({InstructionError: [0, {Custom: 6011}]}, 1)).toBeNull();
    expect(a0ProgramErrorOf({InstructionError: [1, 'InvalidAccountData']}, 1)).toBeNull();
  });
  it('anything else → null', () => {
    for (const e of [null, undefined, 'custom program error: 0x177b', 6011, new Error('blockhash not found')]) {
      expect(a0ProgramErrorOf(e, 1)).toBeNull();
    }
  });
  it('the text a screen shows', () => {
    expect(a0ProgramErrorText(a0ProgramError(6011)!)).toBe(`6011 CpiNotAllowed: ${a0ProgramError(6011)!.message}`);
  });
});
