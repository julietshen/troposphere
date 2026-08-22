import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEnforceSubject } from '../src/server/enforce.ts';

test('a record subject becomes a strongRef and requires a cid', () => {
  assert.deepEqual(buildEnforceSubject({ uri: 'at://did:plc:x/app.bsky.feed.post/a', cid: 'bafy' }), {
    $type: 'com.atproto.repo.strongRef',
    uri: 'at://did:plc:x/app.bsky.feed.post/a',
    cid: 'bafy',
  });
  assert.ok('error' in buildEnforceSubject({ uri: 'at://did:plc:x/app.bsky.feed.post/a' }));
});

test('an account subject becomes a repoRef, via did or a bare did in uri', () => {
  const expected = { $type: 'com.atproto.admin.defs#repoRef', did: 'did:plc:x' };
  assert.deepEqual(buildEnforceSubject({ did: 'did:plc:x' }), expected);
  assert.deepEqual(buildEnforceSubject({ uri: 'did:plc:x' }), expected);
});

test('an empty subject is an error', () => {
  assert.ok('error' in buildEnforceSubject({}));
});
