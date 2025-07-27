import { NextRequest, NextResponse } from 'next/server';
import { FamilyRepository } from '../../../../../../repositories/FamilyRepository';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; siteId: string } }
) {
  try {
    // Verify admin permissions
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get pending signup requests from database
    const familyRepository = new FamilyRepository();
    const pendingRequests = await familyRepository.getPendingSignupRequests(params.siteId);

    // Transform to match the expected format
    const pendingMembers = pendingRequests.map(request => ({
      id: request.id,
      firstName: request.firstName,
      email: request.email,
      status: request.status,
      requestedAt: request.createdAt.toDate().toISOString(),
      verifiedAt: request.verifiedAt?.toDate().toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: pendingMembers
    });

  } catch (error) {
    console.error('Get pending members error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending members' },
      { status: 500 }
    );
  }
} 