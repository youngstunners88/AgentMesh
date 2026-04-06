// AgentMesh - Main Entry Point
// Autonomous B2B Multi-Agent Commerce Network

import { StateManager } from './core/StateManager';
import { MessageRouter } from './router/MessageRouter';
import { BusinessAgent, BusinessCapabilities } from './agents/BusinessAgent';
import { ConsumerAgent, ShoppingIntent } from './consumers/ConsumerAgent';
import { HttpTransport, WebSocketTransport, JsonProtocolAdapter } from './protocol/ProtocolAbstraction';

export { StateManager } from './core/StateManager';
export { MessageRouter } from './router/MessageRouter';
export { BusinessAgent, BusinessCapabilities } from './agents/BusinessAgent';
export { ConsumerAgent, ShoppingIntent } from './consumers/ConsumerAgent';
export { HttpTransport, WebSocketTransport, JsonProtocolAdapter } from './protocol/ProtocolAbstraction';
export { DealEngine, DealProposal, DealStatus } from './deals/DealEngine';

export interface AgentMeshConfig {
  enableLogging: boolean;
  maxHistorySize: number;
  transportType: 'http' | 'websocket';
  baseUrl: string;
}

export class AgentMesh {
  readonly stateManager: StateManager;
  readonly router: MessageRouter;
  private agents: Map<string, BusinessAgent | ConsumerAgent>;
  private config: AgentMeshConfig;

  constructor(config: Partial<AgentMeshConfig> = {}) {
    this.config = {
      enableLogging: true,
      maxHistorySize: 100,
      transportType: 'http',
      baseUrl: 'http://localhost:3000',
      ...config
    };

    this.stateManager = new StateManager(this.config.maxHistorySize);
    this.router = new MessageRouter();
    this.agents = new Map();
  }

  // Agent factory methods
  createBusinessAgent(
    id: string,
    name: string,
    category: 'retail' | 'manufacturing' | 'logistics' | 'finance',
    capabilities: BusinessCapabilities
  ): BusinessAgent {
    const agent = new BusinessAgent(
      id,
      name,
      category,
      capabilities,
      this.stateManager,
      this.router
    );
    
    this.agents.set(id, agent);
    
    if (this.config.enableLogging) {
      console.log(`[AgentMesh] Business agent created: ${name} (${id})`);
    }
    
    return agent;
  }

  createConsumerAgent(id: string, name: string): ConsumerAgent {
    const agent = new ConsumerAgent(
      id,
      name,
      this.stateManager,
      this.router
    );
    
    this.agents.set(id, agent);
    
    if (this.config.enableLogging) {
      console.log(`[AgentMesh] Consumer agent created: ${name} (${id})`);
    }
    
    return agent;
  }

  // System management
  getAgent(id: string): BusinessAgent | ConsumerAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): Map<string, BusinessAgent | ConsumerAgent> {
    return new Map(this.agents);
  }

  getSystemState() {
    return this.stateManager.getState();
  }

  getRouterStats() {
    return this.router.getStats();
  }

  // Discovery and matching
  findAgentsByCategory(category: string): string[] {
    const state = this.stateManager.getState();
    const matches: string[] = [];
    
    for (const [id, profile] of state.agents.entries()) {
      if (profile.category === category) {
        matches.push(id);
      }
    }
    
    return matches;
  }

  findAgentsByCapability(capability: string): string[] {
    const state = this.stateManager.getState();
    const matches: string[] = [];
    
    for (const [id, profile] of state.agents.entries()) {
      if (profile.capabilities.includes(capability as any)) {
        matches.push(id);
      }
    }
    
    return matches;
  }

  // Stats
  getStats(): {
    agents: number;
    deals: number;
    routes: number;
    topics: number;
  } {
    const routerStats = this.router.getStats();
    const state = this.stateManager.getState();
    
    return {
      agents: state.agents.size,
      deals: state.deals.size,
      routes: routerStats.directRoutes,
      topics: routerStats.topicSubscriptions
    };
  }
}

// Default export
export default AgentMesh;