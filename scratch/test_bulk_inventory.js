const { getBulkAvailableInventory } = require('../lib/inventory.js');

async function main() {
  const result = await getBulkAvailableInventory('2026-09-06');
  if (result['483']) {
    console.log('Model 483 availability:', result['483']);
  } else {
    console.log('Model 483 not found in bulk results.');
  }
}

main().catch(console.error);
