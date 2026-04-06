# AgentMesh API Documentation

## Core Concepts

AgentMesh is an autonomous multi-agent commerce network where:
- **Business Agents** represent companies (sellers/suppliers)
- **Consumer Agents** represent shoppers/buyers
- **Deal Engine** negotiates and settles transactions
- **Registry** enables agent discovery
- **Settlement Engine** handles escrow and payments

---

## Quick Start

```typescript
import { AgentMesh } from './src/protocol/AgentMesh';

// Initialize the mesh
const mesh = new AgentMesh();

// Register a business agent
const shoesSupplier = mesh.registerBusiness({
  profile: { name: "Susie's Shoes", category: 'footwear', businessType: 'manufacturer' },
  capabilities: {
    supplies: ['leather shoes', 'sneakers', 'boots'],
    minOrderSize: 50,
    maxOrderSize: 5000,
    turnaroundDays: 21,
    certifications: ['ethical', 'vegan']
  }
});

// Discover suppliers
const textiles = mesh.discover('textiles');
```

---

## Core API Reference

### `AgentMesh`

Main protocol coordinator.

#### `registerBusiness(config: BusinessAgentConfig): BusinessAgent`
Register a business agent in the mesh.

#### `registerConsumer(config: ConsumerAgentConfig): ConsumerAgent`
Register a consumer/shopping agent.

#### `discover(category: string): RegistryEntry[]`
Find agents by category, sorted by reputation.

#### `sendProposal(from: AgentID, to: AgentID, deal: DealTerms): Promise<ProposalResult>`
Send a deal proposal between agents.

#### `getAgent(id: AgentID): Agent | undefined`
Lookup an agent by ID.

---

### `BusinessAgent`

Autonomous supplier representative.

#### Properties
- `id: AgentID` - Unique identifier
- `profile: AgentProfile` - Business info
- `capabilities: BusinessCapabilities` - What they offer

#### Methods

##### `updateCapabilities(caps: Partial<BusinessCapabilities>): void`
Update what the business can provide.

##### `on(event: string, handler: Function): () => void`
Subscribe to events: `proposal:received`, `deal:completed`, `partner:rate`

---

### `ConsumerAgent`

Autonomous buyer representative.

#### Properties
- `id: AgentID` - Unique identifier
- `preferences: ConsumerPreferences` - Shopping preferences
- `budget: BudgetConstraint` - Spending limits

#### Methods

##### `addShoppingGoal(goal: ShoppingGoal): void`
Define what the consumer wants to buy.

##### `discover(category: string): Promise<RegistryEntry[]>`
Find relevant suppliers.

##### `requestQuote(supplierId: AgentID, goal: ShoppingGoal): Promise<Quote>`
Get pricing from a supplier.

##### `negotiate(supplierId: AgentID, deal: DealTerms): Promise<NegotiationResult>`
Attempt to negotiate better terms.

---

### `DealEngine`

Transaction and negotiation manager.

#### `createDeal(terms: DealTerms): Deal`
Create a new deal proposal.

#### `submitProposal(dealId: string): Promise<ProposalStatus>`
Send proposal to counterparty.

#### `evaluateCounterProposal(dealId: string, counter: DealTerms): Promise<EvaluationResult>`
Use AI to evaluate a counter-offer.

#### `generateCounter(dealId: string): Promise<DealTerms | null>`
Generate an AI-powered counter-offer.

#### `escalateToManual(dealId: string, reason: string): void`
Hand off to human when AI can't decide.

---

### `SettlementEngine`

Value exchange and escrow.

#### `createEscrow(dealId, buyerId, sellerId, amount, currency, conditions): EscrowTransaction`
Create an escrow for a deal.

#### `fundEscrow(escrowId, agentId, amount): boolean`
Deposit funds into escrow.

#### `satisfyCondition(escrowId, conditionIndex, verifiedBy): boolean`
Mark a condition as satisfied.

#### `releaseEscrow(escrowId): boolean`
Release funds to seller when all conditions met.

#### `refund(escrowId): boolean`
Return funds to buyer (if not released).

#### `getBalance(agentId): number`
Check agent's current balance.

#### `deposit(agentId, amount): void`
Add funds to agent's account.

---

### `AgentRegistry`

Agent discovery and lookup service.

#### `register(entry): RegistryEntry`
Add an agent to the directory.

#### `lookup(agentId): RegistryEntry | undefined`
Find agent by ID.

#### `discover(category): RegistryEntry[]`
Find agents by category.

#### `findMatches(capabilities): RegistryEntry[]`
Find agents matching specific capabilities.

#### `updateReputation(agentId, delta): void`
Adjust agent's reputation score.

---

### `AuthManager`

Identity verification.

#### `requestChallenge(agentId): AuthChallenge`
Get a challenge to sign (Step 1 of auth).

#### `verify(credentials): Promise<boolean>`
Verify credentials and create session (Step 2).

#### `isVerified(agentId): boolean`
Check if agent has valid session.

#### `hasPermission(agentId, permission): boolean`
Check if agent has specific permission.

---

### `RateLimiter`

Request throttling.

#### `check(key): { allowed, remaining, resetAt }`
Check if request is allowed without consuming.

#### `consume(key): void`
Consume a request quota (throws if exceeded).

#### `block(key, durationMs): void`
Manually block a key.

---

## Events

### Business Agent Events
- `proposal:received` - New proposal received
- `proposal:accepted` - Proposal accepted
- `proposal:rejected` - Proposal rejected
- `deal:negotiating` - Counter-proposal received
- `deal:completed` - Deal successfully closed
- `deal:failed` - Deal failed
- `partner:rate` - Partner rating available

### Mesh Events
- `agent:registered` - New agent joined
- `agent:activated` - Agent came online
- `agent:offline` - Agent went offline
- `reputation:updated` - Score changed

### Settlement Events
- `escrow:created` - New escrow opened
- `escrow:funded` - Funds deposited
- `condition:satisfied` - Deal condition met
- `escrow:released` - Funds transferred
- `escrow:refunded` - Funds returned

---

## Error Handling

All async methods may throw:

```typescript
try {
  await dealEngine.submitProposal(dealId);
} catch (error) {
  if (error instanceof RateLimitExceededError) {
    // Wait and retry
    await sleep(error.retryAfter);
  } else if (error.message.includes('Insufficient balance')) {
    // Fund account first
  }
}
```

Common errors:
- `RateLimitExceededError` - Too many requests
- `AuthenticationError` - Invalid credentials
- `AuthorizationError` - Missing permission
- `ValidationError` - Invalid parameters

---

## Rate Limits

| Operation | Limit | Window |
|-----------|-------|--------|
| Messages | 60/min | 60s |
| Proposals | 10/hour | 3600s |
| Deals | 5/day | 86400s |
| Registry ops | 100/min | 60s |

Use `RateLimiter.check(key)` to preview limits.

---

## Permissions

Available permissions:
- `discover:agents` - Search registry
- `send:proposals` - Submit deal proposals
- `accept:deals` - Accept proposals
- `execute:settlement` - Release escrow funds
- `moderate:mesh` - Admin functions

---

## Type Definitions

See `src/core/types.ts` for full type definitions including:
- `AgentID` - Unique identifier type
- `DealTerms` - Deal parameters
- `Quote` - Supplier pricing
- `BusinessCapabilities` - Supplier offerings
- `ConsumerPreferences` - Buyer preferences
- And more...

---

## Example: Complete Deal Flow

```typescript
// 1. Setup
const mesh = new AgentMesh();
const auth = mesh.auth;

// 2. Authenticate
const challenge = auth.requestChallenge('susie-shoes');
// ... sign challenge with private key ...
await auth.verify({ agentId: 'susie-shoes', signature, publicKey });

// 3. Register business
const supplier = mesh.registerBusiness({
  agentId: 'susie-shoes',
  profile: { name: "Susie's Shoes", category: 'footwear', businessType: 'manufacturer' },
  capabilities: {
    supplies: ['leather shoes', 'sneakers'],
    minOrderSize: 50,
    maxOrderSize: 5000,
    turnaroundDays: 21
  }
});

// 4. Consumer discovers supplier
const buyer = mesh.registerConsumer({
  agentId: 'retailer-1',
  preferences: { seekingCategories: ['footwear'], urgencyLevel: 2 }
});

const suppliers = buyer.discover('footwear');
const bestMatch = suppliers[0];

// 5. Consumer requests quote
const quote = await buyer.requestQuote(bestMatch.agentId, {
  items: [{ category: 'leather shoes', quantity: 100 }],
  requiredBy: Date.now() + 30 * 86400000
});

// 6. Consumer negotiates
const deal = mesh.dealEngine.createDeal({
  buyerId: buyer.id,
  sellerId: bestMatch.agentId,
  items: quote.items,
  totalValue: quote.totalValue * 0.9,  // Negotiate 10% down
  timeline: { deliverBy: Date.now() + 25 * 86400000 }
});

const result = await mesh.sendProposal(buyer.id, bestMatch.agentId, deal);

// 7. Supplier evaluates and responds
supplier.on('proposal:received', async (proposal) => {
  const evaluation = mesh.dealEngine.evaluateCounterProposal(deal.id, proposal);
  
  if (evaluation.acceptable) {
    mesh.dealEngine.submitProposal(deal.id);
  } else if (evaluation.suggestCounter) {
    const counter = await mesh.dealEngine.generateCounter(deal.id);
    mesh.sendProposal(supplier.id, buyer.id, counter!);
  }
});

// 8. Create escrow when deal accepted
const escrow = settlement.createEscrow(
  deal.id,
  buyer.id,
  supplier.id,
  deal.totalValue,
  'USD',
  [
    { type: 'delivery', description: 'Order delivered', satisfied: false },
    { type: 'verification', description: 'Quality check passed', satisfied: false }
  ]
);

// 9. Fund and execute
settlement.deposit(buyer.id, deal.totalValue * 1.1);  // Add buffer
settlement.fundEscrow(escrow.id, buyer.id, deal.totalValue);

// 10. Release when conditions met
settlement.satisfyCondition(escrow.id, 0, 'delivery-service' as AgentID);
settlement.satisfyCondition(escrow.id, 1, 'quality-inspector' as AgentID);
// Escrow auto-releases when all conditions satisfied
```