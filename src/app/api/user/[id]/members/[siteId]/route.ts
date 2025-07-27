import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; siteId: string } }
) {
  try {
    // Verify member permissions
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call our server's function to get site members
    // This would typically query the database for approved members
    
    // TODO: Replace with actual database query
    // This could involve:
    // 1. Querying the database for approved members
    // 2. Checking member permissions
    // 3. Filtering by siteId
    
    // Mock data for demonstration - this should check if the user is actually a member
    const members = [
      {
        id: params.id,
        firstName: 'משתמש',
        email: 'user@example.com',
        status: 'approved',
        joinedAt: '2024-01-10T09:00:00Z'
      }
    ];

    return NextResponse.json({
      success: true,
      data: members
    });

  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
} 