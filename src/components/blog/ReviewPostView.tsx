'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IBlogPost, BlogPostLocalizedFields, BlogPostReviewDecision } from '@/entities/BlogPost';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { formatLocalizedDate } from '@/utils/dateFormat';
import BlogPostBody from './BlogPostBody';
import styles from './PublicPost.module.css';

interface Props {
  token: string;
  post: IBlogPost;
  localized: BlogPostLocalizedFields;
}

export default function ReviewPostView({ token, post, localized }: Props) {
  const { t, i18n } = useTranslation();
  const [decided, setDecided] = useState<BlogPostReviewDecision | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitDecision = async (decision: BlogPostReviewDecision) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(ApiRoute.REVIEW_DECISION, {
        method: 'POST',
        pathParams: { token },
        body: { decision, feedback: decision === 'changes_requested' ? feedback : undefined },
      });
      setDecided(decision);
    } catch (err) {
      console.error('[review] failed to submit decision', err);
      setError(t('reviewDecisionFailed') as string);
    } finally {
      setSubmitting(false);
    }
  };

  if (decided) {
    return (
      <div className={styles.article}>
        <p>
          {decided === 'approved'
            ? (t('reviewApprovedMessage') as string)
            : (t('reviewChangesRequestedMessage') as string)}
        </p>
      </div>
    );
  }

  return (
    <article className={`prose max-w-none ${styles.article}`}>
      <h1 className="mb-1">{localized.title}</h1>
      {post.createdAt && (
        <div className="text-sm text-gray-500 mb-4">{formatLocalizedDate(post.createdAt, i18n.language)}</div>
      )}
      <BlogPostBody content={localized.content} format={localized.contentFormat} />

      {error && <div className="text-sm text-red-600 mt-4">{error}</div>}

      <div className="mt-6 space-y-3">
        {!showFeedbackForm ? (
          <div className="flex items-center gap-3">
            <Button onClick={() => submitDecision('approved')} disabled={submitting}>
              {t('approve') as string}
            </Button>
            <Button variant="outline" onClick={() => setShowFeedbackForm(true)} disabled={submitting}>
              {t('requestChanges') as string}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t('reviewFeedbackPlaceholder') as string}
              className="w-full border border-sage-200 rounded-md px-3 py-2 min-h-[120px]"
            />
            <div className="flex items-center gap-3">
              <Button
                onClick={() => submitDecision('changes_requested')}
                disabled={submitting || !feedback.trim()}
              >
                {t('submit') as string}
              </Button>
              <Button variant="outline" onClick={() => setShowFeedbackForm(false)} disabled={submitting}>
                {t('cancel') as string}
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
