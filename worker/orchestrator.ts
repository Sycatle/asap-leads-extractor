/**
 * Worker Orchestrator - Le cerveau du système
 * 
 * Architecture multi-pipeline parallèle:
 * - Pipeline SCRAPE: Google Maps scraping
 * - Pipeline ENRICH_SOCIETE: Enrichissement SIREN/dirigeant via Societe.com
 * - Pipeline ENRICH_WEBSITE: Analyse CMS, vitesse, pain points
 * 
 * Features:
 * - Exécution parallèle des pipelines compatibles
 * - Queues intelligentes avec backpressure
 * - Métriques temps réel
 * - Graceful shutdown
 * - Auto-adaptation du rythme selon la charge
 */

import { EventEmitter } from 'events';
import { loadConfig, reloadConfigFromDb } from './config';
import { getDb, closeDb } from './db';
import { scrapeGoogleMaps } from './googleMapsScraper';
import { enrich as enrichSociete } from './enrich';
import { enrichWebsiteAnalysis } from './enrichWebsite';
import { enrichLegalNotices } from './enrichLegal';
import { sleep, formatDuration } from './utils';
import { WorkerMonitor, type PipelineMetrics } from './monitor';
import { orchLogger as log } from './logger';
import type { Config } from '../shared/types';

// ===== TYPES =====

type PipelineStatus = 'idle' | 'running' | 'paused' | 'error';

interface PipelineState {
  status: PipelineStatus;
  lastRun: Date | null;
  lastDuration: number;
  totalRuns: number;
  totalProcessed: number;
  errors: number;
  isBlocked: boolean;
  blockReason?: string;
}

interface OrchestratorMetrics {
  uptime: number;
  totalCycles: number;
  pipelines: {
    scrape: PipelineState;
    enrichSociete: PipelineState;
    enrichWebsite: PipelineState;
  };
  database: {
    totalLeads: number;
    needsEnrichSociete: number;
    needsEnrichWebsite: number;
  };
}

interface OrchestratorConfig {
  // Intervalles minimum entre runs (ms)
  scrapeInterval: number;
  enrichSocieteInterval: number;
  enrichWebsiteInterval: number;
  enrichLegalInterval: number;

  // Limites par cycle
  maxScrapePerCycle: number;      // Nombre max de requêtes GMaps par cycle (pas total leads)
  maxEnrichPerCycle: number;
  maxWebsitePerCycle: number;
  maxLegalPerCycle: number;
  
  // Seuils d'équilibrage
  enrichPriorityThreshold: number; // Si > N leads à enrichir, prioriser enrich sur scrape
  
  // Comportement
  enableParallelPipelines: boolean;
  enableAutoThrottle: boolean;
  metricsInterval: number;
}

// Kept for reference; the actual config is loaded from DB
const _DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  scrapeInterval: 5 * 60 * 1000,        // 5 min entre scrapes (plus court car incrémental)
  enrichSocieteInterval: 1 * 60 * 1000,  // 1 min entre enrichissements (plus agressif)
  enrichWebsiteInterval: 5 * 60 * 1000,  // 5 min entre analyses website
  enrichLegalInterval: 10 * 60 * 1000,   // 10 min entre extractions mentions-légales (coût API)

  maxScrapePerCycle: 3,          // 3 requêtes GMaps par cycle (niche+ville)
  maxEnrichPerCycle: 30,
  maxWebsitePerCycle: 20,
  maxLegalPerCycle: 10,           // 10 leads / cycle pour limiter coût Claude
  enrichPriorityThreshold: 50,   // Si > 50 leads à enrichir, prioriser enrich
  
  enableParallelPipelines: true,
  enableAutoThrottle: true,
  metricsInterval: 30 * 1000, // 30 sec
};

/**
 * Merge config.json orchestrator settings with defaults
 */
function buildOrchestratorConfig(appConfig: Config, overrides?: Partial<OrchestratorConfig>): OrchestratorConfig {
  const fromFile = appConfig.orchestrator || {};
  
  return {
    scrapeInterval: (fromFile.scrape_interval ?? 10) * 60 * 1000,
    enrichSocieteInterval: (fromFile.enrich_interval ?? 2) * 60 * 1000,
    enrichWebsiteInterval: (fromFile.website_interval ?? 5) * 60 * 1000,
    enrichLegalInterval: (fromFile.legal_interval ?? 10) * 60 * 1000,

    maxScrapePerCycle: fromFile.max_scrape_per_cycle ?? 3,
    maxEnrichPerCycle: fromFile.max_enrich_per_cycle ?? 30,
    maxWebsitePerCycle: fromFile.max_website_per_cycle ?? 20,
    maxLegalPerCycle: fromFile.max_legal_per_cycle ?? 10,
    enrichPriorityThreshold: fromFile.enrich_priority_threshold ?? 50,
    
    enableParallelPipelines: fromFile.parallel_pipelines ?? true,
    enableAutoThrottle: fromFile.auto_throttle ?? true,
    metricsInterval: (fromFile.metrics_interval ?? 30) * 1000,
    
    ...overrides,
  };
}

// ===== ORCHESTRATOR CLASS =====

export class WorkerOrchestrator extends EventEmitter {
  private config: Config;
  private orchConfig: OrchestratorConfig;
  private isRunning: boolean = false;
  private startTime: Date = new Date();
  private totalCycles: number = 0;
  
  private pipelines: {
    scrape: PipelineState;
    enrichSociete: PipelineState;
    enrichWebsite: PipelineState;
    enrichLegal: PipelineState;
  };
  
  private metricsTimer: NodeJS.Timeout | null = null;
  private mainLoopTimer: NodeJS.Timeout | null = null;
  private monitor: WorkerMonitor;
  
  // État du scraping incrémental
  private scrapeIndex: number = 0;  // Index actuel dans la liste des requêtes
  private scrapeQueries: Array<{ niche: string; city: string }> = [];
  
  constructor(overrides?: Partial<OrchestratorConfig>) {
    super();
    this.config = loadConfig();
    this.orchConfig = buildOrchestratorConfig(this.config, overrides);
    this.monitor = new WorkerMonitor();
    
    this.pipelines = {
      scrape: this.createPipelineState(),
      enrichSociete: this.createPipelineState(),
      enrichWebsite: this.createPipelineState(),
      enrichLegal: this.createPipelineState(),
    };

    // Auto-block legal pipeline if no API key (avoids repeated startup errors)
    if (!process.env.ANTHROPIC_API_KEY) {
      this.pipelines.enrichLegal.isBlocked = true;
      this.pipelines.enrichLegal.blockReason = 'ANTHROPIC_API_KEY non configurée';
    }
    
    // Générer la liste des requêtes de scraping
    this.initScrapeQueries();
  }
  
  /**
   * Génère la liste combinée niche × ville pour le scraping incrémental
   */
  private initScrapeQueries(): void {
    const niches = this.config.scrape?.niches || [];
    const cities = this.config.scrape?.cities || [];
    
    this.scrapeQueries = [];
    for (const niche of niches) {
      for (const city of cities) {
        this.scrapeQueries.push({ niche, city });
      }
    }
    
    // Mélanger pour varier les résultats
    this.shuffleArray(this.scrapeQueries);
    
    log.info(`${this.scrapeQueries.length} requêtes de scraping préparées`);
  }
  
  /**
   * Reload configuration from database if available
   * This allows changing niches/cities without restarting the worker
   */
  private reloadConfig(): void {
    const dbConfig = reloadConfigFromDb();
    if (dbConfig) {
      const nichesChanged = JSON.stringify(dbConfig.scrape?.niches) !== JSON.stringify(this.config.scrape?.niches);
      const citiesChanged = JSON.stringify(dbConfig.scrape?.cities) !== JSON.stringify(this.config.scrape?.cities);
      
      if (nichesChanged || citiesChanged) {
        log.info('🔄 Configuration mise à jour depuis la base de données');
        this.config = dbConfig;
        this.orchConfig = buildOrchestratorConfig(dbConfig, {});
        this.initScrapeQueries(); // Rebuild query list
      }
    }
  }
  
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  private createPipelineState(): PipelineState {
    return {
      status: 'idle',
      lastRun: null,
      lastDuration: 0,
      totalRuns: 0,
      totalProcessed: 0,
      errors: 0,
      isBlocked: false,
    };
  }
  
  // ===== MAIN LOOP =====
  
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Orchestrator déjà en cours');
      return;
    }
    
    this.isRunning = true;
    this.startTime = new Date();
    
    // Init DB
    getDb();
    
    this.printBanner();
    this.startMetricsLoop();
    
    // Premier cycle immédiat
    await this.runMainCycle();
    
    // Boucle principale intelligente
    this.scheduleNextCycle();
    
    // Handle shutdown
    this.setupShutdownHandlers();
    
    log.blank();
    log.success('Orchestrator démarré. Ctrl+C pour arrêter.');
    log.blank();
  }
  
  private printBanner(): void {
    log.header('LEADS FINDER - ORCHESTRATOR v2.0', 70);
    log.kv('Scraping', this.config.scrape?.niches?.join(', ') || 'N/A', 2);
    log.kv('Villes', this.config.scrape?.cities?.join(', ') || 'N/A', 2);
    log.kv('Mode', 'Séquentiel intelligent', 2);
    log.divider('=', 70);
  }
  
  private async runMainCycle(): Promise<void> {
    this.totalCycles++;
    const cycleStart = Date.now();
    
    log.section(`CYCLE #${this.totalCycles} - ${new Date().toLocaleString('fr-FR')}`, 70);
    
    // Reload config from database if available (allows runtime changes)
    this.reloadConfig();
    
    try {
      // Déterminer quels pipelines peuvent tourner
      const tasksToRun = this.getReadyPipelines();
      
      if (tasksToRun.length === 0) {
        log.info('Aucun pipeline prêt, attente...');
        return;
      }
      
      log.info(`Pipelines prêts: ${tasksToRun.join(', ')}`);
      
      // Exécution séquentielle avec priorisation intelligente
      // (le parallélisme cause des conflits de sortie terminal)
      await this.runParallelPipelines(tasksToRun);
      
      const cycleDuration = Date.now() - cycleStart;
      log.success(`Cycle terminé en ${formatDuration(cycleDuration)}`);
      
    } catch (error) {
      log.error(`Erreur cycle: ${(error as Error).message}`);
    }
  }
  
  private getReadyPipelines(): string[] {
    const ready: string[] = [];

    // Check scrape
    if (this.isPipelineReady('scrape', this.orchConfig.scrapeInterval)) {
      if (this.config.scrape?.niches?.length && this.config.scrape?.cities?.length) {
        ready.push('scrape');
      }
    }
    
    // Check enrich (toujours prêt s'il y a du travail)
    if (this.isPipelineReady('enrichSociete', this.orchConfig.enrichSocieteInterval)) {
      ready.push('enrichSociete');
    }
    
    // Check website enrichment
    if (this.isPipelineReady('enrichWebsite', this.orchConfig.enrichWebsiteInterval)) {
      ready.push('enrichWebsite');
    }

    // Check legal extraction (LLM agent)
    if (this.isPipelineReady('enrichLegal', this.orchConfig.enrichLegalInterval)) {
      ready.push('enrichLegal');
    }

    return ready;
  }
  
  private isPipelineReady(name: keyof typeof this.pipelines, interval: number): boolean {
    const pipeline = this.pipelines[name];
    
    if (pipeline.status === 'running') return false;
    if (pipeline.isBlocked) return false;
    
    if (!pipeline.lastRun) return true;
    
    const elapsed = Date.now() - pipeline.lastRun.getTime();
    return elapsed >= interval;
  }
  
  private async runParallelPipelines(tasks: string[]): Promise<void> {
    // IMPORTANT: Exécution séquentielle pour éviter les conflits de sortie terminal
    // Toutes les tâches Playwright (scrape, enrichSociete, enrichWebsite) doivent tourner une par une
    
    // Ordre de priorité intelligent
    const orderedTasks = this.prioritizeTasks(tasks);
    
    for (const task of orderedTasks) {
      await this.runPipeline(task);
    }
  }
  
  /**
   * Priorise les tâches selon l'état de la DB
   */
  private prioritizeTasks(tasks: string[]): string[] {
    const db = getDb();
    const needsEnrich = (db.prepare(`
      SELECT COUNT(*) as c FROM leads WHERE siren IS NULL AND opt_out = 0
    `).get() as { c: number }).c;
    
    // Prioriser enrichissement si beaucoup en attente, sinon scrape
    const priority: Record<string, number> = {
      enrichSociete: needsEnrich >= this.orchConfig.enrichPriorityThreshold ? 1 : 3,
      scrape: needsEnrich >= this.orchConfig.enrichPriorityThreshold ? 3 : 1,
      enrichWebsite: 2,
    };
    
    return [...tasks].sort((a, b) => (priority[a] || 99) - (priority[b] || 99));
  }
  
  /**
   * Sélectionne la tâche Playwright prioritaire selon l'état de la DB
   */
  private selectPlaywrightTask(tasks: string[]): string | undefined {
    if (tasks.length === 0) return undefined;
    if (tasks.length === 1) return tasks[0];
    
    // Si les deux sont disponibles (scrape et enrichSociete)
    const db = getDb();
    const needsEnrich = (db.prepare(`
      SELECT COUNT(*) as c FROM leads WHERE siren IS NULL AND opt_out = 0
    `).get() as { c: number }).c;
    
    // Prioriser l'enrichissement si beaucoup de leads en attente
    if (needsEnrich >= this.orchConfig.enrichPriorityThreshold) {
      log.info(`Priorité enrichissement (${needsEnrich} leads en attente)`);
      return 'enrichSociete';
    }
    
    // Sinon alterner : pair = scrape, impair = enrich
    if (this.totalCycles % 2 === 0 && tasks.includes('scrape')) {
      return 'scrape';
    }
    
    return tasks.includes('enrichSociete') ? 'enrichSociete' : tasks[0];
  }
  
  private async runPipeline(name: string): Promise<void> {
    const pipeline = this.pipelines[name as keyof typeof this.pipelines];
    const startTime = Date.now();
    
    pipeline.status = 'running';
    log.info(`[${name.toUpperCase()}] Démarrage...`);
    
    try {
      let processed = 0;
      
      switch (name) {
        case 'scrape':
          processed = await this.runScrapePipeline();
          break;
        case 'enrichSociete':
          processed = await this.runEnrichSocietePipeline();
          break;
        case 'enrichWebsite':
          processed = await this.runEnrichWebsitePipeline();
          break;
        case 'enrichLegal':
          processed = await this.runEnrichLegalPipeline();
          break;
      }
      
      pipeline.lastRun = new Date();
      pipeline.lastDuration = Date.now() - startTime;
      pipeline.totalRuns++;
      pipeline.totalProcessed += processed;
      pipeline.status = 'idle';
      
      log.success(`[${name.toUpperCase()}] Terminé: ${processed} traités en ${formatDuration(pipeline.lastDuration)}`);
      
    } catch (error) {
      pipeline.status = 'error';
      pipeline.errors++;
      log.error(`[${name.toUpperCase()}] ${(error as Error).message}`);
      
      // Bloquer temporairement si trop d'erreurs
      if (pipeline.errors >= 3) {
        pipeline.isBlocked = true;
        pipeline.blockReason = 'Trop d\'erreurs consécutives';
        log.warn(`[${name.toUpperCase()}] Bloqué temporairement`);
        
        // Débloquer après 5 minutes
        setTimeout(() => {
          pipeline.isBlocked = false;
          pipeline.errors = 0;
          log.info(`[${name.toUpperCase()}] Débloqué`);
        }, 5 * 60 * 1000);
      }
    }
  }
  
  // ===== PIPELINE IMPLEMENTATIONS =====
  
  /**
   * Scraping incrémental : traite N requêtes par cycle au lieu de tout d'un coup
   */
  private async runScrapePipeline(): Promise<number> {
    if (this.scrapeQueries.length === 0) {
      return 0;
    }
    
    const maxQueries = this.orchConfig.maxScrapePerCycle;
    const queriesToRun: Array<{ niche: string; city: string }> = [];
    
    // Prendre les N prochaines requêtes
    for (let i = 0; i < maxQueries; i++) {
      const query = this.scrapeQueries[this.scrapeIndex % this.scrapeQueries.length];
      queriesToRun.push(query);
      this.scrapeIndex++;
      
      // Quand on a fait le tour, remélanger pour varier
      if (this.scrapeIndex >= this.scrapeQueries.length) {
        this.scrapeIndex = 0;
        this.shuffleArray(this.scrapeQueries);
        log.info('Tour complet! Remix des requêtes');
      }
    }
    
    log.sub(`Batch de ${queriesToRun.length} requêtes | Progression: ${this.scrapeIndex}/${this.scrapeQueries.length}`);
    
    // Scraper chaque requête individuellement pour respecter le quota exact
    let totalLeads = 0;
    for (const query of queriesToRun) {
      log.sub(`${query.niche} @ ${query.city}`);
      const leads = await scrapeGoogleMaps({
        niches: [query.niche],
        cities: [query.city],
        saveToDb: true,
      });
      totalLeads += leads.length;
    }
    
    return totalLeads;
  }
  
  private async runEnrichSocietePipeline(): Promise<number> {
    const stats = await enrichSociete(this.orchConfig.maxEnrichPerCycle);
    return stats.enriched;
  }
  
  private async runEnrichWebsitePipeline(): Promise<number> {
    const stats = await enrichWebsiteAnalysis();
    return stats.analyzed;
  }

  private async runEnrichLegalPipeline(): Promise<number> {
    const { processed } = await enrichLegalNotices(this.orchConfig.maxLegalPerCycle);
    return processed;
  }
  
  // ===== SCHEDULING =====
  
  private scheduleNextCycle(): void {
    // Calculer le prochain délai optimal
    const nextDelay = this.calculateNextDelay();
    
    log.info(`Prochain cycle dans ${formatDuration(nextDelay)}`);
    
    this.mainLoopTimer = setTimeout(async () => {
      if (!this.isRunning) return;
      
      await this.runMainCycle();
      this.scheduleNextCycle();
    }, nextDelay);
  }
  
  private calculateNextDelay(): number {
    // Trouver le pipeline qui sera prêt le plus tôt
    const now = Date.now();
    let minDelay = this.orchConfig.scrapeInterval;
    
    const checkPipeline = (name: keyof typeof this.pipelines, interval: number) => {
      const pipeline = this.pipelines[name];
      if (pipeline.isBlocked || pipeline.status === 'running') return;
      
      if (!pipeline.lastRun) {
        minDelay = Math.min(minDelay, 1000); // Immédiat
        return;
      }
      
      const elapsed = now - pipeline.lastRun.getTime();
      const remaining = Math.max(0, interval - elapsed);
      minDelay = Math.min(minDelay, remaining);
    };
    
    checkPipeline('scrape', this.orchConfig.scrapeInterval);
    checkPipeline('enrichSociete', this.orchConfig.enrichSocieteInterval);
    checkPipeline('enrichWebsite', this.orchConfig.enrichWebsiteInterval);
    checkPipeline('collect', this.orchConfig.collectInterval);
    
    // Minimum 10 secondes entre cycles
    return Math.max(10 * 1000, minDelay);
  }
  
  // ===== METRICS =====
  
  private startMetricsLoop(): void {
    this.metricsTimer = setInterval(() => {
      // N'afficher les métriques que si aucun pipeline n'est en cours
      // pour éviter de couper les progress bars
      const anyRunning = Object.values(this.pipelines).some(p => p.status === 'running');
      if (!anyRunning) {
        this.printMetrics();
      }
    }, this.orchConfig.metricsInterval);
  }
  
  private printMetrics(): void {
    const uptime = Date.now() - this.startTime.getTime();
    
    // Récupérer stats DB
    const db = getDb();
    const totalLeads = (db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c;
    const needsEnrich = (db.prepare('SELECT COUNT(*) as c FROM leads WHERE siren IS NULL AND opt_out = 0').get() as any).c;
    const needsWebsite = (db.prepare('SELECT COUNT(*) as c FROM leads WHERE cms_type IS NULL AND opt_out = 0').get() as any).c;
    
    log.section('MÉTRIQUES', 70);
    log.kv('Uptime', formatDuration(uptime));
    log.kv('Cycles', this.totalCycles);
    log.kv('DB', `${totalLeads} leads | ${needsEnrich} à enrichir | ${needsWebsite} à analyser`);
    log.blank();
    log.raw('  Pipelines:');
    
    for (const [name, state] of Object.entries(this.pipelines)) {
      const status = this.getPipelineStatusEmoji(state.status, state.isBlocked);
      const lastRun = state.lastRun ? this.getTimeAgo(state.lastRun) : 'jamais';
      const duration = state.lastDuration > 0 ? formatDuration(state.lastDuration) : '-';
      log.raw(`    ${status} ${name.padEnd(15)} | runs: ${state.totalRuns.toString().padStart(3)} | total: ${state.totalProcessed.toString().padStart(5)} | ${duration.padStart(8)} | last: ${lastRun}`);
    }
    log.divider('─', 70);
  }
  
  /**
   * Print a compact status line (for continuous display)
   */
  private printStatusLine(): void {
    this.monitor.printStatusLine({
      scrape: { status: this.pipelines.scrape.status, totalProcessed: this.pipelines.scrape.totalProcessed },
      enrichSociete: { status: this.pipelines.enrichSociete.status, totalProcessed: this.pipelines.enrichSociete.totalProcessed },
      enrichWebsite: { status: this.pipelines.enrichWebsite.status, totalProcessed: this.pipelines.enrichWebsite.totalProcessed },
      collect: { status: this.pipelines.collect.status, totalProcessed: this.pipelines.collect.totalProcessed },
    });
  }
  
  /**
   * Print full dashboard
   */
  printDashboard(): void {
    const pipelineMetrics: PipelineMetrics[] = Object.entries(this.pipelines).map(([name, state]) => ({
      name,
      status: state.status,
      isBlocked: state.isBlocked,
      totalRuns: state.totalRuns,
      totalProcessed: state.totalProcessed,
      errors: state.errors,
      lastDuration: state.lastDuration,
      avgDuration: state.totalRuns > 0 ? state.lastDuration : 0, // Simplified
      lastRun: state.lastRun,
    }));
    
    this.monitor.printDashboard(pipelineMetrics);
  }
  
  private getPipelineStatusEmoji(status: PipelineStatus, blocked: boolean): string {
    if (blocked) return '🔒';
    switch (status) {
      case 'running': return '🔄';
      case 'error': return '❌';
      case 'paused': return '⏸️';
      default: return '✅';
    }
  }
  
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  }
  
  // ===== CONTROL =====
  
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    log.blank();
    log.warn('Arrêt de l\'orchestrator...');
    this.isRunning = false;
    
    if (this.mainLoopTimer) {
      clearTimeout(this.mainLoopTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    // Attendre que les pipelines en cours finissent
    const runningPipelines = Object.entries(this.pipelines)
      .filter(([_, state]) => state.status === 'running')
      .map(([name]) => name);
    
    if (runningPipelines.length > 0) {
      log.info(`Attente fin de: ${runningPipelines.join(', ')}...`);
      // Attendre max 30 secondes
      let waited = 0;
      while (runningPipelines.some(name => 
        this.pipelines[name as keyof typeof this.pipelines].status === 'running'
      ) && waited < 30000) {
        await sleep(1000);
        waited += 1000;
      }
    }
    
    this.printFinalStats();
    closeDb();
    
    log.success('Orchestrator arrêté proprement');
    log.blank();
  }
  
  private printFinalStats(): void {
    const uptime = Date.now() - this.startTime.getTime();
    
    log.header('STATISTIQUES FINALES', 70);
    log.kv('Durée totale', formatDuration(uptime));
    log.kv('Cycles effectués', this.totalCycles);
    log.blank();
    
    let totalProcessed = 0;
    let totalErrors = 0;
    
    for (const [name, state] of Object.entries(this.pipelines)) {
      totalProcessed += state.totalProcessed;
      totalErrors += state.errors;
      log.raw(`  ${name.padEnd(15)}: ${state.totalRuns} runs, ${state.totalProcessed} traités, ${state.errors} erreurs`);
    }
    
    log.blank();
    log.kv('Total traité', totalProcessed);
    log.kv('Erreurs', totalErrors);
    log.divider('═', 70);
  }
  
  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      await this.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
  
  // ===== PUBLIC GETTERS =====
  
  getMetrics(): OrchestratorMetrics {
    const db = getDb();
    
    return {
      uptime: Date.now() - this.startTime.getTime(),
      totalCycles: this.totalCycles,
      pipelines: { ...this.pipelines },
      database: {
        totalLeads: (db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c,
        needsEnrichSociete: (db.prepare('SELECT COUNT(*) as c FROM leads WHERE siren IS NULL AND opt_out = 0').get() as any).c,
        needsEnrichWebsite: (db.prepare('SELECT COUNT(*) as c FROM leads WHERE cms_type IS NULL AND opt_out = 0').get() as any).c,
      },
    };
  }
  
  isActive(): boolean {
    return this.isRunning;
  }
}

// ===== STANDALONE RUN =====

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const orchestrator = new WorkerOrchestrator();
  orchestrator.start().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
  });
}

export default WorkerOrchestrator;
