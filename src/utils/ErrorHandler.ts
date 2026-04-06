// Error Handler - Circuit breakers, retries, and graceful degradation

import { EventEmitter } from './EventEmitter';

export interface ErrorContext {
  operation: string;
  agentId?: string;
  retryCount?: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;  // ms
  halfOpenMaxCalls: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;  // ms
  maxDelay: number;   // ms
  exponentialBase: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private halfOpenCalls = 0;
  private config: CircuitBreakerConfig;
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      halfOpenMaxCalls: 3,
      ...config
    };
  }
  
  async execute<T>(operation: () => Promise<T>, context: ErrorContext): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.config.recoveryTimeout) {
        this.state = 'half-open';
        this.halfOpenCalls = 0;
      } else {
        throw new Error(`Circuit breaker OPEN for ${context.operation}`);
      }
    }
    
    if (this.state === 'half-open' && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error(`Circuit breaker HALF-OPEN limit reached for ${context.operation}`);
    }
    
    if (this.state === 'half-open') {
      this.halfOpenCalls++;
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }
  
  getState(): string {
    return this.state;
  }
  
  getMetrics(): { failures: number; state: string; lastFailure: number } {
    return {
      failures: this.failures,
      state: this.state,
      lastFailure: this.lastFailure
    };
  }
}

export class RetryHandler {
  private config: RetryConfig;
  private events: EventEmitter;
  
  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialBase: 2,
      ...config
    };
    this.events = new EventEmitter();
  }
  
  async execute<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    circuitBreaker?: CircuitBreaker
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const executeFn = async () => operation();
        
        if (circuitBreaker) {
          return await circuitBreaker.execute(executeFn, {
            ...context,
            retryCount: attempt
          });
        }
        
        return await executeFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt);
          
          this.events.emit('retry:scheduled', {
            ...context,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            delay,
            error: lastError.message
          });
          
          await this.sleep(delay);
        }
      }
    }
    
    this.events.emit('retry:exhausted', {
      ...context,
      attempts: this.config.maxRetries + 1,
      lastError: lastError?.message
    });
    
    throw lastError || new Error(`Max retries exhausted for ${context.operation}`);
  }
  
  on(event: string, handler: Function): () => void {
    return this.events.on(event, handler);
  }
  
  private calculateDelay(attempt: number): number {
    const exponential = this.config.baseDelay * Math.pow(this.config.exponentialBase, attempt);
    const jitter = Math.random() * 1000;  // Add randomness
    return Math.min(exponential + jitter, this.config.maxDelay);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class ErrorRegistry {
  private errors: Map<string, Error[]> = new Map();
  private events: EventEmitter;
  private maxErrorsPerType = 100;
  
  constructor() {
    this.events = new EventEmitter();
  }
  
  register(error: Error, context: ErrorContext): void {
    const errorType = error.constructor.name;
    
    if (!this.errors.has(errorType)) {
      this.errors.set(errorType, []);
    }
    
    const errors = this.errors.get(errorType)!;
    errors.push(error);
    
    // Trim old errors
    if (errors.length > this.maxErrorsPerType) {
      errors.shift();
    }
    
    this.events.emit('error:registered', {
      type: errorType,
      message: error.message,
      context,
      timestamp: Date.now()
    });
  }
  
  getErrors(type?: string): Error[] {
    if (type) {
      return this.errors.get(type) || [];
    }
    
    return Array.from(this.errors.values()).flat();
  }
  
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [type, errors] of this.errors.entries()) {
      stats[type] = errors.length;
    }
    return stats;
  }
  
  clear(type?: string): void {
    if (type) {
      this.errors.delete(type);
    } else {
      this.errors.clear();
    }
  }
  
  on(event: string, handler: Function): () => void {
    return this.events.on(event, handler);
  }
}

// Global error handlers
export const registryBreaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 60000
});

export const settlementBreaker = new CircuitBreaker({
  failureThreshold: 2,
  recoveryTimeout: 120000
});

export const defaultRetry = new RetryHandler({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
});

export const errorRegistry = new ErrorRegistry();