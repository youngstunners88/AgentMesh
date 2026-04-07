// Security Engine - Fraud detection, reputation, and sybil resistance
// Part of AgentMesh autonomous economic ecosystem

import { EventEmitter } from '../utils/EventEmitter';
import { StateManager } from '../core/StateManager';

export interface ReputationScore {
  agentId: string;
  score: number; // 0-1000
  successfulDeals: number;
  disputedDeals: number;
  fraudFlags: number;
  lastActivity: number;
  trustTier: 'unverified' | 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface FraudPattern {
  type: 'rapid_deals' | 'price_manipulation' | 'identity_rotation' | 'collusion' | 'chargeback_abuse';
  confidence: number;
  evidence: string[];
  timestamp: number;
}

export interface BehavioralProfile {
  agentId: string;
  dealVelocity: number; // deals per day
  priceDeviation: number; // from market average
  partnerDiversity: number; // unique partners
  geographicSpread: string[];
  deviceFingerprints: string[];
  temporalPatterns: number[]; // active hours
}

export class SecurityEngine {
  private state: StateManager;
  private eventEmitter: EventEmitter;
  private reputationScores: Map<string, ReputationScore> = new Map();
  private behavioralProfiles: Map<string, BehavioralProfile> = new Map();
  private fraudPatterns: Map<string, FraudPattern[]> = new Map();
  private blacklistedAgents: Set<string> = new Set();
  
  // Thresholds
  private readonly FRAUD_THRESHOLD = 3; // flags before investigation
  private readonly REPUTATION_DECAY = 0.95; // daily decay factor
  private readonly MAX_DEAL_VELOCITY = 50; // deals per day
  private readonly PRICE_DEVIATION_LIMIT = 0.3; // 30% from market
  
  constructor(state: StateManager, eventEmitter: EventEmitter) {
    this.state = state;
    this.eventEmitter = eventEmitter;
    this.initializeListeners();
  }
  
  private initializeListeners(): void {
    // Monitor deal activity for fraud patterns
    this.eventEmitter.on('deal:created', (deal) => this.analyzeDealCreation(deal));
    this.eventEmitter.on('deal:completed', (deal) => this.updateReputation(deal));
    this.eventEmitter.on('deal:disputed', (deal) => this.handleDispute(deal));
    this.eventEmitter.on('agent:registered', (agent) => this.initializeProfile(agent));
  }
  
  // Initialize new agent profile
  initializeProfile(agentId: string, deviceInfo?: any): ReputationScore {
    const profile: BehavioralProfile = {
      agentId,
      dealVelocity: 0,
      priceDeviation: 0,
      partnerDiversity: 0,
      geographicSpread: [],
      deviceFingerprints: deviceInfo ? [this.hashDevice(deviceInfo)] : [],
      temporalPatterns: []
    };
    
    const reputation: ReputationScore = {
      agentId,
      score: 100, // starting score
      successfulDeals: 0,
      disputedDeals: 0,
      fraudFlags: 0,
      lastActivity: Date.now(),
      trustTier: 'unverified'
    };
    
    this.behavioralProfiles.set(agentId, profile);
    this.reputationScores.set(agentId, reputation);
    
    this.eventEmitter.emit('security:profile_created', { agentId, reputation });
    
    return reputation;
  }
  
  // Analyze deal for fraud patterns
  private analyzeDealCreation(deal: any): void {
    const { initiatorId, price, marketPrice, timestamp } = deal;
    const profile = this.behavioralProfiles.get(initiatorId);
    if (!profile) return;
    
    const flags: FraudPattern[] = [];
    
    // Check 1: Rapid deal creation (bot detection)
    const recentDeals = this.getRecentDeals(initiatorId, 24);
    if (recentDeals.length > this.MAX_DEAL_VELOCITY) {
      flags.push({
        type: 'rapid_deals',
        confidence: Math.min(recentDeals.length / this.MAX_DEAL_VELOCITY, 1),
        evidence: [`${recentDeals.length} deals in 24h`],
        timestamp: Date.now()
      });
    }
    
    // Check 2: Price manipulation
    if (marketPrice && Math.abs(price - marketPrice) / marketPrice > this.PRICE_DEVIATION_LIMIT) {
      flags.push({
        type: 'price_manipulation',
        confidence: Math.min(Math.abs(price - marketPrice) / marketPrice, 1),
        evidence: [`Price ${price} vs market ${marketPrice}`],
        timestamp: Date.now()
      });
    }
    
    // Check 3: Temporal pattern anomaly (always active at same times = bot)
    const hour = new Date(timestamp).getHours();
    if (profile.temporalPatterns.length > 10) {
      const variance = this.calculateVariance(profile.temporalPatterns);
      if (variance < 2) { // Less than 2 hour variance
        flags.push({
          type: 'identity_rotation',
          confidence: 0.7,
          evidence: ['Suspicious temporal pattern'],
          timestamp: Date.now()
        });
      }
    }
    profile.temporalPatterns.push(hour);
    
    // Check 4: Collusion detection (repeatedly deals with same small group)
    const partners = this.getRecentPartners(initiatorId);
    if (partners.length < 3 && recentDeals.length > 10) {
      flags.push({
        type: 'collusion',
        confidence: 0.6,
        evidence: [`Only ${partners.length} unique partners`],
        timestamp: Date.now()
      });
    }
    
    // Store and act on flags
    if (flags.length > 0) {
      const existing = this.fraudPatterns.get(initiatorId) || [];
      this.fraudPatterns.set(initiatorId, [...existing, ...flags]);
      
      const rep = this.reputationScores.get(initiatorId);
      if (rep) {
        rep.fraudFlags += flags.length;
        
        if (rep.fraudFlags >= this.FRAUD_THRESHOLD) {
          this.triggerInvestigation(initiatorId, flags);
        }
      }
    }
  }
  
  // Update reputation after successful deal
  private updateReputation(deal: any): void {
    const { initiatorId, responderId, value } = deal;
    
    [initiatorId, responderId].forEach(agentId => {
      const rep = this.reputationScores.get(agentId);
      if (!rep) return;
      
      rep.successfulDeals++;
      rep.lastActivity = Date.now();
      
      // Score calculation
      const successRate = rep.successfulDeals / (rep.successfulDeals + rep.disputedDeals + 1);
      const volumeBonus = Math.min(rep.successfulDeals / 100, 0.2); // Max 20% bonus
      const timeDecay = this.calculateTimeDecay(rep.lastActivity);
      
      rep.score = Math.min(1000, Math.round(
        (500 + successRate * 400 + volumeBonus * 100) * timeDecay
      ));
      
      // Update trust tier
      rep.trustTier = this.calculateTrustTier(rep.score);
      
      this.eventEmitter.emit('security:reputation_updated', { agentId, reputation: rep });
    });
  }
  
  private handleDispute(deal: any): void {
    const { initiatorId, responderId } = deal;
    
    [initiatorId, responderId].forEach(agentId => {
      const rep = this.reputationScores.get(agentId);
      if (rep) {
        rep.disputedDeals++;
        rep.score = Math.max(0, rep.score - 50); // Penalty
        
        if (rep.disputedDeals > rep.successfulDeals / 2) {
          this.blacklistedAgents.add(agentId);
          this.eventEmitter.emit('security:blacklisted', { agentId, reason: 'dispute_ratio' });
        }
      }
    });
  }
  
  private triggerInvestigation(agentId: string, flags: FraudPattern[]): void {
    this.eventEmitter.emit('security:investigation', { 
      agentId, 
      flags, 
      action: 'review' 
    });
    
    // Auto-restrict if high confidence
    const avgConfidence = flags.reduce((a, b) => a + b.confidence, 0) / flags.length;
    if (avgConfidence > 0.8) {
      this.restrictAgent(agentId, 'high_fraud_confidence');
    }
  }
  
  restrictAgent(agentId: string, reason: string): void {
    this.blacklistedAgents.add(agentId);
    this.eventEmitter.emit('security:restricted', { agentId, reason });
  }
  
  // Sybil resistance: Check if new agent is actually existing agent
  detectSybil(newAgentId: string, deviceInfo: any, ipAddress: string): boolean {
    const deviceHash = this.hashDevice(deviceInfo);
    const ipPrefix = ipAddress.split('.').slice(0, 2).join('.');
    
    let matches = 0;
    for (const [agentId, profile] of this.behavioralProfiles) {
      if (agentId === newAgentId) continue;
      
      // Device fingerprint match
      if (profile.deviceFingerprints.includes(deviceHash)) {
        matches++;
      }
      
      // IP subnet match
      if (profile.geographicSpread.includes(ipPrefix)) {
        matches++;
      }
    }
    
    if (matches >= 2) {
      this.eventEmitter.emit('security:sybil_detected', {
        newAgentId,
        matches,
        action: 'require_verification'
      });
      return true;
    }
    
    return false;
  }
  
  // Get reputation with decay applied
  getReputation(agentId: string): ReputationScore | null {
    const rep = this.reputationScores.get(agentId);
    if (!rep) return null;
    
    // Apply time decay
    const daysInactive = (Date.now() - rep.lastActivity) / (24 * 60 * 60 * 1000);
    const decayedScore = rep.score * Math.pow(this.REPUTATION_DECAY, daysInactive);
    
    return {
      ...rep,
      score: Math.round(decayedScore)
    };
  }
  
  isBlacklisted(agentId: string): boolean {
    return this.blacklistedAgents.has(agentId);
  }
  
  // Require higher collateral for low-reputation agents
  getRequiredCollateral(agentId: string, dealValue: number): number {
    const rep = this.getReputation(agentId);
    if (!rep) return dealValue * 0.5; // 50% for new agents
    
    const tiers: Record<string, number> = {
      'unverified': 0.5,
      'bronze': 0.3,
      'silver': 0.2,
      'gold': 0.1,
      'platinum': 0.05
    };
    
    return dealValue * (tiers[rep.trustTier] || 0.5);
  }
  
  private calculateTrustTier(score: number): ReputationScore['trustTier'] {
    if (score >= 900) return 'platinum';
    if (score >= 700) return 'gold';
    if (score >= 500) return 'silver';
    if (score >= 300) return 'bronze';
    return 'unverified';
  }
  
  private calculateVariance(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const squaredDiffs = arr.map(x => Math.pow(x - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b) / arr.length);
  }
  
  private calculateTimeDecay(lastActivity: number): number {
    const days = (Date.now() - lastActivity) / (24 * 60 * 60 * 1000);
    return Math.pow(this.REPUTATION_DECAY, Math.min(days, 30)); // Cap at 30 days
  }
  
  private hashDevice(deviceInfo: any): string {
    // Simple hash of device characteristics
    const str = JSON.stringify(deviceInfo);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  private getRecentDeals(agentId: string, hours: number): any[] {
    // Query state for recent deals
    return this.state.query(`deals:recent:${agentId}:${hours}`) || [];
  }
  
  private getRecentPartners(agentId: string): string[] {
    const deals = this.getRecentDeals(agentId, 168); // 7 days
    const partners = new Set<string>();
    deals.forEach((d: any) => {
      if (d.initiatorId === agentId) partners.add(d.responderId);
      else partners.add(d.initiatorId);
    });
    return Array.from(partners);
  }
  
  // Periodic cleanup and decay
  startMaintenance(): void {
    setInterval(() => {
      this.applyGlobalDecay();
      this.cleanupOldFlags();
    }, 24 * 60 * 60 * 1000); // Daily
  }
  
  private applyGlobalDecay(): void {
    for (const [agentId, rep] of this.reputationScores) {
      const daysSinceActivity = (Date.now() - rep.lastActivity) / (24 * 60 * 60 * 1000);
      if (daysSinceActivity > 30) {
        rep.score = Math.max(0, rep.score - 10); // Inactivity penalty
      }
    }
  }
  
  private cleanupOldFlags(): void {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    for (const [agentId, flags] of this.fraudPatterns) {
      const recent = flags.filter(f => f.timestamp > cutoff);
      if (recent.length !== flags.length) {
        this.fraudPatterns.set(agentId, recent);
      }
    }
  }
  
  getSecurityReport(agentId: string): {
    reputation: ReputationScore | null;
    profile: BehavioralProfile | null;
    flags: FraudPattern[];
    isBlacklisted: boolean;
    riskScore: number;
  } {
    const reputation = this.getReputation(agentId);
    const profile = this.behavioralProfiles.get(agentId) || null;
    const flags = this.fraudPatterns.get(agentId) || [];
    
    // Calculate risk score (0-100)
    let riskScore = 0;
    if (!reputation) riskScore += 30;
    else {
      riskScore += (1000 - reputation.score) / 20; // Lower rep = higher risk
      riskScore += reputation.fraudFlags * 10;
      riskScore += reputation.disputedDeals * 5;
    }
    
    return {
      reputation,
      profile,
      flags,
      isBlacklisted: this.isBlacklisted(agentId),
      riskScore: Math.min(100, riskScore)
    };
  }
}