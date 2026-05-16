/**
 * Email templates — versions HTML+text avec variables {{firstName}}.
 *
 * Le rendu (résolution des variables) est fait dans le worker au moment de
 * l'envoi, pas en DB.
 */

import { asc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { templates, type NewTemplate, type Template } from '../schema';

export async function listTemplates(db: DbClient): Promise<Template[]> {
  return db.select().from(templates).orderBy(asc(templates.name));
}

export async function findTemplateById(db: DbClient, id: number): Promise<Template | null> {
  const rows = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function addTemplate(db: DbClient, tpl: NewTemplate): Promise<Template | null> {
  const rows = await db.insert(templates).values(tpl).returning();
  return rows[0] ?? null;
}

export async function updateTemplate(
  db: DbClient,
  id: number,
  data: Partial<NewTemplate>,
): Promise<boolean> {
  const rows = await db
    .update(templates)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(templates.id, id))
    .returning({ id: templates.id });
  return rows.length > 0;
}

export async function deleteTemplate(db: DbClient, id: number): Promise<boolean> {
  const rows = await db.delete(templates).where(eq(templates.id, id)).returning({ id: templates.id });
  return rows.length > 0;
}
