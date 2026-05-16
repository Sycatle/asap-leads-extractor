/**
 * Stats Queries - Statistics and gamification
 */

import type Database from 'better-sqlite3';
import type { DbLead, LeadStatus, CallStatus } from '../types';
import type { LeadStats, GamifiedStats, TopLead, StatsPeriod } from './types';

// ===== BASIC STATS =====

export function getStats(db: Database.Database): LeadStats {
  const total = (db.prepare('SELECT COUNT(*) as count FROM leads WHERE deleted_at IS NULL').get() as { count: number }).count;

  const statusRows = db.prepare('SELECT status, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY status').all() as { status: LeadStatus; count: number }[];
  const by_status: Record<LeadStatus, number> = {
    nouveau: 0, contacte: 0, qualifie: 0, proposition: 0, converti: 0, perdu: 0
  };
  for (const row of statusRows) {
    by_status[row.status] = row.count;
  }

  const callRows = db.prepare('SELECT call_status, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY call_status').all() as { call_status: CallStatus; count: number }[];
  const by_call_status: Record<CallStatus, number> = {
    non_appele: 0, appele: 0, rappeler: 0, injoignable: 0
  };
  for (const row of callRows) {
    by_call_status[row.call_status] = row.count;
  }

  const priorityRows = db.prepare('SELECT priority, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY priority').all() as { priority: string; count: number }[];
  const by_priority: Record<string, number> = {};
  for (const row of priorityRows) {
    by_priority[row.priority] = row.count;
  }

  const cityRows = db.prepare('SELECT city, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY city ORDER BY count DESC LIMIT 10').all() as { city: string; count: number }[];
  const by_city: Record<string, number> = {};
  for (const row of cityRows) {
    by_city[row.city] = row.count;
  }

  const followups_today = (db.prepare(`
    SELECT COUNT(*) as count FROM leads 
    WHERE date(next_followup_at) <= date('now') AND deleted_at IS NULL
  `).get() as { count: number }).count;

  const to_call = (db.prepare(`
    SELECT COUNT(*) as count FROM leads 
    WHERE call_status = 'non_appele' AND status = 'nouveau' AND deleted_at IS NULL
  `).get() as { count: number }).count;

  return {
    total,
    by_status,
    by_call_status,
    by_priority,
    by_city,
    followups_today,
    to_call,
  };
}

// ===== GAMIFIED STATS =====

function getPeriodFilter(period: StatsPeriod): string {
  switch (period) {
    case '24h':
      return "AND created_at >= datetime('now', '-1 day')";
    case '7d':
      return "AND created_at >= datetime('now', '-7 days')";
    case '30d':
      return "AND created_at >= datetime('now', '-30 days')";
    case 'all':
      return '';
  }
}

function getPeriodDays(period: StatsPeriod): number {
  switch (period) {
    case '24h': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case 'all': return 365;
  }
}

export function getGamifiedStats(db: Database.Database, period: StatsPeriod = '24h'): GamifiedStats {
  const periodFilter = getPeriodFilter(period);
  const periodDays = getPeriodDays(period);

  // === PERIOD STATS ===
  const callsCount = (db.prepare(`
    SELECT COUNT(*) as count FROM lead_history 
    WHERE type = 'call' ${periodFilter}
  `).get() as { count: number }).count;

  const contactsCount = (db.prepare(`
    SELECT COUNT(*) as count FROM lead_history 
    WHERE type = 'call' 
    ${periodFilter}
    AND new_value IN ('interesse', 'rdv_pris', 'devis_envoye', 'rappeler')
  `).get() as { count: number }).count;

  const rdvCount = (db.prepare(`
    SELECT COUNT(*) as count FROM lead_history 
    WHERE type = 'call' 
    ${periodFilter}
    AND new_value = 'rdv_pris'
  `).get() as { count: number }).count;

  const avgDuration = (db.prepare(`
    SELECT AVG(duration_seconds) as avg FROM lead_history 
    WHERE type = 'call' 
    ${periodFilter}
    AND duration_seconds IS NOT NULL
  `).get() as { avg: number | null }).avg ?? 0;

  // Daily goal based on period
  const callsGoal = period === '24h' ? 25 : period === '7d' ? 175 : period === '30d' ? 500 : 1000;

  // === STREAK CALCULATION ===
  const activityDays = db.prepare(`
    SELECT DISTINCT date(created_at) as day FROM lead_history 
    WHERE type = 'call'
    AND created_at >= datetime('now', '-30 days')
    ORDER BY day DESC
  `).all() as { day: string }[];

  let currentStreak = 0;
  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  const todayStr = checkDate.toISOString().split('T')[0];
  const hasActivityToday = activityDays.some(d => d.day === todayStr);

  if (!hasActivityToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  const streakDate = new Date(checkDate);
  for (const activityDay of activityDays) {
    const expectedDate = streakDate.toISOString().split('T')[0];
    if (activityDay.day === expectedDate) {
      currentStreak++;
      streakDate.setDate(streakDate.getDate() - 1);
    } else if (activityDay.day < expectedDate) {
      break;
    }
  }

  const bestStreak = Math.max(currentStreak, 5);

  // === TOP LEADS ===
  const topLeadsRows = db.prepare(`
    SELECT 
      id, name, city, niche, phone, score, priority, website, website_status, pain_points, image_url, rating, reviews_count
    FROM leads 
    WHERE status = 'nouveau' 
    AND call_status = 'non_appele'
    AND (opt_out IS NULL OR opt_out = 0)
    AND deleted_at IS NULL
    ORDER BY 
      CASE WHEN website IS NULL OR website = '' THEN 0 ELSE 1 END,
      score DESC,
      priority = 'high' DESC
    LIMIT 5
  `).all() as DbLead[];

  const topLeads: TopLead[] = topLeadsRows.map(lead => {
    let reason = '';
    if (!lead.website) {
      reason = '🚫 Pas de site web';
    } else if (lead.website_status === 'old') {
      reason = '⚠️ Site vieillot';
    } else if (lead.website_status === 'platform') {
      reason = '📦 Site plateforme limitant';
    } else if (lead.score && lead.score >= 70) {
      reason = '⭐ Score élevé';
    } else {
      reason = '📞 À contacter';
    }

    return {
      id: lead.id,
      name: lead.name,
      city: lead.city,
      niche: lead.niche,
      phone: lead.phone,
      score: lead.score ?? 50,
      priority: lead.priority,
      website: lead.website,
      website_status: lead.website_status,
      pain_points: lead.pain_points ? JSON.parse(lead.pain_points) : null,
      reason,
      image_url: lead.image_url,
      rating: lead.rating,
      reviews_count: lead.reviews_count,
    };
  });

  // === PERFORMANCE BY PERIOD ===
  const weeklyData = db.prepare(`
    SELECT 
      date(created_at) as day,
      COUNT(*) as calls,
      SUM(CASE WHEN new_value IN ('interesse', 'rdv_pris', 'devis_envoye', 'rappeler') THEN 1 ELSE 0 END) as contacts
    FROM lead_history 
    WHERE type = 'call'
    AND created_at >= datetime('now', '-${periodDays} days')
    GROUP BY date(created_at)
    ORDER BY day
  `).all() as { day: string; calls: number; contacts: number }[];

  const labels: string[] = [];
  const calls: number[] = [];
  const contacts: number[] = [];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const displayDays = Math.min(periodDays, 30);
  for (let i = displayDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const dayData = weeklyData.find(w => w.day === dayStr);

    if (periodDays <= 7) {
      labels.push(dayNames[d.getDay()]);
    } else {
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }
    calls.push(dayData?.calls ?? 0);
    contacts.push(dayData?.contacts ?? 0);
  }

  // === CONVERSION RATE ===
  const totalLeads = (db.prepare('SELECT COUNT(*) as count FROM leads WHERE deleted_at IS NULL').get() as { count: number }).count;
  const convertedLeads = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'converti' AND deleted_at IS NULL").get() as { count: number }).count;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return {
    today: {
      calls_today: callsCount,
      calls_goal: callsGoal,
      contacts_today: contactsCount,
      rdv_today: rdvCount,
      avg_call_duration: Math.round(avgDuration),
    },
    streak: {
      current_streak: currentStreak,
      best_streak: bestStreak,
      last_activity_date: activityDays[0]?.day ?? null,
    },
    top_leads: topLeads,
    weekly_performance: {
      calls,
      contacts,
      labels,
    },
    conversion_rate: conversionRate,
  };
}
