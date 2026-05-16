import { NextRequest, NextResponse } from 'next/server';
import { bulkEnroll, findContactsByLead, findSequenceById, getDb, isSuppressed } from '@/lib/db';
import { EnrollSchema, validateInput, ValidationError } from '@/lib/validation';
import type { NewEnrollment } from '@/lib/db';

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) || n <= 0 ? null : n;
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
    const data = validateInput(EnrollSchema, body);

    // Résoudre leadIds → premier contact non supprimé par lead
    const enrollments: NewEnrollment[] = [];
    if (data.leadIds?.length) {
      for (const leadId of data.leadIds) {
        const contacts = await findContactsByLead(db, leadId);
        const target = contacts.find((c) => c.verifiedStatus !== 'bounced' && c.verifiedStatus !== 'unsub');
        if (!target) continue;
        if (await isSuppressed(db, target.email)) continue;
        enrollments.push({ sequenceId: seqId, leadId, contactId: target.id });
      }
    }
    if (data.contactIds?.length) {
      // Pour contactIds explicites, on suppose que l'appelant a déjà validé
      // mais on garde la suppression check
      const { findContactById } = await import('@/lib/db');
      for (const contactId of data.contactIds) {
        const c = await findContactById(db, contactId);
        if (!c) continue;
        if (await isSuppressed(db, c.email)) continue;
        enrollments.push({ sequenceId: seqId, leadId: c.leadId, contactId });
      }
    }

    const inserted = await bulkEnroll(db, enrollments);
    return NextResponse.json({ requested: enrollments.length, enrolled: inserted }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error enrolling:', error);
    return NextResponse.json({ error: 'Failed to enroll' }, { status: 500 });
  }
}
