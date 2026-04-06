// Consumer Agent - Shopper's AI representative

import { AgentID, AgentProfile } from '../core/types';
import { StateManager } from '../core/StateManager';
import { MessageRouter } from '../router/MessageRouter';
import { BusinessAgent } from '../agents/BusinessAgent';

export interface ShoppingIntent {
  product: string;
  maxPrice: number;
  preferredDeliveryDays: number;
  minQuality: number;
}

export interface Quote {
  sellerId: AgentID;
  product: string;
  price: number;
  quantity: number;
  deliveryDays: number;
  confidence: number;
}

export class ConsumerAgent {
  private id: AgentID;
  private profile: AgentProfile;
  private shoppingIntent: ShoppingIntent | null;
  private quotes: Quote[];
  private stateManager: StateManager;
  private router: MessageRouter;

  constructor(
    id: AgentID,
    name: string,
    stateManager: StateManager,
    router: MessageRouter
  ) {
    this.id = id;
    this.shoppingIntent = null;
    this.quotes = [];
    this.stateManager = stateManager;
    this.router = router;
    
    this.profile = {
      id,
      name,
      category: 'consumer',
      capabilities: [],
      reputation: 100,
      createdAt: Date.now()
    };
  }

  async initialize(): Promise<void> {
    this.stateManager.registerAgent(this.profile);
    this.router.registerRoute(this.id, this.id);
    
    // Subscribe to quotes from businesses
    this.router.onMessage(this.id, (msg) => {
      if (msg.type === 'negotiate') {
        this.handleQuote(msg);
      }
    });

    console.log(`[${this.id}] Consumer agent ready`);
  }

  setShoppingIntent(intent: ShoppingIntent): void {
    this.shoppingIntent = intent;
    this.quotes = []; // Reset quotes for new search
    console.log(`[${this.id}] Looking for: ${intent.product} (max R${intent.maxPrice})`);
  }

  async discoverRetailers(retailAgents: BusinessAgent[]): Promise<void> {
    if (!this.shoppingIntent) {
      console.warn(`[${this.id}] No shopping intent set`);
      return;
    }

    for (const retailer of retailAgents) {
      // Direct discovery message to each retailer
      this.router.route({
        id: `discover-${Date.now()}`,
        from: this.id,
        to: retailer.id,
        type: 'discover',
        payload: {
          consumerNeeds: this.shoppingIntent,
          urgency: 'normal'
        },
        timestamp: Date.now()
      });
    }
  }

  private handleQuote(message: any): void {
    const quote: Quote = {
      sellerId: message.from,
      product: message.payload.offer?.product,
      price: message.payload.offer?.proposedPrice,
      quantity: message.payload.offer?.proposedQuantity,
      deliveryDays: 7,
      confidence: this.calculateConfidence(message.payload.offer)
    };

    this.quotes.push(quote);
    console.log(`[${this.id}] Received quote from ${quote.sellerId}: R${quote.price}`);
  }

  private calculateConfidence(offer: any): number {
    if (!this.shoppingIntent || !offer) return 0;
    
    const priceRatio = offer.proposedPrice / this.shoppingIntent.maxPrice;
    if (priceRatio > 1) return 0.1;
    if (priceRatio < 0.5) return 0.9;
    return 1 - (priceRatio * 0.5);
  }

  selectBestQuote(): Quote | null {
    if (this.quotes.length === 0) return null;
    
    // Sort by best price then confidence
    this.quotes.sort((a, b) => {
      if (a.price === b.price) return b.confidence - a.confidence;
      return a.price - b.price;
    });
    
    return this.quotes[0];
  }

  getQuotes(): Quote[] {
    return [...this.quotes];
  }

  getProfile(): AgentProfile {
    return { ...this.profile };
  }
}