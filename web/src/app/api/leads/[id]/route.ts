import { NextRequest, NextResponse } from 'next/server';
import { findById, updateLead, addNote } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lead = findById(parseInt(id));
    
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
    const body = await request.json();
    
    const success = updateLead(parseInt(id), body);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update lead' },
        { status: 400 }
      );
    }
    
    const updated = findById(parseInt(id));
    return NextResponse.json(updated);
  } catch (error) {
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
    const body = await request.json();
    
    if (body.note) {
      addNote(parseInt(id), body.note);
    }
    
    const updated = findById(parseInt(id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error adding note:', error);
    return NextResponse.json(
      { error: 'Failed to add note' },
      { status: 500 }
    );
  }
}
