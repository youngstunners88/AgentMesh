import { EventEmitter } from '../utils/EventEmitter';

interface Asset {
  type: 'NATIVE' | 'STABLE' | 'GOVERNANCE' | 'NFT';
  amount: number;
  address: string;
}

interface Grant {
  id: string;
  recipient: string;
  amount: number;
  purpose: string;
  approved: boolean;
  released: boolean;
}

export class Treasury {
  private assets: Map<string, Asset> = new Map();
  private grants: Map<string, Grant> = new Map();
  private eventEmitter = new EventEmitter();
  
  constructor(
    public daoAddress: string,
    public multiSigThreshold: number = 3
  ) {}

  // Network fee collection
  depositFee(amount: number, fromDeal: string): void {
    const fee = this.assets.get('fees') || { type: 'NATIVE', amount: 0, address: this.daoAddress };
    fee.amount += amount;
    this.assets.set('fees', fee);
    this.eventEmitter.emit('feeCollected', { deal: fromDeal, amount });
  }

  // Resource allocation to agents
  async allocate(compute: number, storage: number, bandwidth: number): Promise<string> {
    const allocationId = `alloc-${Date.now()}`;
    
    const cost = compute * 0.001 + storage * 0.0001 + bandwidth * 0.0005;
    const treasuryBalance = this.getBalance('NATIVE');
    
    if (cost > treasuryBalance) {
      throw new Error('Insufficient treasury balance');
    }
    
    this.assets.set('allocations', {
      type: 'NATIVE',
      amount: (this.assets.get('allocations')?.amount || 0) + cost,
      address: allocationId
    });
    
    return allocationId;
  }

  // Grant proposal
  async proposeGrant(recipient: string, amount: number, purpose: string): Promise<string> {
    const id = `grant-${Date.now()}`;
    const grant: Grant = {
      id,
      recipient,
      amount,
      purpose,
      approved: false,
      released: false
    };
    this.grants.set(id, grant);
    return id;
  }

  // Grant approval (requires multi-sig)
  async approveGrant(grantId: string, approverSignature: string): Promise<void> {
    const grant = this.grants.get(grantId);
    if (!grant) throw new Error('Grant not found');
    
    // Collect signatures until threshold reached
    const signatures = this.getSignatures(grantId);
    signatures.push(approverSignature);
    
    if (signatures.length >= this.multiSigThreshold) {
      grant.approved = true;
      await this.releaseGrant(grantId);
    }
  }

  private async releaseGrant(grantId: string): Promise<void> {
    const grant = this.grants.get(grantId)!;
    const balance = this.getBalance('NATIVE');
    
    if (balance < grant.amount) {
      throw new Error('Insufficient balance for grant');
    }
    
    // Transfer to recipient
    grant.released = true;
    this.eventEmitter.emit('grantReleased', grant);
  }

  getBalance(type: string): number {
    const assets = Array.from(this.assets.values()).filter(a => a.type === type);
    return assets.reduce((sum, a) => sum + a.amount, 0);
  }

  private getSignatures(grantId: string): string[] {
    // Multi-sig storage
    return [];
  }
}