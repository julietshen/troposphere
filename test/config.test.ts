import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIngestConfig } from '../src/config.ts';

test('loadIngestConfig applies defaults and reads coop item settings', () => {
  process.env.COOP_ITEMS_URL = 'http://localhost/api/v1/items/async';
  process.env.COOP_ITEMS_API_KEY = 'k';
  delete process.env.JETSTREAM_URL;
  delete process.env.JETSTREAM_COLLECTIONS;
  const c = loadIngestConfig();
  assert.equal(c.jetstreamUrl, 'wss://jetstream2.us-east.bsky.network/subscribe');
  assert.deepEqual(c.collections, ['app.bsky.feed.post', 'app.bsky.actor.profile']);
  assert.equal(c.coopPostType, 'ATproto-post');
  assert.equal(c.coopAccountType, 'ATproto-account');
  assert.equal(c.batchSize, 50);
});

test('loadIngestConfig throws without COOP_ITEMS_URL', () => {
  delete process.env.COOP_ITEMS_URL;
  assert.throws(() => loadIngestConfig());
});
