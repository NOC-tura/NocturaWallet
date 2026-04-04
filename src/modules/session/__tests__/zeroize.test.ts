import {zeroize} from '../zeroize';

describe('zeroize', () => {
  it('fills Uint8Array with zeros', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    zeroize(data);
    expect(data.every(b => b === 0)).toBe(true);
  });

  it('handles empty array', () => {
    const data = new Uint8Array(0);
    zeroize(data);
    expect(data.length).toBe(0);
  });

  it('handles large array', () => {
    const data = new Uint8Array(1024);
    data.fill(0xff);
    zeroize(data);
    expect(data.every(b => b === 0)).toBe(true);
  });

  it('does not throw on null/undefined', () => {
    expect(() => zeroize(null as unknown as Uint8Array)).not.toThrow();
    expect(() => zeroize(undefined as unknown as Uint8Array)).not.toThrow();
  });
});
