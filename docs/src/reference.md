# Reference

## Configuration

Set via environment (a `.env` file is loaded in development).

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `LABELER_DID` | yes | | The labeler's DID (`did:web:...` or `did:plc:...`). |
| `LABELER_SIGNING_KEY` | yes | | 64-char hex secp256k1 private key. From `npm run keygen`. |
| `ADMIN_TOKEN` | yes | | Bearer token for `POST /admin/labels`. |
| `DATABASE_URL` | yes | | Postgres connection string. |
| `PORT` | no | `4100` | HTTP port. |
| `REPORT_FORWARD_URL` | no | | Backend endpoint to forward inbound reports to. |
| `REPORT_FORWARD_TOKEN` | no | | Bearer token sent with forwarded reports. |
| `REPORT_ENRICH` | no | `true` | Resolve and attach reported content to forwarded reports. |
| `REPORT_FORWARD_FORMAT` | no | `raw` | `raw` (Bearer JSON) or `coop` (Coop `/api/v1/report` + X-API-KEY). |
| `COOP_POST_TYPE` | no | `ATproto-post` | Coop item type id for posts (coop format). |
| `COOP_ACCOUNT_TYPE` | no | `ATproto-account` | Coop item type id for accounts (coop format). |
| `PDS_URL` | no | | Your PDS, for enforcement. Enables `POST /admin/enforce`. |
| `PDS_ADMIN_PASSWORD` | no | | Admin password for `PDS_URL`. |

Ingestion worker (`npm run ingest`) only:

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `COOP_ITEMS_URL` | yes | | Coop's `/api/v1/items/async` endpoint. |
| `COOP_ITEMS_API_KEY` | yes | | Coop org API key, sent as `X-API-KEY`. |
| `JETSTREAM_URL` | no | `wss://jetstream2.us-east.bsky.network/subscribe` | Jetstream instance. |
| `JETSTREAM_COLLECTIONS` | no | `app.bsky.feed.post,app.bsky.actor.profile` | Record types to stream. |
| `JETSTREAM_WANTED_DIDS` | no | (all) | Restrict to specific accounts. |
| `INGEST_BATCH_SIZE` | no | `50` | Max items per POST. |
| `INGEST_BATCH_INTERVAL_MS` | no | `1000` | Flush interval. |

See [Ingesting content into Coop](./ingesting-content.md).

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | none | Liveness. Returns the labeler DID. |
| `POST` | `/admin/labels` | bearer | Create and negate labels. |
| `POST` | `/admin/enforce` | bearer | Take down or restore on your PDS. |
| `POST` | `/coop/action` | bearer | Coop `CUSTOM_ACTION` shape: label and/or take down. |
| `GET` | `/xrpc/com.atproto.label.queryLabels` | none | Query labels by URI pattern. |
| `GET` (WS) | `/xrpc/com.atproto.label.subscribeLabels` | none | Label firehose. |
| `POST` | `/xrpc/com.atproto.moderation.createReport` | service JWT | Accept a report. |

## POST /admin/enforce

Take down or restore a record or account on your own PDS. Bearer-authenticated with
`ADMIN_TOKEN`. Body: `subject` (a record `{ uri, cid }` or account `{ did }`), `takedown`
(`true` to take down, `false` to restore, default `true`), and optional `ref`. Requires
`PDS_URL` and `PDS_ADMIN_PASSWORD`; returns `501` otherwise. See [Enforcement](./enforcement.md).

## POST /coop/action

Accepts Coop's `CUSTOM_ACTION` webhook body directly, so a Coop action uses troposphere with no
adapter. Bearer-authenticated with `ADMIN_TOKEN`. Body: `item.id` (the subject atproto URI or
DID) and `custom` with any of `create` / `negate` (label values) and `takedown` (boolean), plus
optional `cid` and `ref`. For a record without a `cid`, the current version is resolved from its
own PDS. See [Deploying with Coop](./deploying-with-coop.md).

## POST /xrpc/com.atproto.moderation.createReport

Standard atproto report intake, reached by PDS proxying (not called directly). Auth is the
inter-service JWT the reporter's PDS attaches. Input is `reasonType`, optional `reason`, and a
`subject` (a `com.atproto.admin.defs#repoRef` for an account or a `com.atproto.repo.strongRef`
for a record). Returns the created report with an integer `id` and the `reportedBy` DID. See
[Receiving reports](./receiving-reports.md).

## POST /admin/labels

Request:

```json
{
  "subject": { "uri": "at://... or did:...", "cid": "optional" },
  "create": ["label-value"],
  "negate": ["label-value"]
}
```

Response:

```json
{ "labels": [ { "seq": 1, "val": "label-value", "neg": false } ] }
```

Errors: `401` (missing or wrong token), `400` (missing `subject.uri`, or neither `create` nor
`negate` provided).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run keygen` | Generate a signing key and print the public multibase. |
| `npm run db:init` | Apply the Postgres schema. |
| `npm run ingest` | Stream Jetstream into Coop's item intake. |
| `npm run dev` | Run with watch (type-stripped, no build step). |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run the compiled build. |
| `npm run typecheck` | Type-check without emitting. |
| `npm run smoke` | End-to-end check against a running instance. |

## Database

Two tables. `label`: key columns `seq` (bigserial, the firehose cursor), `src`, `uri`, `cid`,
`val`, `neg`, `cts`, `exp`, `sig`. Timestamps are stored as text so a stored label reproduces
exactly the bytes that were signed. `report`: `id` (bigserial), `reason_type`, `reason`,
`subject_type`, `subject_did`, `subject_uri`, `subject_cid`, `reported_by`, `created_at`.
Enforcement is not stored; it is applied directly to the PDS.

## Building the docs

This book is built with [mdBook](https://rust-lang.github.io/mdBook/):

```bash
mdbook serve docs      # live preview
mdbook build docs      # output to docs/book
```
