// Deal Engine - Transaction and negotiation logic

import { AgentID, DealID } from '../core/types';

export interface DealProposal {
  id: DealID;
  buyerAgent: AgentID;
  sellerAgent: AgentID;
  product: string;
  proposedPrice: number;
  proposedQuantity: number;
  proposedDeliveryDays: number;
  status: DealStatus;
  createdAt: number;
}

export type DealStatus = 
  | 'proposed' 
  | 'negotiating' 
  | 'accepted' 
  | 'rejected' 
  | 'escrow' 
  | 'settled' 
  | 'disputed';

export interface NegotiationState {
  dealId: DealID;
  buyerAgent: AgentID;
  sellerAgent: AgentID;
  product: string;
  proposedPrice: number;
  proposedQuantity: number;
  status: DealStatus;
  lastUpdate: number;
  messageHistory: NegotiationMessage[];
}

export interface NegotiationMessage {
  from: AgentID;
  to: AgentID;
  type: 'offer' | 'counter' | 'accept' | 'reject' | 'query';
  content: string;
  timestamp: number;
}

export interface EscrowRecord {
  dealId: DealID;
  amount: number;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  buyerFundsLocked: boolean;
  sellerGoodsConfirmed: boolean;
  createdAt: number;
  settledAt: number | null;
}

export class DealEngine {
  private deals: Map<DealID, DealProposal>;
  private negotiations: Map<DealID, NegotiationState>;
  private escrows: Map<DealID, EscrowRecord>;

  constructor() {
    this.deals = new Map();
    this.negotiations = new Map();
    this.escrows = new Map();
  }

  // Deal lifecycle
  proposeDeal(params: {
    buyerAgent: AgentID;
    sellerAgent: AgentID;
    product: string;
    proposedPrice: number;
    proposedQuantity: number;
    proposedDeliveryDays?: number;
  }): DealProposal {
    const deal: DealProposal = {
      id: this.generateDealId(),
      ...params,
      proposedDeliveryDays: params.proposedDeliveryDays || 7,
      status: 'proposed',
      createdAt: Date.now()
    };

    this.deals.set(deal.id, deal);
    
    // Initialize negotiation
    const negotiation: NegotiationState = {
      dealId: deal.id,
      buyerAgent: deal.buyerAgent,
      sellerAgent: deal.sellerAgent,
      product: deal.product,
      proposedPrice: deal.proposedPrice,
      proposedQuantity: deal.proposedQuantity,
      status: 'proposed',
      lastUpdate: Date.now(),
      messageHistory: []
    };

    this.negotiations.set(deal.id, negotiation);
    
    return deal;
  }

  counterOffer(negotiation: NegotiationState, counteringAgent: AgentID): NegotiationState {
    const updated: NegotiationState = {
      ...negotiation,
      status: 'negotiating',
      lastUpdate: Date.now(),
      messageHistory: [
        ...negotiation.messageHistory,
        {
          from: counteringAgent,
          to: counteringAgent === negotiation.buyerAgent 
            ? negotiation.sellerAgent 
            : negotiation.buyerAgent,
          type: 'counter',
          content: 'Counter offer proposed',
          timestamp: Date.now()
        }
      ]
    };

    this.negotiations.set(updated.dealId, updated);
    return updated;
  }

  acceptDeal(dealId: DealID, acceptingAgent: AgentID): boolean {
    const deal = this.deals.get(dealId);
    const negotiation = this.negotiations.get(dealId);
    
    if (!deal || !negotiation) return false;

    // Update deal status
    deal.status = 'accepted';
    this.deals.set(dealId, deal);

    // Update negotiation
    negotiation.status = 'accepted';
    negotiation.lastUpdate = Date.now();
    negotiation.messageHistory.push({
      from: acceptingAgent,
      to: acceptingAgent === deal.buyerAgent ? deal.sellerAgent : deal.buyerAgent,
      type: 'accept',
      content: 'Deal accepted',
      timestamp: Date.now()
    });
    this.negotiations.set(dealId, negotiation);

    // Create escrow
    this.createEscrow(deal);

    return true;
  }

  rejectDeal(dealId: DealID, rejectingAgent: AgentID, reason: string): boolean {
    const deal = this.deals.get(dealId);
    const negotiation = this.negotiations.get(dealId);
    
    if (!deal || !negotiation) return false;

    deal.status = 'rejected';
    this.deals.set(dealId, deal);

    negotiation.status = 'rejected';
    negotiation.lastUpdate = Date.now();
    negotiation.messageHistory.push({
      from: rejectingAgent,
      to: rejectingAgent === deal.buyerAgent ? deal.sellerAgent : deal.buyerAgent,
      type: 'reject',
      content: reason,
      timestamp: Date.now()
    });
    this.negotiations.set(dealId, negotiation);

    return true;
  }

  // Escrow management
  private createEscrow(deal: DealProposal): EscrowRecord {
    const escrow: EscrowRecord = {
      dealId: deal.id,
      amount: deal.proposedPrice * deal.proposedQuantity,
      buyerConfirmed: false,
      sellerConfirmed: false,
      buyerFundsLocked: false,
      sellerGoodsConfirmed: false,
      createdAt: Date.now(),
      settledAt: null
    };

    this.escrows.set(deal.id, escrow);
    return escrow;
  }

  lockBuyerFunds(dealId: DealID): boolean {
    const escrow = this.escrows.get(dealId);
    if (!escrow) return false;
    
    escrow.buyerFundsLocked = true;
    escrow.buyerConfirmed = true;
    this.escrows.set(dealId, escrow);
    
    this.checkSettlement(dealId);
    return true;
  }

  confirmSellerGoods(dealId: DealID): boolean {
    const escrow = this.escrows.get(dealId);
    if (!escrow) return false;
    
    escrow.sellerGoodsConfirmed = true;
    escrow.sellerConfirmed = true;
    this.escrows.set(dealId, escrow);
    
    this.checkSettlement(dealId);
    return true;
  }

  private checkSettlement(dealId: DealID): void {
    const escrow = this.escrows.get(dealId);
    const deal = this.deals.get(dealId);
    
    if (!escrow || !deal) return;

    if (escrow.buyerFundsLocked && escrow.sellerGoodsConfirmed) {
      escrow.settledAt = Date.now();
      this.escrows.set(dealId, escrow);
      
      deal.status = 'escrow';
      this.deals.set(dealId, deal);
    }
  }

  settleDeal(dealId: DealID): boolean {
    const deal = this.deals.get(dealId);
    const escrow = this.escrows.get(dealId);
    
    if (!deal || !escrow) return false;
    if (!escrow.buyerConfirmed || !escrow.sellerConfirmed) return false;

    deal.status = 'settled';
    this.deals.set(dealId, deal);

    escrow.settledAt = Date.now();
    this.escrows.set(dealId, escrow);

    return true;
  }

  // Queries
  getDeal(dealId: DealID): DealProposal | undefined {
    return this.deals.get(dealId);
  }

  getNegotiation(dealId: DealID): NegotiationState | undefined {
    return this.negotiations.get(dealId);
  }

  getEscrow(dealId: DealID): EscrowRecord | undefined {
    return this.escrows.get(dealId);
  }

  getDealsByAgent(agentId: AgentID): DealProposal[] {
    return Array.from(this.deals.values()).filter(
      deal => deal.buyerAgent === agentId || deal.sellerAgent === agentId
    );
  }

  getActiveDeals(): DealProposal[] {
    return Array.from(this.deals.values()).filter(
      deal => ['proposed', 'negotiating', 'accepted', 'escrow'].includes(deal.status)
    );
  }

  private generateDealId(): string {
    return `deal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}