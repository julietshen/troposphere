# Enforcement (takedowns)

A label is advisory: it attaches metadata that consumers may act on. Enforcement is different.
It removes or restores content on a PDS you control. `troposphere` exposes both levers so a
backend can choose per case: label it, take it down, or both.

Enforcement targets the operator's **own** PDS. You can only take down content on a PDS you hold
admin credentials for, which is the point: you enforce on your own infrastructure. For
third-party content (for example a post hosted on someone else's PDS), labeling is the only
lever anyone has.

## Enabling it

Set the PDS you administer and its admin password. Until both are set, `POST /admin/enforce`
returns `501`.

```bash
PDS_URL=https://pds.example.com
PDS_ADMIN_PASSWORD=...
```

## Taking down a record or account

`POST /admin/enforce`, authenticated with the same admin bearer token as the label API.

```bash
# take down a record
curl -X POST https://labeler.example.com/admin/enforce \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{
        "subject": { "uri": "at://did:plc:.../app.bsky.feed.post/abc", "cid": "bafy..." },
        "takedown": true,
        "ref": "report:42"
      }'

# take down an account
  -d '{ "subject": { "did": "did:plc:..." }, "takedown": true }'

# restore (reverse a takedown)
  -d '{ "subject": { "did": "did:plc:..." }, "takedown": false }'
```

- `subject`: a record (`uri` + `cid`) or an account (`did`).
- `takedown`: `true` takes down, `false` restores. Defaults to `true`.
- `ref`: an optional reference string (for example your internal case id) recorded on the PDS.

## What happens under the hood

The labeler calls `com.atproto.admin.updateSubjectStatus` on your PDS with HTTP Basic admin
auth, mapping the subject to a `strongRef` (record) or `repoRef` (account) and setting the
takedown state. A non-2xx response from the PDS is surfaced as a `502` so your backend knows the
takedown did not apply.

## Label and enforce together

The two are independent calls, so a backend decision can do either or both. A common pattern:
label content for consumers who subscribe to your labeler, and take it down on your own PDS so
it stops being served from your infrastructure.
