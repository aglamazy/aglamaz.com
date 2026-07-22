import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import {
  buildBlessingPageSlug,
  resolveCanonicalBlessingPage,
} from '../src/repositories/BlessingPageRepository.utils';
import type { BlessingPage } from '../src/entities/BlessingPage';

function makePage(overrides: Partial<BlessingPage>): BlessingPage {
  return {
    id: 'page-1',
    eventId: 'event-1',
    siteId: 'site-1',
    year: 2025,
    slug: 'event-1-2025',
    createdBy: 'user-1',
    createdAt: Timestamp.fromDate(new Date(2025, 0, 1)),
    ...overrides,
  };
}

function testDeathPageResolvesToSameStandingPageAcrossYears() {
  const memorialPage = makePage({
    id: 'mem-2025',
    year: 2025,
    slug: 'event-1',
    createdAt: Timestamp.fromDate(new Date(2025, 0, 1)),
  });

  const lookupIn2025 = resolveCanonicalBlessingPage([memorialPage], 'death', 2025);
  const lookupIn2026 = resolveCanonicalBlessingPage([memorialPage], 'death', 2026);

  assert.equal(lookupIn2025?.id, memorialPage.id);
  assert.equal(lookupIn2026?.id, memorialPage.id);
  console.log('death page standing lookup across years passed');
}

function testBirthdayPagesStayYearScoped() {
  const birthday2025 = makePage({
    id: 'birth-2025',
    eventId: 'event-2',
    year: 2025,
    slug: 'event-2-2025',
    createdAt: Timestamp.fromDate(new Date(2025, 0, 1)),
  });
  const birthday2026 = makePage({
    id: 'birth-2026',
    eventId: 'event-2',
    year: 2026,
    slug: 'event-2-2026',
    createdAt: Timestamp.fromDate(new Date(2026, 0, 1)),
  });

  const lookupIn2025 = resolveCanonicalBlessingPage([birthday2026, birthday2025], 'birthday', 2025);
  const lookupIn2026 = resolveCanonicalBlessingPage([birthday2026, birthday2025], 'birthday', 2026);

  assert.equal(lookupIn2025?.id, birthday2025.id);
  assert.equal(lookupIn2026?.id, birthday2026.id);
  assert.equal(resolveCanonicalBlessingPage([birthday2025], 'birthday', 2026), null);
  console.log('birthday pages remain year-scoped passed');
}

function testSlugBuilderMatchesStandingAndYearScopedRules() {
  assert.equal(buildBlessingPageSlug('event-1', 'death'), 'event-1');
  assert.equal(buildBlessingPageSlug('event-1', 'birthday', 2025), 'event-1-2025');
  console.log('slug builder rules passed');
}

testDeathPageResolvesToSameStandingPageAcrossYears();
testBirthdayPagesStayYearScoped();
testSlugBuilderMatchesStandingAndYearScopedRules();
