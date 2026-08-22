import { Secp256k1Keypair } from '@atproto/crypto';

export async function loadSigningKey(hex: string): Promise<Secp256k1Keypair> {
  return Secp256k1Keypair.import(hex, { exportable: false });
}

// The publicKeyMultibase to publish as the #atproto_label verification method in
// the labeler's DID document. keypair.did() is `did:key:z<multibase>`; the DID
// document wants the multibase portion.
export function publicKeyMultibase(keypair: Secp256k1Keypair): string {
  return keypair.did().replace(/^did:key:/, '');
}
