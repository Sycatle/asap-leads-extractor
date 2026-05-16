import { afterEach, describe, expect, it } from 'vitest';
import { _getRefs, acquireBrowser, closeSharedBrowser, releaseBrowser } from './browserPool';

afterEach(async () => {
  await closeSharedBrowser();
});

describe('browserPool', () => {
  it('reuses the same Browser instance across acquires', async () => {
    const a = await acquireBrowser();
    const b = await acquireBrowser();
    expect(a).toBe(b);
    expect(a.isConnected()).toBe(true);
    expect(_getRefs()).toBe(2);
    await releaseBrowser();
    await releaseBrowser();
  });

  it('relaunches after closeSharedBrowser', async () => {
    const a = await acquireBrowser();
    expect(a.isConnected()).toBe(true);
    await releaseBrowser();
    await closeSharedBrowser();
    expect(_getRefs()).toBe(0);

    const b = await acquireBrowser();
    expect(b).not.toBe(a);
    expect(b.isConnected()).toBe(true);
    await releaseBrowser();
  });

  it('handles concurrent acquires without launching twice', async () => {
    const [a, b, c] = await Promise.all([acquireBrowser(), acquireBrowser(), acquireBrowser()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    await releaseBrowser();
    await releaseBrowser();
    await releaseBrowser();
  });
});
