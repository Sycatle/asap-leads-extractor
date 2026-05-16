import { NextResponse } from 'next/server';
import { getDb, getStats } from '@/lib/db';

// Gamified stats simplifié post-migration : on dérive les chiffres depuis getStats.
// La version riche (streak, top_leads, today calls par session) nécessite un port
// complet de l'ancien stats.ts — à faire dans une itération dédiée.
export async function GET() {
  try {
    const stats = await getStats(getDb());
    return NextResponse.json({
      today: {
        calls_made: stats.contacted_today,
        leads_qualified: stats.by_status.qualifie,
        followups_due: stats.followups_today,
      },
      streak: { current_streak: 0, longest_streak: 0, last_call_date: null },
      top_leads: [],
      period_stats: stats,
    });
  } catch (error) {
    console.error('Error fetching gamified stats:', error);
    return NextResponse.json({ error: 'Failed to fetch gamified stats' }, { status: 500 });
  }
}
