import type { LabelerConfig } from '../config.ts';
import type { StoredReport } from '../db/reports.ts';
import { parseAtUri, type EnrichedSubject } from './enrich.ts';

// Coop's POST /api/v1/report envelope. The HTTP body validator only accepts
// reporter.kind === 'user', so external reports are attributed as user reports with the
// reporter DID. See Coop server/routes/reporting/ReportingRoutes.ts.
interface RawItemSubmission {
  id: string;
  typeId: string;
  data: Record<string, unknown>;
}
export interface CoopReport {
  reporter: { kind: 'user'; typeId: string; id: string };
  reportedAt: string;
  reportedForReason: { reason: string };
  reportedItem: RawItemSubmission;
  additionalItems?: RawItemSubmission[];
}

function accountItem(
  did: string,
  enrichment: EnrichedSubject | undefined,
  config: LabelerConfig,
): RawItemSubmission {
  return {
    id: did,
    typeId: config.coopAccountType,
    data: {
      did,
      handle: enrichment?.handle ?? did,
      isActive: true,
    },
  };
}

function recordItem(
  uri: string,
  cid: string | undefined,
  report: StoredReport,
  enrichment: EnrichedSubject | undefined,
  config: LabelerConfig,
): { item: RawItemSubmission; author?: RawItemSubmission } {
  const parsed = parseAtUri(uri);
  const authorDid = parsed?.authority ?? enrichment?.did ?? '';
  const value = (enrichment?.record?.value ?? {}) as Record<string, unknown>;
  const resolvedCid = cid ?? enrichment?.record?.cid;

  const data: Record<string, unknown> = {
    text: typeof value.text === 'string' ? value.text : '',
    authorDid: { id: authorDid, typeId: config.coopAccountType },
    rkey: parsed?.rkey ?? '',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : report.createdAt,
    atUri: uri,
    isLive: false,
  };
  if (resolvedCid) data.cid = resolvedCid;
  if (Array.isArray(value.langs)) data.langs = value.langs;

  return {
    item: { id: uri, typeId: config.coopPostType, data },
    // Include the author account so the post's authorDid reference resolves in Coop.
    author: authorDid ? accountItem(authorDid, enrichment, config) : undefined,
  };
}

// Map troposphere's stored report + enrichment onto Coop's /api/v1/report envelope.
export function toCoopReport(
  report: StoredReport,
  enrichment: EnrichedSubject | undefined,
  config: LabelerConfig,
): CoopReport {
  const reason = report.reason ? `${report.reasonType}: ${report.reason}` : report.reasonType;
  const base = {
    reporter: { kind: 'user' as const, typeId: config.coopAccountType, id: report.reportedBy },
    reportedAt: report.createdAt,
    reportedForReason: { reason },
  };

  if (report.subjectType === 'record' && report.subjectUri) {
    const { item, author } = recordItem(
      report.subjectUri,
      report.subjectCid,
      report,
      enrichment,
      config,
    );
    return { ...base, reportedItem: item, ...(author ? { additionalItems: [author] } : {}) };
  }

  return { ...base, reportedItem: accountItem(report.subjectDid ?? '', enrichment, config) };
}
