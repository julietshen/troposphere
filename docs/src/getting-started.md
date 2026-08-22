# Getting started

## Prerequisites

- Node 24 or newer.
- Postgres.

## Install

```bash
git clone https://github.com/julietshen/troposphere
cd troposphere
npm install
```

## 1. Generate a signing key

```bash
npm run keygen
```

This prints three things:

```
LABELER_SIGNING_KEY=<64 hex chars>
# did:key:             did:key:zQ3sh...
# publicKeyMultibase:  zQ3sh...
```

Keep `LABELER_SIGNING_KEY` secret. The `publicKeyMultibase` is what you will publish in your
DID document so the network can verify your labels. See
[Publishing your labeler identity](./identity.md).

## 2. Configure

Copy the example env file and fill it in:

```bash
cp .env.example .env
```

| Variable | Meaning |
| --- | --- |
| `LABELER_DID` | Your labeler's DID (`did:web:...` or `did:plc:...`). |
| `LABELER_SIGNING_KEY` | The 64-char hex key from `npm run keygen`. |
| `ADMIN_TOKEN` | Bearer token your backend presents to the emit API. |
| `DATABASE_URL` | Postgres connection string. |
| `PORT` | HTTP port (default `4100`). |

## 3. Create the schema and run

```bash
npm run db:init
npm run dev          # or: npm run build && npm start
```

On startup the server logs the labeler DID and the `#atproto_label` key it is using, as a
reminder to publish them.

## 4. Verify it works

Emit a label and read it back:

```bash
curl -X POST http://localhost:4100/admin/labels \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "subject": { "uri": "at://did:plc:example/app.bsky.feed.post/abc" }, "create": ["spam"] }'

curl "http://localhost:4100/xrpc/com.atproto.label.queryLabels?uriPatterns=at://did:plc:example/app.bsky.feed.post/abc"
```

Or run the bundled smoke test, which emits, queries, tails the firehose, and independently
verifies the signatures:

```bash
LABELER_URL=http://localhost:4100 \
ADMIN_TOKEN=$ADMIN_TOKEN \
LABELER_DID=$LABELER_DID \
SIGNING_DID_KEY=did:key:zQ3sh... \
npm run smoke
```

The smoke test also exercises report intake: it mints a service JWT and confirms
`createReport` accepts an authed report and rejects unauthenticated or wrong-audience ones.

Next: make the network trust your labels by
[publishing your labeler identity](./identity.md).
