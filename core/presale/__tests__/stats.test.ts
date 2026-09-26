import {fetchPresaleStats} from '../stats';
import type {JsonGetter} from '../../ports';

function jsonReturning(body: unknown): JsonGetter {
  return {get: async () => body as never};
}

/**
 * `/stats` carries no price. The price comes from a table in the client, so this
 * reader is where a buyer's quoted price is decided — which is why the arithmetic was
 * moved rather than rewritten.
 */
describe('fetchPresaleStats', () => {
  it('derives the price from the stage table', async () => {
    const stats = await fetchPresaleStats(
      jsonReturning({success: true, data: {currentStage: 1, totalNocSold: 0, isPaused: false}}),
    );
    expect(stats.displayStage).toBe(2);
    expect(stats.pricePerNocUsd).toBe(0.1723);
  });

  it('clamps a stage index beyond the table instead of returning undefined', async () => {
    const stats = await fetchPresaleStats(
      jsonReturning({success: true, data: {currentStage: 99, totalNocSold: 0, isPaused: false}}),
    );
    expect(stats.displayStage).toBe(10);
    expect(Number.isFinite(stats.pricePerNocUsd)).toBe(true);
  });

  it('clamps a negative stage index to the first stage', async () => {
    const stats = await fetchPresaleStats(
      jsonReturning({success: true, data: {currentStage: -5, totalNocSold: 0, isPaused: false}}),
    );
    expect(stats.displayStage).toBe(1);
    expect(stats.pricePerNocUsd).toBe(0.1501);
  });

  it('throws on an unsuccessful envelope rather than quoting stage 1 at full price', async () => {
    await expect(fetchPresaleStats(jsonReturning({success: false}))).rejects.toThrow();
    await expect(fetchPresaleStats(jsonReturning({success: true}))).rejects.toThrow();
  });

  it('reports progress into the current stage, not the total sold', async () => {
    // Stage index 1 means one full stage (10,240,000 NOC) is already behind us.
    const stats = await fetchPresaleStats(
      jsonReturning({success: true, data: {currentStage: 1, totalNocSold: 10_240_500, isPaused: false}}),
    );
    expect(stats.soldInStageBase).toBe('500000000000');
    expect(stats.stageCapacityBase).toBe('10240000000000000');
  });

  it('treats a missing isPaused as not paused, and a true one as paused', async () => {
    const open = await fetchPresaleStats(jsonReturning({success: true, data: {currentStage: 0, totalNocSold: 0}}));
    const shut = await fetchPresaleStats(
      jsonReturning({success: true, data: {currentStage: 0, totalNocSold: 0, isPaused: true}}),
    );
    expect(open.isPaused).toBe(false);
    expect(shut.isPaused).toBe(true);
  });
});
