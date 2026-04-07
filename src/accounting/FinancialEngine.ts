import { EventEmitter } from '../utils/EventEmitter';

interface BalanceSheet {
  assets: {
    cash: number;
    inventory: Map<string, { quantity: number; value: number }>;
    receivables: number; // money owed to us
    investments: number;
  };
  liabilities: {
    payables: number; // money we owe
    debt: number;
    accruedExpenses: number;
  };
  equity: number;
}

interface PnL {
  revenue: number;
  cogs: number; // cost of goods sold
  grossProfit: number;
  operatingExpenses: {
    salaries: number;
    rent: number;
    marketing: number;
    other: number;
  };
  netIncome: number;
  period: { start: Date; end: Date };
}

interface CashFlow {
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
}

export class FinancialEngine {
  private balanceSheet: BalanceSheet;
  private transactions: Transaction[] = [];
  private emitter: EventEmitter;
  private quarterlyReports: PnL[] = [];
  
  constructor(initialCapital: number = 100000) {
    this.balanceSheet = {
      assets: {
        cash: initialCapital,
        inventory: new Map(),
        receivables: 0,
        investments: 0
      },
      liabilities: {
        payables: 0,
        debt: 0,
        accruedExpenses: 0
      },
      equity: initialCapital
    };
    this.emitter = new EventEmitter();
  }

  // Record a sale
  recordSale(product: string, quantity: number, price: number, credit: boolean = false): void {
    const revenue = quantity * price;
    
    if (credit) {
      this.balanceSheet.assets.receivables += revenue;
    } else {
      this.balanceSheet.assets.cash += revenue;
    }
    
    // Reduce inventory
    const current = this.balanceSheet.assets.inventory.get(product);
    if (current) {
      const cogs = (current.value / current.quantity) * quantity;
      current.quantity -= quantity;
      current.value -= cogs;
    }
    
    this.transactions.push({
      type: 'SALE',
      amount: revenue,
      product,
      quantity,
      timestamp: Date.now()
    });
    
    this.emitter.emit('sale', { revenue, product, quantity });
    this.updateEquity();
  }

  // Record a purchase
  recordPurchase(product: string, quantity: number, cost: number, credit: boolean = false): void {
    const totalCost = quantity * cost;
    
    if (credit) {
      this.balanceSheet.liabilities.payables += totalCost;
    } else {
      this.balanceSheet.assets.cash -= totalCost;
    }
    
    // Add to inventory
    const current = this.balanceSheet.assets.inventory.get(product);
    if (current) {
      current.quantity += quantity;
      current.value += totalCost;
    } else {
      this.balanceSheet.assets.inventory.set(product, { quantity, value: totalCost });
    }
    
    this.transactions.push({
      type: 'PURCHASE',
      amount: totalCost,
      product,
      quantity,
      timestamp: Date.now()
    });
    
    this.updateEquity();
  }

  // Calculate credit score based on payment history
  calculateCreditScore(): number {
    const onTimePayments = this.transactions
      .filter(t => t.type === 'PAYMENT' && t.onTime)
      .length;
    const totalPayments = this.transactions.filter(t => t.type === 'PAYMENT').length;
    
    if (totalPayments === 0) return 700; // Neutral score
    
    const ratio = onTimePayments / totalPayments;
    const baseScore = 300 + (ratio * 550);
    
    // Adjust for debt-to-equity
    const debtRatio = this.balanceSheet.liabilities.debt / this.balanceSheet.equity;
    const penalty = Math.min(100, debtRatio * 50);
    
    return Math.round(Math.max(300, Math.min(850, baseScore - penalty)));
  }

  // Generate quarterly P&L
  generatePnL(): PnL {
    const quarterStart = new Date();
    quarterStart.setMonth(quarterStart.getMonth() - 3);
    
    const quarterTransactions = this.transactions.filter(
      t => t.timestamp >= quarterStart.getTime()
    );
    
    const revenue = quarterTransactions
      .filter(t => t.type === 'SALE')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const cogs = quarterTransactions
      .filter(t => t.type === 'PURCHASE')
      .reduce((sum, t) => sum + t.amount * 0.6, 0); // Assume 60% is COGS
    
    const opex = {
      salaries: revenue * 0.15,
      rent: revenue * 0.05,
      marketing: revenue * 0.08,
      other: revenue * 0.02
    };
    
    const totalOpex = Object.values(opex).reduce((a, b) => a + b, 0);
    
    const pnl: PnL = {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      operatingExpenses: opex,
      netIncome: revenue - cogs - totalOpex,
      period: { start: quarterStart, end: new Date() }
    };
    
    this.quarterlyReports.push(pnl);
    return pnl;
  }

  // Calculate cash flow
  calculateCashFlow(): CashFlow {
    const recent = this.transactions.filter(
      t => t.timestamp >= Date.now() - 90 * 24 * 60 * 60 * 1000
    );
    
    const operating = recent
      .filter(t => t.type === 'SALE' || t.type === 'PURCHASE')
      .reduce((sum, t) => sum + (t.type === 'SALE' ? t.amount : -t.amount), 0);
    
    return {
      operating,
      investing: -this.balanceSheet.assets.investments,
      financing: this.balanceSheet.liabilities.debt,
      netChange: operating - this.balanceSheet.assets.investments + this.balanceSheet.liabilities.debt
    };
  }

  getBalanceSheet(): BalanceSheet {
    return this.balanceSheet;
  }

  getHealthMetrics(): FinancialHealth {
    const currentRatio = 
      (this.balanceSheet.assets.cash + this.balanceSheet.assets.receivables) /
      (this.balanceSheet.liabilities.payables || 1);
    
    const debtToEquity = this.balanceSheet.liabilities.debt / (this.balanceSheet.equity || 1);
    
    return {
      currentRatio: Math.round(currentRatio * 100) / 100,
      debtToEquity: Math.round(debtToEquity * 100) / 100,
      creditScore: this.calculateCreditScore(),
      runway: this.calculateRunway(),
      status: currentRatio > 1.5 && debtToEquity < 1 ? 'HEALTHY' : 'AT_RISK'
    };
  }

  private updateEquity(): void {
    const assets = 
      this.balanceSheet.assets.cash +
      this.balanceSheet.assets.receivables +
      this.balanceSheet.assets.investments +
      Array.from(this.balanceSheet.assets.inventory.values())
        .reduce((sum, item) => sum + item.value, 0);
    
    const liabilities =
      this.balanceSheet.liabilities.payables +
      this.balanceSheet.liabilities.debt +
      this.balanceSheet.liabilities.accruedExpenses;
    
    this.balanceSheet.equity = assets - liabilities;
  }

  private calculateRunway(): number {
    const monthlyBurn = 5000; // Estimated
    return Math.floor(this.balanceSheet.assets.cash / monthlyBurn);
  }
}

interface Transaction {
  type: 'SALE' | 'PURCHASE' | 'PAYMENT' | 'DEBT' | 'INVESTMENT';
  amount: number;
  product?: string;
  quantity?: number;
  timestamp: number;
  onTime?: boolean;
}

interface FinancialHealth {
  currentRatio: number;
  debtToEquity: number;
  creditScore: number;
  runway: number; // months
  status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
}