import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Secp256k1Keypair, verifySignature } from '@atproto/crypto';
import { cborEncode } from '@atproto/common';
import { signLabel, toWireLabel } from '../src/labels/sign.ts';

const CTS = '2026-01-01T00:00:00.000Z';

test('signLabel produces a signature that verifies against the labeler key', async () => {
  const kp = await Secp256k1Keypair.create({ exportable: false });
  const signed = await signLabel(kp, {
    src: kp.did(),
    uri: 'at://did:plc:x/app.bsky.feed.post/a',
    cid: 'bafyx',
    val: 'spam',
    cts: CTS,
  });
  const { sig, ...rest } = signed;
  assert.equal(await verifySignature(kp.did(), cborEncode(rest), sig), true);
  assert.equal(signed.ver, 1);
  assert.equal(signed.val, 'spam');
  assert.equal(signed.cid, 'bafyx');
  assert.equal('neg' in signed, false);
});

test('signLabel includes neg only when true and omits cid when absent', async () => {
  const kp = await Secp256k1Keypair.create({ exportable: false });
  const signed = await signLabel(kp, { src: kp.did(), uri: 'did:plc:x', val: 'spam', neg: true, cts: CTS });
  assert.equal(signed.neg, true);
  assert.equal('cid' in signed, false);
});

test('toWireLabel omits unset optionals', async () => {
  const kp = await Secp256k1Keypair.create({ exportable: false });
  const signed = await signLabel(kp, { src: kp.did(), uri: 'did:plc:x', val: 'spam', cts: CTS });
  const wire = toWireLabel(signed);
  assert.equal(wire.ver, 1);
  assert.equal('neg' in wire, false);
  assert.equal('cid' in wire, false);
  assert.equal('exp' in wire, false);
});
