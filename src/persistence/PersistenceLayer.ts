// Persistence Layer - Database adapter for state restoration

import { AgentID } from '../core/types';
import { StateManager } from '../core/StateManager';

export interface PersistenceConfig {
  type: 'memory' | 'file' | 'sqlite' | 'redis';
  path?: string;
  ttl?: number;  // Time to live in ms
  autoSave?: boolean;
  saveInterval?: number;  // ms
}

export interface Snapshot {
  timestamp: number;
  version: string;
  data: Record<string, unknown>;
  checksum: string;
}

export class PersistenceLayer {
  private config: PersistenceConfig;
  private memoryStore: Map<string, unknown>;
  private autoSaveInterval?: NodeJS.Timer;
  private subscribers: Map<string, (data: unknown) => Promise<void>>;
  
  constructor(config: PersistenceConfig = { type: 'memory' }) {
    this.config = { autoSave: true, saveInterval: 30000, ...config };
    this.memoryStore = new Map();
    this.subscribers = new Map();
    
    if (this.config.autoSave && this.config.saveInterval) {
      this.startAutoSave();
    }
  }
  
  // Connect state manager to persistence
  connect<T>(key: string, stateManager: StateManager<T>): () => void {
    // Save on every state change
    const unsubscribe = stateManager.subscribe(async (newState) => {
      await this.save(key, newState);
    });
    
    // Register for explicit saves
    this.subscribers.set(key, async (data) => {
      stateManager.setState(data as T, false);  // Silent restore
    });
    
    return () => {
      unsubscribe();
      this.subscribers.delete(key);
    };
  }
  
  // Save state
  async save<T>(key: string, data: T): Promise<void> {
    const snapshot: Snapshot = {
      timestamp: Date.now(),
      version: '1.0.0',
      data: data as Record<string, unknown>,
      checksum: this.computeChecksum(data)
    };
    
    switch (this.config.type) {
      case 'memory':
        this.memoryStore.set(key, snapshot);
        break;
        
      case 'file':
        if (this.config.path) {
          await this.saveToFile(key, snapshot);
        }
        break;
        
      case 'sqlite':
        await this.saveToSQLite(key, snapshot);
        break;
        
      case 'redis':
        await this.saveToRedis(key, snapshot);
        break;
    }
  }
  
  // Load state
  async load<T>(key: string): Promise<T | null> {
    let snapshot: Snapshot | null = null;
    
    switch (this.config.type) {
      case 'memory':
        snapshot = this.memoryStore.get(key) as Snapshot | null;
        break;
        
      case 'file':
        if (this.config.path) {
          snapshot = await this.loadFromFile(key);
        }
        break;
        
      case 'sqlite':
        snapshot = await this.loadFromSQLite(key);
        break;
        
      case 'redis':
        snapshot = await this.loadFromRedis(key);
        break;
    }
    
    if (!snapshot) return null;
    
    // Verify integrity
    const currentChecksum = this.computeChecksum(snapshot.data);
    if (currentChecksum !== snapshot.checksum) {
      console.warn(`[Persistence] Checksum mismatch for ${key}, data may be corrupted`);
      // Could attempt recovery from backup
    }
    
    return snapshot.data as T;
  }
  
  // Restore all connected states
  async restoreAll(): Promise<void> {
    for (const [key, restoreFn] of this.subscribers.entries()) {
      const data = await this.load(key);
      if (data) {
        await restoreFn(data);
        console.log(`[Persistence] Restored state: ${key}`);
      }
    }
  }
  
  // Create backup
  async backup(): Promise<string> {
    const backupKey = `backup-${Date.now()}`;
    const allData: Record<string, Snapshot> = {};
    
    switch (this.config.type) {
      case 'memory':
        for (const [key, value] of this.memoryStore.entries()) {
          allData[key] = value as Snapshot;
        }
        break;
        
      case 'file':
        // Load all files from directory
        allData['registry'] = await this.loadFromFile('registry') || null!;
        allData['escrows'] = await this.loadFromFile('escrows') || null!;
        break;
    }
    
    const backupData: Snapshot = {
      timestamp: Date.now(),
      version: '1.0.0',
      data: allData,
      checksum: this.computeChecksum(allData)
    };
    
    await this.save(backupKey, backupData);
    return backupKey;
  }
  
  // Restore from backup
  async restoreFromBackup(backupKey: string): Promise<boolean> {
    const backup = await this.load<Record<string, Snapshot>>(backupKey);
    if (!backup) return false;
    
    for (const [key, snapshot] of Object.entries(backup)) {
      await this.save(key, snapshot.data);
      
      const restoreFn = this.subscribers.get(key);
      if (restoreFn) {
        await restoreFn(snapshot.data);
      }
    }
    
    return true;
  }
  
  // Delete state
  async delete(key: string): Promise<void> {
    switch (this.config.type) {
      case 'memory':
        this.memoryStore.delete(key);
        break;
      case 'file':
        // Delete file
        break;
      case 'sqlite':
        // Delete row
        break;
      case 'redis':
        // Delete key
        break;
    }
  }
  
  // List all saved keys
  async listKeys(): Promise<string[]> {
    switch (this.config.type) {
      case 'memory':
        return Array.from(this.memoryStore.keys());
      case 'file':
        return [];  // Would scan directory
      case 'sqlite':
        return [];  // Would query database
      case 'redis':
        return [];  // Would query keys
      default:
        return [];
    }
  }
  
  // Cleanup (close connections, stop autosave)
  async cleanup(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Save everything one last time
    for (const [key, snapshot] of this.memoryStore.entries()) {
      await this.save(key, snapshot);
    }
  }
  
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      for (const [key, snapshot] of this.memoryStore.entries()) {
        await this.save(key, snapshot);
      }
    }, this.config.saveInterval);
  }
  
  private computeChecksum(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  private async saveToFile(key: string, snapshot: Snapshot): Promise<void> {
    // File system implementation
    const fs = await import('fs/promises');
    const path = `${this.config.path}/${key}.json`;
    await fs.mkdir(this.config.path!, { recursive: true });
    await fs.writeFile(path, JSON.stringify(snapshot, null, 2));
  }
  
  private async loadFromFile(key: string): Promise<Snapshot | null> {
    try {
      const fs = await import('fs/promises');
      const path = `${this.config.path}/${key}.json`;
      const data = await fs.readFile(path, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  private async saveToSQLite(key: string, snapshot: Snapshot): Promise<void> {
    // Would use SQLite library
    console.log(`[SQLite] Save ${key}`);
  }
  
  private async loadFromSQLite(key: string): Promise<Snapshot | null> {
    console.log(`[SQLite] Load ${key}`);
    return null;
  }
  
  private async saveToRedis(key: string, snapshot: Snapshot): Promise<void> {
    // Would use Redis library with TTL
    console.log(`[Redis] Save ${key}`);
  }
  
  private async loadFromRedis(key: string): Promise<Snapshot | null> {
    console.log(`[Redis] Load ${key}`);
    return null;
  }
}

export const persistence = new PersistenceLayer({
  type: 'memory',
  autoSave: true,
  saveInterval: 60000  // 1 minute
});