import { IdResolver } from '@atproto/identity';

// A DID resolver for verifying inbound requests. It resolves any AT Protocol DID
// (did:plc or did:web) to its atproto signing key, so reports proxied from any
// AppView's PDS can be authenticated, not just Bluesky's.
export function createIdResolver(): IdResolver {
  return new IdResolver();
}

// The getSigningKey callback verifyJwt expects: iss DID -> its signing key.
export function signingKeyResolver(resolver: IdResolver) {
  return (iss: string, forceRefresh: boolean): Promise<string> =>
    resolver.did.resolveAtprotoKey(iss, forceRefresh);
}
