// Rate Limiter - Prevents spam and resource exhaustion

import { AgentID } from '../core/types';
import { EventEmitter } from './EventEmitter';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;      // Time window in milliseconds
  burstAllowance?: number;  // Allow burst of requests
  cooldownMs?: number;     // Cooldown after exceeding limit
}

export interface RateLimitState {
  count: number;
  windowStart: number;
  blockedUntil?: number;
  violations: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();
  private config: RateLimitConfig;
  private events: EventEmitter;
  private cleanupInterval?: NodeJS.Timer;
  
  constructor(config: RateLimitConfig) {
    this.config = {
      burstAllowance: 0,
      cooldownMs: 60000,
      ...config
    };
    this.events = new EventEmitter();
    this.startCleanup();
  }
  
  // Check if request is allowed
  check(key: string): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
    const now = Date.now();
    let state = this.limits.get(key);
    
    // Create new state if not exists or window expired
    if (!state || now - state.windowStart > this.config.windowMs) {
      state = {
        count: 0,
        windowStart: now,
        violations: state?.violations || 0
      };
      this.limits.set(key, state);
    }
    
    // Check if currently blocked
    if (state.blockedUntil && now < state.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: state.blockedUntil,
        retryAfter: state.blockedUntil - now
      };
    }
    
    // Check limit
    const effectiveMax = this.config.maxRequests + this.config.burstAllowance!;
    
    if (state.count >= effectiveMax) {
      // Block for cooldown period
      state.blockedUntil = now + this.config.cooldownMs!;
      state.violations++;
      
      this.events.emit('rate:exceeded', {
        key,
        count: state.count,
        limit: effectiveMax,
        blockedUntil: state.blockedUntil,
        violations: state.violations
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: state.blockedUntil,
        retryAfter: this.config.cooldownMs
      };
    }
    
    // Allow request
    state.count++;
    
    return {
      allowed: true,
      remaining: effectiveMax - state.count,
      resetAt: state.windowStart + this.config.windowMs
    };
  }
  
  // Consume a request (throws if not allowed)
  consume(key: string): void {
    const result = this.check(key);
    
    if (!result.allowed) {
      throw new RateLimitExceededError(
        `Rate limit exceeded for ${key}. Retry after ${result.retryAfter}ms`,
        result.retryAfter!
      );
    }
  }
  
  // Peek without consuming
  peek(key: string): { remaining: number; resetAt: number; isBlocked: boolean } {
    const state = this.limits.get(key);
    const now = Date.now();
    
    if (!state) {
      return {
        remaining: this.config.maxRequests + this.config.burstAllowance!,
        resetAt: now + this.config.windowMs,
        isBlocked: false
      };
    }
    
    const isBlocked = state.blockedUntil ? now < state.blockedUntil : false;
    const effectiveMax = this.config.maxRequests + this.config.burstAllowance!;
    const remaining = Math.max(0, effectiveMax - state.count);
    
    return {
      remaining,
      resetAt: state.blockedUntil || state.windowStart + this.config.windowMs,
      isBlocked
    };
  }
  
  // Get usage stats for a key
  getStats(key: string): RateLimitState | undefined {
    return this.limits.get(key);
  }
  
  // Reset limit for a key
  reset(key: string): void {
    this.limits.delete(key);
    this.events.emit('rate:reset', { key });
  }
  
  // Block a key explicitly
  block(key: string, durationMs: number): void {
    const now = Date.now();
    const state: RateLimitState = {
      count: this.config.maxRequests + this.config.burstAllowance!,
      windowStart: now,
      blockedUntil: now + durationMs,
      violations: 1
    };
    
    this.limits.set(key, state);
    
    this.events.emit('rate:blocked', {
      key,
      blockedUntil: state.blockedUntil,
      duration: durationMs
    });
  }
  
  // Get all blocked keys
  getBlocked(): string[] {
    const now = Date.now();
    const blocked: string[] = [];
    
    for (const [key, state] of this.limits.entries()) {
      if (state.blockedUntil && now < state.blockedUntil) {
        blocked.push(key);
      }
    }
    
    return blocked;
  }
  
  // Cleanup old entries
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiryWindow = this.config.windowMs + this.config.cooldownMs!;
      
      for (const [key, state] of this.limits.entries()) {
        // Remove entries where window expired and not blocked
        if (!state.blockedUntil || now > state.blockedUntil + expiryWindow) {
          if (now - state.windowStart > expiryWindow) {
            this.limits.delete(key);
          }
        }
      }
    }, this.config.windowMs);
  }
  
  // Stop cleanup
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
  
  // Subscribe to events
  on(event: string, handler: Function): () => void {
    return this.events.on(event, handler);
  }
}

export class RateLimitExceededError extends Error {
  retryAfter: number;
  
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitExceededError';
    this.retryAfter = retryAfter;
  }
}

// Pre-configured limiters
export const messageLimiter = new RateLimiter({
  maxRequests: 60,      // 60 messages
  windowMs: 60000,      // per minute
  burstAllowance: 10,   // allow 10 burst
  cooldownMs: 30000     // 30s cooldown
});

export const proposalLimiter = new RateLimiter({
  maxRequests: 10,      // 10 proposals
  windowMs: 3600000,    // per hour
  burstAllowance: 2,
  cooldownMs: 600000    // 10min cooldown
});

export const dealLimiter = new RateLimiter({
  maxRequests: 5,       // 5 deals
  windowMs: 86400000,   // per day
  burstAllowance: 1,
  cooldownMs: 3600000   // 1h cooldown
});

export const registryLimiter = new RateLimiter({
  maxRequests: 100,     // 100 registry ops
  windowMs: 60000,      // per minute
  burstAllowance: 20
});