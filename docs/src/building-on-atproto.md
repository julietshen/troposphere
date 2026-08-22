# Building on the AT Protocol

This guide is for someone building their own thing on the AT Protocol: your own record types
(lexicons), maybe your own PDS, maybe your own AppView. It explains where `troposphere` fits and,
just as importantly, where it does not assume you are Bluesky.

The short version: `troposphere` is lexicon-, PDS-, and AppView-agnostic. It handles labeling,
reporting, and enforcement for your stack, whatever that stack is.

## What is generic

**Your own record types.** A label points at an AT-URI (`at://did/<collection>/<rkey>`) or a
bare DID. Nothing in `troposphere` inspects the collection, so labeling a `com.yourapp.recipe` or
a `site.standard.document` works exactly like labeling an `app.bsky.feed.post`. The label
*values* are your own vocabulary too. You are not limited to Bluesky's record types or label set.

**Your own PDS.** Report intake resolves the reporter through their DID (`did:plc` or `did:web`),
so a report proxied from any PDS authenticates. Enrichment reads the reported record from the
subject's *own* PDS. Enforcement takes content down on *your* PDS. None of these paths call a
Bluesky AppView.

**Your own AppView.** Your AppView subscribes to your labeler by its DID over the standard
`subscribeLabels` firehose, the same way Bluesky's AppView would. `queryLabels` is the same
standard endpoint. `troposphere` does not care who is consuming.

## What you provide

- **A labeler identity.** A DID whose document advertises your signing key and this server. Use
  `did:web` under your own domain for full self-hosting, or `did:plc` for portability. See
  [Publishing your labeler identity](./identity.md).
- **A moderation backend.** Something that decides what to label or take down. That can be
  [Coop](./deploying-with-coop.md), a classifier, a rules engine, or your own tooling. See
  [Using it from a moderation backend](./driving-from-a-backend.md).
- **Label handling in your AppView.** `troposphere` emits standard labels; your AppView has to
  read them and decide what to do (hide, warn, badge). That interpretation is your app's job, as
  it is for any labeler.

## What troposphere does not do

- **It does not interpret labels for you.** Emitting a `spam` label does nothing on its own; your
  AppView (or Bluesky's, if you publish to that ecosystem) decides what a label means in the UI.
- **It does not define custom moderation lexicons.** It implements the standard
  `com.atproto.moderation.createReport`. If you invent your own report record type, you would
  handle that separately. Using the standard report procedure keeps you interoperable with
  existing clients.
- **It does not resolve enforcement across many PDSes.** Enforcement targets one configured PDS
  (yours). Multi-PDS targeting is on the [roadmap](./roadmap.md).

## A walkthrough for a custom stack

Say you run `yourapp.example` with a lexicon `com.yourapp.post`, your own PDS, and your own
AppView.

1. **Create a labeler identity** at `did:web:labeler.yourapp.example` and publish its DID document
   and `app.bsky.labeler.service` declaration with your label values. See
   [Publishing your labeler identity](./identity.md).
2. **Deploy `troposphere`** with that DID and a signing key, a Postgres, and (for enforcement)
   `PDS_URL`/`PDS_ADMIN_PASSWORD` pointing at your PDS. See [Getting started](./getting-started.md).
3. **Point it at your backend.** Set `REPORT_FORWARD_URL` to your backend so inbound reports
   arrive there. Have your backend call `POST /admin/labels` to publish a label and
   `POST /admin/enforce` to take content down.
4. **Label your own records.** A decision to label `at://did:.../com.yourapp.post/abc` is one
   call; the collection being `com.yourapp.post` changes nothing.
5. **Consume labels in your AppView.** Subscribe to `did:web:labeler.yourapp.example` over
   `subscribeLabels`, hydrate labels onto your `com.yourapp.post` views, and render them however
   your product wants.

At no point in this does Bluesky's infrastructure sit in the path. `troposphere` is the moderation
labeler for *your* atmosphere.
