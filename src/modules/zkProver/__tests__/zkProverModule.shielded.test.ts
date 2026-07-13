jest.mock('../../../constants/features', () => ({isLocalProvingEnabled: jest.fn(() => false)}));
jest.mock('../localProver', () => ({localProver: {supported: true, prove: jest.fn(async () => ({proofBytes: 'cc'.repeat(256), publicInputs: ['1']}))}}));
jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));

import {proveShielded} from '../zkProverModule';
import {isLocalProvingEnabled} from '../../../constants/features';
import {localProver} from '../localProver';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

beforeEach(() => jest.clearAllMocks());

it('flag ON → proves locally, never calls the hosted prover', async () => {
  (isLocalProvingEnabled as jest.Mock).mockReturnValue(true);
  const res = await proveShielded('transfer', {merkleRoot: '5'} as never);
  expect(localProver.prove).toHaveBeenCalledWith('transfer', {merkleRoot: '5'});
  expect(pinnedFetch).not.toHaveBeenCalled(); // witness never left the device
  expect(res.proofBytes).toBe('cc'.repeat(256));
});
