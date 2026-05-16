import { NextRequest, NextResponse } from 'next/server';
import { getDb, findById, markOptOut, addHistory } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId) || leadId <= 0) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    const db = getDb();
    const lead = await findById(db, leadId);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const success = await markOptOut(db, leadId);
    if (!success) return NextResponse.json({ error: 'Failed to mark opt-out' }, { status: 400 });

    await addHistory(db, {
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
    return NextResponse.json({ error: 'Failed to mark opt-out' }, { status: 500 });
  }
}
