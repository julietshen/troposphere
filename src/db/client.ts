import { EventEmitter } from 'node:events';
import pg from 'pg';
import type { SignedLabel } from '../labels/sign.ts';

export interface StoredLabel extends SignedLabel {
  seq: number;
}

export interface QueryOpts {
  uriPatterns: string[];
  sources?: string[];
  limit: number;
  cursor: number;
}

interface LabelRow {
  seq: string;
  src: string;
  uri: string;
  cid: string | null;
  val: string;
  neg: boolean;
  cts: string;
  exp: string | null;
  sig: Buffer;
}

function rowToStored(row: LabelRow): StoredLabel {
  return {
    ver: 1,
    seq: Number(row.seq),
    src: row.src,
    uri: row.uri,
    ...(row.cid ? { cid: row.cid } : {}),
    val: row.val,
    ...(row.neg ? { neg: true } : {}),
    cts: row.cts,
    ...(row.exp ? { exp: row.exp } : {}),
    sig: row.sig,
  };
}

// Escape LIKE metacharacters so a uriPattern prefix is matched literally.
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export class LabelStore {
  private pool: pg.Pool;
  private emitter = new EventEmitter();

  constructor(pool: pg.Pool) {
    this.pool = pool;
    // Unbounded: one listener per open subscribeLabels stream.
    this.emitter.setMaxListeners(0);
  }

  async insert(label: SignedLabel): Promise<StoredLabel> {
    const { rows } = await this.pool.query<{ seq: string }>(
      `insert into label (src, uri, cid, val, neg, cts, exp, sig)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning seq`,
      [
        label.src,
        label.uri,
        label.cid ?? null,
        label.val,
        label.neg ?? false,
        label.cts,
        label.exp ?? null,
        Buffer.from(label.sig),
      ],
    );
    const seq = Number(rows[0]!.seq);
    const stored: StoredLabel = { ...label, seq };
    this.emitter.emit('label', stored);
    return stored;
  }

  async query(opts: QueryOpts): Promise<StoredLabel[]> {
    const conds: string[] = [];
    const vals: unknown[] = [];

    const patterns = opts.uriPatterns ?? [];
    const matchAll = patterns.some((p) => p === '*');
    if (patterns.length && !matchAll) {
      const uriConds: string[] = [];
      for (const p of patterns) {
        if (p.endsWith('*')) {
          vals.push(`${escapeLike(p.slice(0, -1))}%`);
          uriConds.push(`uri LIKE $${vals.length}`);
        } else {
          vals.push(p);
          uriConds.push(`uri = $${vals.length}`);
        }
      }
      conds.push(`(${uriConds.join(' OR ')})`);
    }

    if (opts.sources?.length) {
      vals.push(opts.sources);
      conds.push(`src = ANY($${vals.length})`);
    }

    vals.push(opts.cursor);
    conds.push(`seq > $${vals.length}`);

    vals.push(opts.limit);
    const where = conds.length ? `where ${conds.join(' and ')}` : '';
    const { rows } = await this.pool.query<LabelRow>(
      `select * from label ${where} order by seq asc limit $${vals.length}`,
      vals,
    );
    return rows.map(rowToStored);
  }

  // Labels with seq strictly greater than cursor, ascending. Used to backfill a
  // subscribeLabels consumer before it joins the live tail.
  async since(cursor: number, limit: number): Promise<StoredLabel[]> {
    const { rows } = await this.pool.query<LabelRow>(
      `select * from label where seq > $1 order by seq asc limit $2`,
      [cursor, limit],
    );
    return rows.map(rowToStored);
  }

  async maxSeq(): Promise<number> {
    const { rows } = await this.pool.query<{ max: string | null }>(
      `select max(seq) as max from label`,
    );
    return rows[0]?.max ? Number(rows[0].max) : 0;
  }

  onLabel(fn: (label: StoredLabel) => void): () => void {
    this.emitter.on('label', fn);
    return () => this.emitter.off('label', fn);
  }
}
