import { NextRequest, NextResponse } from 'next/server';
import { addSuppression, getDb, listSuppressions, removeSuppression } from '@/lib/db';
import { AddSuppressionSchema, validateInput, ValidationError } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 1000) : 100;
    const entries = await listSuppressions(getDb(), limit);
    return NextResponse.json({ entries, count: entries.length });
  } catch (error) {
    console.error('Error listing suppressions:', error);
    return NextResponse.json({ error: 'Failed to list suppressions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateInput(AddSuppressionSchema, body);

    const entry = await addSuppression(getDb(), {
      email: data.email,
      reason: data.reason,
      source: data.source ?? 'api',
    });

    // entry est null si l'email était déjà supprimé (idempotent)
    return NextResponse.json({ ok: true, added: !!entry, entry }, { status: entry ? 201 : 200 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error adding suppression:', error);
    return NextResponse.json({ error: 'Failed to add suppression' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
    const removed = await removeSuppression(getDb(), email);
    return NextResponse.json({ removed });
  } catch (error) {
    console.error('Error removing suppression:', error);
    return NextResponse.json({ error: 'Failed to remove suppression' }, { status: 500 });
  }
}
