import { NextRequest, NextResponse } from 'next/server';
import { findById, updateLead, addNote } from '@/lib/db';
import { 
  UpdateLeadSchema, 
  AddNoteSchema, 
  validateInput, 
  ValidationError 
} from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId) || leadId <= 0) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      );
    }
    
    const lead = findById(leadId);
    
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId) || leadId <= 0) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Validate input with Zod
    const validatedData = validateInput(UpdateLeadSchema, body);
    
    const success = updateLead(leadId, validatedData);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update lead' },
        { status: 400 }
      );
    }
    
    const updated = findById(leadId);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.message },
        { status: 400 }
      );
    }
    console.error('Error updating lead:', error);
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId) || leadId <= 0) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Validate input with Zod
    const validatedData = validateInput(AddNoteSchema, body);
    
    addNote(leadId, validatedData.note);
    
    const updated = findById(leadId);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.message },
        { status: 400 }
      );
    }
    console.error('Error adding note:', error);
    return NextResponse.json(
      { error: 'Failed to add note' },
      { status: 500 }
    );
  }
}
