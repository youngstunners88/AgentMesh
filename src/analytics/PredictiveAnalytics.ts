import { EventEmitter } from '../utils/EventEmitter';

interface DealFeatures {
  buyerReputation: number;
  sellerReputation: number;
  marketVolatility: number;
  priceVsMarket: number; // ratio
  historicalSuccessRate: number;
  buyerCash: number;
  sellerInventory: number;
  urgency: number; // 0-1
}

interface PredictionResult {
  successProbability: number; // 0-1
  riskScore: number; // 0-1
  expectedProfit: number;
  recommendation: 'PROCEED' | 'NEGOTIATE' | 'DECLINE' | 'ESCALATE';
  confidence: number; // 0-1
}

interface MarketTrend {
  direction: 'UP' | 'DOWN' | 'STABLE';
  velocity: number; // rate of change
  forecast: number[]; // next 5 predictions
}

export class PredictiveAnalytics {
  private historicalDeals: HistoricalDeal[] = [];
  private modelWeights: ModelWeights;
  private emitter: EventEmitter;
  
  constructor() {
    this.modelWeights = this.initializeWeights();
    this.emitter = new EventEmitter();
  }

  // Predict deal success using weighted features
  predictDealSuccess(features: DealFeatures): PredictionResult {
    const w = this.modelWeights;
    
    // Simple logistic regression approximation
    const score = 
      w.reputation * (features.buyerReputation + features.sellerReputation) / 200 +
      w.stability * (1 - features.marketVolatility) +
      w.price * (features.priceVsMarket > 0.9 && features.priceVsMarket < 1.1 ? 1 : 0.5) +
      w.history * features.historicalSuccessRate +
      w.liquidity * Math.min(1, features.buyerCash / 10000) +
      w.supply * Math.min(1, features.sellerInventory / 100);
    
    // Sigmoid function for probability
    const probability = 1 / (1 + Math.exp(-(score - 2.5) * 2));
    
    // Risk calculation
    const riskFactors = [
      features.marketVolatility > 0.3 ? 0.3 : 0,
      features.buyerReputation < 500 ? 0.2 : 0,
      features.sellerReputation < 500 ? 0.2 : 0,
      features.buyerCash < 1000 ? 0.2 : 0,
      features.urgency > 0.8 ? 0.1 : 0
    ];
    const riskScore = Math.min(1, riskFactors.reduce((a, b) => a + b, 0));
    
    // Recommendation
    let recommendation: PredictionResult['recommendation'];
    if (probability > 0.8 && riskScore < 0.3) {
      recommendation = 'PROCEED';
    } else if (probability > 0.6 && riskScore < 0.5) {
      recommendation = 'NEGOTIATE';
    } else if (probability < 0.4 || riskScore > 0.7) {
      recommendation = 'DECLINE';
    } else {
      recommendation = 'ESCALATE';
    }
    
    const result: PredictionResult = {
      successProbability: Math.round(probability * 100) / 100,
      riskScore: Math.round(riskScore * 100) / 100,
      expectedProfit: this.calculateExpectedProfit(features, probability),
      recommendation,
      confidence: Math.round(Math.max(0, 1 - riskScore) * 100) / 100
    };
    
    this.emitter.emit('prediction', result);
    return result;
  }

  // Forecast market trends using moving averages
  forecastMarketTrend(
    priceHistory: number[],
    volumeHistory: number[]
  ): MarketTrend {
    if (priceHistory.length < 5) {
      return { direction: 'STABLE', velocity: 0, forecast: priceHistory };
    }
    
    // Calculate moving averages
    const shortMA = this.calculateMA(priceHistory.slice(-5));
    const longMA = this.calculateMA(priceHistory.slice(-20));
    
    // Trend direction
    const diff = shortMA - longMA;
    const direction: MarketTrend['direction'] = 
      diff > longMA * 0.02 ? 'UP' :
      diff < -longMA * 0.02 ? 'DOWN' : 'STABLE';
    
    // Velocity
    const velocity = diff / longMA;
    
    // Forecast next 5 periods
    const lastPrice = priceHistory[priceHistory.length - 1];
    const trend = velocity * lastPrice;
    const forecast = [1, 2, 3, 4, 5].map(i => 
      Math.round((lastPrice + trend * i) * 100) / 100
    );
    
    return { direction, velocity, forecast };
  }

  // Update model with actual outcomes
  trainModel(dealId: string, features: DealFeatures, outcome: boolean): void {
    this.historicalDeals.push({
      dealId,
      features,
      outcome,
      timestamp: Date.now()
    });
    
    // Simple gradient descent adjustment
    const prediction = this.predictDealSuccess(features);
    const error = (outcome ? 1 : 0) - prediction.successProbability;
    
    // Adjust weights
    const learningRate = 0.01;
    this.modelWeights.reputation -= learningRate * error * (features.buyerReputation / 100);
    this.modelWeights.stability -= learningRate * error * features.marketVolatility;
    this.modelWeights.history -= learningRate * error * features.historicalSuccessRate;
    
    // Normalize weights
    const sum = Object.values(this.modelWeights).reduce((a, b) => a + b, 0);
    Object.keys(this.modelWeights).forEach(k => {
      this.modelWeights[k as keyof ModelWeights] /= sum;
    });
    
    this.emitter.emit('model:updated', { dealId, error, weights: this.modelWeights });
  }

  // Anomaly detection
  detectAnomaly(currentMetrics: DealFeatures): boolean {
    const avgReputation = this.historicalDeals.reduce(
      (sum, d) => sum + d.features.buyerReputation, 0
    ) / (this.historicalDeals.length || 1);
    
    // Flag if significantly different from historical average
    const zScore = Math.abs(currentMetrics.buyerReputation - avgReputation) / 100;
    return zScore > 2;
  }

  private calculateExpectedProfit(features: DealFeatures, probability: number): number {
    // Assume average deal size is $1000 with 15% margin
    const dealSize = (features.buyerCash + features.sellerInventory * 10) / 2;
    const margin = 0.15;
    const grossProfit = dealSize * margin;
    
    // Discount by risk
    const adjustedProfit = grossProfit * probability * (1 - (features.marketVolatility * 2));
    
    return Math.round(adjustedProfit * 100) / 100;
  }

  private calculateMA(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private initializeWeights(): ModelWeights {
    return {
      reputation: 0.25,
      stability: 0.20,
      price: 0.15,
      history: 0.20,
      liquidity: 0.10,
      supply: 0.10
    };
  }
}

interface ModelWeights {
  reputation: number;
  stability: number;
  price: number;
  history: number;
  liquidity: number;
  supply: number;
}

interface HistoricalDeal {
  dealId: string;
  features: DealFeatures;
  outcome: boolean;
  timestamp: number;
}