import { NextRequest, NextResponse } from 'next/server';
import { getNextLead } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse excluded IDs (comma-separated)
    const excludeParam = searchParams.get('exclude');
    const excludeIds = excludeParam 
      ? excludeParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))
      : [];
    
    // Parse recent niches for rotation (comma-separated)
    const recentNichesParam = searchParams.get('recentNiches');
    const recentNiches = recentNichesParam 
      ? recentNichesParam.split(',').filter(n => n.trim())
      : [];
    
    const lead = getNextLead(excludeIds, { recentNiches });
    
    if (!lead) {
      return NextResponse.json({
        lead: null,
        message: 'Aucun lead à appeler',
        reason: 'all_done',
      });
    }
    
    return NextResponse.json({
      lead,
      reason: lead.next_followup_at 
        ? (new Date(lead.next_followup_at) < new Date() ? 'overdue_followup' : 'scheduled_followup')
        : (lead.call_status === 'non_appele' ? 'fresh_lead' : 'stale_callback'),
    });
  } catch (error) {
    console.error('Error getting next lead:', error);
    return NextResponse.json(
      { error: 'Failed to get next lead' },
      { status: 500 }
    );
  }
}
