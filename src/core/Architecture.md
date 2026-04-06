# AgentMesh Architecture

## Core Principles

### 1. File System
- Domain-driven folder structure
- Each module owns its files
- Clear import/export contracts

### 2. Routing System
- Message bus for agent communication
- Topic-based pub/sub
- Direct peer-to-peer channels

### 3. State Management
- Centralized state tree
- Immutable updates
- Reactive subscriptions

### 4. Abstraction Layer
- Protocol-agnostic interfaces
- Pluggable transports
- Swappable implementations

### 5. Modularity
- Self-contained modules
- Explicit dependencies
- Interface-driven design

### 6. Separation of Concerns
- Core: System infrastructure
- Agents: Business logic
- Protocol: Communication
- State: Data management
- Registry: Discovery
- Deals: Transaction logic
- Consumers: User-facing