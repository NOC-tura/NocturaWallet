/**
 * M1d Review Focus 2 (review r1 m10): #19, #20 and #21 read the source ONLY from the intent — never the
 * live selection, never walletStore — so a selection change cannot move an in-flight Send. A source
 * check, with its positive control (#12 does read the live selection, once, at open).
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (f: string): string => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

it.each(['TxSimulateScreen.tsx', 'TxConfirmScreen.tsx', 'TransactionStatusScreen.tsx'])('%s imports neither the selection hooks nor walletStore', f => {
  const src = read(f);
  expect(src).not.toMatch(/useSelectedAccount|selectedAccount|walletStore/);
  expect(src).toMatch(/intent\.from/);
});

it('positive control: #12 reads the selection (and captures it in state)', () => {
  expect(read('SendScreen.tsx')).toMatch(/useState\(liveSelected\)/);
});
