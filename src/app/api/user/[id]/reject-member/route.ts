import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { memberId, siteId } = body;

    if (!memberId || !siteId) {
      return NextResponse.json(
        { error: 'Missing required fields: memberId, siteId' },
        { status: 400 }
      );
    }

    // Call our server's rejectMember function
    // This would typically update the database to reject the member
    
    // TODO: Replace with actual server-side rejection logic
    // This could involve:
    // 1. Updating member status in database
    // 2. Sending notification to rejected member
    // 3. Logging the rejection action
    
    const result = {
      success: true,
      memberId,
      siteId,
      rejectedBy: params.id,
      rejectedAt: new Date().toISOString(),
      status: 'rejected'
    };

    return NextResponse.json({
      success: true,
      message: 'Member rejected successfully',
      data: result
    });

  } catch (error) {
    console.error('Reject member error:', error);
    return NextResponse.json(
      { error: 'Failed to reject member' },
      { status: 500 }
    );
  }
} 