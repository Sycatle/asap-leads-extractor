import { NextRequest, NextResponse } from 'next/server';
import { addStep, findSequenceById, getDb, listSteps } from '@/lib/db';
import { AddStepSchema, validateInput, ValidationError } from '@/lib/validation';

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const seqId = parseId(id);
    if (!seqId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const steps = await listSteps(getDb(), seqId);
    return NextResponse.json({ steps });
  } catch (error) {
    console.error('Error listing steps:', error);
    return NextResponse.json({ error: 'Failed to list steps' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const seqId = parseId(id);
    if (!seqId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const db = getDb();
    const seq = await findSequenceById(db, seqId);
    if (!seq) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });

    const body = await request.json();
    const data = validateInput(AddStepSchema, body);
    if (data.channel === 'email' && !data.templateId) {
      return NextResponse.json({ error: 'email step requires templateId' }, { status: 400 });
    }

    const step = await addStep(db, {
      sequenceId: seqId,
      order: data.order,
      channel: data.channel,
      delayHours: data.delayHours,
      templateId: data.templateId ?? null,
      condition: data.condition ?? null,
    });
    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error creating step:', error);
    return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
  }
}
