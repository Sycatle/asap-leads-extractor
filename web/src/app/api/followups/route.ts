import { NextResponse } from 'next/server';
import { getFollowups } from '@/lib/db';

export async function GET() {
  try {
    const followups = getFollowups();
    
    // Group by urgency
    const grouped = {
      overdue: followups.filter(f => f.urgency === 'overdue'),
      today: followups.filter(f => f.urgency === 'today'),
      tomorrow: followups.filter(f => f.urgency === 'tomorrow'),
      week: followups.filter(f => f.urgency === 'week'),
    };
    
    return NextResponse.json({
      followups,
      grouped,
      counts: {
        overdue: grouped.overdue.length,
        today: grouped.today.length,
        tomorrow: grouped.tomorrow.length,
        week: grouped.week.length,
        total: followups.length,
      },
    });
  } catch (error) {
    console.error('Error fetching followups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch followups' },
      { status: 500 }
    );
  }
}
