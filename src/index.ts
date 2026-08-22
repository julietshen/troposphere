import pg from 'pg';
import { loadConfig } from './config.ts';
import { loadSigningKey, publicKeyMultibase } from './labels/keypair.ts';
import { LabelStore } from './db/client.ts';
import { ReportStore } from './db/reports.ts';
import { createIdResolver } from './identity/resolver.ts';
import { buildApp } from './server/index.ts';

const config = loadConfig();
const keypair = await loadSigningKey(config.signingKeyHex);
const pool = new pg.Pool({ connectionString: config.databaseUrl });
const app = buildApp({
  labels: new LabelStore(pool),
  reports: new ReportStore(pool),
  resolver: createIdResolver(),
  keypair,
  config,
});

const httpServer = app.listen(config.port, () => {
  console.log(`troposphere listening on :${config.port}`);
  console.log(`  labeler DID:          ${config.did}`);
  console.log(`  #atproto_label key:   ${publicKeyMultibase(keypair)}`);
  console.log(`  publish this key + an #atproto_labeler service in the DID document.`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down.`);
  httpServer.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
