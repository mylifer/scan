import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { withRetry } from '../lib/retry';

describe('withRetry', () => {
  const noWait = async () => {};

  it('ilk denemede başarılıysa bir kez çağırır', async () => {
    let n = 0;
    assert.equal(await withRetry(async () => ++n, [10, 10], noWait), 1);
    assert.equal(n, 1);
  });

  it('geçici hatadan sonra başarılı olunca sonucu döner ve bekleme sürelerini kullanır', async () => {
    let n = 0;
    const waits: number[] = [];
    const r = await withRetry(
      async () => {
        if (++n < 3) throw new Error('Network request failed');
        return 'ok';
      },
      [2000, 5000],
      async (ms) => {
        waits.push(ms);
      },
    );
    assert.equal(r, 'ok');
    assert.deepEqual(waits, [2000, 5000]);
  });

  it('tüm denemeler başarısızsa son hatayı fırlatır', async () => {
    let n = 0;
    await assert.rejects(
      withRetry(
        async () => {
          throw new Error(`hata ${++n}`);
        },
        [1, 1],
        noWait,
      ),
      /hata 3/,
    );
  });
});
