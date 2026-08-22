import type { Secp256k1Keypair } from '@atproto/crypto';
import type { LabelStore } from '../db/client.ts';
import { signLabel } from './sign.ts';

export interface EmitDeps {
  store: LabelStore;
  keypair: Secp256k1Keypair;
  did: string;
}

export interface EmitInput {
  uri: string;
  cid?: string;
  create?: string[];
  negate?: string[];
}

export interface EmittedLabel {
  seq: number;
  val: string;
  neg: boolean;
}

// Sign, store, and broadcast a set of create/negate labels on one subject. Shared by the
// admin label API and the Coop action endpoint.
export async function emitLabels(deps: EmitDeps, input: EmitInput): Promise<EmittedLabel[]> {
  const cts = new Date().toISOString();
  const emitted: EmittedLabel[] = [];

  for (const val of input.create ?? []) {
    const stored = await deps.store.insert(
      await signLabel(deps.keypair, { src: deps.did, uri: input.uri, cid: input.cid, val, cts }),
    );
    emitted.push({ seq: stored.seq, val, neg: false });
  }
  for (const val of input.negate ?? []) {
    const stored = await deps.store.insert(
      await signLabel(deps.keypair, {
        src: deps.did,
        uri: input.uri,
        cid: input.cid,
        val,
        neg: true,
        cts,
      }),
    );
    emitted.push({ seq: stored.seq, val, neg: true });
  }
  return emitted;
}
