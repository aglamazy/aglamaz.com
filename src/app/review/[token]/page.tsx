import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { blogRepository } from '@/repositories/BlogRepository';
import { resolveLocalizedFields } from '@/utils/blogLocales';
import { DEFAULT_LOCALE } from '@/i18n';
import ReviewDecisionForm from './ReviewDecisionForm';
import BlogPostBody from '@/components/blog/BlogPostBody';
import I18nProvider from '@/components/I18nProvider';
import blogStyles from '@/components/blog/PublicPost.module.css';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { formatLocalizedDate } from '@/utils/dateFormat';
import { resolveDateLocale } from '@/utils/timezoneRegion';

export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const post = await blogRepository.getByReviewToken(token);
  if (!post) {
    notFound();
  }

  const headerStore = await headers();
  const preferred =
    headerStore
      .get('accept-language')
      ?.split(',')[0]
      ?.split(';')[0]
      ?.toLowerCase() ||
    post.primaryLocale ||
    DEFAULT_LOCALE;

  const localized = resolveLocalizedFields(post, {
    preferredLocale: preferred,
    fallbackLocales: [DEFAULT_LOCALE],
  });

  const cookieStore = await cookies();
  const tz = cookieStore.get('tz')?.value;
  const dateLocale = resolveDateLocale(localized.locale, tz);

  // Page direction/lang must follow the CONTENT's own locale (localized.locale), not the
  // reviewer's browser Accept-Language - a reviewer with a Hebrew browser opening an
  // English draft must still see it rendered LTR. ReviewLayout used to force this via a
  // hardcoded DEFAULT_LOCALE (which is 'he' app-wide, per next-i18next.config.js), so
  // every review page rendered RTL regardless of what was actually being reviewed (Agla,
  // 2026-08-12, live). Nothing else on this page needs the i18n context (no t()/
  // useTranslation calls in BlogPostBody or ReviewDecisionForm) - this wrap exists purely
  // to set the correct dir/lang on <html>.
  return (
    <I18nProvider initialLocale={localized.locale} resolvedLocale={localized.locale}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-600">
          Draft — review requested. Preview below matches how this post will look once published.
        </div>
        {/* Same Card/CardHeader/CardContent shape a published post renders in on the
            real site (see [locale]/blog/[id]/page.tsx) - Agla, 2026-09-04: the review
            page must draw the post exactly as it will display, not an approximation. */}
        <Card>
          <CardHeader>
            <h1 className="m-0 text-2xl font-semibold text-charcoal">{localized.title}</h1>
            {post.createdAt && (
              <div className="mt-1 text-xs font-normal text-gray-500">
                {formatLocalizedDate(post.createdAt, dateLocale)}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <BlogPostBody
              content={localized.content}
              format={localized.contentFormat}
              className={`prose max-w-none ${blogStyles.content}`}
            />
          </CardContent>
        </Card>
        <hr className="my-8 border-gray-200" />
        <ReviewDecisionForm token={token} />
      </div>
    </I18nProvider>
  );
}
