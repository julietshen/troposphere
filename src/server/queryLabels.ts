import type { LabelStore } from '../db/client.ts';
import { toWireLabel } from '../labels/sign.ts';

const MAX_LIMIT = 250;
const DEFAULT_LIMIT = 50;

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return [];
}

// com.atproto.label.queryLabels — public HTTP. cursor is a stringified seq.
export function queryLabelsHandler(store: LabelStore) {
  return async (ctx: { params: Record<string, unknown> }) => {
    const uriPatterns = asStringArray(ctx.params.uriPatterns);
    const sources = asStringArray(ctx.params.sources);
    const limit = Math.min(Number(ctx.params.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = ctx.params.cursor ? Number(ctx.params.cursor) : 0;

    const labels = await store.query({
      uriPatterns,
      sources: sources.length ? sources : undefined,
      limit,
      cursor,
    });

    const last = labels.at(-1);
    return {
      encoding: 'application/json' as const,
      body: {
        cursor: last ? String(last.seq) : undefined,
        labels: labels.map(toWireLabel),
      },
    };
  };
}
