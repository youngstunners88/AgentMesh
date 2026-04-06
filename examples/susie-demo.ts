// Susie's Shoes Demo - Shows how AgentMesh connects supply chains automatically

import { AgentMesh, BusinessCapabilities, ShoppingIntent } from '../src/index';

async function runSusieDemo() {
  console.log('🌐 AgentMesh Demo: Susie\'s Shoes Supply Chain\n');
  
  // Initialize the mesh
  const mesh = new AgentMesh({
    enableLogging: true,
    maxHistorySize: 50,
    transportType: 'http',
    baseUrl: 'http://localhost:3000'
  });

  console.log('1️⃣ Creating business agents...\n');

  // Create Susie's Shoes (retailer)
  const susiesShoes = mesh.createBusinessAgent(
    'susie-shoes-001',
    "Susie's Shoes",
    'retail',
    {
      canSource: true,
      canManufacture: false,
      canDeliver: false,
      canFinance: false,
      canMarket: true
    }
  );

  // Create ABC Textiles (manufacturer)
  const abcTextiles = mesh.createBusinessAgent(
    'abc-textiles-002',
    'ABC Textiles',
    'manufacturing',
    {
      canSource: true,
      canManufacture: true,
      canDeliver: false,
      canFinance: false,
      canMarket: false
    }
  );

  // Create FastFreight Logistics
  const fastFreight = mesh.createBusinessAgent(
    'fastfreight-003',
    'FastFreight Logistics',
    'logistics',
    {
      canSource: false,
      canManufacture: false,
      canDeliver: true,
      canFinance: false,
      canMarket: false
    }
  );

  // Create Enterprise Finance
  const enterpriseFinance = mesh.createBusinessAgent(
    'enterprise-finance-004',
    'Enterprise Finance',
    'finance',
    {
      canSource: false,
      canManufacture: false,
      canDeliver: false,
      canFinance: true,
      canMarket: false
    }
  );

  console.log('✓ 4 business agents created');
  console.log('  - Susie\'s Shoes (retailer)');
  console.log('  - ABC Textiles (manufacturer)');
  console.log('  - FastFreight Logistics (delivery)');
  console.log('  - Enterprise Finance (financing)');

  // Initialize all agents
  console.log('\n2️⃣ Initializing agents...');
  await susiesShoes.initialize(
    { connect: async () => {}, disconnect: async () => {}, isConnected: () => true, send: async () => {}, onReceive: () => () => {} },
    { encode: (m) => m, decode: (p) => p as any, validate: () => true }
  );
  await abcTextiles.initialize(
    { connect: async () => {}, disconnect: async () => {}, isConnected: () => true, send: async () => {}, onReceive: () => () => {} },
    { encode: (m) => m, decode: (p) => p as any, validate: () => true }
  );
  await fastFreight.initialize(
    { connect: async () => {}, disconnect: async () => {}, isConnected: () => true, send: async () => {}, onReceive: () => () => {} },
    { encode: (m) => m, decode: (p) => p as any, validate: () => true }
  );
  await enterpriseFinance.initialize(
    { connect: async () => {}, disconnect: async () => {}, isConnected: () => true, send: async () => {}, onReceive: () => () => {} },
    { encode: (m) => m, decode: (p) => p as any, validate: () => true }
  );

  console.log('✓ All agents initialized');

  // Susie's Shoes has a need
  console.log('\n3️⃣ Susie needs new leather shoes from Cape Town...');
  susiesShoes.setRequirements({
    needsProduct: 'Cape Town Leather Shoes',
    needsCapability: 'manufacturing',
    maxPrice: 500,
    minQuality: 85,
    deliveryTimeframe: 14
  });

  // ABC Textiles can provide
  console.log('\n4️⃣ ABC Textiles can manufacture leather shoes...');
  abcTextiles.setRequirements({
    needsProduct: 'Raw Leather Material',
    needsCapability: 'sourcing',
    maxPrice: 200,
    minQuality: 80,
    deliveryTimeframe: 30
  });

  // Start discovery
  console.log('\n5️⃣ Starting discovery process...');
  await susiesShoes.discoverPartners();

  console.log('\n📊 System Stats:');
  const stats = mesh.getStats();
  console.log(`  - Active agents: ${stats.agents}`);
  console.log(`  - Active deals: ${stats.deals}`);
  console.log(`  - Direct routes: ${stats.routes}`);
  console.log(`  - Topic subscriptions: ${stats.topics}`);

  console.log('\n✅ Demo complete!');
  console.log('\nHow it works:');
  console.log('1. Susie\'s Shoes agent broadcasts a need for leather shoes');
  console.log('2. ABC Textiles agent discovers the need and responds');
  console.log('3. Negotiation happens automatically between agents');
  console.log('4. FastFreight could join for delivery');
  console.log('5. Enterprise Finance could offer trade financing');
  console.log('\nZero user interface. Just autonomous deal flow.');
}

runSusieDemo().catch(console.error);