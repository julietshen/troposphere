// End-to-end smoke test against a running troposphere.
// Usage:
//   LABELER_URL=http://localhost:4100 \
//   ADMIN_TOKEN=... \
//   SIGNING_DID_KEY=did:key:z... \
//   node scripts/smoke.mjs
//
// SIGNING_DID_KEY is the did:key printed by `npm run keygen` / server startup; it is
// used to independently verify the signatures the labeler produces.
import { WebSocket } from 'ws';
import { Frame, createServiceJwt } from '@atproto/xrpc-server';
import { Secp256k1Keypair, verifySignature } from '@atproto/crypto';
import { cborEncode } from '@atproto/common';

const BASE = process.env.LABELER_URL ?? 'http://localhost:4100';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const SIGNING_DID_KEY = process.env.SIGNING_DID_KEY;
const LABELER_DID = process.env.LABELER_DID;
if (!ADMIN_TOKEN || !SIGNING_DID_KEY || !LABELER_DID) {
  console.error('Set ADMIN_TOKEN, SIGNING_DID_KEY, and LABELER_DID.');
  process.exit(2);
}
const WS_BASE = BASE.replace(/^http/, 'ws');
const SUBJECT_URI = 'at://did:plc:example1234567890/app.bsky.feed.post/smoke';
const SUBJECT_CID = 'bafyreib2rxk3rybk3aobmv5cjuql3bm2twh4jo5uxyk3d3nrlgd4g7c3qm';

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

async function verifyLabel(label) {
  const { sig, ...rest } = label;
  const bytes = cborEncode(rest);
  const sigBytes =
    sig instanceof Uint8Array ? sig : new Uint8Array(Buffer.from(sig.$bytes ?? sig, 'base64'));
  return verifySignature(SIGNING_DID_KEY, bytes, sigBytes);
}

const post = (body) =>
  fetch(`${BASE}/admin/labels`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
  });

const received = [];
const ws = new WebSocket(`${WS_BASE}/xrpc/com.atproto.label.subscribeLabels?cursor=0`);
ws.on('message', (data) => {
  const frame = Frame.fromBytes(new Uint8Array(data));
  if (frame.isMessage() && frame.header.t === '#labels') received.push(...frame.body.labels);
});
await new Promise((res, rej) => {
  ws.on('open', res);
  ws.on('error', rej);
});
check('subscribeLabels connects', true);

const emit = await post({ subject: { uri: SUBJECT_URI, cid: SUBJECT_CID }, create: ['spam'] });
const emitBody = await emit.json();
check('admin/labels emits (200)', emit.status === 200, JSON.stringify(emitBody));

const unauth = await fetch(`${BASE}/admin/labels`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ subject: { uri: SUBJECT_URI }, create: ['spam'] }),
});
check('admin/labels rejects missing token (401)', unauth.status === 401);

const q = await (
  await fetch(
    `${BASE}/xrpc/com.atproto.label.queryLabels?uriPatterns=${encodeURIComponent(SUBJECT_URI)}`,
  )
).json();
const queried = q.labels?.find((l) => !l.neg);
check('queryLabels returns the label', !!queried);
check('queried label signature verifies', queried ? await verifyLabel(queried) : false);

await post({ subject: { uri: SUBJECT_URI, cid: SUBJECT_CID }, negate: ['spam'] });
const q2 = await (
  await fetch(
    `${BASE}/xrpc/com.atproto.label.queryLabels?uriPatterns=${encodeURIComponent(SUBJECT_URI)}`,
  )
).json();
const neg = q2.labels?.find((l) => l.neg === true);
check('negation signature verifies', neg ? await verifyLabel(neg) : false);

await new Promise((r) => setTimeout(r, 300));
check('subscribeLabels delivered labels', received.length >= 2, `received ${received.length}`);
ws.close();

// --- createReport intake ---
const CREATE_REPORT = 'com.atproto.moderation.createReport';
const reporter = await Secp256k1Keypair.create({ exportable: false });
const reporterDid = reporter.did();
const reportJwt = (aud) => createServiceJwt({ iss: reporterDid, aud, lxm: CREATE_REPORT, keypair: reporter });
const sendReport = (jwt, body) =>
  fetch(`${BASE}/xrpc/${CREATE_REPORT}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(jwt ? { authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  });

const report = await (
  await sendReport(await reportJwt(LABELER_DID), {
    reasonType: 'com.atproto.moderation.defs#reasonSpam',
    reason: 'smoke test',
    subject: { $type: 'com.atproto.repo.strongRef', uri: SUBJECT_URI, cid: SUBJECT_CID },
  })
).json();
check('createReport accepts authed report', report.id > 0 && report.reportedBy === reporterDid);

const noAuth = await sendReport(null, {
  reasonType: 'com.atproto.moderation.defs#reasonSpam',
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:plc:x' },
});
check('createReport rejects missing token', noAuth.status === 401 || noAuth.status === 403);

const wrongAud = await sendReport(await reportJwt('did:web:not-this-labeler.example'), {
  reasonType: 'com.atproto.moderation.defs#reasonSpam',
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:plc:x' },
});
check('createReport rejects wrong audience', wrongAud.status === 401 || wrongAud.status === 403);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
