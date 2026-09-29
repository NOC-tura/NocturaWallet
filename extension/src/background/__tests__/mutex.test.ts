import {createMutex} from '../mutex';

describe('createMutex', () => {
  it('runs overlapping tasks one after another, in call order', async () => {
    const serial = createMutex();
    const log: string[] = [];
    let release!: () => void;
    const first = serial(async () => {
      log.push('a start');
      await new Promise<void>(r => (release = r));
      log.push('a end');
    });
    const second = serial(async () => void log.push('b'));
    await Promise.resolve();
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(['a start', 'a end', 'b']);
  });

  it('a rejected task does not block the next one', async () => {
    const serial = createMutex();
    await expect(serial(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await serial(async () => 7)).toBe(7);
  });
});
