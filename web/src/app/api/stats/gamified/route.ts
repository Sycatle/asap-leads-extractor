import { NextRequest, NextResponse } from 'next/server';
import { getGamifiedStats, StatsPeriod } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || '24h') as StatsPeriod;
    
    // Validate period
    const validPeriods: StatsPeriod[] = ['24h', '7d', '30d', 'all'];
    const safePeriod = validPeriods.includes(period) ? period : '24h';
    
    const stats = getGamifiedStats(safePeriod);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching gamified stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gamified stats' },
      { status: 500 }
    );
  }
}
