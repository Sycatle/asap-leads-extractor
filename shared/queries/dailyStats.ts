/**
 * Daily Stats Queries - Operations on cached stats_daily table
 */

import type Database from 'better-sqlite3';
import type { DbStatsDaily } from '../types.js';

/**
 * Get stats for a specific date
 */
export function getStatsForDate(db: Database.Database, date: string): DbStatsDaily | null {
  const stmt = db.prepare('SELECT * FROM stats_daily WHERE date = ?');
  return (stmt.get(date) as DbStatsDaily) ?? null;
}

/**
 * Get stats for a range of dates
 */
export function getStatsRange(db: Database.Database, startDate: string, endDate: string): DbStatsDaily[] {
  const stmt = db.prepare(`
    SELECT * FROM stats_daily 
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC
  `);
  return stmt.all(startDate, endDate) as DbStatsDaily[];
}

/**
 * Get stats for the last N days
 */
export function getStatsLastDays(db: Database.Database, days: number): DbStatsDaily[] {
  const stmt = db.prepare(`
    SELECT * FROM stats_daily 
    WHERE date >= date('now', '-${days} days')
    ORDER BY date ASC
  `);
  return stmt.all() as DbStatsDaily[];
}

/**
 * Update or insert stats for a date (upsert)
 */
export function upsertDailyStats(db: Database.Database, stats: Partial<DbStatsDaily> & { date: string }): boolean {
  const existing = getStatsForDate(db, stats.date);
  
  if (existing) {
    // Update
    const fields: string[] = [];
    const params: Record<string, unknown> = { date: stats.date };
    
    const updateableFields: (keyof DbStatsDaily)[] = [
      'leads_created', 'leads_contacted', 'leads_qualified', 'leads_converted', 'leads_lost',
      'calls_made', 'calls_reached', 'calls_voicemail', 'followups_set', 'avg_score'
    ];
    
    for (const field of updateableFields) {
      if (stats[field] !== undefined) {
        fields.push(`${field} = @${field}`);
        params[field] = stats[field];
      }
    }
    
    if (fields.length === 0) return false;
    
    fields.push("updated_at = datetime('now')");
    
    const stmt = db.prepare(`UPDATE stats_daily SET ${fields.join(', ')} WHERE date = @date`);
    const result = stmt.run(params);
    return result.changes > 0;
  } else {
    // Insert
    const stmt = db.prepare(`
      INSERT INTO stats_daily (
        date, leads_created, leads_contacted, leads_qualified, leads_converted, leads_lost,
        calls_made, calls_reached, calls_voicemail, followups_set, avg_score
      ) VALUES (
        @date, @leads_created, @leads_contacted, @leads_qualified, @leads_converted, @leads_lost,
        @calls_made, @calls_reached, @calls_voicemail, @followups_set, @avg_score
      )
    `);
    
    const result = stmt.run({
      date: stats.date,
      leads_created: stats.leads_created ?? 0,
      leads_contacted: stats.leads_contacted ?? 0,
      leads_qualified: stats.leads_qualified ?? 0,
      leads_converted: stats.leads_converted ?? 0,
      leads_lost: stats.leads_lost ?? 0,
      calls_made: stats.calls_made ?? 0,
      calls_reached: stats.calls_reached ?? 0,
      calls_voicemail: stats.calls_voicemail ?? 0,
      followups_set: stats.followups_set ?? 0,
      avg_score: stats.avg_score ?? 0,
    });
    
    return result.changes > 0;
  }
}

/**
 * Increment a stat counter for today
 */
export function incrementDailyStat(
  db: Database.Database, 
  field: keyof Pick<DbStatsDaily, 'leads_created' | 'leads_contacted' | 'leads_qualified' | 'leads_converted' | 'leads_lost' | 'calls_made' | 'calls_reached' | 'calls_voicemail' | 'followups_set'>,
  amount = 1
): boolean {
  const today = new Date().toISOString().split('T')[0];
  
  // Ensure today's row exists
  const existing = getStatsForDate(db, today);
  if (!existing) {
    upsertDailyStats(db, { date: today });
  }
  
  const stmt = db.prepare(`
    UPDATE stats_daily 
    SET ${field} = ${field} + ?, updated_at = datetime('now')
    WHERE date = ?
  `);
  const result = stmt.run(amount, today);
  return result.changes > 0;
}

/**
 * Recalculate stats for a specific date from raw data
 * This is useful for fixing cached data or initial population
 */
export function recalculateDailyStats(db: Database.Database, date: string): DbStatsDaily {
  const dateStart = `${date} 00:00:00`;
  const dateEnd = `${date} 23:59:59`;
  
  // Count leads created
  const leadsCreated = (db.prepare(`
    SELECT COUNT(*) as count FROM leads 
    WHERE created_at >= ? AND created_at <= ?
  `).get(dateStart, dateEnd) as { count: number }).count;
  
  // Count status changes
  const statusCounts = db.prepare(`
    SELECT to_status, COUNT(*) as count 
    FROM lead_status_log 
    WHERE changed_at >= ? AND changed_at <= ?
    GROUP BY to_status
  `).all(dateStart, dateEnd) as { to_status: string; count: number }[];
  
  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) {
    statusMap[row.to_status] = row.count;
  }
  
  // Count calls
  const callStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN outcome IN ('appele', 'interesse', 'rdv_pris', 'devis_envoye') THEN 1 ELSE 0 END) as reached,
      SUM(CASE WHEN outcome = 'messagerie' THEN 1 ELSE 0 END) as voicemail
    FROM lead_calls 
    WHERE called_at >= ? AND called_at <= ?
  `).get(dateStart, dateEnd) as { total: number; reached: number; voicemail: number };
  
  // Count followups set
  const followupsSet = (db.prepare(`
    SELECT COUNT(*) as count FROM lead_history 
    WHERE type = 'followup_set' 
    AND created_at >= ? AND created_at <= ?
  `).get(dateStart, dateEnd) as { count: number }).count;
  
  // Average score of leads created that day
  const avgScore = (db.prepare(`
    SELECT AVG(score) as avg FROM leads 
    WHERE created_at >= ? AND created_at <= ?
  `).get(dateStart, dateEnd) as { avg: number | null }).avg ?? 0;
  
  const stats: DbStatsDaily = {
    date,
    leads_created: leadsCreated,
    leads_contacted: statusMap['contacte'] ?? 0,
    leads_qualified: statusMap['qualifie'] ?? 0,
    leads_converted: statusMap['converti'] ?? 0,
    leads_lost: statusMap['perdu'] ?? 0,
    calls_made: callStats.total,
    calls_reached: callStats.reached,
    calls_voicemail: callStats.voicemail,
    followups_set: followupsSet,
    avg_score: Math.round(avgScore),
    updated_at: new Date().toISOString(),
  };
  
  upsertDailyStats(db, stats);
  
  return stats;
}

/**
 * Get aggregated stats for a period
 */
export function getAggregatedStats(db: Database.Database, days: number): {
  total_leads_created: number;
  total_calls_made: number;
  total_calls_reached: number;
  avg_daily_calls: number;
  conversion_rate: number;
} {
  const stats = getStatsLastDays(db, days);
  
  const totals = stats.reduce((acc, s) => ({
    leads_created: acc.leads_created + s.leads_created,
    calls_made: acc.calls_made + s.calls_made,
    calls_reached: acc.calls_reached + s.calls_reached,
    converted: acc.converted + s.leads_converted,
    contacted: acc.contacted + s.leads_contacted,
  }), { leads_created: 0, calls_made: 0, calls_reached: 0, converted: 0, contacted: 0 });
  
  return {
    total_leads_created: totals.leads_created,
    total_calls_made: totals.calls_made,
    total_calls_reached: totals.calls_reached,
    avg_daily_calls: stats.length > 0 ? Math.round(totals.calls_made / stats.length) : 0,
    conversion_rate: totals.contacted > 0 ? Math.round((totals.converted / totals.contacted) * 100) : 0,
  };
}
