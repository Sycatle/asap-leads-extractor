/**
 * Shared Queries - Centralized database operations
 * 
 * Export all query functions from a single entry point.
 * Import in both worker and web to avoid code duplication.
 */

// Re-export all types
export * from './types';

// Re-export security utilities
export { sanitizeOrderBy, sanitizeOrderDir, softDeleteFilter } from './security';

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
} from './leads';

// Re-export history queries
export {
  addHistory,
  getLeadHistory,
  getLeadsHistory,
  countHistoryByType,
} from './history';

// Re-export session queries
export {
  startSession,
  endSession,
  updateSessionStats,
  getActiveSession,
  getSessionById,
  getRecentSessions,
} from './sessions';

// Re-export stats queries
export {
  getStats,
  getGamifiedStats,
} from './stats';

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
} from './painPoints';

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
} from './calls';

// Re-export lead notes queries (normalized table)
export {
  getNotesForLead,
  addLeadNote,
  updateNote,
  deleteNote,
  getNoteCount,
  searchNotes,
} from './notes';

// Re-export status log queries (normalized table)
export {
  getStatusHistory,
  logStatusChange,
  getConversionFunnel,
  getStatusTransitions,
  getAverageTimeToConvert,
  getLeadsByStatusReached,
  getConversionRate,
} from './statusLog';

// Re-export daily stats queries (cached stats)
export {
  getStatsForDate,
  getStatsRange,
  getStatsLastDays,
  upsertDailyStats,
  incrementDailyStat,
  recalculateDailyStats,
  getAggregatedStats,
} from './dailyStats';

// Re-export scraper config queries
export {
  hasScraperConfigTables,
  getNiches,
  getNicheNames,
  addNiche,
  updateNiche,
  deleteNiche,
  getCities,
  getCityNames,
  addCity,
  updateCity,
  deleteCity,
  getDepartments,
  addDepartment,
  toggleDepartment,
  getExcludeKeywords,
  addExcludeKeyword,
  removeExcludeKeyword,
  getSetting,
  getSettingNumber,
  getSettingBoolean,
  setSetting,
  getAllSettings,
  loadScraperConfigFromDb,
  importConfigToDb,
} from './scraperConfig';

export type { ScraperNiche, ScraperCity, ScraperSettings, ScraperConfigFromDb } from './scraperConfig';
