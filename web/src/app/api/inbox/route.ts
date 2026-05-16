import { NextRequest, NextResponse } from 'next/server';
import { getDb, listInboundUnhandled, markLeadEmailHandled } from '@/lib/db';

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;
  const emails = await listInboundUnhandled(getDb(), limit);
  return NextResponse.json({ emails, count: emails.length });
}

export async function POST(request: NextRequest) {
  // marque un email comme handled (action manuelle inbox)
  try {
    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const ok = await markLeadEmailHandled(getDb(), id);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error('inbox POST error:', err);
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
}
