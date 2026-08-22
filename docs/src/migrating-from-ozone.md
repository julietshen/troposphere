# Migrating from Ozone

If you already run Ozone as your labeler, you can move label emission to `troposphere` while
keeping whatever moderation workflow you have. This page covers the moving parts.

## The two migration shapes

**Keep your Ozone DID.** Point the same labeler DID at `troposphere` by updating the DID
document's `#atproto_labeler` service endpoint to the new server, and configure
`troposphere` with that DID and a signing key the DID advertises. Consumers keep their
existing subscription; only the server behind the DID changes.

**Use a new labeler identity.** Stand up `troposphere` under a fresh `did:web` or `did:plc`
(see [Publishing your labeler identity](./identity.md)) and have consumers subscribe to the new
DID. Cleaner separation, but subscribers must re-subscribe.

Most operators find keeping the DID least disruptive.

## The signing key

Labels are only valid if signed by a key the DID document advertises. If you keep your DID and
want continuity, the DID document must advertise the key `troposphere` signs with. Either
import your existing labeler key into `troposphere` (set `LABELER_SIGNING_KEY` to it), or
publish `troposphere`'s new key as an additional `#atproto_label` verification method. Never
copy the key anywhere it does not need to be.

## Existing labels

Labels Ozone already published stay on the network; consumers have persisted them. There is no
automatic import of Ozone's label history into the `troposphere` store today, so:

- New labels and negations flow through `troposphere` from cutover onward.
- If you need `troposphere`'s store and firehose backfill to include historical labels, plan
  a one-time backfill from your Ozone label export into the `label` table, preserving the
  original signatures and timestamps. A helper for this is not yet provided.

## Reports

Both accept `com.atproto.moderation.createReport`. `troposphere` verifies the report, stores
it, and forwards it to your backend (see [Receiving reports](./receiving-reports.md)), rather
than housing a review console itself. Point the labeler DID at `troposphere` and reports flow
to your backend instead of Ozone's queue.

## Suggested cutover

1. Deploy `troposphere`, point your backend's label emission at `POST /admin/labels`, and set
   `REPORT_FORWARD_URL` to your backend's report intake.
2. Verify with the smoke test and by resolving your DID and subscribing.
3. Move the DID's `#atproto_labeler` service endpoint to the new server (or launch a new DID),
   which also routes inbound reports to `troposphere`.
4. Keep Ozone available until any label-history backfill you need is in place.
