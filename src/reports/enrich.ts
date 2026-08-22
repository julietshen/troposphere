import type { IdResolver } from '@atproto/identity';

export interface EnrichedSubject {
  did: string;
  handle?: string;
  pds?: string;
  record?: {
    uri: string;
    reportedCid?: string;
    cid?: string;
    value?: unknown;
    found: boolean;
  };
}

export interface ParsedAtUri {
  authority: string;
  collection: string;
  rkey: string;
}

export function parseAtUri(uri: string): ParsedAtUri | null {
  if (!uri.startsWith('at://')) return null;
  const [authority, collection, rkey] = uri.slice('at://'.length).split('/');
  if (!authority || !collection || !rkey) return null;
  return { authority, collection, rkey };
}

async function toDid(resolver: IdResolver, authority: string): Promise<string | undefined> {
  if (authority.startsWith('did:')) return authority;
  return (await resolver.handle.resolve(authority)) ?? undefined;
}

// Resolve a reported subject through its own identity (DID to PDS) and attach content, so a
// forwarded report carries the record itself, not just a URI. Fully AppView-agnostic: it reads
// the record from the subject's own PDS via com.atproto.repo.getRecord, no AppView involved.
export async function enrichRecordSubject(
  resolver: IdResolver,
  uri: string,
  reportedCid?: string,
): Promise<EnrichedSubject | undefined> {
  const parsed = parseAtUri(uri);
  if (!parsed) return undefined;

  const did = await toDid(resolver, parsed.authority);
  if (!did) return undefined;

  const data = await resolver.did.resolveAtprotoData(did);
  const enriched: EnrichedSubject = {
    did,
    handle: data.handle,
    pds: data.pds,
    record: { uri, reportedCid, found: false },
  };

  try {
    const url =
      `${data.pds}/xrpc/com.atproto.repo.getRecord` +
      `?repo=${encodeURIComponent(did)}` +
      `&collection=${encodeURIComponent(parsed.collection)}` +
      `&rkey=${encodeURIComponent(parsed.rkey)}`;
    const res = await fetch(url);
    if (res.ok) {
      const body = (await res.json()) as { cid?: string; value?: unknown };
      enriched.record = { uri, reportedCid, cid: body.cid, value: body.value, found: true };
    }
  } catch {
    // Best-effort: a deleted record or unreachable PDS leaves record.found = false.
  }
  return enriched;
}

export async function enrichAccountSubject(
  resolver: IdResolver,
  did: string,
): Promise<EnrichedSubject> {
  try {
    const data = await resolver.did.resolveAtprotoData(did);
    return { did, handle: data.handle, pds: data.pds };
  } catch {
    return { did };
  }
}

// Resolve the current CID of a record from its own PDS, so a label or takedown can pin to a
// specific version when the caller did not supply one. Best-effort: returns undefined on any
// failure (unresolvable identity, deleted record, unreachable PDS).
export async function resolveCurrentCid(
  resolver: IdResolver,
  uri: string,
): Promise<string | undefined> {
  const parsed = parseAtUri(uri);
  if (!parsed) return undefined;
  try {
    const did = await toDid(resolver, parsed.authority);
    if (!did) return undefined;
    const data = await resolver.did.resolveAtprotoData(did);
    const url =
      `${data.pds}/xrpc/com.atproto.repo.getRecord` +
      `?repo=${encodeURIComponent(did)}` +
      `&collection=${encodeURIComponent(parsed.collection)}` +
      `&rkey=${encodeURIComponent(parsed.rkey)}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { cid?: string };
    return body.cid;
  } catch {
    return undefined;
  }
}
