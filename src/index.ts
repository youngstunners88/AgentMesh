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
export { Types } from './core/types';

// Agents
export { BusinessAgent, Capabilities } from './agents/BusinessAgent';
export { ConsumerAgent } from './agents/ConsumerAgent';
export { CapitalAgent } from './agents/CapitalAgent';
export { DAOAgent, InfrastructureCapability } from './dao/DAOAgent';
export { CompanyAgent, CompanyRole } from './companies/CompanyAgent';

// Deal System
export { DealEngine, Deal } from './deals/DealEngine';
export { ValueSettlement, EscrowRecord } from './deals/ValueSettlement';

// Protocol & Infrastructure
export { ProtocolAbstraction } from './protocol/ProtocolAbstraction';
export { MessageRouter } from './router/MessageRouter';

// Registry & Discovery
export { AgentRegistry } from './registry/AgentRegistry';
export { CompanyRegistry } from './registry/CompanyRegistry';

// Economic Systems
export { MarketSimulator, MarketSnapshot } from './market/MarketSimulator';
export { FinancialEngine, BalanceSheet, PnL, CashFlow, FinancialHealth } from './accounting/FinancialEngine';
export { PredictiveAnalytics, PredictionResult, MarketTrend, DealFeatures } from './analytics/PredictiveAnalytics';

// Visualization
export { MeshVisualizer, VisualizerConfig, SceneSnapshot } from './visualization/MeshVisualizer';

// Real Data & APIs
export { RealAPIConnectors, StockData, CommodityData, MarketContext } from './integrations/RealAPIConnectors';

// Production & Distribution
export { ProductionEngine, ProductionLine } from './manufacturing/ProductionEngine';
export { LogisticsNetwork, SupplyChain, DistributionRoute } from './distribution/LogisticsNetwork';

// Strategy & Governance
export { StrategicEngine, Strategy } from './strategy/StrategicEngine';
export { CoalitionFormation, Coalition } from './strategy/CoalitionFormation';
export { GovernanceModule, Proposal, Vote } from './governance/GovernanceModule';
export { Voting } from './governance/Voting';

// Treasury & Security
export { Treasury } from './dao/Treasury';
export { SecurityLayer, FraudDetection } from './security/SecurityLayer';
export { AuthManager } from './auth/AuthManager';

// Monitoring & Analytics
export { MonitoringDashboard, SystemMetrics } from './monitoring/Dashboard';
export { EconomicAnalytics, TradeMetrics } from './analytics/EconomicAnalytics';

// Utilities
export { EventEmitter } from './utils/EventEmitter';
export { ErrorHandler } from './utils/ErrorHandler';
export { RateLimiter } from './utils/RateLimiter';
export { Logger } from './utils/Logger';

// Persistence
export { PersistenceLayer, DatabaseAdapter } from './persistence/PersistenceLayer';

// Communication
export { AgentMailBridge } from './communication/AgentMailBridge';
export { HumanInboxManager } from './communication/HumanInboxManager';
export { ApprovalWorkflow } from './communication/ApprovalWorkflow';
export { DigestGenerator } from './communication/DigestGenerator';

// Economic Zones
export { EconomicZone, ZoneRules } from './economy/EconomicZones';

// Inspector & Demo
export { MeshInspector } from './inspector/MeshInspector';

// API Server
export { createAPIServer } from './api/server';

// Demo
export { runSusieDemo } from './examples/susie-demo';

// Version
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();