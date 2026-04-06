// Message Router - Routing system for agent communication

import { AgentID, MessageType, MessageEntry } from '../core/types';
import { EventEmitter } from '../utils/EventEmitter';

export interface Route {
  source: AgentID;
  destination: AgentID;
  channel: ChannelType;
  priority: Priority;
}

export type ChannelType = 'direct' | 'broadcast' | 'topic';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface RoutingTable {
  directRoutes: Map<AgentID, Route[]>;
  topicSubscriptions: Map<string, AgentID[]>;
}

export class MessageRouter extends EventEmitter {
  private routingTable: RoutingTable;
  private messageBus: EventEmitter;

  constructor() {
    super();
    this.routingTable = {
      directRoutes: new Map(),
      topicSubscriptions: new Map()
    };
    this.messageBus = new EventEmitter();
  }

  // Register direct route between agents
  registerRoute(source: AgentID, destination: AgentID): void {
    if (!this.routingTable.directRoutes.has(source)) {
      this.routingTable.directRoutes.set(source, []);
    }
    
    const routes = this.routingTable.directRoutes.get(source)!;
    const existing = routes.find(r => r.destination === destination);
    
    if (!existing) {
      routes.push({
        source,
        destination,
        channel: 'direct',
        priority: 'normal'
      });
    }
    
    this.emit('route:registered', { source, destination });
  }

  // Subscribe to topic
  subscribeToTopic(agentId: AgentID, topic: string): void {
    if (!this.routingTable.topicSubscriptions.has(topic)) {
      this.routingTable.topicSubscriptions.set(topic, []);
    }
    
    const subscribers = this.routingTable.topicSubscriptions.get(topic)!;
    if (!subscribers.includes(agentId)) {
      subscribers.push(agentId);
    }
    
    this.emit('subscription:added', { agentId, topic });
  }

  // Unsubscribe from topic
  unsubscribeFromTopic(agentId: AgentID, topic: string): void {
    const subscribers = this.routingTable.topicSubscriptions.get(topic);
    if (subscribers) {
      const index = subscribers.indexOf(agentId);
      if (index !== -1) {
        subscribers.splice(index, 1);
        this.emit('subscription:removed', { agentId, topic });
      }
    }
  }

  // Route message
  route(message: MessageEntry): void {
    const routes = this.findRoutes(message.from, message.to, message.type);
    
    for (const route of routes) {
      this.deliver(message, route);
    }
    
    this.emit('message:routed', { message, routeCount: routes.length });
  }

  private findRoutes(source: AgentID, destination: AgentID, type: MessageType): Route[] {
    const routes: Route[] = [];
    
    // Direct route
    const directRoutes = this.routingTable.directRoutes.get(source);
    if (directRoutes) {
      const direct = directRoutes.find(r => r.destination === destination);
      if (direct) routes.push(direct);
    }
    
    // Topic-based routing for discovery
    if (type === 'discover') {
      const topicRoutes = this.routingTable.topicSubscriptions.get('discovery');
      if (topicRoutes) {
        for (const agentId of topicRoutes) {
          if (agentId !== source) {
            routes.push({
              source,
              destination: agentId,
              channel: 'topic',
              priority: 'normal'
            });
          }
        }
      }
    }
    
    return routes;
  }

  private deliver(message: MessageEntry, route: Route): void {
    // Emit on message bus for delivery
    this.messageBus.emit(`agent:${route.destination}`, message);
  }

  // Register handler for agent's incoming messages
  onMessage(agentId: AgentID, handler: (message: MessageEntry) => void): () => void {
    this.messageBus.on(`agent:${agentId}`, handler);
    
    // Return unsubscribe function
    return () => {
      this.messageBus.off(`agent:${agentId}`, handler);
    };
  }

  // Broadcast to topic
  broadcast(source: AgentID, topic: string, payload: unknown): void {
    const subscribers = this.routingTable.topicSubscriptions.get(topic);
    if (subscribers) {
      for (const destination of subscribers) {
        if (destination !== source) {
          const message: MessageEntry = {
            id: this.generateMessageId(),
            from: source,
            to: destination,
            type: 'discover',
            payload,
            timestamp: Date.now()
          };
          
          this.route(message);
        }
      }
    }
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get routing statistics
  getStats(): { directRoutes: number; topicSubscriptions: number } {
    let directRoutes = 0;
    for (const routes of this.routingTable.directRoutes.values()) {
      directRoutes += routes.length;
    }
    
    let topicSubscriptions = 0;
    for (const subscribers of this.routingTable.topicSubscriptions.values()) {
      topicSubscriptions += subscribers.length;
    }
    
    return { directRoutes, topicSubscriptions };
  }
}