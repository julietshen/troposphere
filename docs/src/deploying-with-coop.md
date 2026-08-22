# Deploying with Coop

[Coop](https://github.com/roostorg/coop) is the reference console for `troposphere`. Coop plays
the role Ozone's UI would (the review queue, reviewer roles, rules, and event history);
`troposphere` is the protocol-facing arm Coop drives to publish labels, receive reports, and
enforce takedowns.

```
AT Protocol content ─▶ Coop (ingest, rules, review queue, reviewers)
                              │  decision (label / take down)
                              ▼
                       troposphere  ─▶ signed labels ─▶ subscribeLabels / queryLabels
                              ▲        ─▶ takedown ─▶ your PDS
                              │
   inbound report ───────────┘  (createReport, forwarded into a Coop queue)
```

## What each side owns

- **Coop**: ingests atproto content as items, runs rules, routes to review queues, and lets
  reviewers act. Its actions fire outbound HTTP callbacks.
- **troposphere**: signs and serves labels, accepts and forwards reports, enforces takedowns. It
  holds the labeler signing key; Coop never sees it.

## 1. Deploy troposphere

Follow [Getting started](./getting-started.md). For a Coop deployment you will typically set:

```bash
LABELER_DID=did:web:labeler.yourorg.example
LABELER_SIGNING_KEY=...
ADMIN_TOKEN=...                 # Coop presents this on label/enforce calls
DATABASE_URL=postgres://.../troposphere
REPORT_FORWARD_URL=...          # Coop's report/item intake (see step 4)
REPORT_FORWARD_TOKEN=...        # Coop API key
PDS_URL=https://your-pds        # only if you enforce takedowns on your own PDS
PDS_ADMIN_PASSWORD=...
```

Then [publish your labeler identity](./identity.md).

## 2. Labels and takedowns out: Coop action to troposphere

Coop publishes a label or takedown by firing a `CUSTOM_ACTION` at a reviewer's decision (or from a
rule). Point it at troposphere's Coop endpoint, `POST /coop/action`, which accepts Coop's action
shape directly, with no adapter:

- **callbackUrl**: `POST /coop/action` on troposphere.
- **callbackUrlHeaders**: `{ "Authorization": "Bearer <ADMIN_TOKEN>" }`.
- **callbackUrlBody**: the directive. `{ "create": ["spam"] }` labels, `{ "negate": ["spam"] }`
  removes a label, `{ "takedown": true }` takes the content down. Combine them in one action if you
  want: `{ "create": ["nsfw"], "takedown": true }`.

Coop injects the item's atproto URI as `item.id`; troposphere reads it as the subject and, for a
record, resolves the current CID from the record's own PDS so the label or takedown pins to that
version. You do not compute the CID in Coop. Takedowns require `PDS_URL`/`PDS_ADMIN_PASSWORD` (your
own PDS); see [Enforcement](./enforcement.md).

## 3. Ingestion and review

Coop ingests atproto content (for example from Jetstream) as items, runs rules, and routes them
to queues. A reviewer opens an item, sees the post and its author context, and picks an action.
Choosing a label or takedown action fires the callback in step 2. None of this involves Ozone.

## 4. Reports in: troposphere to a Coop queue

Turn on the Coop report format and point troposphere at Coop's report intake:

```bash
REPORT_FORWARD_FORMAT=coop
REPORT_FORWARD_URL=https://your-coop/api/v1/report
REPORT_FORWARD_TOKEN=<coop org API key>   # sent as X-API-KEY
COOP_POST_TYPE=ATproto-post               # your org's item type ids
COOP_ACCOUNT_TYPE=ATproto-account
```

When a user reports content to your labeler, troposphere verifies and enriches the report (see
[Receiving reports](./receiving-reports.md)), maps it onto Coop's `POST /api/v1/report` envelope
(`reporter` as a user report keyed by the reporter DID, the reported record or account as the
`reportedItem`, and the reason on `reportedForReason`), and posts it with `X-API-KEY`. Coop's
report endpoint always enqueues the item to a review queue, so the report lands in Coop alongside
everything else. No adapter needed.

## Integration status

Both directions are turnkey and tested end to end:

- **Labels and takedowns out**: `/coop/action` accepts Coop's `CUSTOM_ACTION` body as-is, so
  wiring is just configuring a Coop action (step 2). No adapter.
- **Reports in**: `REPORT_FORWARD_FORMAT=coop` posts Coop's `/api/v1/report` envelope with
  `X-API-KEY` (step 4). No adapter.

One thing remains, tracked as "Coop wiring" on the [roadmap](./roadmap.md): the Coop-side action
configuration itself (creating the label and takedown actions and attaching them to queues in
Coop), and optionally generating the labeler declaration from Coop's configured labels.
