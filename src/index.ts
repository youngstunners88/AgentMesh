// AgentMesh - Autonomous Economic Ecosystem
// Full-scale business automation network

import { AgentRegistry, registry } from './registry/Registry';
import { MessageRouter } from './router/MessageRouter';
import { StateManager } from './core/StateManager';
import { ProtocolAbstraction } from './protocol/ProtocolAbstraction';
import { StrategicEngine } from './strategy/StrategicEngine';
import { CoalitionFormation } from './strategy/CoalitionFormation';
import { CapitalAgent } from './capital/CapitalAgent';
import { ProductionEngine } from './manufacturing/ProductionEngine';
import { LogisticsNetwork } from './distribution/LogisticsNetwork';
import { DealEngine } from './deals/DealEngine';
import { SettlementEngine } from './settlement/SettlementEngine';
import { BusinessAgent } from './agents/BusinessAgent';
import { ConsumerAgent } from './consumers/ConsumerAgent';
import { EconomicAnalytics } from './analytics/EconomicAnalytics';
import { Dashboard } from './monitoring/Dashboard';
import { EventEmitter } from './utils/EventEmitter';
import { ErrorHandler } from './utils/ErrorHandler';
import { RateLimiter } from './utils/RateLimiter';
import { PersistenceLayer } from './persistence/PersistenceLayer';
import { AuthManager } from './auth/AuthManager';

export {
  // Core
  AgentRegistry, registry,
  MessageRouter,
  StateManager,
  ProtocolAbstraction,
  EventEmitter,
  ErrorHandler,
  RateLimiter,
  PersistenceLayer,
  AuthManager,
  
  // Agents
  BusinessAgent,
  ConsumerAgent,
  CapitalAgent,
  
  // Strategy & Intelligence
  StrategicEngine,
  CoalitionFormation,
  
  // Operations
  ProductionEngine,
  LogisticsNetwork,
  DealEngine,
  SettlementEngine,
  
  // Analytics
  EconomicAnalytics,
  Dashboard
};

// Main AgentMesh class - orchestrates the entire ecosystem
export class AgentMesh {
  private stateManager: StateManager;
  private messageRouter: MessageRouter;
  private strategicEngine: StrategicEngine;
  private coalitionFormation: CoalitionFormation;
  private productionEngine: ProductionEngine;
  private logisticsNetwork: LogisticsNetwork;
  private dealEngine: DealEngine;
  private settlementEngine: SettlementEngine;
  private economicAnalytics: EconomicAnalytics;
  private dashboard: Dashboard;
  private eventEmitter: EventEmitter;
  private persistence: PersistenceLayer;
  private authManager: AuthManager;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.persistence = new PersistenceLayer();
    this.authManager = new AuthManager();
    this.stateManager = new StateManager(this.eventEmitter);
    this.messageRouter = new MessageRouter(this.eventEmitter);
    this.strategicEngine = new StrategicEngine(this.eventEmitter, this.stateManager);
    this.coalitionFormation = new CoalitionFormation(this.eventEmitter);
    this.productionEngine = new ProductionEngine(this.eventEmitter);
    this.logisticsNetwork = new LogisticsNetwork(this.eventEmitter);
    this.dealEngine = new DealEngine(this.stateManager, this.messageRouter, this.eventEmitter);
    this.settlementEngine = new SettlementEngine();
    this.economicAnalytics = new EconomicAnalytics(this.eventEmitter);
    this.dashboard = new Dashboard(this.eventEmitter);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Cross-module event coordination
    this.eventEmitter.on('deal:completed', (deal) => {
      this.economicAnalytics.recordDeal(deal);
      this.strategicEngine.updateMarketIntelligence(deal);
    });

    this.eventEmitter.on('coalition:formed', (coalition) => {
      this.economicAnalytics.recordCoalition(coalition);
    });

    this.eventEmitter.on('production:completed', (batch) => {
      this.logisticsNetwork.planDistribution(batch);
    });

    this.eventEmitter.on('capital:investment', (investment) => {
      this.economicAnalytics.recordInvestment(investment);
    });

    this.eventEmitter.on('state:changed', (change) => {
      this.persistence.persist(change);
    });
  }

  // Public API for ecosystem management
  public registerBusiness(agent: BusinessAgent): void {
    registry.register(agent);
    this.messageRouter.registerAgent(agent);
    this.strategicEngine.registerAgent(agent);
  }

  public registerCapitalAgent(agent: CapitalAgent): void {
    registry.register(agent);
    this.coalitionFormation.registerCapitalAgent(agent);
    this.messageRouter.registerAgent(agent);
  }

  public async initiateDeal(buyerId: string, sellerId: string, requirements: any): Promise<any> {
    return this.dealEngine.initiateDeal(buyerId, sellerId, requirements);
  }

  public async formCoalition(agentIds: string[], objective: any): Promise<any> {
    return this.coalitionFormation.formCoalition(agentIds, objective);
  }

  public async processProduction(agentId: string, order: any): Promise<any> {
    return this.productionEngine.processOrder(agentId, order);
  }

  public async optimizeLogistics(shipment: any): Promise<any> {
    return this.logisticsNetwork.optimizeRoute(shipment);
  }

  public getDashboard(): Dashboard {
    return this.dashboard;
  }

  public getAnalytics(): EconomicAnalytics {
    return this.economicAnalytics;
  }

  public async getEcosystemSnapshot(): Promise<any> {
    return {
      agents: registry.getAllAgents(),
      deals: this.dealEngine.getActiveDeals(),
      coalitions: this.coalitionFormation.getActiveCoalitions(),
      production: this.productionEngine.getActiveProduction(),
      logistics: this.logisticsNetwork.getActiveShipments(),
      capital: this.coalitionFormation.getCapitalPool(),
      analytics: this.economicAnalytics.getSummary()
    };
  }

  public start(): void {
    console.log('🌐 AgentMesh Ecosystem Started');
    this.dashboard.start();
    this.economicAnalytics.start();
    this.strategicEngine.startContinuousAnalysis();
    
    // Start autonomous operations
    this.startAutonomousDiscovery();
  }

  private startAutonomousDiscovery(): void {
    // Agents continuously discover opportunities
    setInterval(async () => {
      const agents = registry.getAllAgents();
      for (const agent of agents) {
        if (agent.capabilities.includes('strategy')) {
          const opportunities = await this.strategicEngine.discoverOpportunities(agent.id);
          for (const opp of opportunities) {
            this.eventEmitter.emit('opportunity:discovered', { agentId: agent.id, opportunity: opp });
          }
        }
      }
    }, 60000); // Every minute
  }
}

// Singleton instance
export const agentMesh = new AgentMesh();

// Core Systems
export { AgentMesh } from './core/AgentMesh';
export { StateManager } from './core/StateManager';
export { EventEmitter } from './utils/EventEmitter';

// Agents
export { BusinessAgent, BusinessCapabilities } from './agents/BusinessAgent';
export { ConsumerAgent } from './consumers/ConsumerAgent';
export { CapitalAgent } from './capital/CapitalAgent';

// Protocol & Deals
export { MessageRouter } from './router/MessageRouter';
export { ProtocolAdapter } from './protocol/ProtocolAdapter';
export { DealEngine, Deal, DealStatus } from './deals/DealEngine';

// Registry
export { Registry, AgentRegistryEntry } from './registry/Registry';

// Strategy & Coalitions
export { StrategicEngine } from './strategy/StrategicEngine';
export { CoalitionManager, Coalition } from './strategy/CoalitionManager';

// Manufacturing & Distribution
export { ProductionEngine } from './manufacturing/ProductionEngine';
export { LogisticsNetwork } from './distribution/LogisticsNetwork';

// Auth & Settlement
export { AuthManager } from './auth/AuthManager';
export { SettlementEngine } from './settlement/SettlementEngine';

// Persistence & Security
export { PersistenceLayer } from './persistence/PersistenceLayer';
export { SecurityLayer } from './security/SecurityLayer';

// Blockchain
export { SmartContractEscrow } from './blockchain/SmartContractEscrow';

// AI
export { LLMStrategyAgent } from './ai/LLMStrategyAgent';

// Data Feeds
export { DataFeedEngine } from './feeds/DataFeedEngine';

// Communication (AgentMail Bridge)
export { AgentMailBridge } from './communication/AgentMailBridge';
export { HumanInboxManager } from './communication/HumanInboxManager';
export { ApprovalWorkflow } from './communication/ApprovalWorkflow';
export { DigestGenerator } from './communication/DigestGenerator';

// Types
export * from './core/types';