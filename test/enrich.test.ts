import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAtUri } from '../src/reports/enrich.ts';

test('parseAtUri parses a valid at-uri', () => {
  assert.deepEqual(parseAtUri('at://did:plc:x/app.bsky.feed.post/abc'), {
    authority: 'did:plc:x',
    collection: 'app.bsky.feed.post',
    rkey: 'abc',
  });
});

test('parseAtUri rejects non-at-uris and incomplete uris', () => {
  assert.equal(parseAtUri('did:plc:x'), null);
  assert.equal(parseAtUri('at://did:plc:x/app.bsky.feed.post'), null);
  assert.equal(parseAtUri('https://example.com'), null);
});
