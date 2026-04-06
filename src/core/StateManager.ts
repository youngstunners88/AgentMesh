// State Manager - Centralized immutable state management

import { SystemState, AgentID, DealID, AgentProfile, DealState } from './types';
import { EventEmitter } from '../utils/EventEmitter';

export class StateManager extends EventEmitter {
  private state: SystemState;
  private history: SystemState[];
  private maxHistory: number;

  constructor(maxHistory: number = 50) {
    super();
    this.state = this.createInitialState();
    this.history = [];
    this.maxHistory = maxHistory;
  }

  private createInitialState(): SystemState {
    return {
      agents: new Map(),
      deals: new Map(),
      messages: {
        entries: [],
        append: (entry) => this.state.messages.entries.push(entry),
        query: (filter) => this.queryMessages(filter)
      },
      registry: {
        byCategory: new Map(),
        byCapability: new Map()
      }
    };
  }

  private queryMessages(filter: any): any[] {
    return this.state.messages.entries.filter(entry => {
      if (filter.from && entry.from !== filter.from) return false;
      if (filter.to && entry.to !== filter.to) return false;
      if (filter.type && entry.type !== filter.type) return false;
      if (filter.since && entry.timestamp < filter.since) return false;
      return true;
    });
  }

  // Immutable state access
  getState(): Readonly<SystemState> {
    return Object.freeze({
      ...this.state,
      agents: new Map(this.state.agents),
      deals: new Map(this.state.deals)
    });
  }

  // Agent operations
  registerAgent(profile: AgentProfile): void {
    this.saveHistory();
    
    const newAgents = new Map(this.state.agents);
    newAgents.set(profile.id, profile);
    
    this.state = {
      ...this.state,
      agents: newAgents
    };
    
    this.emit('agent:registered', profile);
  }

  updateAgent(id: AgentID, updates: Partial<AgentProfile>): void {
    this.saveHistory();
    
    const existing = this.state.agents.get(id);
    if (!existing) throw new Error(`Agent ${id} not found`);
    
    const updated = { ...existing, ...updates };
    const newAgents = new Map(this.state.agents);
    newAgents.set(id, updated);
    
    this.state = {
      ...this.state,
      agents: newAgents
    };
    
    this.emit('agent:updated', updated);
  }

  // Deal operations
  createDeal(deal: DealState): void {
    this.saveHistory();
    
    const newDeals = new Map(this.state.deals);
    newDeals.set(deal.id, deal);
    
    this.state = {
      ...this.state,
      deals: newDeals
    };
    
    this.emit('deal:created', deal);
  }

  updateDeal(id: DealID, updates: Partial<DealState>): void {
    this.saveHistory();
    
    const existing = this.state.deals.get(id);
    if (!existing) throw new Error(`Deal ${id} not found`);
    
    const updated = { ...existing, ...updates };
    const newDeals = new Map(this.state.deals);
    newDeals.set(id, updated);
    
    this.state = {
      ...this.state,
      deals: newDeals
    };
    
    this.emit('deal:updated', updated);
  }

  // History management
  private saveHistory(): void {
    this.history.push(this.state);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  undo(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    this.emit('state:undo');
    return true;
  }

  // Subscriptions
  subscribe(selector: (state: SystemState) => any, callback: (value: any) => void): () => void {
    const handler = () => callback(selector(this.getState()));
    this.on('agent:registered', handler);
    this.on('agent:updated', handler);
    this.on('deal:created', handler);
    this.on('deal:updated', handler);
    
    return () => {
      this.off('agent:registered', handler);
      this.off('agent:updated', handler);
      this.off('deal:created', handler);
      this.off('deal:updated', handler);
    };
  }
}