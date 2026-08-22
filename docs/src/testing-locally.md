# Testing locally against Coop

This walks through verifying the whole loop on your own machine: a real Coop, a real labeler,
real signed labels. It assumes you have the [Coop](https://github.com/roostorg/coop) repo checked
out and can run it locally (Docker, Postgres, ClickHouse, Scylla, Redis).

## What you are proving

- Content flows from the network into Coop as items you can review.
- A reviewer decision in Coop produces a real signed label, verifiable against the labeler key.
- A report reaches a Coop review queue.
- A takedown is applied to a PDS.

## 1. Bring up Coop with the atproto item types

Coop needs two item types, `ATproto-post` and `ATproto-account`, plus an org, an API key, and a
label action. Item types are created by Coop's seed, not over HTTP, so start from a Coop setup
that seeds them (the `trustcon` branch's `seed-trustcon` creates the item types, queues, and a
label action). Run Coop's backing services, backend, and client per Coop's README, then run the
seed.

From that setup you need three things:

- the org's **API key** (`X-API-KEY` for `/items/async` and `/report`),
- the **item type IDs** for the post and account types (Coop assigns each type an id; the HTTP
  intake matches `typeId` against that id, not the display name, so set `COOP_POST_TYPE` /
  `COOP_ACCOUNT_TYPE` to the ids). The seed output prints them.
- a **label action** whose callback URL is your troposphere `POST /coop/action` (or `/label`),
  with `Authorization: Bearer <ADMIN_TOKEN>`.

This loop has been run end to end against a real local Coop: items post to `/items/async` (202),
reports post to `/report` (201, enqueued), the reported item shows up in a Coop review queue, and
a reviewer picking a label action in the Review Console posts to troposphere and produces a signed
label that verifies against the labeler key. The seed's Bleep/Bloop actions post to `/label` with
`{ labelVal }`, which troposphere accepts as-is.

## 2. Run troposphere

```bash
npm run keygen          # note LABELER_SIGNING_KEY and the did:key it prints
cp .env.example .env    # then fill in:
#   LABELER_DID=did:web:localhost%3A4100   (or a did:plc test account)
#   LABELER_SIGNING_KEY=...  ADMIN_TOKEN=...  DATABASE_URL=...
#   REPORT_FORWARD_FORMAT=coop
#   REPORT_FORWARD_URL=http://localhost:8080/api/v1/report
#   REPORT_FORWARD_TOKEN=<coop org API key>
#   PDS_URL=... PDS_ADMIN_PASSWORD=...   (only to test takedowns)
npm run db:init
npm run server:start    # or: npm run dev
```

## 3. Ingest content into Coop

Scope it to a test account so you are not pulling the whole firehose:

```bash
COOP_ITEMS_URL=http://localhost:8080/api/v1/items/async \
COOP_ITEMS_API_KEY=<coop org API key> \
JETSTREAM_WANTED_DIDS=<your test account did> \
npm run ingest
```

Post from that account on Bluesky and watch the item show up in Coop.

## 4. Label, and verify it is real

Open the reported item in Coop's Review Console, pick the label action in the Decision panel, and
Submit. Coop fires the action to troposphere (`/coop/action`, or `/label` for a relay-style
action), which signs and stores the label. Confirm it is a real, valid label by querying it and
checking the signature (the smoke test does exactly this):

```bash
LABELER_URL=http://localhost:4100 \
ADMIN_TOKEN=... LABELER_DID=... SIGNING_DID_KEY=did:key:z... \
npm run smoke
```

or query directly:

```bash
curl "http://localhost:4100/xrpc/com.atproto.label.queryLabels?uriPatterns=<the at-uri>"
```

## 5. Reports and takedowns

Send a report (a client's `createReport`, proxied to your labeler, or a direct call for testing)
and confirm it lands in a Coop review queue. If you set `PDS_URL`/`PDS_ADMIN_PASSWORD`, pick the
takedown action and confirm the content is taken down on that PDS.

## On the labeler identity

Locally, verifying the signature against the labeler key proves the labeler is working correctly.
For a labeler that outside clients (like the Bluesky app) can subscribe to, the DID has to be
publicly resolvable, which means a `did:web` on a real domain serving `did.json`, or a `did:plc`.
See [Publishing your labeler identity](./identity.md). A public deploy is the next step past this
local check.
