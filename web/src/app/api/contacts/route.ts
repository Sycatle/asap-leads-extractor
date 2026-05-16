import { NextRequest, NextResponse } from 'next/server';
import { addContact, findById, findContactsByLead, getDb, logConsent } from '@/lib/db';
import { AddContactSchema, validateInput, ValidationError } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const leadIdParam = request.nextUrl.searchParams.get('leadId');
    if (!leadIdParam) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }
    const leadId = parseInt(leadIdParam, 10);
    if (isNaN(leadId) || leadId <= 0) {
      return NextResponse.json({ error: 'Invalid leadId' }, { status: 400 });
    }
    const contacts = await findContactsByLead(getDb(), leadId);
    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateInput(AddContactSchema, body);

    const db = getDb();
    const lead = await findById(db, data.leadId);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const contact = await addContact(db, {
      leadId: data.leadId,
      email: data.email.trim().toLowerCase(),
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      role: data.role ?? null,
      phone: data.phone ?? null,
      linkedinUrl: data.linkedinUrl ?? null,
      source: data.source,
    });

    if (contact) {
      await logConsent(db, {
        contactId: contact.id,
        basis: 'legitimate_interest',
        evidence: `manual add via web UI, source=${data.source}, lead=${lead.id} (${lead.name})`,
      });
    }

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error adding contact:', error);
    return NextResponse.json({ error: 'Failed to add contact' }, { status: 500 });
  }
}
