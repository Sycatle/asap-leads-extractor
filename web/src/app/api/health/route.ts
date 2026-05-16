import { NextResponse } from 'next/server';
import { dbHealthcheck } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { totalLeads } = await dbHealthcheck();
    return NextResponse.json({ status: 'ok', totalLeads, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'unknown' },
      { status: 503 },
    );
  }
}
