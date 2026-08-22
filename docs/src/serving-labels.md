# Serving labels to the network

Consumers read labels two ways: on demand with `queryLabels`, and as a live stream with
`subscribeLabels`. Both are standard atproto endpoints served under `/xrpc/`.

## queryLabels

`GET /xrpc/com.atproto.label.queryLabels`

Parameters:

- `uriPatterns` (required): one or more patterns. An exact `at://` or `did:` value, or a
  prefix ending in `*`. The single pattern `*` matches everything.
- `sources` (optional): restrict to specific labeler DIDs.
- `limit` (optional): default 50, maximum 250.
- `cursor` (optional): a sequence number to page from.

```bash
curl "http://localhost:4100/xrpc/com.atproto.label.queryLabels?uriPatterns=at://did:plc:example/app.bsky.feed.post/abc"
```

Response:

```json
{
  "cursor": "42",
  "labels": [
    {
      "ver": 1,
      "src": "did:web:labeler.example.com",
      "uri": "at://did:plc:example/app.bsky.feed.post/abc",
      "val": "spam",
      "cts": "2026-08-22T00:00:00.000Z",
      "sig": { "$bytes": "..." }
    }
  ]
}
```

Page by passing the returned `cursor` back on the next request.

## subscribeLabels

`GET /xrpc/com.atproto.label.subscribeLabels` (WebSocket)

Each label is assigned a monotonic sequence number. Connect with a `cursor` to backfill
everything after that sequence, then stay connected for the live tail:

```
ws://localhost:4100/xrpc/com.atproto.label.subscribeLabels?cursor=0
```

- With a cursor, the server backfills from the store, then joins you to the live stream.
  Labels emitted during backfill are buffered, so there is no gap at cutover.
- Without a cursor, you receive only labels emitted from the moment you connect.

Frames are the standard atproto framing. Each `#labels` message carries a `seq` and an array
of signed labels, dag-cbor encoded. The `@atproto/xrpc-server` `Frame` helper decodes them;
see `scripts/smoke.mjs` for a minimal consumer.

## Verifying signatures

A label is trustworthy only if its signature verifies against the labeler's
`#atproto_label` key. Consumers resolve the labeler DID, read that key, reconstruct the label
object without `sig`, dag-cbor encode it, and check the signature. The smoke test does exactly
this using `verifySignature` from `@atproto/crypto`.
