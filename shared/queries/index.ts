/**
 * Shared Queries - Centralized database operations
 * 
 * Export all query functions from a single entry point.
 * Import in both worker and web to avoid code duplication.
 */

// Re-export all types
export * from './types.js';

// Re-export security utilities
export { sanitizeOrderBy, sanitizeOrderDir, softDeleteFilter } from './security.js';

// Re-export lead queries
export {
  findLeadsRaw,
  findLeads,
  findLeadsAdvancedRaw,
  findLeadsAdvanced,
  countLeads,
  countLeadsAdvanced,
  findByIdRaw,
  findById,
  updateLead,
  updateStatus,
  scheduleFollowup,
  softDeleteLead,
  restoreLead,
  logCall,
  addNote,
  markOptOut,
  getDistinctCities,
  getDistinctNiches,
  getFollowups,
} from './leads.js';

// Re-export history queries
export {
  addHistory,
  getLeadHistory,
  getLeadsHistory,
  countHistoryByType,
} from './history.js';

// Re-export session queries
export {
  startSession,
  endSession,
  updateSessionStats,
  getActiveSession,
  getSessionById,
  getRecentSessions,
} from './sessions.js';

// Re-export stats queries
export {
  getStats,
  getGamifiedStats,
} from './stats.js';

// Re-export pain points queries (normalized table)
export {
  getPainPointsForLead,
  getPainPointsArray,
  addPainPoint,
  addPainPoints,
  removePainPoint,
  clearPainPoints,
  findLeadsByPainPoint,
  getPainPointStats,
} from './painPoints.js';

// Re-export lead calls queries (normalized table)
export {
  getCallsForLead,
  getCallsForSession,
  recordCall,
  getCallCount,
  getCallStats,
  getCallsPerDay,
  getLastCall,
  getAverageCallDuration,
} from './calls.js';

// Re-export lead notes queries (normalized table)
export {
  getNotesForLead,
  addLeadNote,
  updateNote,
  deleteNote,
  getNoteCount,
  searchNotes,
} from './notes.js';

// Re-export status log queries (normalized table)
export {
  getStatusHistory,
  logStatusChange,
  getConversionFunnel,
  getStatusTransitions,
  getAverageTimeToConvert,
  getLeadsByStatusReached,
  getConversionRate,
} from './statusLog.js';

// Re-export daily stats queries (cached stats)
export {
  getStatsForDate,
  getStatsRange,
  getStatsLastDays,
  upsertDailyStats,
  incrementDailyStat,
  recalculateDailyStats,
  getAggregatedStats,
} from './dailyStats.js';
