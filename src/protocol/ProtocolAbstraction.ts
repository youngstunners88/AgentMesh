// Protocol Abstraction Layer - Pluggable communication interfaces

import { AgentID, MessageEntry } from '../core/types';

export interface TransportLayer {
  send(message: MessageEntry): Promise<void>;
  onReceive(handler: (message: MessageEntry) => void): () => void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface ProtocolAdapter {
  encode(message: MessageEntry): unknown;
  decode(payload: unknown): MessageEntry;
  validate(message: MessageEntry): boolean;
}

export abstract class ProtocolAbstraction {
  protected transport: TransportLayer;
  protected adapter: ProtocolAdapter;
  protected agentId: AgentID;

  constructor(
    agentId: AgentID,
    transport: TransportLayer,
    adapter: ProtocolAdapter
  ) {
    this.agentId = agentId;
    this.transport = transport;
    this.adapter = adapter;
  }

  abstract async initialize(): Promise<void>;
  abstract async send(message: MessageEntry): Promise<void>;
  abstract onReceive(handler: (message: MessageEntry) => void): () => void;
}

// HTTP/REST Transport Implementation
export class HttpTransport implements TransportLayer {
  private baseUrl: string;
  private connected: boolean = false;
  private receiveHandler: ((message: MessageEntry) => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(message: MessageEntry): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
  }

  onReceive(handler: (message: MessageEntry) => void): () => void {
    this.receiveHandler = handler;
    
    // Start polling
    const pollInterval = setInterval(() => this.poll(), 5000);
    
    return () => {
      clearInterval(pollInterval);
      this.receiveHandler = null;
    };
  }

  private async poll(): Promise<void> {
    if (!this.connected || !this.receiveHandler) return;
    
    try {
      const response = await fetch(`${this.baseUrl}/messages/pending`);
      if (response.ok) {
        const messages = await response.json();
        for (const message of messages) {
          this.receiveHandler(message);
        }
      }
    } catch (error) {
      // Silently fail on poll errors
    }
  }
}

// WebSocket Transport Implementation
export class WebSocketTransport implements TransportLayer {
  private ws: WebSocket | null = null;
  private url: string;
  private connected: boolean = false;
  private handlers: ((message: MessageEntry) => void)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        for (const handler of this.handlers) {
          handler(message);
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(message: MessageEntry): Promise<void> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected');
    }
    
    this.ws.send(JSON.stringify(message));
  }

  onReceive(handler: (message: MessageEntry) => void): () => void {
    this.handlers.push(handler);
    
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }
}

// JSON Protocol Adapter
export class JsonProtocolAdapter implements ProtocolAdapter {
  encode(message: MessageEntry): unknown {
    return {
      ...message,
      timestamp: message.timestamp
    };
  }

  decode(payload: unknown): MessageEntry {
    const msg = payload as MessageEntry;
    return {
      ...msg,
      timestamp: msg.timestamp || Date.now()
    };
  }

  validate(message: MessageEntry): boolean {
    return !!(
      message.id &&
      message.from &&
      message.to &&
      message.type &&
      message.timestamp
    );
  }
}