// Registry Tests

import { registry, AgentRegistry } from '../src/registry/Registry';
import { AgentID, BusinessCapabilities } from '../src/core/types';

describe('AgentRegistry', () => {
  beforeEach(() => {
    // Reset registry state
    (registry as any).state.setState({});
  });
  
  test('should register a new agent', () => {
    const agentId: AgentID = 'test-agent-1';
    const entry = registry.register({
      agentId,
      profile: {
        name: 'Test Business',
        category: 'textiles',
        businessType: 'wholesaler'
      },
      capabilities: {
        supplies: ['fabric', 'thread'],
        demands: [],
        minOrderSize: 100,
        maxOrderSize: 10000,
        turnaroundDays: 14,
        certifications: ['organic'],
        reliabilityScore: 85,
        paymentTerms: 'net30'
      } as BusinessCapabilities
    });
    
    expect(entry.agentId).toBe(agentId);
    expect(entry.reputation).toBe(0);
    expect(entry.status).toBe('active');
  });
  
  test('should lookup registered agent', () => {
    const agentId: AgentID = 'test-agent-2';
    
    registry.register({
      agentId,
      profile: { name: 'Test', category: 'test', businessType: 'test' },
      capabilities: { supplies: [], demands: [] } as any
    });
    
    const found = registry.lookup(agentId);
    expect(found).toBeDefined();
    expect(found?.agentId).toBe(agentId);
  });
  
  test('should discover agents by category', () => {
    registry.register({
      agentId: 'agent-1',
      profile: { name: 'Shoes Inc', category: 'footwear', businessType: 'manufacturer' },
      capabilities: { supplies: ['shoes'], demands: ['leather'] } as any
    });
    
    registry.register({
      agentId: 'agent-2',
      profile: { name: 'Textiles Co', category: 'textiles', businessType: 'manufacturer' },
      capabilities: { supplies: ['fabric'], demands: [] } as any
    });
    
    const footwear = registry.discover('footwear');
    expect(footwear).toHaveLength(1);
    expect(footwear[0].profile.name).toBe('Shoes Inc');
  });
  
  test('should update reputation', () => {
    const agentId: AgentID = 'test-agent-3';
    
    registry.register({
      agentId,
      profile: { name: 'Test', category: 'test', businessType: 'test' },
      capabilities: {} as any
    });
    
    registry.updateReputation(agentId, 20);
    const agent = registry.lookup(agentId);
    expect(agent?.reputation).toBe(20);
    
    registry.updateReputation(agentId, 50);
    expect(registry.lookup(agentId)?.reputation).toBe(70);
  });
  
  test('should cap reputation at 100', () => {
    const agentId: AgentID = 'test-agent-4';
    
    registry.register({
      agentId,
      profile: { name: 'Test', category: 'test', businessType: 'test' },
      capabilities: {} as any
    });
    
    registry.updateReputation(agentId, 150);
    expect(registry.lookup(agentId)?.reputation).toBe(100);
  });
  
  test('should mark agent offline after cleanup', () => {
    const agentId: AgentID = 'test-agent-5';
    
    registry.register({
      agentId,
      profile: { name: 'Test', category: 'test', businessType: 'test' },
      capabilities: {} as any
    });
    
    // Manually set lastSeen to old time
    const oldState = (registry as any).state.getState();
    oldState[agentId].lastSeen = Date.now() - 600000;  // 10 min ago
    
    registry.cleanup(300000);  // 5 min max age
    
    const agent = registry.lookup(agentId);
    expect(agent?.status).toBe('offline');
  });
});