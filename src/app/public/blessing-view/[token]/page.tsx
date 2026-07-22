// No-login, read-only view of a blessing page via a 48h magic link token -
// the honoree's own "read what your family wrote for you" link (Agla,
// 2026-07-22). Same rendering as the public memorial page, but token-gated
// (not isPublic-gated) and shows ALL blessings, not just visibleToPublic ones
// - the honoree should see everything written for them, not the subset
// approved for strangers on the public route.
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { BlessingMagicLinkRepository } from '@/repositories/BlessingMagicLinkRepository';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { BlessingRepository } from '@/repositories/BlessingRepository';
import PublicMemorialPage from '@/components/memorial/PublicMemorialPage';
import { DEFAULT_LOCALE } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function BlessingMagicLinkRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const linkRepo = new BlessingMagicLinkRepository();
  const link = await linkRepo.getByToken(token);
  if (!link) {
    notFound();
  }

  const blessingPageRepo = new BlessingPageRepository();
  const blessingPage = await blessingPageRepo.getById(link.blessingPageId);
  if (!blessingPage) {
    notFound();
  }

  const anniversaryRepo = new AnniversaryRepository();
  const event = await anniversaryRepo.getById(blessingPage.eventId);
  if (!event) {
    notFound();
  }

  const headerStore = await headers();
  const preferred = headerStore.get('accept-language')?.split(',')[0]?.split(';')[0]?.toLowerCase() || DEFAULT_LOCALE;

  const blessingRepo = new BlessingRepository();
  // listByBlessingPage (not listPublicByBlessingPage) - the honoree sees every
  // blessing written for them, not just the ones marked visibleToPublic.
  const blessings = await blessingRepo.listByBlessingPage(blessingPage.id, preferred);

  return <PublicMemorialPage blessingPage={blessingPage} event={event} blessings={blessings} readOnly />;
}
