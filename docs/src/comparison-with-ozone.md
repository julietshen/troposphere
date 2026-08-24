# How it compares to Ozone

Ozone is the moderation system Bluesky builds and runs. It is two things in one deployment:

1. A **moderation console and backend**: a review queue, report handling, moderator
   accounts and roles, event history, takedowns, and a web UI, backed by its own database
   and the `tools.ozone.*` lexicons.
2. A **label emitter**: it holds the labeler signing key, mints signed `com.atproto.label`
   records, and publishes them over `subscribeLabels` and `queryLabels`.

`troposphere` covers the AT Protocol-facing parts: pulling content in for review, publishing
labels, taking reports, and enforcing takedowns. Coop is the moderation tool. troposphere is not
just a labeler, and it is not a console; together with Coop it replaces Ozone.

| | Ozone | troposphere |
| --- | --- | --- |
| Moderation tool / queue | Built in | Coop (the tool troposphere works with) |
| Ingest content for review | Bluesky's infra feeds it | Yes (Jetstream worker) |
| Report intake (`createReport`) | Built in (`tools.ozone.*`) | Yes; enriched and forwarded to Coop |
| Signs and serves labels | Yes | Yes |
| `subscribeLabels` firehose | Yes | Yes |
| `queryLabels` | Yes | Yes |
| Takedowns on your own PDS | Yes | Yes (`POST /admin/enforce`) |
| Data model you must adopt | Ozone's | None; plain HTTP APIs |
| Drive it from your own tooling | Not the primary path | The primary path |

For this project, [Coop](https://github.com/roostorg/coop) plays the role Ozone's UI would: the
review queue, reviewer roles, and event history. `troposphere` is the atproto plumbing Coop
uses to publish labels, receive reports, and enforce takedowns.

## When to use which

Use **Ozone** if you want Bluesky's moderation console and are happy to run its stack.

Use **Coop + troposphere** if you want to build your moderation workflow in
[Coop](https://github.com/roostorg/coop) - its review queues, automated enforcement rules,
matching banks, reviewer roles - and have it act on AT Protocol content. Coop is where the
work happens; troposphere connects that workflow to the network, so content flows in and
labels, reports, and takedowns flow out. You do not bring your own queue or rules; you build
them in Coop.

## What stays the same for consumers

To an AppView or client subscribing to your labeler, there is no difference. A labeler is
identified by its DID and speaks `subscribeLabels` and `queryLabels`. Consumers do not know
or care whether Ozone or `troposphere` produced a label, as long as it is signed by the key
the labeler's DID document advertises.
