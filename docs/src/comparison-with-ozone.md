# How it compares to Ozone

Ozone is the moderation system Bluesky builds and runs. It is two things in one deployment:

1. A **moderation console and backend**: a review queue, report handling, moderator
   accounts and roles, event history, takedowns, and a web UI, backed by its own database
   and the `tools.ozone.*` lexicons.
2. A **label emitter**: it holds the labeler signing key, mints signed `com.atproto.label`
   records, and publishes them over `subscribeLabels` and `queryLabels`.

`troposphere` is only the second half, deliberately.

| | Ozone | troposphere |
| --- | --- | --- |
| Moderation console / queue | Built in | Bring your own backend (Coop is the reference) |
| Report intake (`createReport`) | Built in (`tools.ozone.*`) | Yes; enriched and forwarded to your backend |
| Signs and serves labels | Yes | Yes |
| `subscribeLabels` firehose | Yes | Yes |
| `queryLabels` | Yes | Yes |
| Takedowns on your own PDS | Yes | Yes (`POST /admin/enforce`) |
| Data model you must adopt | Ozone's | None; plain HTTP APIs |
| Drive it from your own tooling | Not the primary path | The primary path |

For this project, [Coop](https://github.com/roostorg/coop) plays the role Ozone's UI would: the
review queue, reviewer roles, and event history. `troposphere` is the protocol-facing arm Coop
drives to publish labels, receive reports, and enforce takedowns.

## When to use which

Use **Ozone** if you want a complete, batteries-included moderation console and are happy
to run its stack.

Use **troposphere** if you already have (or want to build) your own moderation workflow,
and you only need the atproto-facing labeler. You keep your queue, your rules, your
reviewers, and your database, and call one HTTP endpoint to publish labels. This is the
natural fit when a platform like [Coop](https://github.com/roostorg/coop) is the backend,
or when you have a classifier or bespoke tooling that decides what to label.

## What stays the same for consumers

To an AppView or client subscribing to your labeler, there is no difference. A labeler is
identified by its DID and speaks `subscribeLabels` and `queryLabels`. Consumers do not know
or care whether Ozone or `troposphere` produced a label, as long as it is signed by the key
the labeler's DID document advertises.
