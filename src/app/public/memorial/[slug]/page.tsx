import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { BlessingRepository } from '@/repositories/BlessingRepository';
import PublicMemorialPage from '@/components/memorial/PublicMemorialPage';
import { DEFAULT_LOCALE } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function PublicMemorialPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const blessingPageRepo = new BlessingPageRepository();
  const blessingPage = await blessingPageRepo.getBySlug(slug);

  // Missing page, or explicitly not marked public → 404 rather than a soft
  // "not found" body, matching the public blog post precedent.
  if (!blessingPage || !blessingPage.isPublic) {
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
  // Public route: must only ever surface blessings marked visibleToPublic —
  // listByBlessingPage is member-facing and returns everything, which would
  // leak private member memories onto this unauthenticated page.
  const blessings = await blessingRepo.listPublicByBlessingPage(blessingPage.id, preferred);

  return <PublicMemorialPage blessingPage={blessingPage} event={event} blessings={blessings} />;
}
