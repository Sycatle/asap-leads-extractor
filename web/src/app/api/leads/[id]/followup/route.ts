import { NextRequest, NextResponse } from 'next/server';
import { scheduleFollowupWithHistory, findById } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const date = body.date as string;
    const note = body.note as string | undefined;
    
    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }
    
    const success = scheduleFollowupWithHistory(parseInt(id), date, note);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to schedule followup' },
        { status: 400 }
      );
    }
    
    const updated = findById(parseInt(id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error scheduling followup:', error);
    return NextResponse.json(
      { error: 'Failed to schedule followup' },
      { status: 500 }
    );
  }
}
