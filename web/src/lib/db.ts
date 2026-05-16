/**
 * Web DB layer - re-exporte le client Drizzle + queries du worker.
 * Toutes les routes API web passent par ici.
 */

import { sql } from 'drizzle-orm';
import { getDb, closeDb, getPool, type DbClient, schema } from '../../../db/client';
import { leads as leadsTable } from '../../../db/schema';

export { getDb, closeDb, getPool, type DbClient, schema };
export { leads as leadsTable } from '../../../db/schema';
export type { Lead, NewLead } from '../../../db/schema';

// Re-export all Drizzle queries
export {
  // leads
  findLeads,
  findLeadsAdvanced,
  countLeads,
  countLeadsAdvanced,
  findById,
  findByPhone,
  insertLead,
  updateLead,
  updateStatus,
  scheduleFollowup,
  softDeleteLead,
  restoreLead,
  logCall,
  markOptOut,
  getDistinctCities,
  getDistinctNiches,
  // stats
  getStats,
  // llm usage
  getDailyCost,
  getTotalCostCents,
  recordUsage,
  // history
  getLeadHistory,
  addHistory,
  updateStatusWithHistory,
  logCallWithHistory,
  scheduleFollowupWithHistory,
  addNoteWithHistory,
  getFollowups,
  // sessions
  startSession,
  endSession,
  getActiveSession,
  getSessionById,
  updateSessionStats,
  // lead selection
  getNextLead,
} from '../../../db/queries';

export type { LeadStats } from '../../../db/queries/stats';
export type { DailyCost, UsageRecord } from '../../../db/queries/llmUsage';
export type { LeadFilters, AdvancedLeadFilters } from '../../../db/queries/filters';
export type { LeadHistoryEntry, HistoryType, FollowupLead, FollowupUrgency } from '../../../db/queries/history';
export type { CallSession } from '../../../db/queries/sessions';

// Healthcheck léger : compte les leads pour valider la connexion DB
export async function dbHealthcheck(): Promise<{ totalLeads: number }> {
  const [row] = await getDb().select({ c: sql<number>`count(*)::int` }).from(leadsTable);
  return { totalLeads: row?.c ?? 0 };
}

// addNote : alias historique pour add note via lead_notes + concaténation
export { addNoteWithHistory as addNote } from '../../../db/queries';

// Features non encore portées (sont des stubs jusqu'à port)
function notImplemented<T>(feature: string): T {
  throw new Error(`Feature '${feature}' pas encore portée sur Drizzle/Postgres`);
}

export async function getGamifiedStats(_period?: 'today' | '7d' | '30d' | 'all'): Promise<unknown> {
  return notImplemented('getGamifiedStats');
}

export const scraperConfig = {
  loadScraperConfigFromDb: () => notImplemented('scraperConfig.loadScraperConfigFromDb'),
  getNiches: () => notImplemented('scraperConfig.getNiches'),
  getCities: () => notImplemented('scraperConfig.getCities'),
  getAllSettings: () => notImplemented('scraperConfig.getAllSettings'),
};

export type StatsPeriod = 'today' | '7d' | '30d' | 'all';
