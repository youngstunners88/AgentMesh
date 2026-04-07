import { AgentMesh } from '../protocol/AgentMesh';

export interface NetworkState {
  totalAgents: number;
  activeDeals: number;
  totalValueLocked: number;
  networkHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  topAgents: AgentStats[];
  economicZones: ZoneStats[];
  governance: GovernanceState;
}

interface AgentStats {
  id: string;
  type: string;
  reputation: number;
  dealVolume: number;
  profit: number;
}

interface ZoneStats {
  id: string;
  agentCount: number;
  tradeVolume: number;
  currency: string;
}

interface GovernanceState {
  activeProposals: number;
  pendingVotes: number;
  treasuryBalance: number;
}

export class MeshInspector {
  private agents: Map<string, AgentMesh> = new Map();
  
  registerAgent(agent: AgentMesh): void {
    this.agents.set(agent.id, agent);
  }

  getNetworkState(): NetworkState {
    const allAgents = Array.from(this.agents.values());
    
    return {
      totalAgents: allAgents.length,
      activeDeals: this.countActiveDeals(allAgents),
      totalValueLocked: this.calculateTVL(allAgents),
      networkHealth: this.assessHealth(allAgents),
      topAgents: this.getTopAgents(allAgents, 10),
      economicZones: this.getZoneStats(allAgents),
      governance: this.getGovernanceState()
    };
  }

  visualize(): string {
    const state = this.getNetworkState();
    
    return `
╔════════════════════════════════════════════════╗
║           AGENTMESH NETWORK STATE              ║
╠════════════════════════════════════════════════╣
║ Total Agents:        ${state.totalAgents.toString().padEnd(25)} ║
║ Active Deals:        ${state.activeDeals.toString().padEnd(25)} ║
║ Total Value Locked:   $${state.totalValueLocked.toFixed(2).padEnd(24)} ║
║ Network Health:       ${state.networkHealth.padEnd(25)} ║
╠════════════════════════════════════════════════╣
║ TOP PERFORMING AGENTS                           ║
${state.topAgents.map((a, i) => `║ ${i+1}. ${a.id.slice(0,15).padEnd(15)} | Rep: ${a.reputation.toFixed(1).padEnd(4)} | Vol: $${a.profit.toFixed(0).padEnd(6)} ║`).join('\n')}
╠════════════════════════════════════════════════╣
║ GOVERNANCE STATUS                               ║
║ Active Proposals:    ${state.governance.activeProposals.toString().padEnd(25)} ║
║ Treasury Balance:    $${state.governance.treasuryBalance.toFixed(2).padEnd(24)} ║
╚════════════════════════════════════════════════╝
    `;
  }

  private countActiveDeals(agents: AgentMesh[]): number {
    return agents.reduce((sum, a) => sum + (a.state?.deals?.length || 0), 0);
  }

  private calculateTVL(agents: AgentMesh[]): number {
    return agents.reduce((sum, a) => sum + (a.state?.escrow?.balance || 0), 0);
  }

  private assessHealth(agents: AgentMesh[]): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' {
    const ratio = agents.filter(a => a.state?.online).length / agents.length;
    if (ratio > 0.8) return 'HEALTHY';
    if (ratio > 0.5) return 'DEGRADED';
    return 'CRITICAL';
  }

  private getTopAgents(agents: AgentMesh[], limit: number): AgentStats[] {
    return agents
      .map(a => ({
        id: a.id,
        type: a.constructor.name,
        reputation: a.state?.reputation || 0,
        dealVolume: a.state?.deals?.length || 0,
        profit: a.state?.profit || 0
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, limit);
  }

  private getZoneStats(agents: AgentMesh[]): ZoneStats[] {
    // Group by zone
    return [];
  }

  private getGovernanceState(): GovernanceState {
    return { activeProposals: 0, pendingVotes: 0, treasuryBalance: 0 };
  }
}