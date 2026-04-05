/**
 * Merkle Module Tests
 * 8 tests covering incremental sync, persistence, root verification, and error cases.
 * All network calls are mocked via pinnedFetch.
 */

jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {MerkleModule, computeMerkleRoot} from '../merkleModule';
import {MerkleRootMismatchError, MerkleSyncError, MERKLE_TREE_DEPTH} from '../types';

const mockPinnedFetch = pinnedFetch as jest.Mock;

/** Build a fake pinnedFetch response */
function mockResponse(data: unknown) {
  return Promise.resolve({
    status: 200,
    headers: {},
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

const TREE_ADDRESS = 'MockTreeAddress111111111111111111111111';
const ANCHOR_ROOT = '0'.repeat(64);

function makeLeaves(count: number, offset = 0) {
  return Array.from({length: count}, (_, i) => ({
    index: offset + i,
    commitment: (offset + i).toString(16).padStart(64, '0'),
  }));
}

describe('MerkleModule', () => {
  let module: MerkleModule;

  beforeEach(() => {
    module = new MerkleModule();
    module.reset();
    jest.clearAllMocks();
  });

  it('initial state has nextLeafIndex=0 and no root', () => {
    const state = module.getState();
    expect(state.nextLeafIndex).toBe(0);
    expect(state.currentRoot).toBe('');
    expect(state.treeAddress).toBeNull();
  });

  it('sync returns newLeaves=0 when server returns empty leaves', async () => {
    mockPinnedFetch.mockReturnValueOnce(
      mockResponse({
        leaves: [],
        treeAddress: TREE_ADDRESS,
        anchorRoot: ANCHOR_ROOT,
        totalLeaves: 0,
      }),
    );

    const result = await module.sync();
    expect(result.newLeaves).toBe(0);
    expect(result.rootVerified).toBe(true);
  });

  it('sync persists new leaves and advances nextLeafIndex', async () => {
    const leaves = makeLeaves(3);
    const root = computeMerkleRoot(leaves.map(l => l.commitment));

    mockPinnedFetch.mockReturnValueOnce(
      mockResponse({
        leaves,
        treeAddress: TREE_ADDRESS,
        anchorRoot: root,
        totalLeaves: 3,
      }),
    );

    const result = await module.sync();
    expect(result.newLeaves).toBe(3);
    expect(result.root).toBe(root);
    expect(result.rootVerified).toBe(true);

    const state = module.getState();
    expect(state.nextLeafIndex).toBe(3);
    expect(state.currentRoot).toBe(root);
    expect(state.treeAddress).toBe(TREE_ADDRESS);
  });

  it('incremental sync only fetches leaves after nextLeafIndex', async () => {
    // First sync: 3 leaves
    const leaves1 = makeLeaves(3);
    const root1 = computeMerkleRoot(leaves1.map(l => l.commitment));
    mockPinnedFetch.mockReturnValueOnce(
      mockResponse({
        leaves: leaves1,
        treeAddress: TREE_ADDRESS,
        anchorRoot: root1,
        totalLeaves: 3,
      }),
    );
    await module.sync();

    // Second sync: 2 more leaves (server returns offset=3)
    const leaves2 = makeLeaves(2, 3);
    const allLeaves = [...leaves1, ...leaves2];
    const root2 = computeMerkleRoot(allLeaves.map(l => l.commitment));
    mockPinnedFetch.mockReturnValueOnce(
      mockResponse({
        leaves: leaves2,
        treeAddress: TREE_ADDRESS,
        anchorRoot: root2,
        totalLeaves: 5,
      }),
    );
    const result = await module.sync();

    expect(result.newLeaves).toBe(2);
    expect(result.root).toBe(root2);

    // Verify the URL used the correct `from` parameter
    const callUrl: string = (mockPinnedFetch.mock.calls[1] as [string])[0];
    expect(callUrl).toContain('from=3');
  });

  it('throws MerkleRootMismatchError when local root differs from anchor root', async () => {
    const leaves = makeLeaves(2);
    // Provide a deliberately wrong anchor root
    const wrongRoot = 'deadbeef'.padStart(64, '0');

    mockPinnedFetch.mockReturnValueOnce(
      mockResponse({
        leaves,
        treeAddress: TREE_ADDRESS,
        anchorRoot: wrongRoot,
        totalLeaves: 2,
      }),
    );

    await expect(module.sync()).rejects.toThrow(MerkleRootMismatchError);
  });

  it('throws MerkleSyncError when pinnedFetch throws a network error', async () => {
    mockPinnedFetch.mockRejectedValueOnce(new Error('Network timeout'));
    await expect(module.sync()).rejects.toThrow(MerkleSyncError);
  });

  it('computeMerkleRoot returns deterministic result for fixed leaves', () => {
    const leaves = ['aabbcc'.padStart(64, '0'), '112233'.padStart(64, '0')];
    const root1 = computeMerkleRoot(leaves);
    const root2 = computeMerkleRoot(leaves);
    expect(root1).toBe(root2);
    expect(root1).toHaveLength(64);
  });

  it('reset clears persisted state', async () => {
    const leaves = makeLeaves(2);
    const root = computeMerkleRoot(leaves.map(l => l.commitment));
    mockPinnedFetch.mockReturnValueOnce(
      mockResponse({
        leaves,
        treeAddress: TREE_ADDRESS,
        anchorRoot: root,
        totalLeaves: 2,
      }),
    );
    await module.sync();
    expect(module.getState().nextLeafIndex).toBe(2);

    module.reset();
    const state = module.getState();
    expect(state.nextLeafIndex).toBe(0);
    expect(state.currentRoot).toBe('');
  });
});
