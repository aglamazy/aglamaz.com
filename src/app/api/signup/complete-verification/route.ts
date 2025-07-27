import { NextRequest, NextResponse } from 'next/server';
import { FamilyRepository } from '../../../../repositories/FamilyRepository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, userId } = body;

    if (!token || !userId) {
      return NextResponse.json(
        { error: 'Missing token or user ID' },
        { status: 400 }
      );
    }

    // Complete the verification with user ID
    const familyRepository = new FamilyRepository();
    await familyRepository.verifySignupRequest(token, userId);

    return NextResponse.json({
      success: true,
      message: 'Verification completed successfully',
      data: {
        userId,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Complete verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete verification' },
      { status: 400 }
    );
  }
} 