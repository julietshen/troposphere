export interface LabelerConfig {
  port: number;
  databaseUrl: string;
  did: string;
  signingKeyHex: string;
  adminToken: string;
  // Optional: where to forward inbound reports (a moderation backend). When unset,
  // reports are accepted and stored but not forwarded anywhere.
  reportForwardUrl?: string;
  reportForwardToken?: string;
  // Resolve the reported subject (DID to PDS getRecord) and attach content to the
  // forwarded report. On by default; only runs when forwarding is configured.
  enrichReports: boolean;
  // How to shape the forwarded report. 'raw' posts troposphere's own JSON with a Bearer
  // token; 'coop' posts Coop's POST /api/v1/report envelope with an X-API-KEY header.
  reportForwardFormat: 'raw' | 'coop';
  // Coop item type ids for the 'coop' format (the org's ATproto post/account types).
  coopPostType: string;
  coopAccountType: string;
  // Optional: the PDS to enforce takedowns on (your own PDS) and its admin password.
  // When unset, POST /admin/enforce returns 501.
  pdsUrl?: string;
  pdsAdminPassword?: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadConfig(): LabelerConfig {
  const did = required('LABELER_DID');
  if (!did.startsWith('did:')) {
    throw new Error(`LABELER_DID must be a DID (got: ${did})`);
  }

  const signingKeyHex = required('LABELER_SIGNING_KEY');
  if (!/^[0-9a-fA-F]{64}$/.test(signingKeyHex)) {
    throw new Error('LABELER_SIGNING_KEY must be a 64-character hex string (32 bytes)');
  }

  return {
    port: Number(process.env.PORT ?? 4100),
    databaseUrl: required('DATABASE_URL'),
    did,
    signingKeyHex,
    adminToken: required('ADMIN_TOKEN'),
    reportForwardUrl: process.env.REPORT_FORWARD_URL || undefined,
    reportForwardToken: process.env.REPORT_FORWARD_TOKEN || undefined,
    enrichReports: process.env.REPORT_ENRICH !== 'false',
    reportForwardFormat: process.env.REPORT_FORWARD_FORMAT === 'coop' ? 'coop' : 'raw',
    coopPostType: process.env.COOP_POST_TYPE || 'ATproto-post',
    coopAccountType: process.env.COOP_ACCOUNT_TYPE || 'ATproto-account',
    pdsUrl: process.env.PDS_URL || undefined,
    pdsAdminPassword: process.env.PDS_ADMIN_PASSWORD || undefined,
  };
}

// The optional ingestion worker (npm run ingest) has its own config so it does not require
// the labeler signing key. It streams Jetstream and posts items to Coop's /items/async.
export interface IngestConfig {
  jetstreamUrl: string;
  collections: string[];
  wantedDids?: string[];
  coopItemsUrl: string;
  coopItemsApiKey: string;
  batchSize: number;
  batchIntervalMs: number;
  coopPostType: string;
  coopAccountType: string;
}

export function loadIngestConfig(): IngestConfig {
  return {
    jetstreamUrl: process.env.JETSTREAM_URL || 'wss://jetstream2.us-east.bsky.network/subscribe',
    collections: (process.env.JETSTREAM_COLLECTIONS || 'app.bsky.feed.post,app.bsky.actor.profile')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    wantedDids: process.env.JETSTREAM_WANTED_DIDS
      ? process.env.JETSTREAM_WANTED_DIDS.split(',').map((d) => d.trim()).filter(Boolean)
      : undefined,
    coopItemsUrl: required('COOP_ITEMS_URL'),
    coopItemsApiKey: required('COOP_ITEMS_API_KEY'),
    batchSize: Number(process.env.INGEST_BATCH_SIZE ?? 50),
    batchIntervalMs: Number(process.env.INGEST_BATCH_INTERVAL_MS ?? 1000),
    coopPostType: process.env.COOP_POST_TYPE || 'ATproto-post',
    coopAccountType: process.env.COOP_ACCOUNT_TYPE || 'ATproto-account',
  };
}
