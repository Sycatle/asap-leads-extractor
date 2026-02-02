/**
 * Task Queue - Gestion intelligente des tâches
 * 
 * Features:
 * - Priority queue (high/normal/low)
 * - Concurrency control
 * - Backpressure handling
 * - Rate limiting
 * - Retry with exponential backoff
 */

import { EventEmitter } from 'events';
import { sleep } from './utils';

// ===== TYPES =====

export type TaskPriority = 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task<T = unknown> {
  id: string;
  priority: TaskPriority;
  status: TaskStatus;
  data: T;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
}

export interface TaskQueueConfig {
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  maxQueueSize: number;
  processInterval: number;
}

type TaskProcessor<T, R> = (task: Task<T>) => Promise<R>;

// ===== TASK QUEUE CLASS =====

export class TaskQueue<T = unknown, R = unknown> extends EventEmitter {
  private config: TaskQueueConfig;
  private queues: {
    high: Task<T>[];
    normal: Task<T>[];
    low: Task<T>[];
  };
  private running: Map<string, Task<T>> = new Map();
  private processor: TaskProcessor<T, R>;
  private isProcessing: boolean = false;
  private isPaused: boolean = false;
  private processTimer: NodeJS.Timeout | null = null;
  
  private stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
  };
  
  constructor(processor: TaskProcessor<T, R>, config?: Partial<TaskQueueConfig>) {
    super();
    
    this.processor = processor;
    this.config = {
      concurrency: config?.concurrency ?? 1,
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      maxQueueSize: config?.maxQueueSize ?? 1000,
      processInterval: config?.processInterval ?? 100,
    };
    
    this.queues = {
      high: [],
      normal: [],
      low: [],
    };
  }
  
  // ===== PUBLIC API =====
  
  /**
   * Add a task to the queue
   */
  enqueue(data: T, priority: TaskPriority = 'normal', id?: string): Task<T> {
    const totalSize = this.size();
    if (totalSize >= this.config.maxQueueSize) {
      throw new Error(`Queue full (max: ${this.config.maxQueueSize})`);
    }
    
    const task: Task<T> = {
      id: id ?? this.generateId(),
      priority,
      status: 'pending',
      data,
      retries: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date(),
    };
    
    this.queues[priority].push(task);
    this.emit('enqueued', task);
    
    // Start processing if not already
    this.startProcessing();
    
    return task;
  }
  
  /**
   * Add multiple tasks at once
   */
  enqueueBatch(items: Array<{ data: T; priority?: TaskPriority; id?: string }>): Task<T>[] {
    return items.map(item => this.enqueue(item.data, item.priority, item.id));
  }
  
  /**
   * Get queue size
   */
  size(): number {
    return this.queues.high.length + this.queues.normal.length + this.queues.low.length;
  }
  
  /**
   * Get running task count
   */
  runningCount(): number {
    return this.running.size;
  }
  
  /**
   * Pause processing
   */
  pause(): void {
    this.isPaused = true;
    this.emit('paused');
  }
  
  /**
   * Resume processing
   */
  resume(): void {
    this.isPaused = false;
    this.emit('resumed');
    this.startProcessing();
  }
  
  /**
   * Clear all pending tasks
   */
  clear(): void {
    const cleared = this.size();
    this.queues.high = [];
    this.queues.normal = [];
    this.queues.low = [];
    this.emit('cleared', cleared);
  }
  
  /**
   * Wait for all tasks to complete
   */
  async drain(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.size() === 0 && this.running.size === 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
  
  /**
   * Stop the queue and wait for running tasks
   */
  async stop(): Promise<void> {
    this.clear();
    this.stopProcessing();
    
    // Wait for running tasks to finish
    if (this.running.size > 0) {
      await this.drain();
    }
  }
  
  /**
   * Get statistics
   */
  getStats(): typeof this.stats & { pending: number; running: number } {
    return {
      ...this.stats,
      pending: this.size(),
      running: this.running.size,
    };
  }
  
  // ===== INTERNAL =====
  
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processLoop();
  }
  
  private stopProcessing(): void {
    this.isProcessing = false;
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
  }
  
  private async processLoop(): Promise<void> {
    while (this.isProcessing && !this.isPaused) {
      // Check if we can process more tasks
      if (this.running.size >= this.config.concurrency) {
        await sleep(this.config.processInterval);
        continue;
      }
      
      // Get next task (priority order)
      const task = this.getNextTask();
      if (!task) {
        // No more tasks, stop processing
        this.isProcessing = false;
        this.emit('idle');
        return;
      }
      
      // Process task (non-blocking)
      this.processTask(task);
      
      // Small delay to prevent CPU spinning
      await sleep(10);
    }
  }
  
  private getNextTask(): Task<T> | null {
    // Priority order: high > normal > low
    if (this.queues.high.length > 0) {
      return this.queues.high.shift()!;
    }
    if (this.queues.normal.length > 0) {
      return this.queues.normal.shift()!;
    }
    if (this.queues.low.length > 0) {
      return this.queues.low.shift()!;
    }
    return null;
  }
  
  private async processTask(task: Task<T>): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date();
    this.running.set(task.id, task);
    this.emit('started', task);
    
    try {
      const result = await this.processor(task);
      
      task.status = 'completed';
      task.completedAt = new Date();
      this.running.delete(task.id);
      
      this.stats.processed++;
      this.stats.succeeded++;
      
      this.emit('completed', task, result);
      
    } catch (error) {
      task.error = error as Error;
      this.running.delete(task.id);
      
      // Check if we should retry
      if (task.retries < task.maxRetries) {
        task.retries++;
        task.status = 'pending';
        this.stats.retried++;
        
        // Re-queue with delay
        await sleep(this.config.retryDelay * Math.pow(2, task.retries - 1));
        this.queues[task.priority].unshift(task);
        
        this.emit('retry', task);
      } else {
        task.status = 'failed';
        task.completedAt = new Date();
        
        this.stats.processed++;
        this.stats.failed++;
        
        this.emit('failed', task, error);
      }
    }
  }
}

// ===== RATE LIMITER =====

export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;
  
  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }
  
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  async acquire(tokens: number = 1): Promise<void> {
    this.refill();
    
    while (this.tokens < tokens) {
      // Wait for tokens to be available
      const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
      await sleep(Math.max(10, waitTime));
      this.refill();
    }
    
    this.tokens -= tokens;
  }
  
  tryAcquire(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  available(): number {
    this.refill();
    return this.tokens;
  }
}

// ===== BATCH PROCESSOR =====

export interface BatchProcessorConfig<T, R> {
  processor: (items: T[]) => Promise<R[]>;
  batchSize: number;
  batchTimeout: number; // ms to wait before processing partial batch
  maxConcurrentBatches: number;
}

export class BatchProcessor<T, R> extends EventEmitter {
  private config: BatchProcessorConfig<T, R>;
  private buffer: T[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private activeBatches: number = 0;
  private results: Map<number, R[]> = new Map();
  private batchCounter: number = 0;
  
  constructor(config: BatchProcessorConfig<T, R>) {
    super();
    this.config = config;
  }
  
  async add(item: T): Promise<void> {
    this.buffer.push(item);
    
    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    } else {
      this.scheduleBatchTimeout();
    }
  }
  
  async addBatch(items: T[]): Promise<void> {
    for (const item of items) {
      await this.add(item);
    }
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    // Wait if too many batches are running
    while (this.activeBatches >= this.config.maxConcurrentBatches) {
      await sleep(100);
    }
    
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Take items from buffer
    const items = this.buffer.splice(0, this.config.batchSize);
    const batchId = ++this.batchCounter;
    
    this.activeBatches++;
    this.emit('batchStarted', batchId, items.length);
    
    try {
      const results = await this.config.processor(items);
      this.results.set(batchId, results);
      this.emit('batchCompleted', batchId, results);
    } catch (error) {
      this.emit('batchFailed', batchId, error);
    } finally {
      this.activeBatches--;
    }
  }
  
  private scheduleBatchTimeout(): void {
    if (this.batchTimer) return;
    
    this.batchTimer = setTimeout(() => {
      this.flush().catch(console.error);
    }, this.config.batchTimeout);
  }
  
  async drain(): Promise<void> {
    await this.flush();
    
    while (this.activeBatches > 0) {
      await sleep(100);
    }
  }
  
  pending(): number {
    return this.buffer.length;
  }
}

export default TaskQueue;
