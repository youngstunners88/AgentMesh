// Three.js Network Visualizer for AgentMesh
// Real-time 3D graph of agents, deals, and capital flow

export interface VisualizerConfig {
  nodeCount: number;
  dealFlowSpeed: number;
  showLabels: boolean;
  cameraPosition: { x: number; y: number; z: number };
}

export class MeshVisualizer {
  private agents: Map<string, AgentNode> = new Map();
  private deals: DealEdge[] = [];
  private config: VisualizerConfig;
  private frame: number = 0;
  
  constructor(config: VisualizerConfig = {
    nodeCount: 100,
    dealFlowSpeed: 1,
    showLabels: true,
    cameraPosition: { x: 0, y: 50, z: 100 }
  }) {
    this.config = config;
  }

  // Add agent as node
  addAgent(agent: Agent): void {
    const position = this.calculatePosition(agent.type);
    const color = this.getAgentColor(agent.type);
    
    this.agents.set(agent.id, {
      id: agent.id,
      type: agent.type,
      name: agent.name,
      x: position.x,
      y: position.y,
      z: position.z,
      color,
      size: this.getNodeSize(agent),
      connections: [],
      capital: agent.capital || 0,
      pulse: 0
    });
  }

  // Visualize deal as animated edge
  addDeal(deal: Deal): void {
    const source = this.agents.get(deal.buyerId);
    const target = this.agents.get(deal.sellerId);
    
    if (!source || !target) return;
    
    const edge: DealEdge = {
      id: deal.id,
      source: deal.buyerId,
      target: deal.sellerId,
      value: deal.value,
      status: deal.status,
      progress: 0,
      color: this.getDealColor(deal.status),
      particles: []
    };
    
    // Add particle trail
    for (let i = 0; i < 5; i++) {
      edge.particles.push({
        progress: i * 0.2,
        intensity: 1 - (i * 0.15)
      });
    }
    
    this.deals.push(edge);
    source.connections.push(deal.sellerId);
    target.connections.push(deal.buyerId);
  }

  // Animate one frame
  animate(): SceneSnapshot {
    this.frame++;
    
    // Animate deal flow
    this.deals.forEach(deal => {
      deal.progress += 0.01 * this.config.dealFlowSpeed;
      
      // Animate particles along the edge
      deal.particles.forEach(p => {
        p.progress += 0.02;
        if (p.progress > 1) p.progress = 0;
      });
      
      // Complete deal animation
      if (deal.progress >= 1) {
        deal.status = 'COMPLETED';
        deal.color = '#00ff00'; // Green for completed
      }
    });
    
    // Pulse active agents
    this.agents.forEach(agent => {
      agent.pulse = Math.sin(this.frame * 0.1) * 0.3 + 0.7;
    });
    
    // Remove completed deals after delay
    this.deals = this.deals.filter(d => 
      d.status !== 'COMPLETED' || d.progress < 1.5
    );
    
    return this.generateSnapshot();
  }

  // Generate Three.js compatible scene data
  generateSnapshot(): SceneSnapshot {
    return {
      nodes: Array.from(this.agents.values()).map(a => ({
        id: a.id,
        position: [a.x, a.y, a.z],
        color: a.color,
        size: a.size * a.pulse,
        label: this.config.showLabels ? a.name : undefined,
        capital: a.capital
      })),
      edges: this.deals.map(d => ({
        id: d.id,
        source: d.source,
        target: d.target,
        value: d.value,
        color: d.color,
        progress: d.progress,
        particles: d.particles
      })),
      stats: {
        activeAgents: this.agents.size,
        flowingDeals: this.deals.filter(d => d.status === 'PENDING').length,
        totalCapital: Array.from(this.agents.values()).reduce((sum, a) => sum + a.capital, 0)
      }
    };
  }

  // Focus camera on specific agent
  focusOnAgent(agentId: string): CameraPosition | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    
    return {
      x: agent.x,
      y: agent.y + 20,
      z: agent.z + 50,
      target: { x: agent.x, y: agent.y, z: agent.z }
    };
  }

  // Highlight capital flow path
  highlightFlowPath(fromAgent: string, toAgent: string): string[] {
    // Simple BFS to find path
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ 
      id: fromAgent, 
      path: [fromAgent] 
    }];
    
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      
      if (id === toAgent) return path;
      
      if (visited.has(id)) continue;
      visited.add(id);
      
      const agent = this.agents.get(id);
      if (agent) {
        agent.connections.forEach(connId => {
          if (!visited.has(connId)) {
            queue.push({ id: connId, path: [...path, connId] });
          }
        });
      }
    }
    
    return [];
  }

  private calculatePosition(type: AgentType): { x: number; y: number; z: number } {
    // Cluster by type
    const clusters: Record<AgentType, { x: number; z: number; spread: number }> = {
      BUSINESS: { x: -30, z: -30, spread: 20 },
      CONSUMER: { x: 30, z: -30, spread: 25 },
      CAPITAL: { x: -30, z: 30, spread: 15 },
      DAO: { x: 0, z: 0, spread: 10 },
      COMPANY: { x: 0, z: 30, spread: 20 },
      MANUFACTURING: { x: -50, z: 0, spread: 15 },
      LOGISTICS: { x: 50, z: 0, spread: 15 },
      SERVICE: { x: 30, z: 30, spread: 20 }
    };
    
    const cluster = clusters[type] || clusters.BUSINESS;
    
    return {
      x: cluster.x + (Math.random() - 0.5) * cluster.spread,
      y: Math.random() * 20, // Height variation
      z: cluster.z + (Math.random() - 0.5) * cluster.spread
    };
  }

  private getAgentColor(type: AgentType): string {
    const colors: Record<AgentType, string> = {
      BUSINESS: '#4285f4',    // Blue
      CONSUMER: '#34a853',     // Green
      CAPITAL: '#fbbc04',      // Yellow
      DAO: '#ea4335',          // Red
      COMPANY: '#9c27b0',      // Purple
      MANUFACTURING: '#ff9800', // Orange
      LOGISTICS: '#00bcd4',     // Cyan
      SERVICE: '#795548'        // Brown
    };
    return colors[type] || '#ffffff';
  }

  private getNodeSize(agent: Agent): number {
    // Size based on capital/influence
    const baseSize = 5;
    const capitalFactor = Math.log10(agent.capital + 1) * 0.5;
    return baseSize + capitalFactor;
  }

  private getDealColor(status: DealStatus): string {
    const colors: Record<DealStatus, string> = {
      PENDING: '#ffeb3b',   // Yellow - flowing
      NEGOTIATING: '#ff9800', // Orange
      COMPLETED: '#4caf50',   // Green
      FAILED: '#f44336',       // Red
      DISPUTED: '#9c27b0'      // Purple
    };
    return colors[status];
  }
}

interface AgentNode {
  id: string;
  type: AgentType;
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
  size: number;
  connections: string[];
  capital: number;
  pulse: number;
}

interface DealEdge {
  id: string;
  source: string;
  target: string;
  value: number;
  status: DealStatus;
  progress: number;
  color: string;
  particles: Array<{ progress: number; intensity: number }>;
}

interface SceneSnapshot {
  nodes: Array<{
    id: string;
    position: number[];
    color: string;
    size: number;
    label?: string;
    capital: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    value: number;
    color: string;
    progress: number;
    particles: Array<{ progress: number; intensity: number }>;
  }>;
  stats: {
    activeAgents: number;
    flowingDeals: number;
    totalCapital: number;
  };
}

type AgentType = 'BUSINESS' | 'CONSUMER' | 'CAPITAL' | 'DAO' | 'COMPANY' | 'MANUFACTURING' | 'LOGISTICS' | 'SERVICE';
type DealStatus = 'PENDING' | 'NEGOTIATING' | 'COMPLETED' | 'FAILED' | 'DISPUTED';

interface Agent {
  id: string;
  type: AgentType;
  name: string;
  capital: number;
}

interface Deal {
  id: string;
  buyerId: string;
  sellerId: string;
  value: number;
  status: DealStatus;
}

interface CameraPosition {
  x: number;
  y: number;
  z: number;
  target: { x: number; y: number; z: number };
}