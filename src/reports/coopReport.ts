import type { LabelerConfig } from '../config.ts';
import type { StoredReport } from '../db/reports.ts';
import { parseAtUri, type EnrichedSubject } from './enrich.ts';
import { buildAccountItem, buildPostItem, type RawItemSubmission } from '../coop/items.ts';

// Coop's POST /api/v1/report envelope. The HTTP body validator only accepts
// reporter.kind === 'user', so external reports are attributed as user reports with the
// reporter DID. See Coop server/routes/reporting/ReportingRoutes.ts.
export interface CoopReport {
  reporter: { kind: 'user'; typeId: string; id: string };
  reportedAt: string;
  reportedForReason: { reason: string };
  reportedItem: RawItemSubmission;
  additionalItems?: RawItemSubmission[];
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
    const parsed = parseAtUri(report.subjectUri);
    const authorDid = parsed?.authority ?? enrichment?.did ?? '';
    const reportedItem = buildPostItem(
      authorDid,
      parsed?.rkey ?? '',
      report.subjectCid ?? enrichment?.record?.cid,
      enrichment?.record?.value,
      report.createdAt,
      config,
    );
    // Include the author account so the post's authorDid reference resolves in Coop.
    const additionalItems = authorDid
      ? [buildAccountItem(authorDid, enrichment?.handle, undefined, config)]
      : undefined;
    return { ...base, reportedItem, ...(additionalItems ? { additionalItems } : {}) };
  }

  return {
    ...base,
    reportedItem: buildAccountItem(report.subjectDid ?? '', enrichment?.handle, undefined, config),
  };
}
