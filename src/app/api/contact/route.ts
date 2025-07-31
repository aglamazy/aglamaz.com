import { NextRequest, NextResponse } from 'next/server';
import { contactRepository } from '@/repositories/ContactRepository';

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const saved = await contactRepository.addContactMessage({ name, email, message });
    return NextResponse.json({ success: true, data: saved });
  } catch (err) {
    console.error('Contact form error:', err);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
