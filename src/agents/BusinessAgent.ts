// Business Agent - Core autonomous business representative

import { AgentID, AgentProfile, Capability, BusinessCategory, MessageEntry, MessageType } from '../core/types';
import { StateManager } from '../core/StateManager';
import { MessageRouter } from '../router/MessageRouter';
import { ProtocolAbstraction, TransportLayer, ProtocolAdapter } from '../protocol/ProtocolAbstraction';
import { DealEngine, DealProposal, NegotiationState } from '../deals/DealEngine';

export interface BusinessCapabilities {
  canSource: boolean;
  canManufacture: boolean;
  canDeliver: boolean;
  canFinance: boolean;
  canMarket: boolean;
}

export interface ValueRequirements {
  needsProduct: string;
  needsCapability: Capability;
  maxPrice: number;
  minQuality: number;
  deliveryTimeframe: number; // days
}

export class BusinessAgent {
  readonly id: AgentID;
  private profile: AgentProfile;
  private capabilities: BusinessCapabilities;
  private requirements: ValueRequirements | null;
  private stateManager: StateManager;
  private router: MessageRouter;
  private protocol: ProtocolAbstraction | null;
  private dealEngine: DealEngine;
  private messageUnsubscribe: (() => void) | null;

  constructor(
    id: AgentID,
    name: string,
    category: BusinessCategory,
    capabilities: BusinessCapabilities,
    stateManager: StateManager,
    router: MessageRouter
  ) {
    this.id = id;
    this.capabilities = capabilities;
    this.requirements = null;
    this.stateManager = stateManager;
    this.router = router;
    this.protocol = null;
    this.dealEngine = new DealEngine();
    
    this.profile = {
      id,
      name,
      category,
      capabilities: this.extractCapabilities(capabilities),
      reputation: 100,
      createdAt: Date.now()
    };
  }

  private extractCapabilities(caps: BusinessCapabilities): Capability[] {
    const capabilities: Capability[] = [];
    if (caps.canSource) capabilities.push('sourcing');
    if (caps.canManufacture) capabilities.push('manufacturing');
    if (caps.canDeliver) capabilities.push('fulfillment');
    if (caps.canFinance) capabilities.push('financing');
    if (caps.canMarket) capabilities.push('marketing');
    return capabilities;
  }

  // Lifecycle
  async initialize(transport: TransportLayer, adapter: ProtocolAdapter): Promise<void> {
    // Register with state
    this.stateManager.registerAgent(this.profile);
    
    // Set up protocol layer
    this.protocol = new BusinessProtocol(this.id, transport, adapter);
    await this.protocol.initialize();
    
    // Subscribe to messages
    this.messageUnsubscribe = this.router.onMessage(this.id, (msg) => {
      this.handleMessage(msg);
    });
    
    // Register routes
    this.router.registerRoute(this.id, this.id); // Self-reference for discovery
    
    console.log(`[${this.id}] Business agent initialized`);
  }

  async shutdown(): Promise<void> {
    if (this.messageUnsubscribe) {
      this.messageUnsubscribe();
    }
    
    if (this.protocol) {
      // Protocol disconnect handled by transport
    }
    
    console.log(`[${this.id}] Business agent shutdown`);
  }

  // Business logic
  setRequirements(requirements: ValueRequirements): void {
    this.requirements = requirements;
    console.log(`[${this.id}] Requirements set: ${requirements.needsProduct}`);
  }

  async discoverPartners(): Promise<void> {
    if (!this.requirements) {
      console.warn(`[${this.id}] No requirements set for discovery`);
      return;
    }

    const discoveryMessage: MessageEntry = {
      id: this.generateId(),
      from: this.id,
      to: 'broadcast',
      type: 'discover',
      payload: {
        needs: this.requirements,
        offers: this.capabilities
      },
      timestamp: Date.now()
    };

    this.router.broadcast(this.id, 'discovery', discoveryMessage.payload);
    console.log(`[${this.id}] Broadcasting discovery for: ${this.requirements.needsProduct}`);
  }

  // Message handling
  private handleMessage(message: MessageEntry): void {
    console.log(`[${this.id}] Received ${message.type} from ${message.from}`);
    
    switch (message.type) {
      case 'discover':
        this.handleDiscovery(message);
        break;
      case 'negotiate':
        this.handleNegotiation(message);
        break;
      case 'propose':
        this.handleProposal(message);
        break;
      case 'accept':
        this.handleAcceptance(message);
        break;
      case 'reject':
        this.handleRejection(message);
        break;
      case 'escrow':
        this.handleEscrow(message);
        break;
      case 'settle':
        this.handleSettlement(message);
        break;
      default:
        console.warn(`[${this.id}] Unknown message type: ${message.type}`);
    }
  }

  private handleDiscovery(message: MessageEntry): void {
    const payload = message.payload as {
      needs: ValueRequirements;
      offers: BusinessCapabilities;
    };

    // Check if I can fulfill their needs
    const canFulfill = this.canFulfill(payload.needs);
    
    if (canFulfill) {
      // Send negotiation offer
      const offer: NegotiationState = {
        dealId: this.generateId(),
        buyerAgent: message.from,
        sellerAgent: this.id,
        product: payload.needs.needsProduct,
        proposedPrice: this.calculatePrice(payload.needs),
        proposedQuantity: 100,
        status: 'proposed',
        lastUpdate: Date.now()
      };

      this.sendMessage(message.from, 'negotiate', { offer });
    }
  }

  private handleNegotiation(message: MessageEntry): void {
    const { offer } = message.payload as { offer: NegotiationState };
    
    // Evaluate the offer
    if (this.requirements) {
      const acceptable = this.evaluateOffer(offer);
      
      if (acceptable) {
        const deal = this.dealEngine.proposeDeal({
          buyerAgent: this.id,
          sellerAgent: message.from,
          product: offer.product,
          proposedPrice: offer.proposedPrice,
          proposedQuantity: offer.proposedQuantity
        });
        
        this.sendMessage(message.from, 'propose', { deal });
      } else {
        const counter = this.dealEngine.counterOffer(offer, this.id);
        this.sendMessage(message.from, 'negotiate', { offer: counter });
      }
    }
  }

  private handleProposal(message: MessageEntry): void {
    const { deal } = message.payload as { deal: DealProposal };
    
    // Auto-accept if it meets requirements
    if (this.meetsRequirements(deal)) {
      this.sendMessage(message.from, 'accept', { dealId: deal.id });
    } else {
      this.sendMessage(message.from, 'reject', { 
        dealId: deal.id,
        reason: 'Terms do not meet requirements'
      });
    }
  }

  private handleAcceptance(message: MessageEntry): void {
    const { dealId } = message.payload as { dealId: string };
    this.dealEngine.acceptDeal(dealId, this.id);
    
    // Initiate escrow
    this.sendMessage(message.from, 'escrow', { dealId });
  }

  private handleRejection(message: MessageEntry): void {
    const { dealId, reason } = message.payload as { dealId: string; reason: string };
    console.log(`[${this.id}] Deal ${dealId} rejected: ${reason}`);
  }

  private handleEscrow(message: MessageEntry): void {
    const { dealId } = message.payload as { dealId: string };
    const deal = this.dealEngine.getDeal(dealId);
    
    if (deal) {
      // Confirm escrow
      this.sendMessage(message.from, 'settle', { dealId });
    }
  }

  private handleSettlement(message: MessageEntry): void {
    const { dealId } = message.payload as { dealId: string };
    this.dealEngine.settleDeal(dealId);
    console.log(`[${this.id}] Deal ${dealId} settled!`);
  }

  // Helper methods
  private sendMessage(to: AgentID, type: MessageType, payload: unknown): void {
    const message: MessageEntry = {
      id: this.generateId(),
      from: this.id,
      to,
      type,
      payload,
      timestamp: Date.now()
    };
    
    this.router.route(message);
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private canFulfill(requirements: ValueRequirements): boolean {
    // Logic to determine if this agent can fulfill the requirements
    if (this.capabilities.canManufacture && requirements.needsCapability === 'manufacturing') {
      return true;
    }
    if (this.capabilities.canDeliver && requirements.needsCapability === 'fulfillment') {
      return true;
    }
    if (this.capabilities.canSource && requirements.needsCapability === 'sourcing') {
      return true;
    }
    return false;
  }

  private calculatePrice(requirements: ValueRequirements): number {
    // Dynamic pricing logic
    return requirements.maxPrice * 0.85; // Offer 15% below max
  }

  private evaluateOffer(offer: NegotiationState): boolean {
    if (!this.requirements) return false;
    return offer.proposedPrice <= this.requirements.maxPrice;
  }

  private meetsRequirements(deal: DealProposal): boolean {
    if (!this.requirements) return false;
    return (
      deal.proposedPrice <= this.requirements.maxPrice &&
      deal.product === this.requirements.needsProduct
    );
  }
}

// Concrete protocol implementation
class BusinessProtocol extends ProtocolAbstraction {
  async initialize(): Promise<void> {
    await this.transport.connect();
    this.transport.onReceive((message) => {
      // Handle transport-level messages
      console.log('Transport received:', message);
    });
  }

  async send(message: MessageEntry): Promise<void> {
    if (!this.transport.isConnected()) {
      throw new Error('Transport not connected');
    }
    
    const encoded = this.adapter.encode(message);
    await this.transport.send(message);
  }

  onReceive(handler: (message: MessageEntry) => void): () => void {
    return this.transport.onReceive((payload) => {
      const decoded = this.adapter.decode(payload);
      if (this.adapter.validate(decoded)) {
        handler(decoded);
      }
    });
  }
}