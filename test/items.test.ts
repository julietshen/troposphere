import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountItem, buildPostItem } from '../src/coop/items.ts';

const types = { coopPostType: 'ATproto-post', coopAccountType: 'ATproto-account' };

test('buildPostItem maps a post record to an ATproto-post item', () => {
  const item = buildPostItem(
    'did:plc:author',
    'rkey1',
    'bafycid',
    { text: 'hello', createdAt: '2026-01-01T00:00:00.000Z', langs: ['en'] },
    'FALLBACK',
    types,
  );
  assert.equal(item.typeId, 'ATproto-post');
  assert.equal(item.id, 'at://did:plc:author/app.bsky.feed.post/rkey1');
  assert.equal(item.data.text, 'hello');
  assert.deepEqual(item.data.authorDid, { id: 'did:plc:author', typeId: 'ATproto-account' });
  assert.equal(item.data.rkey, 'rkey1');
  assert.equal(item.data.cid, 'bafycid');
  assert.equal(item.data.atUri, item.id);
  assert.equal(item.data.isLive, false);
  assert.deepEqual(item.data.langs, ['en']);
  assert.equal(item.data.createdAt, '2026-01-01T00:00:00.000Z');
});

test('buildPostItem falls back createdAt and empty text, omits absent cid', () => {
  const item = buildPostItem('did:plc:a', 'r', undefined, {}, 'FALLBACK', types);
  assert.equal(item.data.text, '');
  assert.equal(item.data.createdAt, 'FALLBACK');
  assert.equal('cid' in item.data, false);
});

test('buildAccountItem requires did/handle/isActive, handle falls back to did', () => {
  const a = buildAccountItem('did:plc:acct', undefined, undefined, types);
  assert.equal(a.typeId, 'ATproto-account');
  assert.equal(a.data.did, 'did:plc:acct');
  assert.equal(a.data.handle, 'did:plc:acct');
  assert.equal(a.data.isActive, true);
});

test('buildAccountItem includes profile fields when present', () => {
  const a = buildAccountItem('did:plc:acct', 'alice.test', { displayName: 'Alice', description: 'hi' }, types);
  assert.equal(a.data.handle, 'alice.test');
  assert.equal(a.data.displayName, 'Alice');
  assert.equal(a.data.description, 'hi');
});
