import * as assert from 'assert';
import { debounce } from '../../src/util/debounce';

describe('debounce', () => {
  it('only invokes once after rapid-fire calls settle', async () => {
    let callCount = 0;
    let lastArg: string | undefined;
    const debounced = debounce((value: string) => {
      callCount++;
      lastArg = value;
    }, 20);

    debounced('a');
    debounced('b');
    debounced('c');

    await sleep(60);

    assert.strictEqual(callCount, 1);
    assert.strictEqual(lastArg, 'c');
  });

  it('invokes again for calls in a later, separate window', async () => {
    let callCount = 0;
    const debounced = debounce(() => callCount++, 20);

    debounced();
    await sleep(40);
    debounced();
    await sleep(40);

    assert.strictEqual(callCount, 2);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
