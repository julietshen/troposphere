# Emitting labels

Labels are created through `POST /admin/labels`, a bearer-authenticated endpoint your
moderation backend calls. It is backend-agnostic: the labeler does not decide what to label,
your backend does, and then tells the labeler to publish.

## Authentication

Every request must carry the admin bearer token:

```
authorization: Bearer <ADMIN_TOKEN>
```

Requests without it get `401`.

## Request

```json
{
  "subject": { "uri": "at://did:plc:.../app.bsky.feed.post/abc", "cid": "bafy..." },
  "create": ["spam"],
  "negate": []
}
```

- `subject.uri` (required): the record `at://` URI, or a bare `did:` for an account.
- `subject.cid` (optional): pins a record label to a specific version.
- `create`: label values to apply.
- `negate`: label values to retract.

You may pass `create`, `negate`, or both. At least one value is required.

## Labeling a record vs an account

Record label:

```json
{ "subject": { "uri": "at://did:plc:.../app.bsky.feed.post/abc", "cid": "bafy..." }, "create": ["spam"] }
```

Account label (omit `cid`, use the bare DID):

```json
{ "subject": { "uri": "did:plc:..." }, "create": ["scam-account"] }
```

## Retracting a label

Negation emits a new label with `neg` set and a later timestamp, which is how atproto retracts:

```json
{ "subject": { "uri": "at://did:plc:.../app.bsky.feed.post/abc" }, "negate": ["spam"] }
```

## Response

```json
{
  "labels": [
    { "seq": 42, "val": "spam", "neg": false }
  ]
}
```

Each emitted label gets a sequence number. That number is the position in the
`subscribeLabels` firehose, so a backend can record it for reconciliation.

## What happens under the hood

For each value, the labeler builds the canonical label object (`ver` 1, your DID as `src`,
the subject, a fresh timestamp), signs its dag-cbor encoding with the labeler key, stores it
in Postgres with the next sequence number, and pushes it to every open `subscribeLabels`
stream. See [Serving labels](./serving-labels.md).
