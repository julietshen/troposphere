# Roadmap

`troposphere` today ingests content into Coop; signs, stores, serves, and streams labels;
accepts, enriches, and forwards reports; and enforces takedowns on your own PDS. These are the
pieces not yet built, in rough priority order.

## Custom lexicon ingestion

The ingestion worker maps `app.bsky.feed.post` and `app.bsky.actor.profile`. Projects with their
own record types would benefit from a configurable mapping so `com.yourapp.*` records ingest into
their own Coop item types.

## Jetstream cursor and replay

Ingestion is a live tail today. Persisting a cursor and using Jetstream v2 replay would let a
worker catch up after downtime without missing content.

## Multi-PDS enforcement

Enforcement targets a single configured PDS. Operators running content across several PDSes
would benefit from resolving the subject's PDS from its DID and selecting the matching admin
credential per target.

## Identity provisioning helpers

Tooling to publish and maintain the labeler identity: generating the `did:web` document,
updating a `did:plc` identity, and publishing and updating the `app.bsky.labeler.service`
declaration record, ideally kept in sync with the label values the labeler actually emits.

## Labeler declaration from Coop's labels

The Coop integration itself is built, in both directions: `POST /coop/action` takes Coop's
`CUSTOM_ACTION` body for labels and takedowns, and `REPORT_FORWARD_FORMAT=coop` posts Coop's
`/api/v1/report` envelope for reports. The one troposphere-side piece left is a helper that
generates the `app.bsky.labeler.service` declaration from the label values configured in Coop, so
the two stay in sync. (Creating the actions and queues inside Coop is operator setup, covered in
[Deploying with Coop](./deploying-with-coop.md), not troposphere code.)

## Multi-tenant operation

One deployment serving several labeler identities, keyed by DID, each with its own signing key,
label set, and backend routing. Today one deployment serves one labeler.

## Multi-instance live tail

The live firehose is delivered in-process. Fanning out labels across multiple instances behind
a load balancer needs a shared notification path such as Postgres `LISTEN`/`NOTIFY`. See
[Operations](./operations.md).

## Ozone history backfill

A helper to import an existing Ozone labeler's published labels into the store, preserving
signatures and timestamps, so `troposphere`'s firehose backfill includes history after a
[migration](./migrating-from-ozone.md).
