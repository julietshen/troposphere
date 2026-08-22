import type { Request, Response } from 'express';
import type { Secp256k1Keypair } from '@atproto/crypto';
import type { LabelStore } from '../db/client.ts';
import type { LabelerConfig } from '../config.ts';
import { emitLabels } from '../labels/emit.ts';

interface EmitBody {
  subject?: { uri?: unknown; cid?: unknown };
  create?: unknown;
  negate?: unknown;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

// POST /admin/labels — the backend-agnostic label-emit API. Any moderation backend
// (Coop, or your own tooling) presents the admin bearer token and posts a subject
// plus label values to create and/or negate. The labeler signs and stores each one,
// which broadcasts it to every open subscribeLabels stream.
export function adminLabelsHandler(
  store: LabelStore,
  keypair: Secp256k1Keypair,
  config: LabelerConfig,
) {
  return async (req: Request, res: Response): Promise<void> => {
    if (req.header('authorization') !== `Bearer ${config.adminToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = (req.body ?? {}) as EmitBody;
    const uri = body.subject?.uri;
    if (typeof uri !== 'string' || !uri) {
      res.status(400).json({ error: 'InvalidRequest', message: 'subject.uri is required' });
      return;
    }
    const cid = typeof body.subject?.cid === 'string' ? body.subject.cid : undefined;
    const create = strings(body.create);
    const negate = strings(body.negate);
    if (!create.length && !negate.length) {
      res.status(400).json({
        error: 'InvalidRequest',
        message: 'provide create[] and/or negate[] label values',
      });
      return;
    }

    const labels = await emitLabels({ store, keypair, did: config.did }, { uri, cid, create, negate });
    res.json({ labels });
  };
}
