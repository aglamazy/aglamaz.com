import assert from 'node:assert/strict';
import { EmailTrackingRepository } from '../src/repositories/EmailTrackingRepository';
import { MemberRepository } from '../src/repositories/MemberRepository';
import { EmailTrackingDetailService } from '../src/services/EmailTrackingSummaryService';
import { makeFakeFirestore } from './helpers/fakeFirestore';

const SITE_ID = 'site1';
const SEND_TYPE = 'digest' as const;
const SEND_ID = 'weekly:2026-W32';

async function seedMember(db: FirebaseFirestore.Firestore, id: string, fields: Record<string, unknown>) {
  // The fake Firestore has no .set() - .update() on a not-yet-existing doc creates it,
  // same effective result for this test's seeding purpose.
  await db.collection('members').doc(id).update(fields);
}

async function testGroupsRawEventsIntoOneRowPerEngagedRecipient() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const trackingRepo = new EmailTrackingRepository(fakeDb);
  const memberRepo = new MemberRepository(fakeDb);
  await seedMember(fakeDb, 'member1', { email: 'alice@example.com', displayName: 'Alice' });
  await seedMember(fakeDb, 'member2', { email: 'bob@example.com', displayName: 'Bob' });

  // member1 opened twice (should collapse to one row, firstOpenAt = the earlier one) and clicked once.
  await trackingRepo.logEvent({ siteId: SITE_ID, recipientMemberId: 'member1', sendType: SEND_TYPE, sendId: SEND_ID, eventType: 'open' });
  await trackingRepo.logEvent({ siteId: SITE_ID, recipientMemberId: 'member1', sendType: SEND_TYPE, sendId: SEND_ID, eventType: 'open' });
  await trackingRepo.logEvent({ siteId: SITE_ID, recipientMemberId: 'member1', sendType: SEND_TYPE, sendId: SEND_ID, eventType: 'click' });
  // member2 only opened, never clicked.
  await trackingRepo.logEvent({ siteId: SITE_ID, recipientMemberId: 'member2', sendType: SEND_TYPE, sendId: SEND_ID, eventType: 'open' });
  // A different send (different sendId) must never leak into this send's detail.
  await trackingRepo.logEvent({ siteId: SITE_ID, recipientMemberId: 'member1', sendType: SEND_TYPE, sendId: 'weekly:2026-W31', eventType: 'open' });

  const service = new EmailTrackingDetailService(trackingRepo, memberRepo);
  const detail = await service.getRecipientDetailForSend(SITE_ID, SEND_TYPE, SEND_ID);

  assert.equal(detail.length, 2, 'must collapse to one row per recipient, not one row per raw event');

  const member1Row = detail.find((r) => r.memberId === 'member1');
  assert.ok(member1Row);
  assert.equal(member1Row!.opened, true);
  assert.equal(member1Row!.clicked, true);
  assert.equal(member1Row!.displayLabel, 'Alice');
  assert.equal(member1Row!.email, 'alice@example.com');

  const member2Row = detail.find((r) => r.memberId === 'member2');
  assert.ok(member2Row);
  assert.equal(member2Row!.opened, true);
  assert.equal(member2Row!.clicked, false, 'member2 never clicked - must not be marked as clicked');

  console.log('groups raw events into one row per engaged recipient, scoped to the exact send: PASSED');
}

async function testFallsBackToRawIdWhenMemberRecordIsGone() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const trackingRepo = new EmailTrackingRepository(fakeDb);
  const memberRepo = new MemberRepository(fakeDb);
  // No member doc seeded for 'ghost-member' - simulates a deleted/removed member.
  await trackingRepo.logEvent({ siteId: SITE_ID, recipientMemberId: 'ghost-member', sendType: SEND_TYPE, sendId: SEND_ID, eventType: 'open' });

  const service = new EmailTrackingDetailService(trackingRepo, memberRepo);
  const detail = await service.getRecipientDetailForSend(SITE_ID, SEND_TYPE, SEND_ID);

  assert.equal(detail.length, 1);
  assert.equal(detail[0].memberId, 'ghost-member');
  assert.equal(detail[0].displayLabel, 'ghost-member', 'must fall back to the raw id, never throw, when the member record is gone');
  assert.equal(detail[0].email, null);
  console.log('falls back to the raw member id when the member record is gone, never throws: PASSED');
}

async function testNoEventsReturnsEmptyList() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const trackingRepo = new EmailTrackingRepository(fakeDb);
  const memberRepo = new MemberRepository(fakeDb);
  const service = new EmailTrackingDetailService(trackingRepo, memberRepo);
  const detail = await service.getRecipientDetailForSend(SITE_ID, SEND_TYPE, 'weekly:2099-W01');
  assert.deepEqual(detail, []);
  console.log('a send with no events returns an empty list, not an error: PASSED');
}

async function run() {
  await testGroupsRawEventsIntoOneRowPerEngagedRecipient();
  await testFallsBackToRawIdWhenMemberRecordIsGone();
  await testNoEventsReturnsEmptyList();
}

run();
