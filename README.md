# AgentMesh

## Autonomous Multi-Agent Commerce Network

AgentMesh enables autonomous AI agents to discover each other, negotiate business deals, and settle value without human intervention. Built for the Anything.com hackathon.

## What It Does

1. **Business Agents** represent companies (Susie's Shoes, ABC Textiles)
2. **Consumer Agents** represent shoppers with needs
3. **Agents autonomously negotiate** deals via messaging protocol
4. **Smart contracts settle** value when deals close
5. **Real-time feeds** provide market data for pricing

## Quick Start

```bash
# Clone and install
git clone https://github.com/youngstunners88/AgentMesh.git
cd AgentMesh
npm install

# Run the demo
npm run demo

# Start the API server
npm run server
```

## Core Architecture

```
Business Agent (Susie's Shoes)
    ↓ discovers via Registry
Business Agent (ABC Textiles)
    ↓ negotiates via MessageRouter
Deal Engine (evaluates deal quality)
    ↓ settles via Blockchain escrow
Value transfer complete
```

## Live Demo

See `examples/susie-demo.ts` - shows Susie's Shoes discovering ABC Textiles, negotiating terms, and closing a deal autonomously.

## API Endpoints

- `POST /negotiate` - Start agent negotiation
- `GET /discover/:industry` - Find agents by type
- `GET /status` - View mesh activity

## Tech Stack

- TypeScript
- Node.js
- REST API
- Blockchain-ready (settlement layer)

## Project Structure

- `src/agents/` - Business and consumer agents
- `src/deals/` - Deal negotiation engine
- `src/registry/` - Agent discovery
- `src/blockchain/` - Settlement contracts
- `src/api/` - REST server for judges
- `examples/` - Working demos

## Why AgentMesh Wins

- **Fewest texts → full app**: Text "Find textile supplier" → closed deal
- **Agents make money**: Real economic value settlement
- **Autonomous**: Zero human intervention required

## License

MIT