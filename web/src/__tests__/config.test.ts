import {Connection} from '@solana/web3.js';
import {API_BASE, rpcEndpoint} from '../config';

describe('config', () => {
  it('keeps the API same-origin, so no credential can live in the bundle', () => {
    expect(API_BASE).toBe('/api/v1');
  });

  it('gives Connection an absolute endpoint — it rejects a relative one', () => {
    // Positive control for the guard this function exists because of.
    expect(() => new Connection('/rpc')).toThrow(/must start with/i);
    expect(() => new Connection(rpcEndpoint())).not.toThrow();
  });

  it('points at this origin, not at a hard-coded host', () => {
    expect(rpcEndpoint().startsWith(window.location.origin)).toBe(true);
    expect(rpcEndpoint()).toMatch(/\/rpc$/);
  });
});
