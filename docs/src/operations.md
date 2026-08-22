# Operations

## The signing key is the identity

The labeler's whole trust model rests on its signing key. Anyone with the key can publish
labels as your labeler. Treat `LABELER_SIGNING_KEY` like any high-value secret:

- Store it in your platform's secret manager, not in the repo or an image.
- Give it only to the labeler process. Backends drive the labeler over the admin API and never
  need the signing key.
- Have a rotation plan. Rotating means publishing a new `#atproto_label` key in the DID
  document. `did:plc` offers key recovery through the PLC directory; `did:web` rotation is a
  document edit.

## The label store is durable by design

Emitted labels are permanent on the network: consumers persist them, and negation, not
deletion, is how you retract. The Postgres store is the labeler's record of what it has
published and the source of firehose backfill. Back it up. Do not treat it as a cache you can
drop, or consumers and your store will disagree about history.

## Deployment shape

- One process serves both the public `/xrpc/` endpoints and the `/admin/labels` API. Put the
  admin API behind your network boundary so only your backend can reach it; the `/xrpc/`
  endpoints are meant to be public.
- Terminate TLS in front of the service. The atproto ecosystem expects HTTPS on the default
  port for labeler endpoints.
- The `serviceEndpoint` in your DID document must be the public URL clients reach, with no
  path.

## A note on scale

The live tail is delivered in-process: a label emitted through the admin API is pushed to the
`subscribeLabels` streams connected to that same process. A single instance handles this
cleanly. Running multiple instances behind a load balancer, where a label emitted on one
instance must reach subscribers on another, needs a shared notification path (for example
Postgres `LISTEN`/`NOTIFY`). That is a known extension point, not yet built.

## Health

`GET /health` returns `{ "status": "ok", "did": "<labeler did>" }` for load-balancer checks.
