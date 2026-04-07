import { EventEmitter } from '../utils/EventEmitter';

interface MarketState {
  supply: Map<string, number>;  // product -> quantity available
  demand: Map<string, number>;  // product -> quantity wanted
  prices: Map<string, number>; // product -> current price
  volatility: number; // market instability metric
}

export class MarketSimulator {
  private state: MarketState;
  private history: MarketSnapshot[] = [];
  private emitter: EventEmitter;
  
  constructor() {
    this.state = {
      supply: new Map(),
      demand: new Map(),
      prices: new Map(),
      volatility: 0.05
    };
    this.emitter = new EventEmitter();
    this.startSimulation();
  }

  // Live price discovery based on supply/demand
  calculatePrice(product: string): number {
    const supply = this.state.supply.get(product) || 100;
    const demand = this.state.demand.get(product) || 100;
    const basePrice = this.state.prices.get(product) || 100;
    
    // Price elasticity formula
    const ratio = demand / (supply + 1);
    const price = basePrice * Math.pow(ratio, 0.5);
    
    // Add market volatility
    const jitter = 1 + (Math.random() - 0.5) * this.state.volatility;
    return Math.round(price * jitter * 100) / 100;
  }

  // Simulate production cycles
  updateSupply(product: string, quantity: number): void {
    const current = this.state.supply.get(product) || 0;
    this.state.supply.set(product, current + quantity);
    this.emitter.emit('supply:changed', { product, quantity, total: current + quantity });
  }

  // Simulate consumption/purchases
  updateDemand(product: string, quantity: number): void {
    const current = this.state.demand.get(product) || 0;
    this.state.demand.set(product, Math.max(0, current - quantity));
    
    // Replenish demand (people keep wanting things)
    setTimeout(() => {
      this.state.demand.set(product, (this.state.demand.get(product) || 0) + quantity * 0.8);
    }, 5000);
  }

  // Market crash simulation
  simulateCrisis(type: 'liquidity' | 'supply_shock' | 'panic'): void {
    console.log(`[MARKET CRISIS] ${type} detected`);
    this.state.volatility = 0.5; // High volatility
    
    switch(type) {
      case 'liquidity':
        // Freeze all prices
        this.state.prices.forEach((price, product) => {
          this.state.prices.set(product, price * 0.7);
        });
        break;
      case 'supply_shock':
        // Halve all supply
        this.state.supply.forEach((qty, product) => {
          this.state.supply.set(product, qty * 0.5);
        });
        break;
      case 'panic':
        // Surge in demand
        this.state.demand.forEach((qty, product) => {
          this.state.demand.set(product, qty * 2);
        });
        break;
    }
    
    this.emitter.emit('crisis', { type, state: this.getSnapshot() });
    
    // Recovery after 30 seconds
    setTimeout(() => {
      this.state.volatility = 0.05;
      console.log('[MARKET] Crisis resolved, returning to normal');
      this.emitter.emit('recovery', this.getSnapshot());
    }, 30000);
  }

  private startSimulation(): void {
    // Record snapshot every 10 seconds
    setInterval(() => {
      this.history.push(this.getSnapshot());
      if (this.history.length > 100) this.history.shift();
      
      // Random market events
      if (Math.random() < 0.02) {
        const products = Array.from(this.state.supply.keys());
        if (products.length > 0) {
          const randomProduct = products[Math.floor(Math.random() * products.length)];
          this.updateSupply(randomProduct, Math.floor(Math.random() * 20));
        }
      }
    }, 10000);
  }

  getSnapshot(): MarketSnapshot {
    return {
      timestamp: Date.now(),
      supply: Object.fromEntries(this.state.supply),
      demand: Object.fromEntries(this.state.demand),
      prices: Object.fromEntries(this.state.prices),
      volatility: this.state.volatility
    };
  }

  getPriceHistory(product: string): number[] {
    return this.history
      .filter(s => product in s.prices)
      .map(s => s.prices[product]);
  }
}

interface MarketSnapshot {
  timestamp: number;
  supply: Record<string, number>;
  demand: Record<string, number>;
  prices: Record<string, number>;
  volatility: number;
}