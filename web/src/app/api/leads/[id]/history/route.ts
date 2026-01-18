import { NextRequest, NextResponse } from 'next/server';
import { getLeadHistory, findById } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    
    // Verify lead exists
    const lead = findById(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const history = getLeadHistory(leadId, limit);
    
    return NextResponse.json({
      lead_id: leadId,
      history,
      total: history.length,
    });
  } catch (error) {
    console.error('Error fetching lead history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead history' },
      { status: 500 }
    );
  }
}
