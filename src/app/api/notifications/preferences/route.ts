import { NextRequest } from 'next/server';
import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import { verifyReminderPreferenceToken } from '@/services/ReminderPreferenceLinkService';

export const dynamic = 'force-dynamic';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-robots-tag': 'noindex, nofollow',
};

function renderHtml(title: string, message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${title}</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;
}

function topicLabel(topic: 'birthday' | 'yahrzeit'): string {
  return topic === 'birthday' ? 'birthday reminders' : 'yahrzeit reminders';
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new Response(
      renderHtml('Invalid reminder link', 'This reminder preference link is missing a token.'),
      { status: 400, headers: HTML_HEADERS },
    );
  }

  const payload = verifyReminderPreferenceToken(token);
  if (!payload) {
    return new Response(
      renderHtml('Invalid reminder link', 'This reminder preference link is invalid or has expired.'),
      { status: 410, headers: HTML_HEADERS },
    );
  }

  const updates =
    payload.topic === 'birthday'
      ? { birthOptOut: true }
      : { deathOptOut: true };

  try {
    await notificationPreferencesRepository.update(payload.userId, payload.siteId, updates);
  } catch (error) {
    console.error('[notification-preferences][token] failed to update preferences', {
      memberId: payload.userId,
      siteId: payload.siteId,
      topic: payload.topic,
      error,
    });
    return new Response(
      renderHtml('Unable to update preferences', 'We could not update your reminder preferences.'),
      { status: 500, headers: HTML_HEADERS },
    );
  }

  console.log('[notification-preferences][token] updated preferences via link', {
    memberId: payload.userId,
    siteId: payload.siteId,
    topic: payload.topic,
  });

  return new Response(
    renderHtml(
      'Preferences updated',
      `You've been unsubscribed from ${topicLabel(payload.topic)}.`,
    ),
    { status: 200, headers: HTML_HEADERS },
  );
}
