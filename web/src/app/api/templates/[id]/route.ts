import { NextRequest, NextResponse } from 'next/server';
import { deleteTemplate, findTemplateById, getDb, updateTemplate } from '@/lib/db';
import { UpdateTemplateSchema, validateInput, ValidationError } from '@/lib/validation';

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tplId = parseId(id);
  if (!tplId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const tpl = await findTemplateById(getDb(), tplId);
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tpl);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tplId = parseId(id);
    if (!tplId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const body = await request.json();
    const data = validateInput(UpdateTemplateSchema, body);
    const ok = await updateTemplate(getDb(), tplId, data);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tplId = parseId(id);
  if (!tplId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const ok = await deleteTemplate(getDb(), tplId);
  return NextResponse.json({ deleted: ok });
}
