import { NextRequest, NextResponse } from 'next/server';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { firstName, email, siteId } = body;

    if (!firstName || !email || !siteId) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, email, siteId' },
        { status: 400 }
      );
    }

    const familyRepository = new FamilyRepository();

    const signupRequest = await familyRepository.createSignupRequest({
      firstName,
      email,
      siteId,
      userId: params.id,
      status: 'pending'
    });

    return NextResponse.json({
      success: true,
      message: 'Signup request submitted successfully',
      data: signupRequest
    });

  } catch (error) {
    console.error('Signup request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit signup request' },
      { status: 500 }
    );
  }
} 