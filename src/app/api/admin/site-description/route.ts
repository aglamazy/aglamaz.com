import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/auth/service';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { initAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { revalidateTag } from 'next/cache';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';
import { TranslationService } from '@/services/TranslationService';

const SUPPORTED_LOCALES = CONFIG_LOCALES.map((locale) => locale as string);

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/site-description
 * Fetches the current site description for the admin to edit
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(ACCESS_TOKEN)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = payload.sub;
    const siteId = process.env.NEXT_SITE_ID;
    if (!siteId) {
      return NextResponse.json({ error: 'Site ID not configured' }, { status: 500 });
    }

    initAdmin();
    const db = getFirestore();
    const doc = await db.collection('sites').doc(siteId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const data = doc.data() || {};
    const description = data.description || {
      title: '',
      content: '',
      translations: {},
    };

    const siteName = typeof data.name === 'string' ? data.name : '';
    const siteTranslations =
      data.translations && typeof data.translations === 'object'
        ? (data.translations as Record<string, string>)
        : {};

    return NextResponse.json({
      description,
      siteName,
      siteNameTranslations: siteTranslations,
    });
  } catch (error) {
    console.error('[site-description] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site description' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/site-description
 * Saves the site description (requires admin role)
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(ACCESS_TOKEN)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = payload.sub;
    const siteId = process.env.NEXT_SITE_ID;
    if (!siteId) {
      return NextResponse.json({ error: 'Site ID not configured' }, { status: 500 });
    }

    // Verify user is admin for this site
    initAdmin();
    const db = getFirestore();

    const memberQuery = await db
      .collection('members')
      .where('siteId', '==', siteId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      return NextResponse.json({ error: 'Not a member of this site' }, { status: 403 });
    }

    const memberData = memberQuery.docs[0].data();
    if (memberData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== 'object') {
      return NextResponse.json({ error: 'Invalid description data' }, { status: 400 });
    }

    // Validate structure
    const validatedDescription = {
      title: description.title || '',
      content: description.content || '',
      translations: description.translations || {},
    };

    const baseTitle = validatedDescription.title;
    const baseContent = validatedDescription.content;

    if (!validatedDescription.translations.en) {
      validatedDescription.translations.en = {
        title: baseTitle,
        content: baseContent,
      };
    }

    if (TranslationService.isEnabled()) {
      for (const locale of SUPPORTED_LOCALES) {
        if (locale === 'en') continue;
        const existing = validatedDescription.translations[locale];
        const existingTitle = existing?.title?.trim();
        const existingContent = existing?.content?.trim();
        if (existingTitle && existingContent) continue;
        try {
          const translated = await TranslationService.translateHtml({
            title: baseTitle,
            content: baseContent,
            from: 'en',
            to: locale,
          });
          validatedDescription.translations[locale] = {
            title: translated.title,
            content: translated.content,
          };
        } catch (translateError) {
          console.error('[site-description] translation failed', { locale, error: translateError });
        }
      }
    }

    // Update site document
    await db.collection('sites').doc(siteId).update({
      description: validatedDescription,
      updatedAt: new Date(),
    });

    // Revalidate cache
    revalidateTag(`site-description-${siteId}`);
    revalidateTag(`site-${siteId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[site-description] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save site description' },
      { status: 500 }
    );
  }
}
