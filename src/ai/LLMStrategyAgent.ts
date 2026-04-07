import { AgentMesh } from '../core/AgentMesh';
import type { Agent, DealContext } from '../core/types';

/**
 * AI-Powered Strategy Agent
 * Uses LLM reasoning for complex multi-party negotiations
 * and strategic coalition formation
 */
export class LLMStrategyAgent {
  private mesh: AgentMesh;

  constructor(mesh: AgentMesh) {
    this.mesh = mesh;
  }

  /**
   * Analyze deal complexity and recommend strategy
   */
  async analyzeDeal(dealContext: DealContext): Promise<StrategyRecommendation> {
    const complexity = this.calculateComplexity(dealContext);
    
    if (complexity > 0.7) {
      return {
        type: 'LLM_ENHANCED',
        reasoning: 'High complexity deal requires nuanced negotiation',
        tactics: ['multi_round', 'conditional_offers', 'coalition_explore']
      };
    }
    
    return {
      type: 'RULE_BASED',
      reasoning: 'Standard deal pattern detected',
      tactics: ['single_round', 'price_match']
    };
  }

  /**
   * Generate negotiation response using LLM reasoning
   */
  async generateResponse(
    myAgent: Agent,
    counterparty: Agent,
    deal: DealContext,
    history: NegotiationRound[]
  ): Promise<NegotiationResponse> {
    const context = this.buildPromptContext(myAgent, counterparty, deal, history);
    
    // Simulate LLM reasoning (in production, call actual LLM API)
    const reasoning = this.simulateLLMReasoning(context);
    
    return {
      offer: this.calculateOptimalOffer(deal, reasoning),
      reasoning: reasoning.summary,
      alternatives: reasoning.alternatives,
      deadline: this.setDeadline(deal)
    };
  }

  /**
   * Form optimal coalitions for multi-party deals
   */
  async proposeCoalition(
    initiator: Agent,
    goal: CoalitionGoal
  ): Promise<CoalitionProposal> {
    const candidates = this.mesh.registry.findByCapabilities(
      goal.requiredCapabilities
    );
    
    const optimalGroup = this.selectOptimalGroup(candidates, goal);
    
    return {
      members: optimalGroup,
      valueDistribution: this.calculateFairSplit(optimalGroup, goal),
      coordinationProtocol: this.designProtocol(optimalGroup)
    };
  }

  private calculateComplexity(context: DealContext): number {
    let score = 0;
    if (context.parties > 2) score += 0.3;
    if (context.terms.length > 5) score += 0.2;
    if (context.constraints.length > 3) score += 0.2;
    if (context.timePressure) score += 0.2;
    return Math.min(score, 1.0);
  }

  private buildPromptContext(
    myAgent: Agent,
    counterparty: Agent,
    deal: DealContext,
    history: NegotiationRound[]
  ): PromptContext {
    return {
      myProfile: myAgent.profile,
      theirProfile: counterparty.profile,
      dealTerms: deal.terms,
      negotiationHistory: history,
      marketConditions: this.mesh.analytics.getMarketSnapshot(),
      myConstraints: myAgent.constraints
    };
  }

  private simulateLLMReasoning(context: PromptContext): LLMOutput {
    // In production: const response = await fetch('https://api.openai.com/v1/chat/completions', ...)
    
    return {
      summary: `Analyzing deal between ${context.myProfile.name} and ${context.theirProfile.name}`,
      recommendedPrice: this.calculateMarketPrice(context),
      walkAwayPoint: context.myConstraints.minAcceptable,
      alternatives: this.generateAlternatives(context),
      confidence: 0.85
    };
  }

  private calculateOptimalOffer(deal: DealContext, reasoning: LLMOutput): Offer {
    return {
      price: reasoning.recommendedPrice,
      terms: deal.terms.filter(t => t.negotiable),
      conditions: ['payment_within_30_days', 'quality_guarantee'],
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
  }

  private calculateMarketPrice(context: PromptContext): number {
    const basePrice = context.dealTerms.find(t => t.type === 'price')?.value || 100;
    const marketMultiplier = context.marketConditions.priceIndex;
    return basePrice * marketMultiplier * (0.9 + Math.random() * 0.2); // +/- 10%
  }

  private generateAlternatives(context: PromptContext): AlternativeDeal[] {
    return [
      { type: 'defer', reason: 'Wait for better market conditions' },
      { type: 'counterparty_switch', reason: 'Explore other suppliers' },
      { type: 'term_adjustment', reason: 'Modify non-price terms' }
    ];
  }

  private setDeadline(deal: DealContext): number {
    return deal.timePressure 
      ? Date.now() + 2 * 60 * 60 * 1000  // 2 hours
      : Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  private selectOptimalGroup(candidates: Agent[], goal: CoalitionGoal): Agent[] {
    // Greedy selection by capability match + reputation
    return candidates
      .map(a => ({ agent: a, score: this.scoreForGoal(a, goal) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, goal.optimalSize)
      .map(x => x.agent);
  }

  private scoreForGoal(agent: Agent, goal: CoalitionGoal): number {
    const capabilityScore = goal.requiredCapabilities.filter(
      cap => agent.capabilities.includes(cap)
    ).length / goal.requiredCapabilities.length;
    
    const reputationScore = agent.reputationScore / 100;
    
    return capabilityScore * 0.6 + reputationScore * 0.4;
  }

  private calculateFairSplit(members: Agent[], goal: CoalitionGoal): ValueSplit[] {
    const totalValue = goal.expectedValue;
    const splits = members.map(m => ({
      agentId: m.id,
      share: totalValue / members.length, // Equal split baseline
      adjustedShare: this.adjustByContribution(m, members, totalValue)
    }));
    
    return splits;
  }

  private adjustByContribution(agent: Agent, allMembers: Agent[], total: number): number {
    const baseShare = total / allMembers.length;
    const reputationBonus = (agent.reputationScore - 50) / 100 * baseShare * 0.2;
    return baseShare + reputationBonus;
  }

  private designProtocol(group: Agent[]): CoordinationProtocol {
    return {
      communicationChannel: `coalition-${Date.now()}`,
      decisionRule: group.length <= 3 ? 'unanimous' : 'majority',
      disputeResolution: 'escalate_to_arbitration',
      exitConditions: ['material_breach', 'mutual_consent']
    };
  }
}

// Types
interface StrategyRecommendation {
  type: 'LLM_ENHANCED' | 'RULE_BASED';
  reasoning: string;
  tactics: string[];
}

interface NegotiationResponse {
  offer: Offer;
  reasoning: string;
  alternatives: AlternativeDeal[];
  deadline: number;
}

interface Offer {
  price: number;
  terms: any[];
  conditions: string[];
  expiresAt: number;
}

interface AlternativeDeal {
  type: string;
  reason: string;
}

interface CoalitionProposal {
  members: Agent[];
  valueDistribution: ValueSplit[];
  coordinationProtocol: CoordinationProtocol;
}

interface ValueSplit {
  agentId: string;
  share: number;
  adjustedShare: number;
}

interface CoordinationProtocol {
  communicationChannel: string;
  decisionRule: string;
  disputeResolution: string;
  exitConditions: string[];
}

interface PromptContext {
  myProfile: any;
  theirProfile: any;
  dealTerms: any[];
  negotiationHistory: NegotiationRound[];
  marketConditions: any;
  myConstraints: any;
}

interface LLMOutput {
  summary: string;
  recommendedPrice: number;
  walkAwayPoint: number;
  alternatives: AlternativeDeal[];
  confidence: number;
}

interface NegotiationRound {
  timestamp: number;
  from: string;
  offer: any;
  counter?: any;
}

interface CoalitionGoal {
  requiredCapabilities: string[];
  optimalSize: number;
  expectedValue: number;
}