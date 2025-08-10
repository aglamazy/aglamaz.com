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
    const origin = new URL(request.url).origin;
    await familyRepository.createSignupRequest({
      firstName,
      email,
      siteId,
      verificationToken,
      expiresAt,
      status: 'pending_verification'
    }, origin);

    // Send verification email
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || origin}/signup/verify?token=${verificationToken}`;
    
    try {
      const gmailService = await GmailService.init();
      await gmailService.sendVerificationEmail(email, firstName, verificationUrl);
      
      // Update the document to mark email as verified
      const emailKey = email.toLowerCase().trim();
      const documentKey = `${emailKey}_${siteId}`;
      const crypto = require('crypto');
      const documentId = crypto.createHash('sha256').update(documentKey).digest('hex');
      
      await familyRepository.updateSignupRequestEmailVerified(documentId);
      
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