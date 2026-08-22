import { AuthRequiredError, InvalidRequestError, verifyJwt } from '@atproto/xrpc-server';
import type { IdResolver } from '@atproto/identity';
import type { Request } from 'express';
import type { ReportStore } from '../db/reports.ts';
import type { LabelerConfig } from '../config.ts';
import { signingKeyResolver } from '../identity/resolver.ts';
import {
  enrichAccountSubject,
  enrichRecordSubject,
  type EnrichedSubject,
} from '../reports/enrich.ts';
import { toCoopReport } from '../reports/coopReport.ts';
import type { StoredReport } from '../db/reports.ts';

const NSID = 'com.atproto.moderation.createReport';

// Verify the inter-service auth JWT a PDS attaches when it proxies a report to this
// labeler. The signing key is resolved from the reporter's DID, so a report from any
// AT Protocol AppView authenticates, not only Bluesky's. Returns the reporter DID.
export function createReportAuth(config: LabelerConfig, resolver: IdResolver) {
  const getSigningKey = signingKeyResolver(resolver);
  return async (ctx: { req: Request }) => {
    const header = ctx.req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AuthRequiredError('Missing bearer auth token');
    }
    const payload = await verifyJwt(header.slice('Bearer '.length), config.did, NSID, getSigningKey);
    return { credentials: { did: payload.iss.split('#')[0]! } };
  };
}

interface RepoRef {
  did: string;
}
interface StrongRef {
  uri: string;
  cid: string;
}
interface CreateReportInput {
  reasonType: string;
  reason?: string;
  subject: RepoRef | StrongRef;
}

function isStrongRef(subject: RepoRef | StrongRef): subject is StrongRef {
  return typeof (subject as StrongRef).uri === 'string';
}

// com.atproto.moderation.createReport — accept a report, persist it, optionally enrich and
// forward it to a moderation backend, and echo the created report back per the lexicon.
export function createReportHandler(
  reports: ReportStore,
  config: LabelerConfig,
  resolver: IdResolver,
) {
  return async (ctx: { auth: { credentials: unknown }; input: unknown }) => {
    const reportedBy = (ctx.auth.credentials as { did: string }).did;
    const input = (ctx.input as { body: CreateReportInput }).body;
    const subject = input.subject;

    const stored = await reports.insert({
      reasonType: input.reasonType,
      reason: input.reason,
      reportedBy,
      ...(isStrongRef(subject)
        ? { subjectType: 'record' as const, subjectUri: subject.uri, subjectCid: subject.cid }
        : (subject as RepoRef)?.did
          ? { subjectType: 'account' as const, subjectDid: (subject as RepoRef).did }
          : (() => {
              throw new InvalidRequestError('subject must be a repoRef or strongRef');
            })()),
    });

    const enrichment = await enrich(config, resolver, subject);
    await forward(config, stored, subject, enrichment);

    return {
      encoding: 'application/json' as const,
      body: {
        id: stored.id,
        reasonType: stored.reasonType,
        ...(stored.reason ? { reason: stored.reason } : {}),
        subject,
        reportedBy,
        createdAt: stored.createdAt,
      },
    };
  };
}

// Resolve the subject to its content, best-effort. Only runs when forwarding is configured
// (enrichment output is only consumed by the forwarded payload) and enrichment is enabled.
async function enrich(
  config: LabelerConfig,
  resolver: IdResolver,
  subject: RepoRef | StrongRef,
): Promise<EnrichedSubject | undefined> {
  if (!config.reportForwardUrl || !config.enrichReports) return undefined;
  try {
    return isStrongRef(subject)
      ? await enrichRecordSubject(resolver, subject.uri, subject.cid)
      : await enrichAccountSubject(resolver, subject.did);
  } catch (err) {
    console.error('report enrichment failed:', err);
    return undefined;
  }
}

// Best-effort forward to a backend. The report is already durably stored, so a backend
// outage does not lose the report or fail the reporter's request; the backend can
// reconcile from the store. The 'coop' format posts Coop's /api/v1/report envelope with an
// X-API-KEY header; 'raw' posts troposphere's own JSON with a Bearer token.
async function forward(
  config: LabelerConfig,
  stored: StoredReport,
  subject: unknown,
  enrichment: EnrichedSubject | undefined,
): Promise<void> {
  if (!config.reportForwardUrl) return;
  const isCoop = config.reportForwardFormat === 'coop';
  const token = config.reportForwardToken;
  try {
    await fetch(config.reportForwardUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? (isCoop ? { 'x-api-key': token } : { authorization: `Bearer ${token}` }) : {}),
      },
      body: JSON.stringify(
        isCoop
          ? toCoopReport(stored, enrichment, config)
          : { ...stored, subject, ...(enrichment ? { enrichment } : {}) },
      ),
    });
  } catch (err) {
    console.error(`report ${stored.id} forward failed:`, err);
  }
}
