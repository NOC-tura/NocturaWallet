import {execFileSync} from 'node:child_process';

it('no web source imports core/keys', () => {
  let out = '';
  try {
    out = execFileSync('grep', ['-rln', 'core/keys', 'src'], {encoding: 'utf8'});
  } catch {
    out = ''; // grep exits 1 when nothing matches — the passing case
  }
  expect(out.split('\n').filter(l => l && !l.endsWith('no-keys-in-web.test.ts'))).toEqual([]);
});
