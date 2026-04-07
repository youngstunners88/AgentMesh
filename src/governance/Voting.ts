import { EventEmitter } from '../utils/EventEmitter';

type ProposalType = 'UPGRADE' | 'ARBITRATION' | 'TREASURY' | 'POLICY';

interface Proposal {
  id: string;
  type: ProposalType;
  description: string;
  proposedBy: string;
  votes: Map<string, boolean>; // voter -> yes/no
  quorum: number;
  threshold: number; // % needed to pass
  deadline: number;
  status: 'ACTIVE' | 'PASSED' | 'REJECTED' | 'EXECUTED';
}

export class Voting {
  private proposals: Map<string, Proposal> = new Map();
  private eventEmitter = new EventEmitter();

  async propose(
    type: ProposalType,
    description: string,
    proposer: string,
    options: { quorum?: number; threshold?: number; duration?: number } = {}
  ): Promise<string> {
    const id = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const proposal: Proposal = {
      id,
      type,
      description,
      proposedBy: proposer,
      votes: new Map(),
      quorum: options.quorum || 100,
      threshold: options.threshold || 0.51,
      deadline: Date.now() + (options.duration || 7 * 24 * 60 * 60 * 1000), // 7 days default
      status: 'ACTIVE'
    };
    
    this.proposals.set(id, proposal);
    this.eventEmitter.emit('proposalCreated', proposal);
    return id;
  }

  async vote(proposalId: string, voter: string, approve: boolean): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (Date.now() > proposal.deadline) {
      this.finalize(proposalId);
      throw new Error('Voting period ended');
    }
    
    proposal.votes.set(voter, approve);
    this.eventEmitter.emit('voteCast', { proposalId, voter, approve });
    
    // Auto-finalize if quorum reached
    if (proposal.votes.size >= proposal.quorum) {
      await this.finalize(proposalId);
    }
  }

  private async finalize(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId)!;
    const yesVotes = Array.from(proposal.votes.values()).filter(v => v).length;
    const totalVotes = proposal.votes.size;
    
    const passRate = yesVotes / totalVotes;
    proposal.status = passRate >= proposal.threshold ? 'PASSED' : 'REJECTED';
    
    this.eventEmitter.emit('proposalFinalized', proposal);
  }

  getResults(proposalId: string): { yes: number; no: number; status: string } | null {
    const p = this.proposals.get(proposalId);
    if (!p) return null;
    const yes = Array.from(p.votes.values()).filter(v => v).length;
    return { yes, no: p.votes.size - yes, status: p.status };
  }
}