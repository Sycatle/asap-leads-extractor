import { NextRequest, NextResponse } from 'next/server';
import { findById, markOptOut, addHistory } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId) || leadId <= 0) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      );
    }
    
    const lead = findById(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }
    
    const success = markOptOut(leadId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to mark opt-out' },
        { status: 400 }
      );
    }
    
    // Log to history
    addHistory({
      lead_id: leadId,
      type: 'status_change',
      old_value: lead.status,
      new_value: 'perdu',
      note: 'Opt-out demandé',
      duration_seconds: null,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking opt-out:', error);
    return NextResponse.json(
      { error: 'Failed to mark opt-out' },
      { status: 500 }
    );
  }
}
