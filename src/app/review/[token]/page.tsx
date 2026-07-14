import { BlogRepository } from '@/repositories/BlogRepository';
import { localizeBlogPost } from '@/utils/blogLocales';
import { DEFAULT_LOCALE } from '@/i18n';
import { headers } from 'next/headers';
import ReviewPostView from '@/components/blog/ReviewPostView';
import { getServerT } from '@/utils/serverTranslations';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function ReviewPostPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const repo = new BlogRepository();
  const post = await repo.getByReviewToken(token);

  const headerStore = await headers();
  const preferred = headerStore.get('accept-language')?.split(',')[0]?.split(';')[0]?.toLowerCase()
    || post?.primaryLocale
    || DEFAULT_LOCALE;

  if (!post) {
    const t = await getServerT(preferred);
    return (
      <div className={styles.container}>
        <div className={styles.invalid} data-testid="review-invalid">
          {t('reviewLinkInvalid') as string}
        </div>
      </div>
    );
  }

  const localized = localizeBlogPost(post, {
    preferredLocale: preferred,
    fallbackLocales: [post.primaryLocale],
  }).localized;

  return (
    <div className={styles.container}>
      <ReviewPostView token={token} post={post} localized={localized} />
    </div>
  );
}
