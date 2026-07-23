import { NextRequest, NextResponse } from 'next/server';
import { growthLeadRepository } from '@/repositories/GrowthLeadRepository';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const { email, locale, honeyputValue, timeToSubmitMs } = await req.json();
    if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
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
      console.log('Blocked spam growth-signup submission', { email, siteId, honeyputValue, timeToSubmitMs, spamProbability });
      return NextResponse.json({ success: true });
    }

    const saved = await growthLeadRepository.addLead({
      email: email.trim(),
      locale: typeof locale === 'string' && locale.trim() ? locale.trim() : 'en',
      source: 'public-signup',
      siteId,
    });
    return NextResponse.json({ success: true, data: saved });
  } catch (err) {
    console.error('Growth signup error:', err);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
