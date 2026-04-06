// Settlement Engine Tests

import { SettlementEngine, settlement } from '../src/settlement/SettlementEngine';
import { AgentID } from '../src/core/types';

describe('SettlementEngine', () => {
  beforeEach(() => {
    // Reset settlement state
    (settlement as any).escrows.setState({});
    (settlement as any).balances.setState({});
  });
  
  test('should create escrow', () => {
    const escrow = settlement.createEscrow(
      'deal-1',
      'buyer-1' as AgentID,
      'seller-1' as AgentID,
      1000,
      'USD',
      [
        { type: 'delivery', description: 'Goods delivered', satisfied: false },
        { type: 'verification', description: 'Quality check passed', satisfied: false }
      ]
    );
    
    expect(escrow.status).toBe('pending');
    expect(escrow.amount).toBe(1000);
    expect(escrow.conditions).toHaveLength(2);
  });
  
  test('should fund escrow', () => {
    const escrow = settlement.createEscrow(
      'deal-2',
      'buyer-2' as AgentID,
      'seller-2' as AgentID,
      500,
      'USD',
      [{ type: 'delivery', description: 'Delivered', satisfied: false }]
    );
    
    // Deposit initial balance
    settlement.deposit('buyer-2' as AgentID, 1000);
    
    // Fund the escrow
    const funded = settlement.fundEscrow(escrow.id, 'buyer-2' as AgentID, 500);
    
    expect(funded).toBe(true);
    
    const updated = settlement.getEscrow(escrow.id);
    expect(updated?.status).toBe('funded');
    expect(updated?.buyerDeposit).toBe(500);
  });
  
  test('should not fund with insufficient balance', () => {
    const escrow = settlement.createEscrow(
      'deal-3',
      'buyer-3' as AgentID,
      'seller-3' as AgentID,
      2000,
      'USD',
      [{ type: 'delivery', description: 'Delivered', satisfied: false }]
    );
    
    settlement.deposit('buyer-3' as AgentID, 500);
    
    expect(() => {
      settlement.fundEscrow(escrow.id, 'buyer-3' as AgentID, 2000);
    }).toThrow('Insufficient balance');
  });
  
  test('should satisfy condition and release escrow', () => {
    const escrow = settlement.createEscrow(
      'deal-4',
      'buyer-4' as AgentID,
      'seller-4' as AgentID,
      100,
      'USD',
      [
        { type: 'delivery', description: 'Delivered', satisfied: false },
        { type: 'confirmation', description: 'Confirmed', satisfied: false }
      ]
    );
    
    settlement.deposit('buyer-4' as AgentID, 200);
    settlement.fundEscrow(escrow.id, 'buyer-4' as AgentID, 100);
    
    // Satisfy first condition
    settlement.satisfyCondition(escrow.id, 0, 'inspector-1' as AgentID);
    
    let updated = settlement.getEscrow(escrow.id);
    expect(updated?.conditions[0].satisfied).toBe(true);
    expect(updated?.status).toBe('funded');  // Not released yet
    
    // Satisfy second condition - triggers release
    settlement.satisfyCondition(escrow.id, 1, 'inspector-2' as AgentID);
    
    updated = settlement.getEscrow(escrow.id);
    expect(updated?.status).toBe('released');
    
    // Seller should receive funds
    const sellerBalance = settlement.getBalance('seller-4' as AgentID);
    expect(sellerBalance).toBe(100);
  });
  
  test('should refund escrow', () => {
    const escrow = settlement.createEscrow(
      'deal-5',
      'buyer-5' as AgentID,
      'seller-5' as AgentID,
      300,
      'USD',
      [{ type: 'delivery', description: 'Delivered', satisfied: false }]
    );
    
    settlement.deposit('buyer-5' as AgentID, 500);
    settlement.fundEscrow(escrow.id, 'buyer-5' as AgentID, 300);
    
    // Refund before release
    settlement.refund(escrow.id);
    
    const updated = settlement.getEscrow(escrow.id);
    expect(updated?.status).toBe('refunded');
    
    // Buyer should get funds back
    const buyerBalance = settlement.getBalance('buyer-5' as AgentID);
    expect(buyerBalance).toBe(500);
  });
  
  test('should not refund released escrow', () => {
    const escrow = settlement.createEscrow(
      'deal-6',
      'buyer-6' as AgentID,
      'seller-6' as AgentID,
      100,
      'USD',
      [{ type: 'delivery', description: 'Delivered', satisfied: false }]
    );
    
    settlement.deposit('buyer-6' as AgentID, 200);
    settlement.fundEscrow(escrow.id, 'buyer-6' as AgentID, 100);
    settlement.satisfyCondition(escrow.id, 0, 'inspector' as AgentID);
    
    // Now released
    const refunded = settlement.refund(escrow.id);
    expect(refunded).toBe(false);
  });
});