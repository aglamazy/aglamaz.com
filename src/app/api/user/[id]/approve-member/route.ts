import { NextRequest, NextResponse } from 'next/server';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import type { IMember } from '@/entities/Member';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { signupRequestId } = await request.json();
    if (!signupRequestId) {
      return NextResponse.json({ error: 'Missing signupRequestId' }, { status: 400 });
    }
    const familyRepository = new FamilyRepository();
    // Fetch the signup request
    const signupRequest = await familyRepository.getSignupRequestById(signupRequestId);
    if (!signupRequest) {
      return NextResponse.json({ error: 'Signup request not found' }, { status: 404 });
    }
    // Create the member object
    const member: Partial<IMember> = {
      uid: signupRequest.userId || '',
      siteId: signupRequest.siteId,
      role: 'member',
      displayName: signupRequest.firstName || '',
      firstName: signupRequest.firstName || '',
      email: signupRequest.email,
    };
    // Save the member
    const created = await familyRepository.createMember(member);
    // Mark the signup request as approved
    await familyRepository.markSignupRequestApproved(signupRequestId);
    return NextResponse.json({ member: created });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to approve member' }, { status: 500 });
  }
} 