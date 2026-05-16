import { NextRequest, NextResponse } from 'next/server';
import { findSequenceById, getDb, listSteps, updateSequence } from '@/lib/db';
import { UpdateSequenceSchema, validateInput, ValidationError } from '@/lib/validation';

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const seqId = parseId(id);
    if (!seqId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const db = getDb();
    const seq = await findSequenceById(db, seqId);
    if (!seq) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const steps = await listSteps(db, seqId);
    return NextResponse.json({ ...seq, steps });
  } catch (error) {
    console.error('Error fetching sequence:', error);
    return NextResponse.json({ error: 'Failed to fetch sequence' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const seqId = parseId(id);
    if (!seqId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const body = await request.json();
    const data = validateInput(UpdateSequenceSchema, body);
    const updated = await updateSequence(getDb(), seqId, data);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error updating sequence:', error);
    return NextResponse.json({ error: 'Failed to update sequence' }, { status: 500 });
  }
}
