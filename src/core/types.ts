// Core Types - System-wide type definitions

export type AgentID = string;
export type DealID = string;
export type MessageID = string;
export type Timestamp = number;

export interface AgentProfile {
  id: AgentID;
  name: string;
  category: BusinessCategory;
  capabilities: Capability[];
  reputation: number;
  createdAt: Timestamp;
}

export type BusinessCategory = 
  | 'retail' 
  | 'manufacturing' 
  | 'logistics' 
  | 'finance' 
  | 'marketing'
  | 'legal'
  | 'consumer';

export type Capability = 
  | 'sourcing'
  | 'manufacturing' 
  | 'fulfillment'
  | 'financing'
  | 'marketing'
  | 'legal'
  | 'delivery';

export interface SystemState {
  agents: Map<AgentID, AgentProfile>;
  deals: Map<DealID, DealState>;
  messages: MessageLog;
  registry: RegistryState;
}

export interface MessageLog {
  entries: MessageEntry[];
  append(entry: MessageEntry): void;
  query(filter: MessageFilter): MessageEntry[];
}

export interface MessageEntry {
  id: MessageID;
  from: AgentID;
  to: AgentID;
  type: MessageType;
  payload: unknown;
  timestamp: Timestamp;
}

export type MessageType = 
  | 'discover'
  | 'negotiate'
  | 'propose'
  | 'accept'
  | 'reject'
  | 'escrow'
  | 'settle';

export interface MessageFilter {
  from?: AgentID;
  to?: AgentID;
  type?: MessageType;
  since?: Timestamp;
}

export interface RegistryState {
  byCategory: Map<BusinessCategory, AgentID[]>;
  byCapability: Map<Capability, AgentID[]>;
}