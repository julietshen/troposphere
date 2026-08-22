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

[Coop](https://github.com/roostorg/coop) is the console troposphere is built for, and it is the
Ozone UI replacement: the review queue, reviewer roles, and event history live in Coop.
`troposphere` is the atproto plumbing Coop uses. Coop already ingests atproto content,
runs rules, routes items to review queues, and fires actions; a Coop action issues an outbound
HTTP callback, which is the seam that points at this service.

The wiring, once built (see [roadmap](./roadmap.md)):

- A Coop label action's callback URL points at `POST /admin/labels`; a takedown action points at
  `POST /admin/enforce`.
- The action body carries the subject `at://` URI (and CID) and the label value or takedown flag.
- Reports forwarded from `troposphere` land in a Coop review queue.
- The label vocabulary Coop is configured with is used to generate the labeler's
  `app.bsky.labeler.service` declaration.

The result is a full loop with no Ozone in the path: atproto content and reports flow into Coop,
a reviewer or rule decides, and `troposphere` publishes the label or applies the takedown.

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
