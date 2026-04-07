// Data Feed Engine - Real market data via API Ninja
// Provides live pricing and market intelligence for agent negotiations

import { EventEmitter } from '../utils/EventEmitter';
import { StateManager } from '../core/StateManager';

export interface MarketData {
  category: 'commodities' | 'crypto' | 'forex' | 'stocks' | 'metals' | 'energy';
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: number;
  source: string;
}

export interface SupplierQuote {
  supplierId: string;
  productCategory: string;
  itemName: string;
  unitPrice: number;
  minOrderQty: number;
  leadTime: number; // days
  reliability: number; // 0-100
  lastUpdated: number;
}

export interface EconomicIndicator {
  name: string;
  value: number;
  previous: number;
  trend: 'up' | 'down' | 'stable';
  impact: 'high' | 'medium' | 'low';
}

export class DataFeedEngine {
  private eventEmitter: EventEmitter;
  private state: StateManager;
  private apiKey: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // API Ninja endpoints
  private readonly API_BASE = 'https://api.api-ninjas.com/v1';
  
  constructor(eventEmitter: EventEmitter, state: StateManager, apiKey: string) {
    this.eventEmitter = eventEmitter;
    this.state = state;
    this.apiKey = apiKey;
    this.initializeFeeds();
  }
  
  private initializeFeeds(): void {
    // Set up periodic data updates
    this.startCommodityFeed();
    this.startSupplierFeed();
    this.startEconomicIndicators();
  }
  
  // Fetch real commodity prices from API Ninja
  async fetchCommodityPrice(symbol: string): Promise<MarketData | null> {
    const cacheKey = `commodity:${symbol}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    try {
      const response = await fetch(`${this.API_BASE}/commodityprice?symbol=${symbol}`, {
        headers: { 'X-Api-Key': this.apiKey }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      const marketData: MarketData = {
        category: 'commodities',
        symbol: data.symbol,
        price: data.price,
        change24h: data.change || 0,
        volume24h: data.volume || 0,
        timestamp: Date.now(),
        source: 'api-ninja-commodity'
      };
      
      this.cache.set(cacheKey, { data: marketData, timestamp: Date.now() });
      this.state.setState(`market:${symbol}`, marketData);
      
      this.eventEmitter.emit('feed:commodity', marketData);
      
      return marketData;
    } catch (error) {
      this.eventEmitter.emit('feed:error', { type: 'commodity', symbol, error });
      // Return cached data even if stale
      return cached?.data || null;
    }
  }
  
  // Fetch crypto prices
  async fetchCryptoPrice(symbol: string): Promise<MarketData | null> {
    const cacheKey = `crypto:${symbol}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    try {
      const response = await fetch(`${this.API_BASE}/cryptoprice?symbol=${symbol}USDT`, {
        headers: { 'X-Api-Key': this.apiKey }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      const marketData: MarketData = {
        category: 'crypto',
        symbol: data.symbol,
        price: data.price,
        change24h: data.change_24h || 0,
        volume24h: data.volume_24h || 0,
        timestamp: Date.now(),
        source: 'api-ninja-crypto'
      };
      
      this.cache.set(cacheKey, { data: marketData, timestamp: Date.now() });
      this.state.setState(`market:crypto:${symbol}`, marketData);
      
      return marketData;
    } catch (error) {
      this.eventEmitter.emit('feed:error', { type: 'crypto', symbol, error });
      return cached?.data || null;
    }
  }
  
  // Simulate supplier quotes (would integrate with real supplier APIs)
  async fetchSupplierQuotes(productCategory: string): Promise<SupplierQuote[]> {
    // In production, this would query real supplier databases
    // For now, return enhanced mock data with realistic market dynamics
    
    const baseCommodity = await this.fetchCommodityPrice(
      this.mapCategoryToCommodity(productCategory)
    );
    
    const mockSuppliers: SupplierQuote[] = [
      {
        supplierId: 'supplier-abc-textiles',
        productCategory,
        itemName: `${productCategory} - Premium Grade`,
        unitPrice: this.calculateDynamicPrice(baseCommodity?.price, 10, 0.9),
        minOrderQty: 100,
        leadTime: 14,
        reliability: 92,
        lastUpdated: Date.now()
      },
      {
        supplierId: 'supplier-xyz-global',
        productCategory,
        itemName: `${productCategory} - Standard Grade`,
        unitPrice: this.calculateDynamicPrice(baseCommodity?.price, 10, 0.7),
        minOrderQty: 500,
        leadTime: 21,
        reliability: 85,
        lastUpdated: Date.now()
      },
      {
        supplierId: 'supplier-fast-track',
        productCategory,
        itemName: `${productCategory} - Express`,
        unitPrice: this.calculateDynamicPrice(baseCommodity?.price, 10, 1.2),
        minOrderQty: 50,
        leadTime: 7,
        reliability: 78,
        lastUpdated: Date.now()
      }
    ];
    
    // Add market volatility based on real commodity data
    if (baseCommodity && baseCommodity.change24h > 0.05) {
      // Prices rising - suppliers increase prices
      mockSuppliers.forEach(s => {
        s.unitPrice *= (1 + baseCommodity.change24h * 0.5);
        s.reliability = Math.max(50, s.reliability - 2);
      });
    }
    
    this.state.setState(`suppliers:${productCategory}`, mockSuppliers);
    
    return mockSuppliers;
  }
  
  // Get economic indicators affecting business
  async fetchEconomicIndicators(): Promise<EconomicIndicator[]> {
    const indicators: EconomicIndicator[] = [
      {
        name: 'inflation_rate',
        value: 3.2,
        previous: 3.0,
        trend: 'up',
        impact: 'high'
      },
      {
        name: 'manufacturing_pmi',
        value: 52.4,
        previous: 51.8,
        trend: 'up',
        impact: 'medium'
      },
      {
        name: 'currency_volatility',
        value: 0.15,
        previous: 0.12,
        trend: 'up',
        impact: 'high'
      }
    ];
    
    // In production, fetch from API Ninja or other economic data source
    return indicators;
  }
  
  // Calculate deal fairness based on market data
  calculateDealFairness(
    proposedPrice: number,
    productCategory: string,
    volume: number
  ): {
    fairness: 'fair' | 'unfavorable' | 'exploitative' | 'opportunity';
    marketPrice: number;
    deviation: number;
    recommendation: string;
  } {
    const commodityPrice = this.getCachedPrice(
      this.mapCategoryToCommodity(productCategory)
    );
    
    if (!commodityPrice) {
      return {
        fairness: 'unknown',
        marketPrice: 0,
        deviation: 0,
        recommendation: 'Insufficient market data for analysis'
      };
    }
    
    // Calculate expected price with volume discount
    const volumeDiscount = Math.min(volume * 0.0001, 0.15); // Max 15% discount
    const expectedPrice = commodityPrice * (1 - volumeDiscount);
    
    const deviation = (proposedPrice - expectedPrice) / expectedPrice;
    
    let fairness: typeof result.fairness;
    let recommendation: string;
    
    if (deviation > 0.2) {
      fairness = 'exploitative';
      recommendation = 'Price is 20%+ above market. Negotiate down or seek alternatives.';
    } else if (deviation > 0.1) {
      fairness = 'unfavorable';
      recommendation = 'Price is 10%+ above market. Room for negotiation.';
    } else if (deviation < -0.15) {
      fairness = 'opportunity';
      recommendation = 'Price is 15%+ below market. Verify quality but consider immediate acceptance.';
    } else {
      fairness = 'fair';
      recommendation = 'Price is within market range. Standard terms acceptable.';
    }
    
    const result = {
      fairness,
      marketPrice: expectedPrice,
      deviation,
      recommendation
    };
    
    return result;
  }
  
  // Start background feeds
  private startCommodityFeed(): void {
    const commodities = ['GOLD', 'SILVER', 'COTTON', 'OIL', 'WHEAT'];
    
    // Initial fetch
    commodities.forEach(c => this.fetchCommodityPrice(c));
    
    // Periodic updates
    setInterval(() => {
      commodities.forEach(async c => {
        const data = await this.fetchCommodityPrice(c);
        if (data && Math.abs(data.change24h) > 0.02) {
          // Significant price movement - notify agents
          this.eventEmitter.emit('feed:significant_movement', data);
        }
      });
    }, 60000); // Every minute
  }
  
  private startSupplierFeed(): void {
    // Update supplier data every 10 minutes
    setInterval(() => {
      const categories = ['textiles', 'electronics', 'raw_materials', 'components'];
      categories.forEach(cat => this.fetchSupplierQuotes(cat));
    }, 600000);
  }
  
  private startEconomicIndicators(): void {
    // Check economic conditions every hour
    setInterval(async () => {
      const indicators = await this.fetchEconomicIndicators();
      const highImpact = indicators.filter(i => i.impact === 'high' && i.trend === 'up');
      
      if (highImpact.length >= 2) {
        // Market stress - adjust agent strategies
        this.eventEmitter.emit('feed:market_stress', highImpact);
      }
    }, 3600000);
  }
  
  private mapCategoryToCommodity(category: string): string {
    const mapping: Record<string, string> = {
      'textiles': 'COTTON',
      'fabric': 'COTTON',
      'electronics': 'SILVER',
      'precious_metals': 'GOLD',
      'energy': 'OIL',
      'food': 'WHEAT'
    };
    
    return mapping[category.toLowerCase()] || 'GOLD';
  }
  
  private calculateDynamicPrice(basePrice: number | undefined, qty: number, multiplier: number): number {
    if (!basePrice) return qty * 10 * multiplier; // Fallback
    return (basePrice / 100) * qty * multiplier; // Scale to realistic business quantities
  }
  
  private getCachedPrice(symbol: string): number | undefined {
    const cached = this.cache.get(`commodity:${symbol}`);
    return cached?.data?.price;
  }
  
  // Get market context for agent negotiation
  getMarketContext(productCategory: string): {
    commodityPrice: MarketData | null;
    supplierQuotes: SupplierQuote[];
    economicIndicators: EconomicIndicator[];
    marketTrend: 'bullish' | 'bearish' | 'neutral';
  } {
    const commodityPrice = this.cache.get(`commodity:${this.mapCategoryToCommodity(productCategory)}`)?.data || null;
    const supplierQuotes = this.state.getState(`suppliers:${productCategory}`) || [];
    
    let marketTrend: typeof result.marketTrend = 'neutral';
    if (commodityPrice) {
      if (commodityPrice.change24h > 0.03) marketTrend = 'bullish';
      else if (commodityPrice.change24h < -0.03) marketTrend = 'bearish';
    }
    
    const result = {
      commodityPrice,
      supplierQuotes,
      economicIndicators: [],
      marketTrend
    };
    
    return result;
  }
}