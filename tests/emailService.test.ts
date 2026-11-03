// famcircle#201: every send is recorded - accepted, skipped and failed alike - and a record
// that cannot be written is loud but does not turn a sent email into a retried one.
import assert from 'node:assert/strict';
import { EmailService, type EmailSendRequest } from '../src/services/EmailService';
import type { EmailSendRecord } from '../src/repositories/EmailSendRepository';

const base: EmailSendRequest = {
  kind: 'digest',
  carrier: 'resend',
  to: 'member@example.test',
  subject: 'Weekly',
  html: '<p>hi</p>',
  lang: 'he',
  tracking: { origin: 'https://example.test', siteId: 'site1', recipientMemberId: 'm1', sendType: 'digest', sendId: 'weekly:2026-W45' },
};

function harness(carrier: (req: EmailSendRequest) => Promise<{ accepted: boolean; messageId?: string }>, recordFails = false) {
  const records: EmailSendRecord[] = [];
  const calls: EmailSendRequest[] = [];
  const service = new EmailService({
    carriers: {
      resend: async (req) => { calls.push(req); return carrier(req); },
      gmail: async () => { throw new Error('gmail carrier must not be called for a resend send'); },
    },
    record: async (entry) => {
      if (recordFails) throw new Error('firestore down');
      records.push(entry);
    },
  });
  return { service, records, calls };
}

async function testAcceptedIsRecorded() {
  const h = harness(async () => ({ accepted: true, messageId: 're_123' }));
  assert.equal(await h.service.send(base), true);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.records, [{
    kind: 'digest', carrier: 'resend', to: 'member@example.test', subject: 'Weekly', outcome: 'accepted',
    siteId: 'site1', recipientMemberId: 'm1', sendId: 'weekly:2026-W45', lang: 'he',
    providerMessageId: 're_123', error: null,
  }]);
}

async function testSkippedIsRecorded() {
  const h = harness(async () => ({ accepted: false }));
  assert.equal(await h.service.send(base), false);
  assert.equal(h.records[0].outcome, 'skipped');
  assert.equal(h.records[0].providerMessageId, null);
}

async function testFailedIsRecordedThenRethrown() {
  const h = harness(async () => { throw new Error('Resend API error 422: bad to'); });
  await assert.rejects(h.service.send(base), /422/);
  assert.equal(h.records.length, 1);
  assert.equal(h.records[0].outcome, 'failed');
  assert.match(h.records[0].error ?? '', /422: bad to/);
}

async function testExplicitSiteIdWithoutTracking() {
  const h = harness(async () => ({ accepted: true }));
  await h.service.send({ ...base, tracking: undefined, siteId: 'site9', kind: 'welcome' });
  assert.equal(h.records[0].siteId, 'site9');
  assert.equal(h.records[0].recipientMemberId, null);
  assert.equal(h.records[0].kind, 'welcome');
}

async function testRecordFailureIsLoudNotARetry() {
  const h = harness(async () => ({ accepted: true, messageId: 're_9' }), true);
  const logged: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.join(' ')); };
  try {
    assert.equal(await h.service.send(base), true, 'a sent email must still read as sent');
  } finally {
    console.error = orig;
  }
  assert.equal(logged.length, 1);
  assert.match(logged[0], /SEND RECORD WRITE FAILED/);
  assert.match(logged[0], /kind=digest/);
  assert.ok(!logged[0].includes('member@example.test'), 'the loud log must not print the recipient address');
}

async function main() {
  await testAcceptedIsRecorded();
  await testSkippedIsRecorded();
  await testFailedIsRecordedThenRethrown();
  await testExplicitSiteIdWithoutTracking();
  await testRecordFailureIsLoudNotARetry();
  console.log('emailService.test: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
