export interface CommitEvent {
  did: string;
  collection: string;
  rkey: string;
  operation: 'create' | 'update' | 'delete';
  cid?: string;
  record?: unknown;
}

export interface JetstreamOpts {
  url: string;
  collections: string[];
  wantedDids?: string[];
  onCommit: (evt: CommitEvent) => void;
  onIdentity?: (did: string, handle: string | undefined) => void;
  onStatus?: (status: string) => void;
  signal: AbortSignal;
}

function buildUrl(opts: JetstreamOpts): string {
  const params = new URLSearchParams();
  for (const c of opts.collections) params.append('wantedCollections', c);
  for (const d of opts.wantedDids ?? []) params.append('wantedDids', d);
  const qs = params.toString();
  return qs ? `${opts.url}?${qs}` : opts.url;
}

function handleMessage(data: unknown, opts: JetstreamOpts): void {
  if (typeof data !== 'string') return;
  let msg: {
    kind?: string;
    did?: string;
    commit?: {
      operation?: string;
      collection?: string;
      rkey?: string;
      cid?: string;
      record?: unknown;
    };
    identity?: { handle?: string };
  };
  try {
    msg = JSON.parse(data);
  } catch {
    return;
  }

  if (msg.kind === 'commit' && msg.commit && msg.did) {
    const c = msg.commit;
    if (c.operation && c.collection && c.rkey) {
      opts.onCommit({
        did: msg.did,
        collection: c.collection,
        rkey: c.rkey,
        operation: c.operation as CommitEvent['operation'],
        cid: c.cid,
        record: c.record,
      });
    }
  } else if (msg.kind === 'identity' && msg.did) {
    opts.onIdentity?.(msg.did, msg.identity?.handle);
  }
}

// Connect to a Jetstream instance and stream events, reconnecting with backoff. Uses the
// global WebSocket (Node 24), so no dependency. Live tail only; cursor/replay is future work.
export function startJetstream(opts: JetstreamOpts): void {
  let ws: WebSocket | null = null;
  let backoff = 1000;

  const connect = () => {
    if (opts.signal.aborted) return;
    ws = new WebSocket(buildUrl(opts));
    ws.addEventListener('open', () => {
      backoff = 1000;
      opts.onStatus?.('connected');
    });
    ws.addEventListener('message', (ev) => handleMessage(ev.data, opts));
    ws.addEventListener('close', () => {
      if (opts.signal.aborted) return;
      opts.onStatus?.(`disconnected, reconnecting in ${backoff}ms`);
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30000);
    });
    ws.addEventListener('error', () => {
      try {
        ws?.close();
      } catch {
        // close() throwing on an already-closing socket is fine.
      }
    });
  };

  opts.signal.addEventListener('abort', () => {
    try {
      ws?.close();
    } catch {
      // ignore
    }
  });
  connect();
}
