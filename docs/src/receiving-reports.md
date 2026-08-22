# Receiving reports

`troposphere` accepts `com.atproto.moderation.createReport`, the standard way a user reports
an account or record to a labeler. Reports are authenticated, stored, and optionally forwarded
to your moderation backend for triage.

Report intake is AppView-agnostic: a report proxied from any AT Protocol PDS authenticates,
not only Bluesky's.

## How a report arrives

A client does not call the labeler directly. It calls its own PDS with an `atproto-proxy`
header naming the labeler, and the PDS proxies the request to the labeler's endpoint, attaching
an inter-service auth token. That token proves which account is reporting.

```
user's client ──> user's PDS ──(atproto-proxy, signed)──> troposphere /xrpc/com.atproto.moderation.createReport
```

## What the labeler does

1. **Verifies the token.** It resolves the reporter's DID to its signing key (any `did:plc` or
   `did:web`, through the standard identity resolver) and checks the token's signature,
   audience, and scope. A missing, wrong-audience, or invalid token is rejected.
2. **Records the report.** Reason, subject (account or record), and reporter DID are persisted,
   and the report gets an id.
3. **Enriches the subject.** It resolves the reported subject through its own identity (DID to
   PDS) and reads the record with `com.atproto.repo.getRecord`, so the forwarded report carries
   the content, not just a URI. This is AppView-agnostic and best-effort: a deleted record or
   unreachable PDS leaves the content absent but does not fail the report. Set `REPORT_ENRICH=false`
   to skip it.
4. **Forwards it, if configured.** When `REPORT_FORWARD_URL` is set, the report (with any
   enrichment) is POSTed to your backend, with an optional bearer token. Best-effort: the report
   is already durably stored, so a backend outage does not lose it or fail the reporter's request.
5. **Responds** with the created report, per the lexicon.

## Configuring forwarding

```bash
REPORT_FORWARD_URL=https://your-backend.example/reports
REPORT_FORWARD_TOKEN=   # optional bearer token sent to your backend
```

The forwarded body, with enrichment attached:

```json
{
  "id": 1,
  "reasonType": "com.atproto.moderation.defs#reasonSpam",
  "reason": "…",
  "reportedBy": "did:plc:…",
  "createdAt": "2026-08-22T00:00:00.000Z",
  "subject": { "$type": "com.atproto.repo.strongRef", "uri": "at://…", "cid": "…" },
  "enrichment": {
    "did": "did:plc:…",
    "handle": "alice.example.com",
    "pds": "https://pds.example.com",
    "record": { "uri": "at://…", "reportedCid": "…", "cid": "…", "value": { }, "found": true }
  }
}
```

Your backend decides what to do with it: enqueue it for review, run rules, and eventually call
`POST /admin/labels` to publish a label or `POST /admin/enforce` to take it down. The labeler
does not act on reports by itself.

That JSON is the `raw` format. Set `REPORT_FORWARD_FORMAT=coop` to instead post
[Coop](./deploying-with-coop.md)'s `POST /api/v1/report` envelope with an `X-API-KEY` header, so
reports land directly in a Coop review queue with no adapter.

## Declaring what you accept

Clients decide which reports to send you from your `app.bsky.labeler.service` declaration
record. Use its `reasonTypes` and `subjectTypes` to scope what your labeler reviews. See
[Publishing your labeler identity](./identity.md).
