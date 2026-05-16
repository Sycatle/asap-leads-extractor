import { NextRequest, NextResponse } from 'next/server';
import { addSender, getDb, listSenders } from '@/lib/db';
import { AddSenderSchema, validateInput, ValidationError } from '@/lib/validation';

export async function GET() {
  try {
    const senders = await listSenders(getDb());
    // ne pas exposer providerConfig (peut contenir secrets)
    const safe = senders.map(({ providerConfig: _, ...rest }) => rest);
    return NextResponse.json({ senders: safe });
  } catch (error) {
    console.error('Error listing senders:', error);
    return NextResponse.json({ error: 'Failed to list senders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateInput(AddSenderSchema, body);
    const sender = await addSender(getDb(), {
      email: data.email,
      domain: data.domain,
      displayName: data.displayName ?? null,
      replyToTemplate: data.replyToTemplate ?? null,
      provider: data.provider,
      providerConfig: data.providerConfig ?? null,
      dailyLimit: data.dailyLimit ?? 50,
      sendingWindow: data.sendingWindow ?? null,
    });
    return NextResponse.json(sender, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error creating sender:', error);
    return NextResponse.json({ error: 'Failed to create sender' }, { status: 500 });
  }
}
