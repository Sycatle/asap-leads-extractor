import { NextRequest, NextResponse } from 'next/server';
import { addTemplate, getDb, listTemplates } from '@/lib/db';
import { AddTemplateSchema, validateInput, ValidationError } from '@/lib/validation';

export async function GET() {
  try {
    const items = await listTemplates(getDb());
    return NextResponse.json({ templates: items });
  } catch (error) {
    console.error('Error listing templates:', error);
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateInput(AddTemplateSchema, body);
    const tpl = await addTemplate(getDb(), {
      name: data.name,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      bodyText: data.bodyText,
      variables: data.variables ?? [],
    });
    return NextResponse.json(tpl, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
