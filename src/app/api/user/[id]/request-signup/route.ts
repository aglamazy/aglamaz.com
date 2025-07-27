import { NextRequest, NextResponse } from 'next/server';

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

    // Create signup request (mock implementation for now)
    const result = {
      success: true,
      userId: params.id,
      firstName,
      email,
      siteId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Signup request submitted successfully',
      data: result
    });

  } catch (error) {
    console.error('Signup request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit signup request' },
      { status: 500 }
    );
  }
} 