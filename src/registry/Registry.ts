// Agent Registry - Discovery and lookup service for all agents in the mesh

import { AgentID, AgentProfile, BusinessCapabilities, ConsumerPreferences } from '../core/types';
import { StateManager } from '../core/StateManager';
import { EventEmitter } from '../utils/EventEmitter';

export interface RegistryEntry {
  agentId: AgentID;
  profile: AgentProfile;
  capabilities: BusinessCapabilities | ConsumerPreferences;
  lastSeen: number;
  reputation: number;
  status: 'active' | 'idle' | 'offline';
}

export class AgentRegistry {
  private state: StateManager<Record<AgentID, RegistryEntry>>;
  private events: EventEmitter;
  
  constructor() {
    this.state = new StateManager<Record<AgentID, RegistryEntry>>({});
    this.events = new EventEmitter();
  }
  
  // Register a new agent
  register(entry: Omit<RegistryEntry, 'lastSeen' | 'reputation' | 'status'>): RegistryEntry {
    const fullEntry: RegistryEntry = {
      ...entry,
      lastSeen: Date.now(),
      reputation: 0,
      status: 'active'
    };
    
    this.state.setState({
      ...this.state.getState(),
      [entry.agentId]: fullEntry
    });
    
    this.events.emit('agent:registered', fullEntry);
    return fullEntry;
  }
  
  // Lookup by ID
  lookup(agentId: AgentID): RegistryEntry | undefined {
    const entry = this.state.getState()[agentId];
    if (entry) {
      this.updateLastSeen(agentId);
    }
    return entry;
  }
  
  // Discover agents by category
  discover(category: string): RegistryEntry[] {
    return Object.values(this.state.getState())
      .filter(entry => entry.profile.category === category)
      .filter(entry => entry.status === 'active')
      .sort((a, b) => b.reputation - a.reputation);
  }
  
  // Find matches based on capabilities
  findMatches(capabilities: Partial<BusinessCapabilities>): RegistryEntry[] {
    return Object.values(this.state.getState())
      .filter(entry => {
        const caps = entry.capabilities as BusinessCapabilities;
        return Object.entries(capabilities).every(([key, value]) => {
          return caps[key as keyof BusinessCapabilities] === value;
        });
      })
      .filter(entry => entry.status === 'active');
  }
  
  // Update reputation
  updateReputation(agentId: AgentID, delta: number): void {
    const entry = this.lookup(agentId);
    if (!entry) return;
    
    const newRep = Math.max(0, Math.min(100, entry.reputation + delta));
    
    this.state.setState({
      ...this.state.getState(),
      [agentId]: { ...entry, reputation: newRep }
    });
    
    this.events.emit('reputation:updated', { agentId, newReputation: newRep });
  }
  
  // Heartbeat - keep agent alive
  heartbeat(agentId: AgentID): void {
    const entry = this.lookup(agentId);
    if (entry && entry.status !== 'active') {
      this.state.setState({
        ...this.state.getState(),
        [agentId]: { ...entry, status: 'active', lastSeen: Date.now() }
      });
      this.events.emit('agent:activated', { agentId });
    }
  }
  
  // Mark agent offline
  markOffline(agentId: AgentID): void {
    const entry = this.lookup(agentId);
    if (!entry) return;
    
    this.state.setState({
      ...this.state.getState(),
      [agentId]: { ...entry, status: 'offline' }
    });
    
    this.events.emit('agent:offline', { agentId });
  }
  
  // Get all active agents
  getActive(): RegistryEntry[] {
    return Object.values(this.state.getState())
      .filter(entry => entry.status === 'active');
  }
  
  // Cleanup stale agents
  cleanup(maxAgeMs: number = 300000): void {  // 5 minutes default
    const now = Date.now();
    const state = this.state.getState();
    
    for (const [id, entry] of Object.entries(state)) {
      if (now - entry.lastSeen > maxAgeMs && entry.status === 'active') {
        this.markOffline(id as AgentID);
      }
    }
  }
  
  // Subscribe to registry events
  on(event: string, handler: Function): () => void {
    return this.events.on(event, handler);
  }
  
  private updateLastSeen(agentId: AgentID): void {
    const entry = this.state.getState()[agentId];
    if (!entry) return;
    
    this.state.setState({
      ...this.state.getState(),
      [agentId]: { ...entry, lastSeen: Date.now() }
    }, false);  // Silent update
  }
}

export const registry = new AgentRegistry();