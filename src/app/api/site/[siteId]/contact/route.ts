import { NextRequest, NextResponse } from 'next/server';
import { contactRepository } from '@/repositories/ContactRepository';
import { adminNotificationService } from '@/services/AdminNotificationService';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const { name, email, message, honeyputValue, timeToSubmitMs } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    let spamProbability = 0;
    if (typeof honeyputValue === 'string' && honeyputValue.trim().length > 0) {
      spamProbability += 50;
    }
    if (typeof timeToSubmitMs === 'number') {
      if (timeToSubmitMs <= 2000) {
        spamProbability += 25;
      }
      if (timeToSubmitMs <= 1000) {
        spamProbability += 25;
      }
    }

    if (spamProbability >= 50) {
      console.log('Blocked spam submission', {
        name,
        email,
        message,
        honeyputValue,
        timeToSubmitMs,
        spamProbability,
      });
      return NextResponse.json({ success: true });
    }
    const saved = await contactRepository.addContactMessage({ name, email, message });
    const origin = new URL(req.url).origin;
    await adminNotificationService.notify('contact_form', { name, email, message }, origin);
    return NextResponse.json({ success: true, data: saved });
  } catch (err) {
    console.error('Contact form error:', err);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
