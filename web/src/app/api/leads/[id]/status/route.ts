import { NextRequest, NextResponse } from 'next/server';
import { updateStatus, findById, type LeadStatus } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const status = body.status as LeadStatus;
    
    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }
    
    const success = updateStatus(parseInt(id), status);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 400 }
      );
    }
    
    const updated = findById(parseInt(id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}
