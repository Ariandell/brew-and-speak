import assert from 'node:assert/strict';
import test from 'node:test';
import { toPlainText } from './plainText.js';

test('legacy homework line breaks become readable plain text', () => {
    assert.equal(toPlainText('Question<br /><br />Answer'), 'Question\n\nAnswer');
    assert.equal(toPlainText('Question&lt;br /&gt;Answer'), 'Question\nAnswer');
    assert.equal(toPlainText('A&#x20;B &amp; C'), 'A B & C');
});
