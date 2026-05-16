import { NextRequest, NextResponse } from 'next/server';
import { addSequence, getDb, listSequences } from '@/lib/db';
import { AddSequenceSchema, SequenceStatusSchema, validateInput, ValidationError } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const statusParam = request.nextUrl.searchParams.get('status');
    const status = statusParam ? SequenceStatusSchema.parse(statusParam) : undefined;
    const items = await listSequences(getDb(), status);
    return NextResponse.json({ sequences: items });
  } catch (error) {
    console.error('Error listing sequences:', error);
    return NextResponse.json({ error: 'Failed to list sequences' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateInput(AddSequenceSchema, body);
    const seq = await addSequence(getDb(), data);
    return NextResponse.json(seq, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error creating sequence:', error);
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
  }
}
