/**
 * Web DB layer - re-exporte le client Drizzle + queries du worker.
 *
 * Toutes les routes API web passent par ici. Les helpers historiques
 * (lead history, sessions, scraperConfig) qui n'ont pas encore été portés
 * sur Drizzle sont exposés comme stubs qui throw — chaque feature manquante
 * sera portée dans une itération dédiée.
 */

import { sql } from 'drizzle-orm';
import { getDb, closeDb, getPool, type DbClient, schema } from '../../../db/client';
import { leads as leadsTable } from '../../../db/schema';
import type { GamifiedStats, StatsPeriod, FollowupLead, LeadHistoryEntry, CallSession } from './stub-types';

export { getDb, closeDb, getPool, type DbClient, schema };
export { leads as leadsTable } from '../../../db/schema';
export type { Lead, NewLead } from '../../../db/schema';
export type { LeadStats } from '../../../db/queries/stats';
export type { DailyCost, UsageRecord } from '../../../db/queries/llmUsage';
export type { LeadFilters, AdvancedLeadFilters } from '../../../db/queries/filters';
export type { LeadHistoryEntry, HistoryType, CallSession, GamifiedStats, StatsPeriod, TopLead, TodayStats, StreakInfo, FollowupLead, FollowupUrgency, ScraperNiche, ScraperCity, ScraperSettings, ScraperConfigFromDb } from './stub-types';

// Re-export Drizzle async queries
export {
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
  getStats,
  getDailyCost,
  getTotalCostCents,
  recordUsage,
} from '../../../db/queries';

// ===== STUBS — features not yet ported to Drizzle =====
// Ces stubs permettent au web de compiler. À l'usage, ils throw 501 et la
// route concernée renverra 500 dans le try/catch. Port à faire au fil de l'eau.

function notImplemented<T>(feature: string): T {
  throw new Error(`Feature '${feature}' pas encore portée sur Drizzle/Postgres`);
}

export async function getNextLead(_excludeIds?: number[], _niche?: string | null): Promise<unknown> {
  return notImplemented('getNextLead');
}

export async function getGamifiedStats(_period?: StatsPeriod): Promise<GamifiedStats> {
  return notImplemented('getGamifiedStats');
}

export async function getFollowups(): Promise<FollowupLead[]> {
  return notImplemented('getFollowups');
}

export async function addNote(_id: number, _note: string): Promise<boolean> {
  return notImplemented('addNote (use history-aware version)');
}

export async function getLeadHistory(_leadId: number, _limit?: number): Promise<LeadHistoryEntry[]> {
  return notImplemented('getLeadHistory');
}

export async function addHistory(_entry: Omit<LeadHistoryEntry, 'id' | 'created_at'>): Promise<number> {
  return notImplemented('addHistory');
}

export async function updateStatusWithHistory(_id: number, _status: string, _note?: string): Promise<boolean> {
  return notImplemented('updateStatusWithHistory');
}

export async function scheduleFollowupWithHistory(_id: number, _date: string, _note?: string): Promise<boolean> {
  return notImplemented('scheduleFollowupWithHistory');
}

export async function logCallWithHistory(
  _id: number,
  _callStatus: string,
  _note?: string,
  _durationSec?: number,
  _sessionId?: number,
): Promise<boolean> {
  return notImplemented('logCallWithHistory');
}

export async function startSession(): Promise<CallSession> {
  return notImplemented('startSession');
}

export async function endSession(_id: number): Promise<CallSession | null> {
  return notImplemented('endSession');
}

export async function getActiveSession(): Promise<CallSession | null> {
  return notImplemented('getActiveSession');
}

export async function updateSessionStats(
  _id: number,
  _stats: Partial<Pick<CallSession, 'total_calls' | 'total_reached' | 'total_voicemail' | 'total_scheduled'>>,
): Promise<boolean> {
  return notImplemented('updateSessionStats');
}

export async function getSessionById(_id: number): Promise<CallSession | null> {
  return notImplemented('getSessionById');
}

// Healthcheck léger : compte les leads pour valider la connexion DB
export async function dbHealthcheck(): Promise<{ totalLeads: number }> {
  const [row] = await getDb().select({ c: sql<number>`count(*)::int` }).from(leadsTable);
  return { totalLeads: row?.c ?? 0 };
}

// scraperConfig namespace stub
export const scraperConfig = {
  loadScraperConfigFromDb: () => notImplemented('scraperConfig.loadScraperConfigFromDb'),
  getNiches: () => notImplemented('scraperConfig.getNiches'),
  getCities: () => notImplemented('scraperConfig.getCities'),
  getAllSettings: () => notImplemented('scraperConfig.getAllSettings'),
};
