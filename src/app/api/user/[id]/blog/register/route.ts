import { withUserGuard } from '@/lib/withUserGuard';
import { MemberRepository } from '@/repositories/MemberRepository';
import { Timestamp } from 'firebase-admin/firestore';
import type { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext) => {
  try {
    const user = context.user!;
    const { siteId, blogHandle, acceptBlogTerms, acceptSiteTerms } = await request.json();

    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }

    if (!blogHandle || typeof blogHandle !== 'string') {
      return Response.json({ error: 'Missing or invalid blogHandle' }, { status: 400 });
    }

    if (!acceptBlogTerms) {
      return Response.json({ error: 'Blog terms must be accepted' }, { status: 400 });
    }

    if (!acceptSiteTerms) {
      return Response.json({ error: 'Site terms must be accepted' }, { status: 400 });
    }

    // Validate handle format
    const sanitized = blogHandle.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,50}$/.test(sanitized)) {
      return Response.json(
        { error: 'Invalid handle format. Use 3-50 characters: lowercase letters, numbers, and hyphens only.' },
        { status: 400 }
      );
    }

    const repo = new MemberRepository();

    // Check if member already has a blog
    const existing = await repo.getByUid(siteId, user.sub!);
    if (!existing) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    if (existing.blogEnabled && existing.blogHandle) {
      return Response.json(
        { error: 'Blog already registered', blogHandle: existing.blogHandle },
        { status: 409 }
      );
    }

    // Check handle uniqueness
    const handleTaken = await repo.getByHandle(sanitized, siteId);

    if (handleTaken !== null) {
      return Response.json({ error: 'Blog handle already taken' }, { status: 409 });
    }

    // Register blog with acceptance timestamps
    const now = Timestamp.now();
    await repo.update(existing.id, {
      blogEnabled: true,
      blogHandle: sanitized,
      blogTermsAcceptedAt: now,
      siteTermsAcceptedAt: now,
    });

    return Response.json({ ok: true, blogHandle: sanitized });
  } catch (error) {
    console.error('blog registration failed', error);
    return Response.json({ error: 'Failed to register blog' }, { status: 500 });
  }
};

export const POST = withUserGuard(handler);
