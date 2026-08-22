import type { Request, Response } from 'express';
import type { LabelerConfig } from '../config.ts';

interface EnforceBody {
  subject?: { uri?: unknown; cid?: unknown; did?: unknown };
  takedown?: unknown;
  ref?: unknown;
}

export type EnforceSubject =
  | { $type: 'com.atproto.repo.strongRef'; uri: string; cid: string }
  | { $type: 'com.atproto.admin.defs#repoRef'; did: string };

// Map a loose subject ({uri,cid} record, {did} account, or a bare did in uri) to the strongRef
// or repoRef the PDS admin API expects. Returns an error string on an invalid subject.
export function buildEnforceSubject(s: {
  uri?: unknown;
  cid?: unknown;
  did?: unknown;
}): EnforceSubject | { error: string } {
  if (typeof s.uri === 'string' && s.uri.startsWith('at://')) {
    if (typeof s.cid !== 'string') return { error: 'record subject requires cid' };
    return { $type: 'com.atproto.repo.strongRef', uri: s.uri, cid: s.cid };
  }
  if (typeof s.did === 'string') {
    return { $type: 'com.atproto.admin.defs#repoRef', did: s.did };
  }
  if (typeof s.uri === 'string' && s.uri.startsWith('did:')) {
    return { $type: 'com.atproto.admin.defs#repoRef', did: s.uri };
  }
  return { error: 'subject must be a record {uri, cid} or account {did}' };
}

export interface EnforceResult {
  status: number;
  body: unknown;
}

// Take down (or restore) a subject on the operator's own PDS via its admin
// com.atproto.admin.updateSubjectStatus. This only works against a PDS you hold admin
// credentials for, which is the point: you enforce on your own infrastructure.
export async function applyTakedown(
  config: LabelerConfig,
  subject: EnforceSubject,
  applied: boolean,
  ref: string | undefined,
): Promise<EnforceResult> {
  if (!config.pdsUrl || !config.pdsAdminPassword) {
    return {
      status: 501,
      body: {
        error: 'NotConfigured',
        message: 'Set PDS_URL and PDS_ADMIN_PASSWORD to enable enforcement.',
      },
    };
  }
  const basic = `Basic ${Buffer.from(`admin:${config.pdsAdminPassword}`).toString('base64')}`;
  try {
    const pdsRes = await fetch(`${config.pdsUrl}/xrpc/com.atproto.admin.updateSubjectStatus`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: basic },
      body: JSON.stringify({ subject, takedown: { applied, ...(ref ? { ref } : {}) } }),
    });
    if (!pdsRes.ok) {
      return { status: 502, body: { error: 'PdsError', status: pdsRes.status, body: await pdsRes.text() } };
    }
    return { status: 200, body: { enforced: { applied, subject } } };
  } catch (err) {
    return { status: 502, body: { error: 'PdsUnreachable', message: String(err) } };
  }
}

// POST /admin/enforce — the enforcement lever, alongside /admin/labels.
export function enforceHandler(config: LabelerConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    if (req.header('authorization') !== `Bearer ${config.adminToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = (req.body ?? {}) as EnforceBody;
    const applied = body.takedown !== false; // default: take down; false restores
    const ref = typeof body.ref === 'string' ? body.ref : undefined;

    const subject = buildEnforceSubject(body.subject ?? {});
    if ('error' in subject) {
      res.status(400).json({ error: 'InvalidRequest', message: subject.error });
      return;
    }

    const result = await applyTakedown(config, subject, applied, ref);
    res.status(result.status).json(result.body);
  };
}
