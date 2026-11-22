/** M1d review M4: a wipe or an import drops the old wallet's per-account query entries from memory. */
import {clearAllStores, initSecureMmkv} from '../../store/mmkv/instances';
import {queryClient} from '../queryClient';

const A = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

beforeEach(() => {
  queryClient.clear();
  queryClient.setQueryData(['accountSnapshot', A], {solBalance: '1'});
  queryClient.setQueryData(['txHistory', A, undefined], []);
  queryClient.setQueryData(['prices'], {keep: true});
});
afterAll(() => {
  queryClient.clear();
});

it('wipe (clearAllStores) removes accountSnapshot and txHistory entries, not unrelated ones', () => {
  clearAllStores();
  expect(queryClient.getQueryData(['accountSnapshot', A])).toBeUndefined();
  expect(queryClient.getQueryData(['txHistory', A, undefined])).toBeUndefined();
  expect(queryClient.getQueryData(['prices'])).toEqual({keep: true});
});

it('import (initSecureMmkv) removes them too', () => {
  initSecureMmkv('the-next-wallet');
  expect(queryClient.getQueryData(['accountSnapshot', A])).toBeUndefined();
  expect(queryClient.getQueryData(['txHistory', A, undefined])).toBeUndefined();
});
