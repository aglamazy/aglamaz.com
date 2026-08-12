#!/usr/bin/env tsx
/**
 * Relays not-approved blog-review decisions to Shofar's inbox (Agla 2026-07-27).
 *
 * Design context: the review API runs on Vercel (serverless) and can't shell out to
 * inbox.py (a direct connection to the fleet's coordination Postgres, not an HTTP API) -
 * and giving the public-facing app write credentials to that DB would mix product backend
 * with internal fleet plumbing. So FamCircle's backend just records the decision on the
 * post (reviewDecision/reviewFeedback, already existed) and THIS script - run from the
 * FamCircle session's own periodic ticks, where inbox.py + Firestore access both already
 * exist - does the relay. Not synchronous with the button click; "immediately" per tick,
 * not per decision.
 *
 * Shofar's exact spec (2026-07-27, agreed before this was built): decision must stay
 * fix|deny (not collapsed into one "not approved" bucket) - fix = targeted correction,
 * deny = structural signal. Payload: post_id, siteId, decision, feedback text, draft
 * title, link to the post. Push immediately per decision, not batched (best-effort here:
 * each unnotified post is its own inbox.py push, not one combined message).
 *
 * Idempotent: marks shofarNotifiedAt on the post after a successful push, so re-running
 * (or running on every tick) never double-notifies. requestReview() clears this field when
 * a post re-enters review, so a resubmitted-then-decided-again post gets relayed fresh.
 *
 * Usage: npx tsx scripts/relay-blog-feedback-to-shofar.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { execFileSync } from 'child_process';
import { initAdmin } from '../src/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { IBlogPost, BlogPostReviewDecision } from '../src/entities/BlogPost';

const DECISION_LABEL: Partial<Record<BlogPostReviewDecision, 'fix' | 'deny'>> = {
  changes_requested: 'fix',
  denied: 'deny',
};

async function main() {
  initAdmin();
  const db = getFirestore();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://aglamaz.com').replace(/\/+$/, '');

  const snap = await db
    .collection('blogPosts')
    .where('reviewDecision', 'in', ['changes_requested', 'denied'])
    .get();

  const pending = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as IBlogPost & { id: string })
    .filter((post) => !post.shofarNotifiedAt);

  if (pending.length === 0) {
    console.log('[relay-blog-feedback] nothing pending');
    return;
  }

  let relayed = 0;
  let failed = 0;
  for (const post of pending) {
    const label = DECISION_LABEL[post.reviewDecision!];
    if (!label) continue;
    const title = post.locales?.[post.primaryLocale]?.title || '(untitled)';
    const link = `${appUrl}/app/blog/${post.id}/edit`;

    const body = [
      `Blog review decision: ${label}`,
      `post_id: ${post.id}`,
      `siteId: ${post.siteId}`,
      `decision: ${label}`,
      `title: ${title}`,
      `link: ${link}`,
      `feedback: ${post.reviewFeedback || '(none)'}`,
    ].join('\n');

    try {
      // Was hardcoded at ~/develop/Buddy/scripts/inbox.py - retired (ant_executor#1112,
      // 2026-07-28) in favor of the canonical oct_message CLI on PATH, which resolves the
      // real inbox.py location via $HOME internally rather than a path any caller has to
      // track. Found broken 2026-08-12 (same bug FamCircle found in its own copy of this
      // script - Shofar never got a real relay from either site since the retirement, no
      // error surfaced because nothing was running this on a schedule to notice). Also
      // fixed --sender, which was copy-pasted as 'FamCircle' even in this repo's copy.
      execFileSync('oct_message', [
        'push',
        '--to-session', 'Shofar',
        '--sender', 'aglamaz-com',
        body,
      ], { stdio: 'pipe' });
      await db.collection('blogPosts').doc(post.id).update({ shofarNotifiedAt: new Date() });
      relayed++;
    } catch (err) {
      failed++;
      console.error(`[relay-blog-feedback] failed to relay post ${post.id}:`, err);
    }
  }

  console.log(`[relay-blog-feedback] relayed=${relayed} failed=${failed} of ${pending.length} pending`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
