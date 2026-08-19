import assert from 'node:assert/strict';
import { MemberRepository } from '../src/repositories/MemberRepository';
import { makeFakeFirestore } from './helpers/fakeFirestore';

async function testCreateStampsHumanActor() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new MemberRepository(fakeDb);

  const member = await repo.create(
    { siteId: 'site1', role: 'member', firstName: 'A' },
    { kind: 'human', id: 'user1' },
  );

  assert.equal(member.createdBy, 'user1');
  assert.equal(member.createdByKind, 'human');
  assert.equal(member.updatedBy, 'user1');
  assert.equal(member.updatedByKind, 'human');
  console.log('MemberRepository.create stamps createdBy/createdByKind/updatedBy/updatedByKind (human)');
}

async function testCreateStampsAgentActor() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new MemberRepository(fakeDb);

  const member = await repo.create(
    { siteId: 'site1', role: 'admin', firstName: 'Owner' },
    { kind: 'agent', id: 'create-site-script' },
  );

  assert.equal(member.createdBy, 'create-site-script');
  assert.equal(member.createdByKind, 'agent');
  console.log('MemberRepository.create stamps agent actor correctly');
}

async function testUpdatePreservesCreatedByButChangesUpdatedBy() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new MemberRepository(fakeDb);

  const member = await repo.create(
    { siteId: 'site1', role: 'member', firstName: 'A' },
    { kind: 'human', id: 'user1' },
  );

  await repo.update(member.id, { firstName: 'B' }, { kind: 'agent', id: 'Librarian' });
  const updated = await repo.getById(member.id);

  assert.ok(updated);
  assert.equal(updated!.createdBy, 'user1', 'createdBy/createdByKind must never change on update');
  assert.equal(updated!.createdByKind, 'human');
  assert.equal(updated!.updatedBy, 'Librarian', 'updatedBy reflects the LATEST actor, not the original');
  assert.equal(updated!.updatedByKind, 'agent');
  console.log('MemberRepository.update stamps updatedBy/updatedByKind without disturbing createdBy');
}

async function run() {
  await testCreateStampsHumanActor();
  await testCreateStampsAgentActor();
  await testUpdatePreservesCreatedByButChangesUpdatedBy();
}

run();
