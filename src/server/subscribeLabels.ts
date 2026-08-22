import type { LabelStore, StoredLabel } from '../db/client.ts';
import { toWireLabel } from '../labels/sign.ts';

const LABELS_TYPE = 'com.atproto.label.subscribeLabels#labels';
const BACKFILL_BATCH = 500;

function frame(label: StoredLabel) {
  return { $type: LABELS_TYPE, seq: label.seq, labels: [toWireLabel(label)] };
}

// com.atproto.label.subscribeLabels — WebSocket firehose of signed labels.
// With a cursor, backfill from the store then join the live tail with no gap;
// without one, stream only labels created from now on.
export function subscribeLabelsHandler(store: LabelStore) {
  return async function* (ctx: { params: Record<string, unknown>; signal: AbortSignal }) {
    const { signal } = ctx;
    let cursor = ctx.params.cursor != null ? Number(ctx.params.cursor) : undefined;

    // Buffer live labels that arrive during backfill so none are dropped at cutover.
    const queue: StoredLabel[] = [];
    let wake: (() => void) | null = null;
    const off = store.onLabel((label) => {
      if (cursor !== undefined && label.seq <= cursor) return;
      queue.push(label);
      wake?.();
    });

    try {
      if (cursor !== undefined) {
        for (;;) {
          if (signal.aborted) return;
          const batch = await store.since(cursor, BACKFILL_BATCH);
          if (!batch.length) break;
          for (const label of batch) {
            yield frame(label);
            cursor = label.seq;
          }
        }
      }

      while (!signal.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
          wake = null;
          continue;
        }
        const label = queue.shift()!;
        if (cursor !== undefined && label.seq <= cursor) continue;
        cursor = label.seq;
        yield frame(label);
      }
    } finally {
      off();
    }
  };
}
