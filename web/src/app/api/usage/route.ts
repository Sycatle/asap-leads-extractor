import { NextResponse } from 'next/server';
import { getDb, getDailyCost, getTotalCostCents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days') || 14)));
    const db = getDb();

    return NextResponse.json({
      daily: getDailyCost(db, days),
      totals: {
        today_cents: getTotalCostCents(db, 1),
        last_7d_cents: getTotalCostCents(db, 7),
        last_30d_cents: getTotalCostCents(db, 30),
      },
      window_days: days,
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
