// Builders for Coop item submissions (RawItemSubmission), shared by the report forwarder
// (which puts them in a report envelope) and the ingestion worker (which posts them to
// /items/async). Keeping one builder means a reported post and an ingested post look
// identical to Coop.

export interface RawItemSubmission {
  id: string;
  typeId: string;
  data: Record<string, unknown>;
}

export interface CoopItemTypes {
  coopPostType: string;
  coopAccountType: string;
}

// An app.bsky.feed.post (or any post-shaped record) as an ATproto-post item. `record` is the
// raw atproto record; `fallbackCreatedAt` is used when the record has no createdAt.
export function buildPostItem(
  authorDid: string,
  rkey: string,
  cid: string | undefined,
  record: unknown,
  fallbackCreatedAt: string,
  types: CoopItemTypes,
): RawItemSubmission {
  const r = (record ?? {}) as Record<string, unknown>;
  const atUri = `at://${authorDid}/app.bsky.feed.post/${rkey}`;
  const data: Record<string, unknown> = {
    text: typeof r.text === 'string' ? r.text : '',
    authorDid: { id: authorDid, typeId: types.coopAccountType },
    rkey,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : fallbackCreatedAt,
    atUri,
    isLive: false,
  };
  if (cid) data.cid = cid;
  if (Array.isArray(r.langs)) data.langs = r.langs;
  return { id: atUri, typeId: types.coopPostType, data };
}

// An account as an ATproto-account item. `handle` falls back to the DID (the field is
// required and not always known); `record` is an optional app.bsky.actor.profile record.
export function buildAccountItem(
  did: string,
  handle: string | undefined,
  record: unknown,
  types: CoopItemTypes,
): RawItemSubmission {
  const r = (record ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {
    did,
    handle: handle ?? did,
    isActive: true,
  };
  if (typeof r.displayName === 'string') data.displayName = r.displayName;
  if (typeof r.description === 'string') data.description = r.description;
  return { id: did, typeId: types.coopAccountType, data };
}
