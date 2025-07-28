import { NextRequest, NextResponse } from 'next/server';
import { FamilyRepository } from '../../../../repositories/FamilyRepository';
import { GmailService } from '../../../../services/GmailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, email, siteId } = body;

    if (!firstName || !email || !siteId) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, email, siteId' },
        { status: 400 }
      );
    }

    // Create a verification token
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store the verification request in Firestore
    const familyRepository = new FamilyRepository();
    await familyRepository.createSignupRequest({
      firstName,
      email,
      siteId,
      verificationToken,
      expiresAt,
      status: 'pending_verification'
    });

    // Send verification email
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signup/verify?token=${verificationToken}`;
    
    try {
      const gmailService = new GmailService();
      await gmailService.sendVerificationEmail(email, firstName, verificationUrl);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
      data: {
        email
      }
    });

  } catch (error) {
    console.error('Verification request error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
} 