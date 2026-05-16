/**
 * Worker Monitor - Dashboard console temps réel
 * 
 * Affiche un tableau de bord en temps réel avec:
 * - État des pipelines
 * - Métriques de performance
 * - Statistiques de la base de données
 * - Graphiques ASCII simples
 */

import { getDb } from './db';
import { formatDuration } from './utils';

// ===== TYPES =====

export interface PipelineMetrics {
  name: string;
  status: 'idle' | 'running' | 'error' | 'paused';
  isBlocked: boolean;
  totalRuns: number;
  totalProcessed: number;
  errors: number;
  lastDuration: number;
  avgDuration: number;
  lastRun: Date | null;
}

export interface DatabaseMetrics {
  totalLeads: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  needsEnrichSociete: number;
  needsEnrichWebsite: number;
  recentlyAdded: number; // Last 24h
  recentlyEnriched: number; // Last 24h
}

export interface WorkerMetrics {
  uptime: number;
  totalCycles: number;
  pipelines: PipelineMetrics[];
  database: DatabaseMetrics;
  performance: {
    avgCycleTime: number;
    leadsPerHour: number;
    enrichPerHour: number;
  };
}

// ===== MONITOR CLASS =====

export class WorkerMonitor {
  private startTime: Date;
  private cycleTimes: number[] = [];
  private leadsAdded: Array<{ count: number; time: Date }> = [];
  private leadsEnriched: Array<{ count: number; time: Date }> = [];
  
  constructor() {
    this.startTime = new Date();
  }
  
  /**
   * Record a cycle completion
   */
  recordCycle(durationMs: number, leadsAdded: number, leadsEnriched: number): void {
    this.cycleTimes.push(durationMs);
    
    // Keep only last 100 cycles
    if (this.cycleTimes.length > 100) {
      this.cycleTimes.shift();
    }
    
    const now = new Date();
    this.leadsAdded.push({ count: leadsAdded, time: now });
    this.leadsEnriched.push({ count: leadsEnriched, time: now });
    
    // Keep only last hour of data
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.leadsAdded = this.leadsAdded.filter(r => r.time > oneHourAgo);
    this.leadsEnriched = this.leadsEnriched.filter(r => r.time > oneHourAgo);
  }
  
  /**
   * Get database metrics
   */
  getDatabaseMetrics(): DatabaseMetrics {
    const db = getDb();
    
    const totalLeads = (db.prepare('SELECT COUNT(*) as c FROM leads').get() as { c: number } | undefined)?.c ?? 0;
    
    // Status breakdown
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) as c FROM leads GROUP BY status
    `).all() as Array<{ status: string; c: number }>;
    const byStatus: Record<string, number> = {};
    for (const row of statusRows) {
      byStatus[row.status] = row.c;
    }
    
    // Priority breakdown
    const priorityRows = db.prepare(`
      SELECT priority, COUNT(*) as c FROM leads GROUP BY priority
    `).all() as Array<{ priority: string; c: number }>;
    const byPriority: Record<string, number> = {};
    for (const row of priorityRows) {
      byPriority[row.priority] = row.c;
    }
    
    // Needs enrichment
    const needsEnrichSociete = (db.prepare(`
      SELECT COUNT(*) as c FROM leads WHERE siren IS NULL AND opt_out = 0
    `).get() as { c: number } | undefined)?.c ?? 0;
    
    const needsEnrichWebsite = (db.prepare(`
      SELECT COUNT(*) as c FROM leads WHERE cms_type IS NULL AND opt_out = 0
    `).get() as { c: number } | undefined)?.c ?? 0;
    
    // Recent activity (last 24h)
    const recentlyAdded = (db.prepare(`
      SELECT COUNT(*) as c FROM leads 
      WHERE created_at > datetime('now', '-1 day')
    `).get() as { c: number } | undefined)?.c ?? 0;
    
    const recentlyEnriched = (db.prepare(`
      SELECT COUNT(*) as c FROM leads 
      WHERE siren IS NOT NULL 
      AND updated_at > datetime('now', '-1 day')
    `).get() as { c: number } | undefined)?.c ?? 0;
    
    return {
      totalLeads,
      byStatus,
      byPriority,
      needsEnrichSociete,
      needsEnrichWebsite,
      recentlyAdded,
      recentlyEnriched,
    };
  }
  
  /**
   * Calculate performance metrics
   */
  getPerformanceMetrics(): { avgCycleTime: number; leadsPerHour: number; enrichPerHour: number } {
    const avgCycleTime = this.cycleTimes.length > 0
      ? this.cycleTimes.reduce((a, b) => a + b, 0) / this.cycleTimes.length
      : 0;
    
    const leadsPerHour = this.leadsAdded.reduce((sum, r) => sum + r.count, 0);
    const enrichPerHour = this.leadsEnriched.reduce((sum, r) => sum + r.count, 0);
    
    return { avgCycleTime, leadsPerHour, enrichPerHour };
  }
  
  /**
   * Get uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }
  
  /**
   * Print a compact status line
   */
  printStatusLine(pipelines: Record<string, { status: string; totalProcessed: number }>): void {
    const db = this.getDatabaseMetrics();
    const perf = this.getPerformanceMetrics();
    
    const pipelineStatus = Object.entries(pipelines)
      .map(([name, p]) => {
        const emoji = p.status === 'running' ? '🔄' : p.status === 'error' ? '❌' : '✅';
        return `${emoji}${name.slice(0, 3)}`;
      })
      .join(' ');
    
    const line = [
      `⏱️ ${formatDuration(this.getUptime())}`,
      `📊 ${db.totalLeads} leads`,
      `🔍 ${db.needsEnrichSociete} à enrichir`,
      `⚡ ${perf.leadsPerHour}/h`,
      pipelineStatus,
    ].join(' | ');
    
    process.stdout.write(`\r${line}     `);
  }
  
  /**
   * Print full dashboard
   */
  printDashboard(pipelines: PipelineMetrics[]): void {
    const db = this.getDatabaseMetrics();
    const perf = this.getPerformanceMetrics();
    const uptime = this.getUptime();
    
    console.log('\n' + '═'.repeat(80));
    console.log('📊 WORKER DASHBOARD');
    console.log('═'.repeat(80));
    
    // Header
    console.log(`\n  ⏱️  Uptime: ${formatDuration(uptime)}`);
    console.log(`  📈 Performance: ${perf.leadsPerHour} leads/h | ${perf.enrichPerHour} enrichis/h`);
    console.log(`  ⚡ Temps moyen cycle: ${formatDuration(perf.avgCycleTime)}`);
    
    // Database section
    console.log('\n  📁 BASE DE DONNÉES');
    console.log('  ' + '─'.repeat(40));
    console.log(`     Total: ${db.totalLeads} leads`);
    console.log(`     Ajoutés (24h): ${db.recentlyAdded} | Enrichis (24h): ${db.recentlyEnriched}`);
    console.log(`     À enrichir: ${db.needsEnrichSociete} SIREN | ${db.needsEnrichWebsite} website`);
    
    // Status breakdown
    console.log('\n     Par statut:');
    for (const [status, count] of Object.entries(db.byStatus)) {
      const bar = this.createBar(count, db.totalLeads, 20);
      console.log(`       ${status.padEnd(12)} ${bar} ${count}`);
    }
    
    // Priority breakdown
    console.log('\n     Par priorité:');
    for (const [priority, count] of Object.entries(db.byPriority)) {
      const bar = this.createBar(count, db.totalLeads, 20);
      const emoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
      console.log(`       ${emoji} ${priority.padEnd(8)} ${bar} ${count}`);
    }
    
    // Pipelines section
    console.log('\n  🔧 PIPELINES');
    console.log('  ' + '─'.repeat(40));
    
    for (const p of pipelines) {
      const status = this.getPipelineStatusIcon(p.status, p.isBlocked);
      const lastRun = p.lastRun ? this.getTimeAgo(p.lastRun) : 'jamais';
      const duration = p.lastDuration > 0 ? formatDuration(p.lastDuration) : '-';
      
      console.log(`     ${status} ${p.name.padEnd(15)} | ${p.totalRuns.toString().padStart(4)} runs | ${p.totalProcessed.toString().padStart(6)} traités | ${duration.padStart(8)} | ${lastRun}`);
      
      if (p.errors > 0) {
        console.log(`        ⚠️  ${p.errors} erreurs`);
      }
    }
    
    console.log('\n' + '═'.repeat(80));
  }
  
  private getPipelineStatusIcon(status: string, blocked: boolean): string {
    if (blocked) return '🔒';
    switch (status) {
      case 'running': return '🔄';
      case 'error': return '❌';
      case 'paused': return '⏸️';
      default: return '✅';
    }
  }
  
  private createBar(value: number, max: number, width: number): string {
    if (max === 0) return '░'.repeat(width);
    const filled = Math.round((value / max) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }
  
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}

// ===== ASCII GRAPH =====

export class AsciiGraph {
  private width: number;
  private height: number;
  
  constructor(width: number = 60, height: number = 10) {
    this.width = width;
    this.height = height;
  }
  
  /**
   * Create a line graph from data points
   */
  plot(data: number[], title?: string): string {
    if (data.length === 0) return '';
    
    const lines: string[] = [];
    
    // Normalize data to fit height
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    // Create graph
    for (let row = 0; row < this.height; row++) {
      const threshold = max - (row / (this.height - 1)) * range;
      let line = '';
      
      // Sample data points to fit width
      for (let col = 0; col < this.width; col++) {
        const dataIndex = Math.floor((col / this.width) * data.length);
        const value = data[dataIndex] ?? 0;
        
        if (value >= threshold) {
          line += '█';
        } else if (value >= threshold - (range / this.height / 2)) {
          line += '▄';
        } else {
          line += ' ';
        }
      }
      
      // Add Y-axis label
      const yLabel = row === 0 ? max.toFixed(0) : row === this.height - 1 ? min.toFixed(0) : '';
      lines.push(`${yLabel.padStart(5)} │${line}│`);
    }
    
    // Add X-axis
    lines.push('      └' + '─'.repeat(this.width) + '┘');
    
    if (title) {
      lines.unshift(`      ${title}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Create a bar chart
   */
  barChart(data: Array<{ label: string; value: number }>, maxLabelWidth: number = 12): string {
    if (data.length === 0) return '';
    
    const max = Math.max(...data.map(d => d.value), 1);
    const barWidth = this.width - maxLabelWidth - 10;
    
    const lines: string[] = [];
    
    for (const item of data) {
      const barLength = Math.round((item.value / max) * barWidth);
      const bar = '█'.repeat(barLength);
      const label = item.label.slice(0, maxLabelWidth).padEnd(maxLabelWidth);
      lines.push(`  ${label} │${bar} ${item.value}`);
    }
    
    return lines.join('\n');
  }
}

export default WorkerMonitor;
