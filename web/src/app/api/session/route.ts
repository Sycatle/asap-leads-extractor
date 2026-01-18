import { NextRequest, NextResponse } from 'next/server';
import { 
  startSession, 
  endSession, 
  getActiveSession, 
  getSessionById,
  updateSessionStats 
} from '@/lib/db';

// GET - Get active session or specific session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    
    if (sessionId) {
      const session = getSessionById(parseInt(sessionId));
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(session);
    }
    
    const activeSession = getActiveSession();
    return NextResponse.json({
      session: activeSession,
      active: !!activeSession,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// POST - Start new session
export async function POST() {
  try {
    // End any active session first
    const active = getActiveSession();
    if (active) {
      endSession(active.id);
    }
    
    const session = startSession();
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error starting session:', error);
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    );
  }
}

// PATCH - Update session stats or end session
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, stats } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }
    
    if (action === 'end') {
      const session = endSession(id);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(session);
    }
    
    if (stats) {
      const success = updateSessionStats(id, stats);
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update session stats' },
          { status: 400 }
        );
      }
      const session = getSessionById(id);
      return NextResponse.json(session);
    }
    
    return NextResponse.json(
      { error: 'No action specified' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
