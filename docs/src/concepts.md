# Concepts

A short tour of the AT Protocol pieces `troposphere` implements. The full specification is
at [atproto.com/specs/label](https://atproto.com/specs/label).

## Labeler

A labeler is a service, identified by a DID, that publishes labels. Its DID document
advertises two things: a signing key (`#atproto_label`) and a service endpoint
(`#atproto_labeler`, type `AtprotoLabeler`) where its label endpoints live. Clients subscribe
to a labeler by its DID.

## Label

A label is a small signed record attaching a value to a subject:

- `src`: the labeler's DID.
- `uri`: what the label is about. An account (a bare `did:`) or a record (an `at://` URI).
- `cid`: optional, pins the label to a specific version of the record.
- `val`: the label value, a short string such as `spam` or `nudity`.
- `neg`: if true, this label retracts a previous one.
- `cts`: the creation timestamp.
- `exp`: optional expiry.
- `sig`: a signature over the canonical (dag-cbor) encoding of the other fields.

Because verifiers reconstruct the signed bytes from these fields, `troposphere` stores
timestamps verbatim so a stored label reproduces exactly what was signed.

## Negation

Labels are not deleted. To retract a label you emit a new one with the same `src`, `uri`,
and `val`, `neg` set to true, and a later timestamp. Consumers treat the most recent label
for a given `(src, uri, val)` as authoritative.

## queryLabels

`com.atproto.label.queryLabels` is a public HTTP endpoint. Given URI patterns it returns the
matching labels. Clients use it to hydrate labels on demand.

## subscribeLabels

`com.atproto.label.subscribeLabels` is a WebSocket firehose. Each label is assigned a
monotonic sequence number. A consumer connects with a cursor to backfill everything since
that sequence, then stays connected for a live tail. `troposphere` buffers labels emitted
during backfill so there is no gap at cutover.

## Reports

`com.atproto.moderation.createReport` lets a user report an account or record to a labeler.
Reports are proxied to the labeler's endpoint with an inter-service auth token. `troposphere`
verifies that token against the reporter's DID, stores the report, and can forward it to your
backend. See [Receiving reports](./receiving-reports.md).
