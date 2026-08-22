import { loadIngestConfig } from './config.ts';
import { startJetstream, type CommitEvent } from './ingest/jetstream.ts';
import { buildAccountItem, buildPostItem, type RawItemSubmission } from './coop/items.ts';

const config = loadIngestConfig();
const controller = new AbortController();
const handleCache = new Map<string, string>();
const buffer: RawItemSubmission[] = [];
let flushing = false;

function toItems(evt: CommitEvent): RawItemSubmission[] {
  if (evt.operation === 'delete' || evt.record == null) return [];
  if (evt.collection === 'app.bsky.feed.post') {
    return [buildPostItem(evt.did, evt.rkey, evt.cid, evt.record, new Date().toISOString(), config)];
  }
  if (evt.collection === 'app.bsky.actor.profile') {
    return [buildAccountItem(evt.did, handleCache.get(evt.did), evt.record, config)];
  }
  return [];
}

async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (buffer.length > 0) {
      const items = buffer.splice(0, config.batchSize);
      try {
        const res = await fetch(config.coopItemsUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': config.coopItemsApiKey },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) console.error(`items POST failed ${res.status}: ${await res.text()}`);
      } catch (err) {
        // Best-effort: on a transient failure the batch is dropped rather than blocking the
        // stream. Scope ingestion (wantedDids/collections) so volume stays manageable.
        console.error('items POST error:', err);
      }
    }
  } finally {
    flushing = false;
  }
}

startJetstream({
  url: config.jetstreamUrl,
  collections: config.collections,
  wantedDids: config.wantedDids,
  signal: controller.signal,
  onStatus: (s) => console.log(`[jetstream] ${s}`),
  onIdentity: (did, handle) => {
    if (handle) handleCache.set(did, handle);
  },
  onCommit: (evt) => {
    buffer.push(...toItems(evt));
    if (buffer.length >= config.batchSize) void flush();
  },
});

const timer = setInterval(() => void flush(), config.batchIntervalMs);
console.log(
  `troposphere ingest -> ${config.coopItemsUrl} (collections: ${config.collections.join(', ')}` +
    `${config.wantedDids ? `, dids: ${config.wantedDids.length}` : ''})`,
);

function shutdown(sig: string): void {
  console.log(`\n${sig} received, stopping ingest.`);
  controller.abort();
  clearInterval(timer);
  void flush().finally(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
