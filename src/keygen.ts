import { Secp256k1Keypair } from '@atproto/crypto';
import { publicKeyMultibase } from './labels/keypair.ts';

const keypair = await Secp256k1Keypair.create({ exportable: true });
const priv = await keypair.export();

console.log(`LABELER_SIGNING_KEY=${Buffer.from(priv).toString('hex')}`);
console.log(`# did:key:             ${keypair.did()}`);
console.log(`# publicKeyMultibase:  ${publicKeyMultibase(keypair)}`);
console.log('# ^ publish publicKeyMultibase as the #atproto_label verification method.');
