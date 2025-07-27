import { NextRequest, NextResponse } from 'next/server';
import { FamilyRepository } from '../../../../repositories/FamilyRepository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Missing verification token' },
        { status: 400 }
      );
    }

    // Verify the token (without user ID yet)
    const familyRepository = new FamilyRepository();
    const signupRequest = await familyRepository.verifySignupRequest(token, '');

    return NextResponse.json({
      success: true,
      message: 'Token verified successfully',
      data: {
        firstName: signupRequest.firstName,
        email: signupRequest.email,
        siteId: signupRequest.siteId
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 400 }
    );
  }
} 