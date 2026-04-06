// Settlement Engine - Handles value exchange and escrow

import { AgentID } from '../core/types';
import { StateManager } from '../core/StateManager';
import { EventEmitter } from '../utils/EventEmitter';

export interface EscrowTransaction {
  id: string;
  dealId: string;
  buyerId: AgentID;
  sellerId: AgentID;
  amount: number;
  currency: 'USD' | 'BTC' | 'ETH' | string;
  status: 'pending' | 'funded' | 'released' | 'refunded' | 'disputed';
  createdAt: number;
  fundedAt?: number;
  releasedAt?: number;
  buyerDeposit: number;
  sellerDeposit: number;
  conditions: ReleaseCondition[];
}

export interface ReleaseCondition {
  type: 'delivery' | 'confirmation' | 'verification' | 'time';
  description: string;
  satisfied: boolean;
  verifiedBy?: AgentID;
  verifiedAt?: number;
}

export interface TransactionReceipt {
  transactionId: string;
  type: 'deposit' | 'release' | 'refund' | 'dispute';
  amount: number;
  timestamp: number;
  signatures: string[];
}

export class SettlementEngine {
  private escrows: StateManager<Record<string, EscrowTransaction>>;
  private receipts: StateManager<Record<string, TransactionReceipt[]>>;
  private balances: StateManager<Record<AgentID, number>>;
  private events: EventEmitter;
  
  constructor() {
    this.escrows = new StateManager<Record<string, EscrowTransaction>>({});
    this.receipts = new StateManager<Record<string, TransactionReceipt[]>>({});
    this.balances = new StateManager<Record<AgentID, number>>({});
    this.events = new EventEmitter();
  }
  
  // Create escrow
  createEscrow(
    dealId: string,
    buyerId: AgentID,
    sellerId: AgentID,
    amount: number,
    currency: string,
    conditions: ReleaseCondition[]
  ): EscrowTransaction {
    const escrow: EscrowTransaction = {
      id: `escrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dealId,
      buyerId,
      sellerId,
      amount,
      currency,
      status: 'pending',
      createdAt: Date.now(),
      buyerDeposit: 0,
      sellerDeposit: 0,
      conditions
    };
    
    this.escrows.setState({
      ...this.escrows.getState(),
      [escrow.id]: escrow
    });
    
    this.events.emit('escrow:created', escrow);
    return escrow;
  }
  
  // Fund escrow
  fundEscrow(escrowId: string, agentId: AgentID, amount: number): boolean {
    const escrow = this.escrows.getState()[escrowId];
    if (!escrow) return false;
    
    if (escrow.status !== 'pending') {
      throw new Error('Escrow is not in pending state');
    }
    
    // Check balance
    const currentBalance = this.balances.getState()[agentId] || 0;
    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }
    
    // Deduct from balance
    this.balances.setState({
      ...this.balances.getState(),
      [agentId]: currentBalance - amount
    });
    
    // Update escrow
    const isBuyer = escrow.buyerId === agentId;
    const isSeller = escrow.sellerId === agentId;
    
    const updatedEscrow: EscrowTransaction = {
      ...escrow,
      [isBuyer ? 'buyerDeposit' : 'sellerDeposit']: 
        isBuyer ? amount : isSeller ? amount : escrow.buyerDeposit,
      status: this.isFullyFunded(escrow, amount, agentId) ? 'funded' : 'pending',
      fundedAt: Date.now()
    };
    
    this.escrows.setState({
      ...this.escrows.getState(),
      [escrowId]: updatedEscrow
    });
    
    // Create receipt
    this.addReceipt(escrowId, {
      transactionId: `deposit-${Date.now()}`,
      type: 'deposit',
      amount,
      timestamp: Date.now(),
      signatures: [agentId]
    });
    
    this.events.emit('escrow:funded', updatedEscrow);
    return true;
  }
  
  // Satisfy condition
  satisfyCondition(
    escrowId: string,
    conditionIndex: number,
    verifiedBy: AgentID
  ): boolean {
    const escrow = this.escrows.getState()[escrowId];
    if (!escrow) return false;
    
    const conditions = [...escrow.conditions];
    if (conditionIndex < 0 || conditionIndex >= conditions.length) {
      return false;
    }
    
    conditions[conditionIndex] = {
      ...conditions[conditionIndex],
      satisfied: true,
      verifiedBy,
      verifiedAt: Date.now()
    };
    
    const updatedEscrow: EscrowTransaction = {
      ...escrow,
      conditions
    };
    
    this.escrows.setState({
      ...this.escrows.getState(),
      [escrowId]: updatedEscrow
    });
    
    // Check if all conditions satisfied
    if (updatedEscrow.conditions.every(c => c.satisfied)) {
      this.releaseEscrow(escrowId);
    }
    
    this.events.emit('condition:satisfied', {
      escrowId,
      conditionIndex,
      verifiedBy
    });
    
    return true;
  }
  
  // Release escrow
  releaseEscrow(escrowId: string): boolean {
    const escrow = this.escrows.getState()[escrowId];
    if (!escrow) return false;
    
    if (escrow.status !== 'funded') {
      throw new Error('Escrow not fully funded');
    }
    
    if (!escrow.conditions.every(c => c.satisfied)) {
      throw new Error('Not all conditions satisfied');
    }
    
    // Transfer to seller
    const sellerBalance = this.balances.getState()[escrow.sellerId] || 0;
    this.balances.setState({
      ...this.balances.getState(),
      [escrow.sellerId]: sellerBalance + escrow.amount
    });
    
    const updatedEscrow: EscrowTransaction = {
      ...escrow,
      status: 'released',
      releasedAt: Date.now()
    };
    
    this.escrows.setState({
      ...this.escrows.getState(),
      [escrowId]: updatedEscrow
    });
    
    this.addReceipt(escrowId, {
      transactionId: `release-${Date.now()}`,
      type: 'release',
      amount: escrow.amount,
      timestamp: Date.now(),
      signatures: [escrow.buyerId, escrow.sellerId]
    });
    
    this.events.emit('escrow:released', updatedEscrow);
    return true;
  }
  
  // Refund
  refund(escrowId: string): boolean {
    const escrow = this.escrows.getState()[escrowId];
    if (!escrow) return false;
    
    if (escrow.status === 'released' || escrow.status === 'refunded') {
      return false;
    }
    
    // Return buyer deposit
    if (escrow.buyerDeposit > 0) {
      const buyerBalance = this.balances.getState()[escrow.buyerId] || 0;
      this.balances.setState({
        ...this.balances.getState(),
        [escrow.buyerId]: buyerBalance + escrow.buyerDeposit
      });
    }
    
    // Return seller deposit
    if (escrow.sellerDeposit > 0) {
      const sellerBalance = this.balances.getState()[escrow.sellerId] || 0;
      this.balances.setState({
        ...this.balances.getState(),
        [escrow.sellerId]: sellerBalance + escrow.sellerDeposit
      });
    }
    
    const updatedEscrow: EscrowTransaction = {
      ...escrow,
      status: 'refunded'
    };
    
    this.escrows.setState({
      ...this.escrows.getState(),
      [escrowId]: updatedEscrow
    });
    
    this.addReceipt(escrowId, {
      transactionId: `refund-${Date.now()}`,
      type: 'refund',
      amount: escrow.buyerDeposit,
      timestamp: Date.now(),
      signatures: []
    });
    
    this.events.emit('escrow:refunded', updatedEscrow);
    return true;
  }
  
  // Get escrow
  getEscrow(escrowId: string): EscrowTransaction | undefined {
    return this.escrows.getState()[escrowId];
  }
  
  // Get receipts for escrow
  getReceipts(escrowId: string): TransactionReceipt[] {
    return this.receipts.getState()[escrowId] || [];
  }
  
  // Get agent balance
  getBalance(agentId: AgentID): number {
    return this.balances.getState()[agentId] || 0;
  }
  
  // Deposit to balance
  deposit(agentId: AgentID, amount: number): void {
    const current = this.balances.getState()[agentId] || 0;
    this.balances.setState({
      ...this.balances.getState(),
      [agentId]: current + amount
    });
  }
  
  // Subscribe to events
  on(event: string, handler: Function): () => void {
    return this.events.on(event, handler);
  }
  
  private isFullyFunded(
    escrow: EscrowTransaction,
    newDeposit: number,
    agentId: AgentID
  ): boolean {
    const totalNeeded = escrow.amount * 1.1;  // 10% buffer
    const current = escrow.buyerDeposit + escrow.sellerDeposit;
    return current + newDeposit >= totalNeeded;
  }
  
  private addReceipt(escrowId: string, receipt: TransactionReceipt): void {
    const current = this.receipts.getState()[escrowId] || [];
    this.receipts.setState({
      ...this.receipts.getState(),
      [escrowId]: [...current, receipt]
    });
  }
}

export const settlement = new SettlementEngine();