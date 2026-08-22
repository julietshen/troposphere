import express, { type Express } from 'express';
import { schemas } from '@atproto/api';
import { createServer } from '@atproto/xrpc-server';
import type { Secp256k1Keypair } from '@atproto/crypto';
import type { IdResolver } from '@atproto/identity';
import type { LabelStore } from '../db/client.ts';
import type { ReportStore } from '../db/reports.ts';
import type { LabelerConfig } from '../config.ts';
import { queryLabelsHandler } from './queryLabels.ts';
import { subscribeLabelsHandler } from './subscribeLabels.ts';
import { adminLabelsHandler } from './adminLabels.ts';
import { createReportAuth, createReportHandler } from './createReport.ts';
import { enforceHandler } from './enforce.ts';
import { coopActionHandler } from './coop.ts';

export interface ServerDeps {
  labels: LabelStore;
  reports: ReportStore;
  resolver: IdResolver;
  keypair: Secp256k1Keypair;
  config: LabelerConfig;
}

export function buildApp({ labels, reports, resolver, keypair, config }: ServerDeps): Express {
  const server = createServer(schemas, { validateResponse: false });

  server.method('com.atproto.label.queryLabels', queryLabelsHandler(labels));
  server.streamMethod('com.atproto.label.subscribeLabels', subscribeLabelsHandler(labels));
  server.method('com.atproto.moderation.createReport', {
    auth: createReportAuth(config, resolver),
    handler: createReportHandler(reports, config, resolver),
  });

  server.router.get('/health', (_req, res) => {
    res.json({ status: 'ok', did: config.did });
  });
  server.router.post('/admin/labels', express.json(), adminLabelsHandler(labels, keypair, config));
  server.router.post('/admin/enforce', express.json(), enforceHandler(config));
  server.router.post('/coop/action', express.json(), coopActionHandler(labels, keypair, config, resolver));

  // Mounting the xrpc router on a parent app fires its 'mount' event, which is how
  // xrpc-server installs the WebSocket upgrade handler for subscribeLabels. Calling
  // server.listen() directly would skip that and the firehose would 404.
  const app = express();
  app.use(server.router);
  return app;
}
