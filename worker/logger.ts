/**
 * Worker Logger - Système de logging unifié
 * 
 * Centralise tous les logs avec:
 * - Niveaux (debug, info, success, warn, error)
 * - Contextes (SCRAPE, ENRICH, ORCHESTRATOR, etc.)
 * - Progress bars propres
 * - Mode compact/verbose
 */

// ===== CONFIGURATION =====

const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

// ===== TYPES =====

type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';
type LogContext = 'SYSTEM' | 'SCRAPE' | 'ENRICH' | 'WEBSITE' | 'COLLECT' | 'DB' | 'ORCHESTRATOR' | 'LEGAL';

interface LoggerOptions {
  context?: LogContext;
  showTimestamp?: boolean;
}

// ===== STYLES =====

const LEVEL_STYLES: Record<LogLevel, { emoji: string; color?: string }> = {
  debug: { emoji: '🔧' },
  info: { emoji: 'ℹ️ ' },
  success: { emoji: '✓' },
  warn: { emoji: '⚠️ ' },
  error: { emoji: '✗' },
};

const CONTEXT_STYLES: Record<LogContext, { emoji: string; name: string }> = {
  SYSTEM: { emoji: '⚙️ ', name: 'SYS' },
  SCRAPE: { emoji: '🌐', name: 'SCRAPE' },
  ENRICH: { emoji: '🔍', name: 'ENRICH' },
  WEBSITE: { emoji: '📊', name: 'WEB' },
  COLLECT: { emoji: '📥', name: 'COLLECT' },
  DB: { emoji: '💾', name: 'DB' },
  ORCHESTRATOR: { emoji: '🧠', name: 'ORCH' },
  LEGAL: { emoji: '⚖️ ', name: 'LEGAL' },
};

// ===== LOGGER CLASS =====

class Logger {
  private context: LogContext;
  private showTimestamp: boolean;
  private currentProgress: string | null = null;
  
  constructor(options: LoggerOptions = {}) {
    this.context = options.context || 'SYSTEM';
    this.showTimestamp = options.showTimestamp ?? false;
  }
  
  /**
   * Create a child logger with a different context
   */
  child(context: LogContext): Logger {
    return new Logger({ context, showTimestamp: this.showTimestamp });
  }
  
  /**
   * Format the prefix for log messages
   */
  private formatPrefix(level: LogLevel): string {
    const ctx = CONTEXT_STYLES[this.context];
    const lvl = LEVEL_STYLES[level];
    
    const parts: string[] = [];
    
    if (this.showTimestamp) {
      const now = new Date();
      parts.push(`[${now.toLocaleTimeString('fr-FR')}]`);
    }
    
    // Compact format: [CONTEXT] emoji message
    parts.push(`[${ctx.name.padEnd(7)}]`);
    parts.push(lvl.emoji);
    
    return parts.join(' ');
  }
  
  /**
   * Clear current progress line if any
   */
  private clearProgress(): void {
    if (this.currentProgress) {
      process.stdout.write('\r' + ' '.repeat(100) + '\r');
      this.currentProgress = null;
    }
  }
  
  // ===== LOG METHODS =====
  
  debug(...args: unknown[]): void {
    if (!DEBUG) return;
    this.clearProgress();
    console.log(this.formatPrefix('debug'), ...args);
  }
  
  info(...args: unknown[]): void {
    this.clearProgress();
    console.log(this.formatPrefix('info'), ...args);
  }
  
  success(...args: unknown[]): void {
    this.clearProgress();
    console.log(this.formatPrefix('success'), ...args);
  }
  
  warn(...args: unknown[]): void {
    this.clearProgress();
    console.warn(this.formatPrefix('warn'), ...args);
  }
  
  error(...args: unknown[]): void {
    this.clearProgress();
    console.error(this.formatPrefix('error'), ...args);
  }
  
  /**
   * Log data in debug mode with JSON formatting
   */
  debugData(label: string, data: unknown): void {
    if (!DEBUG) return;
    this.clearProgress();
    console.log(this.formatPrefix('debug'), `${label}:`, JSON.stringify(data, null, 2));
  }
  
  // ===== SPECIAL FORMATS =====
  
  /**
   * Print a header/banner
   */
  header(title: string, width: number = 60): void {
    this.clearProgress();
    console.log('');
    console.log('═'.repeat(width));
    console.log(`  ${title}`);
    console.log('═'.repeat(width));
  }
  
  /**
   * Print a section divider
   */
  section(title: string, width: number = 60): void {
    this.clearProgress();
    console.log('');
    console.log('─'.repeat(width));
    console.log(`  ${title}`);
    console.log('─'.repeat(width));
  }
  
  /**
   * Print a simple divider line
   */
  divider(char: string = '─', width: number = 60): void {
    this.clearProgress();
    console.log(char.repeat(width));
  }
  
  /**
   * Print a key-value pair
   */
  kv(key: string, value: string | number, indent: number = 0): void {
    this.clearProgress();
    const prefix = ' '.repeat(indent);
    console.log(`${prefix}${key.padEnd(20 - indent)}: ${value}`);
  }
  
  /**
   * Update a progress line (overwrites current line)
   */
  progress(message: string): void {
    this.currentProgress = message;
    // Truncate to terminal width and pad
    const truncated = message.slice(0, 95).padEnd(100);
    process.stdout.write(`\r${truncated}`);
  }
  
  /**
   * End progress and print final line
   */
  progressEnd(message?: string): void {
    if (this.currentProgress || message) {
      process.stdout.write('\r' + ' '.repeat(100) + '\r');
      if (message) {
        console.log(this.formatPrefix('success'), message);
      }
      this.currentProgress = null;
    }
  }
  
  /**
   * Print a bullet point list item
   */
  bullet(text: string, indent: number = 2): void {
    this.clearProgress();
    console.log(' '.repeat(indent) + '• ' + text);
  }
  
  /**
   * Print a sub-item (indented)
   */
  sub(text: string): void {
    this.clearProgress();
    console.log('    ' + text);
  }
  
  /**
   * Blank line
   */
  blank(): void {
    this.clearProgress();
    console.log('');
  }
  
  /**
   * Raw log without formatting
   */
  raw(...args: unknown[]): void {
    this.clearProgress();
    console.log(...args);
  }
}

// ===== PROGRESS BAR =====

export class ProgressBar {
  private total: number;
  private current: number = 0;
  private startTime: number;
  private width: number;
  private label: string;
  private logger: Logger;
  private lastUpdate: number = 0;
  private updateInterval: number = 100; // ms
  
  constructor(options: {
    total: number;
    label?: string;
    width?: number;
    logger?: Logger;
  }) {
    this.total = options.total;
    this.label = options.label || '';
    this.width = options.width || 30;
    this.logger = options.logger || new Logger();
    this.startTime = Date.now();
  }
  
  /**
   * Update progress
   */
  update(current: number, extra?: string): void {
    this.current = current;
    
    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval && current < this.total) {
      return;
    }
    this.lastUpdate = now;
    
    const percent = Math.min(100, Math.round((this.current / this.total) * 100));
    const filled = Math.round((this.current / this.total) * this.width);
    const bar = '█'.repeat(filled) + '░'.repeat(this.width - filled);
    
    const elapsed = (now - this.startTime) / 1000;
    const rate = elapsed > 0 ? (this.current / elapsed).toFixed(1) : '0';
    
    const parts = [
      this.label ? `${this.label} ` : '',
      `[${bar}]`,
      `${this.current}/${this.total}`,
      `(${percent}%)`,
      `${rate}/s`,
    ];
    
    if (extra) {
      parts.push(extra);
    }
    
    this.logger.progress(parts.join(' '));
  }
  
  /**
   * Increment by 1
   */
  increment(extra?: string): void {
    this.update(this.current + 1, extra);
  }
  
  /**
   * Complete the progress bar
   */
  complete(message?: string): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = elapsed > 0 ? (this.current / elapsed).toFixed(1) : '0';
    
    const finalMessage = message || `${this.label || 'Terminé'}: ${this.current} traités en ${formatDurationShort(elapsed * 1000)} (${rate}/s)`;
    this.logger.progressEnd(finalMessage);
  }
}

// ===== UTILITY FUNCTIONS =====

function formatDurationShort(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m${seconds % 60}s`;
  return `${seconds}s`;
}

// ===== EXPORTS =====

// Default logger instance
export const logger = new Logger({ context: 'SYSTEM' });

// Context-specific loggers (pre-configured)
export const scrapeLogger = new Logger({ context: 'SCRAPE' });
export const enrichLogger = new Logger({ context: 'ENRICH' });
export const websiteLogger = new Logger({ context: 'WEBSITE' });
export const collectLogger = new Logger({ context: 'COLLECT' });
export const dbLogger = new Logger({ context: 'DB' });
export const orchLogger = new Logger({ context: 'ORCHESTRATOR' });
export const legalLogger = new Logger({ context: 'LEGAL' });

// Export class for custom instances
export { Logger };
export default logger;
