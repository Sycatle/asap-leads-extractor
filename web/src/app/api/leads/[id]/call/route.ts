import { NextRequest, NextResponse } from 'next/server';
import { logCallWithHistory, findById } from '@/lib/db';
import { LogCallSchema, validateInput, ValidationError } from '@/lib/validation';

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
    const validatedData = validateInput(LogCallSchema, body);
    
    const success = logCallWithHistory(leadId, validatedData.call_status, validatedData.note);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to log call' },
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
    console.error('Error logging call:', error);
    return NextResponse.json(
      { error: 'Failed to log call' },
      { status: 500 }
    );
  }
}
