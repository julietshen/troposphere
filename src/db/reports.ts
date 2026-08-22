import type pg from 'pg';

export interface ReportInput {
  reasonType: string;
  reason?: string;
  subjectType: 'account' | 'record';
  subjectDid?: string;
  subjectUri?: string;
  subjectCid?: string;
  reportedBy: string;
}

export interface StoredReport extends ReportInput {
  id: number;
  createdAt: string;
}

interface ReportRow {
  id: string;
  reason_type: string;
  reason: string | null;
  subject_type: string;
  subject_did: string | null;
  subject_uri: string | null;
  subject_cid: string | null;
  reported_by: string;
  created_at: Date;
}

export class ReportStore {
  private pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async insert(input: ReportInput): Promise<StoredReport> {
    const { rows } = await this.pool.query<ReportRow>(
      `insert into report
         (reason_type, reason, subject_type, subject_did, subject_uri, subject_cid, reported_by)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, created_at`,
      [
        input.reasonType,
        input.reason ?? null,
        input.subjectType,
        input.subjectDid ?? null,
        input.subjectUri ?? null,
        input.subjectCid ?? null,
        input.reportedBy,
      ],
    );
    const row = rows[0]!;
    return { ...input, id: Number(row.id), createdAt: row.created_at.toISOString() };
  }
}
