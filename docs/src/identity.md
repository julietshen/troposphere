# Publishing your labeler identity

`troposphere` signs labels, but the network only trusts them if the labeler's DID document
advertises the matching signing key and a service endpoint pointing at your server. This is
independent of the software: it is how atproto establishes that a given DID is a labeler.

You need to do three things:

1. Advertise the `#atproto_label` verification method (the `publicKeyMultibase` from
   `npm run keygen`).
2. Advertise an `#atproto_labeler` service endpoint (type `AtprotoLabeler`) pointing at your
   server's public URL.
3. Publish an `app.bsky.labeler.service` declaration record so clients can discover your
   labeler and the label values it uses.

Two DID methods are supported. Provisioning helpers are on the [roadmap](./roadmap.md); for
now the steps are manual and documented here.

## Option A: did:web (recommended for self-hosting)

`did:web` ties the identity to a domain you control, with no dependency on the PLC directory.
Good for a project standing up its own labeler under its own domain.

Set `LABELER_DID=did:web:labeler.example.com` and host a document at
`https://labeler.example.com/.well-known/did.json`:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1"
  ],
  "id": "did:web:labeler.example.com",
  "verificationMethod": [
    {
      "id": "did:web:labeler.example.com#atproto_label",
      "type": "Multikey",
      "controller": "did:web:labeler.example.com",
      "publicKeyMultibase": "zQ3sh..."
    }
  ],
  "service": [
    {
      "id": "#atproto_labeler",
      "type": "AtprotoLabeler",
      "serviceEndpoint": "https://labeler.example.com"
    }
  ]
}
```

The `serviceEndpoint` is the host of this server, with no path.

> **Note on the declaration record.** The `app.bsky.labeler.service` record lives in a repo
> keyed to the labeler DID. A bare `did:web` with no PDS has nowhere to hold it, so the
> record is the one rough edge of the `did:web` path. Options: run a PDS for the labeler
> account, or rely on the DID-document service and `queryLabels` alone (clients can still read
> labels, but the polished in-app subscribe experience that reads the declaration is degraded).
> A helper for this is on the roadmap.

## Option B: did:plc (portable)

`did:plc` is portable across domains and has key-recovery through the PLC directory. This is
the path Bluesky's own tooling assumes, and the labeler account is a normal PDS account, so
it has a repo for the declaration record.

Set `LABELER_DID=did:plc:...` and update the account's PLC identity to add the same
`#atproto_label` key and `#atproto_labeler` service entry as above.

## The declaration record

Whichever DID method you use, publish an `app.bsky.labeler.service` record at rkey `self` in
the labeler's repo, listing the label values you use:

```json
{
  "$type": "app.bsky.labeler.service",
  "policies": {
    "labelValues": ["spam", "nudity"]
  },
  "createdAt": "2026-08-22T00:00:00.000Z"
}
```

You can also declare `reasonTypes` and `subjectTypes` to scope what reports the labeler
accepts. A future helper will keep this record in sync with the label values `troposphere`
actually emits.

## Verifying

After publishing, resolve your DID and confirm the key and service are present. Labels your
server emits should now verify against the DID for any consumer, and the labeler should be
subscribable by its DID.
