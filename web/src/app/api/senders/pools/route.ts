import { NextRequest, NextResponse } from 'next/server';
import { addPool, getDb, listPools } from '@/lib/db';
import { AddPoolSchema, validateInput, ValidationError } from '@/lib/validation';

export async function GET() {
  const pools = await listPools(getDb());
  return NextResponse.json({ pools });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateInput(AddPoolSchema, body);
    const pool = await addPool(getDb(), data);
    return NextResponse.json(pool, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error creating pool:', error);
    return NextResponse.json({ error: 'Failed to create pool' }, { status: 500 });
  }
}
