import { getBulkAvailableInventory } from './lib/inventory.js';

async function main() {
  const date = new Date('2026-06-09T12:00:00.000Z'); // 25 Sivan
  const res = await getBulkAvailableInventory(date);
  console.log('25 Sivan availability for אפור טול שמנת 36:');
  console.log(res.find(r => r.dressName.includes('אפור טול שמנת') && r.sizeText === '36'));
  
  const date2 = new Date('2026-06-08T12:00:00.000Z'); // 24 Sivan
  const res2 = await getBulkAvailableInventory(date2);
  console.log('24 Sivan availability for אפור טול שמנת 36:');
  console.log(res2.find(r => r.dressName.includes('אפור טול שמנת') && r.sizeText === '36'));
}

main().catch(console.error);
