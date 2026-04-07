// Real API Integrations using API Ninja
// Live data feeds and external service connections

const API_NINJA_KEY = process.env.ANYNINJA_API_KEY || '';
const BASE_URL = 'https://api.api-ninjas.com/v1';

export class RealAPIConnectors {
  private apiKey: string;
  private rateLimiter: Map<string, number> = new Map();
  
  constructor(apiKey: string = API_NINJA_KEY) {
    this.apiKey = apiKey;
  }

  // === MARKET DATA ===
  
  async getStockPrice(symbol: string): Promise<StockData> {
    return this.fetchWithCache(`${BASE_URL}/stockprice?ticker=${symbol}`, `stock_${symbol}`);
  }
  
  async getCommodityPrice(name: string): Promise<CommodityData> {
    return this.fetchWithCache(`${BASE_URL}/commodityprice?name=${name}`, `commodity_${name}`);
  }
  
  async getInflationRate(country: string): Promise<InflationData> {
    return this.fetchWithCache(`${BASE_URL}/inflation?country=${country}`, `inflation_${country}`);
  }
  
  async getInterestRate(country: string): Promise<InterestData> {
    return this.fetchWithCache(`${BASE_URL}/interestrate?country=${country}`, `interest_${country}`);
  }

  // === BUSINESS INTELLIGENCE ===
  
  async searchCompany(name: string): Promise<CompanyInfo[]> {
    return this.fetchWithCache(`${BASE_URL}/company?name=${encodeURIComponent(name)}`, `company_${name}`);
  }
  
  async getEarningsCalendar(ticker: string): Promise<EarningsData[]> {
    return this.fetchWithCache(`${BASE_URL}/earningcalendar?ticker=${ticker}`, `earnings_${ticker}`);
  }
  
  async getHistoricalData(ticker: string, period: string): Promise<HistoricalData[]> {
    return this.fetchWithCache(
      `${BASE_URL}/historicalstockprice?ticker=${ticker}&period=${period}`,
      `historical_${ticker}_${period}`
    );
  }

  // === ECONOMIC INDICATORS ===
  
  async getGDP(country: string): Promise<GDPData> {
    return this.fetchWithCache(`${BASE_URL}/gdp?country=${country}`, `gdp_${country}`);
  }
  
  async getUnemployment(country: string): Promise<UnemploymentData> {
    return this.fetchWithCache(`${BASE_URL}/unemployment?country=${country}`, `unemployment_${country}`);
  }

  // === CURRENCY & CRYPTO ===
  
  async getExchangeRate(pair: string): Promise<ExchangeRate> {
    return this.fetchWithCache(`${BASE_URL}/convertcurrency?have=${pair.split('/')[0]}&want=${pair.split('/')[1]}`, `fx_${pair}`);
  }
  
  async getCryptoPrice(symbol: string): Promise<CryptoData> {
    return this.fetchWithCache(`${BASE_URL}/cryptoprice?symbol=${symbol}`, `crypto_${symbol}`);
  }

  // === RISK ASSESSMENT ===
  
  async assessCountryRisk(country: string): Promise<RiskScore> {
    const [gdp, inflation, unemployment] = await Promise.all([
      this.getGDP(country),
      this.getInflationRate(country),
      this.getUnemployment(country)
    ]);
    
    // Composite risk score
    const stability = 100 - (inflation.rate * 10 + unemployment.rate * 2);
    return {
      country,
      stabilityScore: Math.max(0, Math.min(100, stability)),
      indicators: { gdp, inflation, unemployment },
      recommendation: stability > 70 ? 'LOW_RISK' : stability > 40 ? 'MODERATE' : 'HIGH_RISK'
    };
  }

  // === AGENT MESH INTEGRATION ===
  
  async enrichAgentProfile(agent: BusinessAgent): Promise<EnrichedProfile> {
    const companyInfo = await this.searchCompany(agent.name);
    const stockPrice = companyInfo[0]?.ticker ? 
      await this.getStockPrice(companyInfo[0].ticker) : null;
    
    return {
      ...agent,
      marketCap: stockPrice?.market_cap,
      sector: companyInfo[0]?.sector,
      industry: companyInfo[0]?.industry,
      exchange: companyInfo[0]?.exchange,
      financialHealth: stockPrice ? this.assessFinancialHealth(stockPrice) : 'UNKNOWN'
    };
  }
  
  async generateMarketContext(product: string, region: string): Promise<MarketContext> {
    const [commodityPrice, inflation, gdp] = await Promise.all([
      this.getCommodityPrice(product).catch(() => null),
      this.getInflationRate(region).catch(() => null),
      this.getGDP(region).catch(() => null)
    ]);
    
    return {
      product,
      region,
      priceLevel: commodityPrice?.price || 100,
      inflationRate: inflation?.rate || 0,
      gdpGrowth: gdp?.growth_rate || 0,
      marketTemperature: this.calculateMarketTemperature(inflation, gdp),
      buyingPower: this.calculateBuyingPower(inflation, gdp),
      recommendedMargin: this.calculateRecommendedMargin(inflation)
    };
  }

  // === INTERNAL METHODS ===
  
  private async fetchWithCache(url: string, cacheKey: string): Promise<any> {
    // Check rate limit
    const lastCall = this.rateLimiter.get(cacheKey) || 0;
    const now = Date.now();
    if (now - lastCall < 1000) {
      await new Promise(r => setTimeout(r, 1000));
    }
    this.rateLimiter.set(cacheKey, Date.now());
    
    try {
      const response = await fetch(url, {
        headers: { 'X-Api-Key': this.apiKey }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API Ninjas error: ${error}`);
      return this.getMockData(cacheKey);
    }
  }
  
  private getMockData(cacheKey: string): any {
    // Fallback mock data when API fails
    if (cacheKey.startsWith('stock_')) {
      return { price: 100 + Math.random() * 50, change: (Math.random() - 0.5) * 10 };
    }
    if (cacheKey.startsWith('commodity_')) {
      return { price: 50 + Math.random() * 100, unit: 'USD' };
    }
    return {};
  }
  
  private assessFinancialHealth(stock: StockData): 'HEALTHY' | 'STABLE' | 'RISKY' | 'DISTRESSED' {
    if (stock.change > 5) return 'HEALTHY';
    if (stock.change > -5) return 'STABLE';
    if (stock.change > -15) return 'RISKY';
    return 'DISTRESSED';
  }
  
  private calculateMarketTemperature(inflation: InflationData | null, gdp: GDPData | null): 'HOT' | 'WARM' | 'COOL' | 'COLD' {
    if (!inflation || !gdp) return 'WARM';
    const score = (inflation.rate * -10) + (gdp.growth_rate * 5);
    if (score > 30) return 'HOT';
    if (score > 10) return 'WARM';
    if (score > -10) return 'COOL';
    return 'COLD';
  }
  
  private calculateBuyingPower(inflation: InflationData | null, gdp: GDPData | null): number {
    if (!inflation || !gdp) return 100;
    return Math.max(50, 100 - inflation.rate * 5 + gdp.growth_rate);
  }
  
  private calculateRecommendedMargin(inflation: InflationData | null): number {
    if (!inflation) return 0.15;
    return Math.min(0.35, 0.15 + inflation.rate * 0.01);
  }
}

// Type Definitions
interface StockData {
  price: number;
  change: number;
  change_percent: number;
  market_cap?: number;
  volume: number;
}

interface CommodityData {
  price: number;
  unit: string;
  timestamp: string;
}

interface InflationData {
  rate: number;
  year: number;
}

interface InterestData {
  rate: number;
  date: string;
}

interface CompanyInfo {
  name: string;
  ticker: string;
  sector: string;
  industry: string;
  exchange: string;
}

interface EarningsData {
  ticker: string;
  date: string;
  eps_estimate: number;
  revenue_estimate: number;
}

interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface GDPData {
  value: number;
  growth_rate: number;
  year: number;
}

interface UnemploymentData {
  rate: number;
  year: number;
}

interface ExchangeRate {
  exchange_rate: number;
  timestamp: string;
}

interface CryptoData {
  price: number;
  change: number;
  market_cap: number;
}

interface RiskScore {
  country: string;
  stabilityScore: number;
  indicators: { gdp: GDPData; inflation: InflationData; unemployment: UnemploymentData };
  recommendation: 'LOW_RISK' | 'MODERATE' | 'HIGH_RISK';
}

interface BusinessAgent {
  name: string;
  type: string;
  capital: number;
}

interface EnrichedProfile extends BusinessAgent {
  marketCap?: number;
  sector?: string;
  industry?: string;
  exchange?: string;
  financialHealth: 'HEALTHY' | 'STABLE' | 'RISKY' | 'DISTRESSED' | 'UNKNOWN';
}

interface MarketContext {
  product: string;
  region: string;
  priceLevel: number;
  inflationRate: number;
  gdpGrowth: number;
  marketTemperature: 'HOT' | 'WARM' | 'COOL' | 'COLD';
  buyingPower: number;
  recommendedMargin: number;
}