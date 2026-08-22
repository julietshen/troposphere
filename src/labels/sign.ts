import { cborEncode } from '@atproto/common';
import type { Secp256k1Keypair } from '@atproto/crypto';

export interface UnsignedLabel {
  src: string;
  uri: string;
  cid?: string;
  val: string;
  neg?: boolean;
  cts: string;
  exp?: string;
}

export interface SignedLabel {
  ver: 1;
  src: string;
  uri: string;
  cid?: string;
  val: string;
  neg?: boolean;
  cts: string;
  exp?: string;
  sig: Uint8Array;
}

// Build the canonical label object (ver 1, optional fields omitted when unset) and
// sign its dag-cbor encoding. Verifiers reconstruct the object minus `sig`, dag-cbor
// encode it, and check the signature, so the fields here must exactly match what a
// consumer will reconstruct. Omitting unset optionals is required by the spec.
export async function signLabel(
  keypair: Secp256k1Keypair,
  input: UnsignedLabel,
): Promise<SignedLabel> {
  const unsigned: Omit<SignedLabel, 'sig'> = {
    ver: 1,
    src: input.src,
    uri: input.uri,
    ...(input.cid ? { cid: input.cid } : {}),
    val: input.val,
    ...(input.neg ? { neg: true } : {}),
    cts: input.cts,
    ...(input.exp ? { exp: input.exp } : {}),
  };
  const sig = await keypair.sign(cborEncode(unsigned));
  return { ...unsigned, sig };
}

// The wire form served over queryLabels / subscribeLabels. Optionals are omitted
// when unset so the object round-trips to the exact bytes that were signed.
export function toWireLabel(label: SignedLabel): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    ver: label.ver,
    src: label.src,
    uri: label.uri,
    val: label.val,
    cts: label.cts,
    sig: label.sig,
  };
  if (label.cid) wire.cid = label.cid;
  if (label.neg) wire.neg = true;
  if (label.exp) wire.exp = label.exp;
  return wire;
}
