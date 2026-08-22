import type { Request, Response } from 'express';
import type { Secp256k1Keypair } from '@atproto/crypto';
import type { IdResolver } from '@atproto/identity';
import type { LabelStore } from '../db/client.ts';
import type { LabelerConfig } from '../config.ts';
import { emitLabels } from '../labels/emit.ts';
import { resolveCurrentCid } from '../reports/enrich.ts';
import { applyTakedown, buildEnforceSubject } from './enforce.ts';

interface CoopBody {
  item?: { id?: unknown };
  custom?: {
    create?: unknown;
    negate?: unknown;
    takedown?: unknown;
    cid?: unknown;
    ref?: unknown;
    // Alias for `create`, matching the workshop relay shape ({ custom: { labelVal } }), so an
    // existing Coop label action wired for the relay drops onto troposphere unchanged.
    labelVal?: unknown;
  };
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return typeof value === 'string' ? [value] : [];
}

// POST /coop/action — accepts Coop's CUSTOM_ACTION webhook shape directly, so a Coop action can
// drive troposphere with no adapter. Coop puts the subject's atproto URI (or DID) in `item.id`
// and the operator-configured directives in `custom`: label values to `create`/`negate`, and/or
// a `takedown` boolean. For a record without a supplied `cid`, the current version is resolved
// from the record's own PDS so the label or takedown pins to it.
export function coopActionHandler(
  store: LabelStore,
  keypair: Secp256k1Keypair,
  config: LabelerConfig,
  resolver: IdResolver,
) {
  return async (req: Request, res: Response): Promise<void> => {
    if (req.header('authorization') !== `Bearer ${config.adminToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = (req.body ?? {}) as CoopBody;
    const uri = body.item?.id;
    if (typeof uri !== 'string' || !uri) {
      res.status(400).json({ error: 'InvalidRequest', message: 'item.id is required' });
      return;
    }

    const custom = body.custom ?? {};
    const create = [...strings(custom.create), ...strings(custom.labelVal)];
    const negate = strings(custom.negate);
    const hasTakedown = typeof custom.takedown === 'boolean';
    if (!create.length && !negate.length && !hasTakedown) {
      res.status(400).json({
        error: 'InvalidRequest',
        message: 'custom must include create, negate, and/or takedown',
      });
      return;
    }

    const isRecord = uri.startsWith('at://');
    let cid = typeof custom.cid === 'string' ? custom.cid : undefined;
    if (isRecord && !cid) cid = await resolveCurrentCid(resolver, uri);

    const result: { labels?: unknown; enforce?: unknown } = {};

    if (create.length || negate.length) {
      result.labels = await emitLabels({ store, keypair, did: config.did }, { uri, cid, create, negate });
    }

    if (hasTakedown) {
      const subject = buildEnforceSubject(isRecord ? { uri, cid } : { did: uri });
      if ('error' in subject) {
        res.status(400).json({ error: 'InvalidRequest', message: subject.error });
        return;
      }
      const enforced = await applyTakedown(
        config,
        subject,
        custom.takedown as boolean,
        typeof custom.ref === 'string' ? custom.ref : undefined,
      );
      result.enforce = enforced.body;
      if (enforced.status !== 200) {
        res.status(enforced.status).json(result);
        return;
      }
    }

    res.json(result);
  };
}
