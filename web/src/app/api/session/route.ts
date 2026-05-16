import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  startSession,
  endSession,
  getActiveSession,
  getSessionById,
  updateSessionStats,
} from '@/lib/db';
import { UpdateSessionSchema, validateInput, ValidationError } from '@/lib/validation';

// GET - Get active session or specific session by id
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (sessionId) {
      const session = await getSessionById(db, parseInt(sessionId));
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return NextResponse.json(session);
    }

    const activeSession = await getActiveSession(db);
    return NextResponse.json({ session: activeSession, active: !!activeSession });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

// POST - Start new session (auto-ends current active if any)
export async function POST() {
  try {
    const db = getDb();
    const active = await getActiveSession(db);
    if (active) await endSession(db, active.id);
    const session = await startSession(db);
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error starting session:', error);
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
}

// PATCH - Update stats or end session
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = validateInput(UpdateSessionSchema, body);
    const { id, action, stats } = validatedData;
    const db = getDb();

    if (action === 'end') {
      const session = await endSession(db, id);
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return NextResponse.json(session);
    }

    if (stats) {
      const success = await updateSessionStats(db, id, stats);
      if (!success) return NextResponse.json({ error: 'Failed to update session stats' }, { status: 400 });
      const session = await getSessionById(db, id);
      return NextResponse.json(session);
    }

    return NextResponse.json({ error: 'No action specified' }, { status: 400 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
