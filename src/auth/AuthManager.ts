// Auth Manager - Verifies agent identities and manages permissions

import { AgentID, AgentProfile } from '../core/types';
import { createHash, randomBytes } from 'crypto';
import { StateManager } from '../core/StateManager';
import { EventEmitter } from '../utils/EventEmitter';

export interface AuthChallenge {
  nonce: string;
  timestamp: number;
  expiresAt: number;
}

export interface AuthCredentials {
  agentId: AgentID;
  publicKey: string;
  signature: string;
}

export interface VerifiedAgent {
  agentId: AgentID;
  profile: AgentProfile;
  permissions: Permission[];
  verifiedAt: number;
  sessionExpiry: number;
}

export type Permission = 
  | 'discover:agents'
  | 'send:proposals'
  | 'accept:deals'
  | 'execute:settlement'
  | 'moderate:mesh';

export class AuthManager {
  private challenges: StateManager<Record<AgentID, AuthChallenge>>;
  private verified: StateManager<Record<AgentID, VerifiedAgent>>;
  private events: EventEmitter;
  private readonly CHALLENGE_TTL = 300000;  // 5 minutes
  private readonly SESSION_TTL = 86400000; // 24 hours
  
  constructor() {
    this.challenges = new StateManager<Record<AgentID, AuthChallenge>>({});
    this.verified = new StateManager<Record<AgentID, VerifiedAgent>>({});
    this.events = new EventEmitter();
  }
  
  // Step 1: Request challenge
  requestChallenge(agentId: AgentID): AuthChallenge {
    const challenge: AuthChallenge = {
      nonce: randomBytes(32).toString('hex'),
      timestamp: Date.now(),
      expiresAt: Date.now() + this.CHALLENGE_TTL
    };
    
    this.challenges.setState({
      ...this.challenges.getState(),
      [agentId]: challenge
    });
    
    this.events.emit('challenge:created', { agentId, challenge });
    return challenge;
  }
  
  // Step 2: Verify credentials
  async verify(credentials: AuthCredentials): Promise<boolean> {
    const challenge = this.challenges.getState()[credentials.agentId];
    
    if (!challenge) {
      throw new Error('No challenge found for this agent');
    }
    
    if (Date.now() > challenge.expiresAt) {
      this.challenges.setState({
        ...this.challenges.getState(),
        [credentials.agentId]: undefined as any
      });
      throw new Error('Challenge expired');
    }
    
    // Verify signature (simplified - in production use proper crypto)
    const expectedSignature = this.computeSignature(
      challenge.nonce,
      credentials.publicKey
    );
    
    const isValid = credentials.signature === expectedSignature;
    
    if (isValid) {
      // Cleanup challenge
      const challenges = { ...this.challenges.getState() };
      delete challenges[credentials.agentId];
      this.challenges.setState(challenges);
      
      // Create verified session
      const verifiedAgent: VerifiedAgent = {
        agentId: credentials.agentId,
        profile: { name: '', category: '', businessType: '' },  // Will be populated from registry
        permissions: this.inferPermissions(credentials.agentId),
        verifiedAt: Date.now(),
        sessionExpiry: Date.now() + this.SESSION_TTL
      };
      
      this.verified.setState({
        ...this.verified.getState(),
        [credentials.agentId]: verifiedAgent
      });
      
      this.events.emit('agent:verified', verifiedAgent);
    }
    
    return isValid;
  }
  
  // Check if agent is verified
  isVerified(agentId: AgentID): boolean {
    const agent = this.verified.getState()[agentId];
    if (!agent) return false;
    
    if (Date.now() > agent.sessionExpiry) {
      this.revoke(agentId);
      return false;
    }
    
    return true;
  }
  
  // Check permission
  hasPermission(agentId: AgentID, permission: Permission): boolean {
    if (!this.isVerified(agentId)) return false;
    
    const agent = this.verified.getState()[agentId];
    return agent?.permissions.includes(permission) || false;
  }
  
  // Refresh session
  refresh(agentId: AgentID): boolean {
    const agent = this.verified.getState()[agentId];
    if (!agent) return false;
    
    this.verified.setState({
      ...this.verified.getState(),
      [agentId]: {
        ...agent,
        sessionExpiry: Date.now() + this.SESSION_TTL
      }
    });
    
    return true;
  }
  
  // Revoke verification
  revoke(agentId: AgentID): void {
    const verified = { ...this.verified.getState() };
    delete verified[agentId];
    this.verified.setState(verified);
    
    this.events.emit('agent:revoked', { agentId });
  }
  
  // Get verified agent info
  getVerified(agentId: AgentID): VerifiedAgent | undefined {
    return this.verified.getState()[agentId];
  }
  
  // Update permissions (admin only)
  setPermissions(agentId: AgentID, permissions: Permission[]): void {
    const agent = this.verified.getState()[agentId];
    if (!agent) return;
    
    this.verified.setState({
      ...this.verified.getState(),
      [agentId]: { ...agent, permissions }
    });
  }
  
  // Cleanup expired sessions
  cleanup(): void {
    const now = Date.now();
    const verified = { ...this.verified.getState() };
    
    for (const [id, agent] of Object.entries(verified)) {
      if (now > agent.sessionExpiry) {
        delete verified[id as AgentID];
      }
    }
    
    this.verified.setState(verified);
  }
  
  // Subscribe to auth events
  on(event: string, handler: Function): () => void {
    return this.events.on(event, handler);
  }
  
  private computeSignature(nonce: string, publicKey: string): string {
    return createHash('sha256')
      .update(nonce + publicKey)
      .digest('hex');
  }
  
  private inferPermissions(agentId: AgentID): Permission[] {
    // In production, this would use role-based access control
    return [
      'discover:agents',
      'send:proposals',
      'accept:deals'
    ];
  }
}

export const auth = new AuthManager();