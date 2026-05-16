import { NextResponse } from 'next/server';
import { getDb, getDailyCost, getTotalCostCents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days') || 14)));
    const db = getDb();

    const [daily, today, last7, last30] = await Promise.all([
      getDailyCost(db, days),
      getTotalCostCents(db, 1),
      getTotalCostCents(db, 7),
      getTotalCostCents(db, 30),
    ]);

    return NextResponse.json({
      daily,
      totals: { today_cents: today, last_7d_cents: last7, last_30d_cents: last30 },
      window_days: days,
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
