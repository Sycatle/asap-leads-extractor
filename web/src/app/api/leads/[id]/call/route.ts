import { NextRequest, NextResponse } from 'next/server';
import { logCallWithHistory, findById, type CallStatus } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const callStatus = body.call_status as CallStatus;
    const note = body.note as string | undefined;
    
    if (!callStatus) {
      return NextResponse.json(
        { error: 'call_status is required' },
        { status: 400 }
      );
    }
    
    const success = logCallWithHistory(parseInt(id), callStatus, note);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to log call' },
        { status: 400 }
      );
    }
    
    const updated = findById(parseInt(id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error logging call:', error);
    return NextResponse.json(
      { error: 'Failed to log call' },
      { status: 500 }
    );
  }
}
