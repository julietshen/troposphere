# Ingesting content into Coop

For Coop to moderate AT Protocol content, that content has to arrive as Coop items.
troposphere's ingestion worker streams [Jetstream](https://docs.bsky.app/blog/jetstream) and
posts records to Coop's item intake over HTTP, so Coop can run rules and route content to review
queues. This is the proactive-detection path; user reports arrive separately (see
[Receiving reports](./receiving-reports.md)).

Coop itself never connects to Jetstream and needs no atproto-specific connector. This worker does
that job and posts plain items to `/items/async`, which is why Coop stays generic. If your Coop
shows no atproto content, it is not because Coop lacks a firehose; it is because this worker is not
running or is scoped to different accounts.

Ingestion runs as its own process, opt-in, so a troposphere deployment that only labels does
not pay for it.

## Running it

```bash
COOP_ITEMS_URL=https://your-coop/api/v1/items/async \
COOP_ITEMS_API_KEY=<coop org API key> \
npm run ingest
```

The worker connects to Jetstream, maps each record to a Coop item, batches, and POSTs
`{ items: [...] }` to `/api/v1/items/async` with `X-API-KEY`. It reconnects with backoff and
maintains a live tail.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `COOP_ITEMS_URL` | (required) | Coop's `/api/v1/items/async` endpoint. |
| `COOP_ITEMS_API_KEY` | (required) | Coop org API key, sent as `X-API-KEY`. |
| `JETSTREAM_URL` | `wss://jetstream2.us-east.bsky.network/subscribe` | Jetstream instance. |
| `JETSTREAM_COLLECTIONS` | `app.bsky.feed.post,app.bsky.actor.profile` | Record types to stream. |
| `JETSTREAM_WANTED_DIDS` | (all) | Restrict to specific accounts. |
| `INGEST_BATCH_SIZE` | `50` | Max items per POST. |
| `INGEST_BATCH_INTERVAL_MS` | `1000` | Flush interval. |
| `COOP_POST_TYPE` / `COOP_ACCOUNT_TYPE` | `ATproto-post` / `ATproto-account` | Coop item type ids. |

## Scope your ingestion

The full firehose is enormous. Ingesting every post on the network into Coop is almost never
what you want. Scope it:

- `JETSTREAM_WANTED_DIDS` restricts to your project's accounts.
- `JETSTREAM_COLLECTIONS` restricts to the record types you moderate.

For a project running its own PDS or AppView, point `JETSTREAM_URL` at a Jetstream fed by your
own infrastructure, or filter to your accounts.

## Item types and custom lexicons

The worker maps `app.bsky.feed.post` to your post item type and `app.bsky.actor.profile` to your
account item type. Those item types must already exist in your Coop org (created there once), and
`COOP_POST_TYPE` / `COOP_ACCOUNT_TYPE` must be set to their **item type IDs** (the id Coop
assigns each type, not the display name). Coop's HTTP intake matches `typeId` against the id and
rejects the batch otherwise. The mapping produces the same item shape a reported post gets, so
ingested and reported content look identical to Coop.

Mapping additional or custom record types (your own lexicons) to Coop item types is not built in
yet; today the worker covers posts and profiles. See the [roadmap](./roadmap.md).

## What it does not do

Ingestion only submits items. Whether an item reaches a reviewer is up to Coop's rules and
routing (unlike reports, which Coop always enqueues). This is intentional: the item path is for
proactive detection and automated enforcement, so you decide in Coop which content warrants
review.
