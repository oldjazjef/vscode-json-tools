import * as assert from 'assert';
import { activateExtension, openFixture } from './testUtils';

suite('Duplicate Keys', () => {
  suiteSetup(async () => {
    await activateExtension();
  });

  test('duplicate keys fixture loads correctly', async () => {
    const editor = await openFixture('duplicates.json');
    const text = editor.document.getText();

    // Verify the file was loaded correctly with duplicate values
    assert.ok(text.includes('"status": "active"'));
    assert.ok(text.includes('"debug": true'));
  });
});
