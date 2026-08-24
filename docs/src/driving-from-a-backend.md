# Using it from a moderation backend

`troposphere` is the atproto-facing half of a moderation system, and [Coop](./deploying-with-coop.md)
is the other half: the policies, rules, and actions you set up in Coop, and the reviewers who work
there, decide what to label or take down, then use troposphere. This page covers the general
integration shape; if you are using Coop, see
[Deploying with Coop](./deploying-with-coop.md), which wires it up with no adapter.

## The integration in one call

Whatever the backend, the integration is the same: when a decision is made to label a piece of
content, POST the subject and label values with the admin token.

```
your backend ──(decision)──> POST /admin/labels ──> signed label ──> subscribeLabels / queryLabels ──> the network
```

Give the labeler a stable public URL, share the `ADMIN_TOKEN` with your backend, and keep the
signing key on the labeler only. Your backend never touches the key.

## Coop

Coop is the backend troposphere is built for, and it needs no adapter: a Coop action posts its
`CUSTOM_ACTION` body straight to `/coop/action`, and reports forward to a Coop review queue. The
full setup, including ingestion and takedowns, is in
[Deploying with Coop](./deploying-with-coop.md).

## Your own tooling

You do not need Coop. Any script or service that can make an authenticated HTTP request can
use the labeler:

```bash
curl -X POST https://labeler.example.com/admin/labels \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "subject": { "uri": "at://..." }, "create": ["spam"] }'
```

A classifier that flags content, a moderation bot, or a spreadsheet-run batch job all
integrate the same way.

## Receiving reports

Integration also runs the other direction. When users report content to your labeler, the
labeler verifies and stores each report and forwards it to your backend at
`REPORT_FORWARD_URL`. Your backend triages the report and, when it decides to act, calls
`POST /admin/labels`. See [Receiving reports](./receiving-reports.md).

## Idempotency and reconciliation

Emitting the same label twice creates two records; the network treats the latest as current,
so duplicates are harmless but noisy. If your backend needs exactly-once semantics, record the
`seq` returned by each emit and reconcile against `queryLabels` before re-emitting.
