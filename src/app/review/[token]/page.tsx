import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { blogRepository } from '@/repositories/BlogRepository';
import { resolveLocalizedFields } from '@/utils/blogLocales';
import { DEFAULT_LOCALE } from '@/i18n';
import ReviewDecisionForm from './ReviewDecisionForm';
import blogStyles from '@/components/blog/PublicPost.module.css';

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-600">
        Draft — review requested
      </div>
      <article className={`prose max-w-none ${blogStyles.content}`}>
        <h1 className="mb-4 text-2xl font-semibold">{localized.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: localized.content }} />
      </article>
      <hr className="my-8 border-gray-200" />
      <ReviewDecisionForm token={token} />
    </div>
  );
}
