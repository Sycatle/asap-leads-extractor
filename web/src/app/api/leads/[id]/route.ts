import { NextRequest, NextResponse } from 'next/server';
import { getDb, findById, updateLead, addNote } from '@/lib/db';
import { UpdateLeadSchema, AddNoteSchema, validateInput, ValidationError } from '@/lib/validation';

function parseLeadId(id: string): number | null {
  const n = parseInt(id);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = parseLeadId(id);
    if (!leadId) return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });

    const lead = await findById(getDb(), leadId);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    return NextResponse.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = parseLeadId(id);
    if (!leadId) return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });

    const body = await request.json();
    const validatedData = validateInput(UpdateLeadSchema, body);

    const db = getDb();
    const success = await updateLead(db, leadId, validatedData);
    if (!success) return NextResponse.json({ error: 'Failed to update lead' }, { status: 400 });

    const updated = await findById(db, leadId);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = parseLeadId(id);
    if (!leadId) return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });

    const body = await request.json();
    const validatedData = validateInput(AddNoteSchema, body);

    const db = getDb();
    await addNote(db, leadId, validatedData.note);
    const updated = await findById(db, leadId);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error adding note:', error);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
