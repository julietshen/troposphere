import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCoopReport } from '../src/reports/coopReport.ts';
import type { LabelerConfig } from '../src/config.ts';
import type { StoredReport } from '../src/db/reports.ts';

const config = { coopPostType: 'ATproto-post', coopAccountType: 'ATproto-account' } as LabelerConfig;

test('record report maps to an ATproto-post reportedItem with the author as additionalItems', () => {
  const stored: StoredReport = {
    id: 1,
    reasonType: 'com.atproto.moderation.defs#reasonSpam',
    reason: 'bad',
    reportedBy: 'did:plc:reporter',
    createdAt: '2026-01-01T00:00:00.000Z',
    subjectType: 'record',
    subjectUri: 'at://did:plc:author/app.bsky.feed.post/xyz',
    subjectCid: 'bafycid',
  };
  const r = toCoopReport(stored, undefined, config);
  assert.equal(r.reporter.kind, 'user');
  assert.equal(r.reporter.id, 'did:plc:reporter');
  assert.equal(r.reporter.typeId, 'ATproto-account');
  assert.equal(r.reportedForReason.reason, 'com.atproto.moderation.defs#reasonSpam: bad');
  assert.equal(r.reportedItem.typeId, 'ATproto-post');
  assert.equal(r.reportedItem.data.atUri, 'at://did:plc:author/app.bsky.feed.post/xyz');
  assert.equal(r.reportedItem.data.cid, 'bafycid');
  assert.equal(r.additionalItems?.[0]?.data.did, 'did:plc:author');
});

test('account report maps to an ATproto-account reportedItem; reason is just the type when no free text', () => {
  const stored: StoredReport = {
    id: 2,
    reasonType: 'com.atproto.moderation.defs#reasonViolation',
    reportedBy: 'did:plc:reporter',
    createdAt: '2026-01-01T00:00:00.000Z',
    subjectType: 'account',
    subjectDid: 'did:plc:acct',
  };
  const r = toCoopReport(stored, undefined, config);
  assert.equal(r.reportedItem.typeId, 'ATproto-account');
  assert.equal(r.reportedItem.data.did, 'did:plc:acct');
  assert.equal(r.reportedForReason.reason, 'com.atproto.moderation.defs#reasonViolation');
});
