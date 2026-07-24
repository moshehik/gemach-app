import { getBulkAvailableInventory } from './lib/inventory.js';
import { getHebrewDateString } from './lib/hebrewDate.js';
import prisma from './app/lib/prisma.js';

async function main() {
  const modelMap = {};
  const models = await prisma.dressModel.findMany();
  models.forEach(m => modelMap[m.id] = m.name);
  
  let formattedResults = [];
  const targetDate = new Date('2026-06-09T12:00:00.000Z');
  const availabilityData = await getBulkAvailableInventory(targetDate);
  
  for (const modelId in availabilityData) {
      const mName = modelMap[modelId] || "";
      if (!mName.includes("אפור טול")) continue;
      
      for (const size in availabilityData[modelId]) {
         if (size !== '36') continue;
         
         const invData = availabilityData[modelId][size];
         formattedResults.push({
            "תאריך": '2026-06-09',
            "תאריך עברי": getHebrewDateString(targetDate),
            "דגם": modelMap[modelId] || modelId,
            "מידה": size,
            "זמינות_פנויה": typeof invData === 'object' ? invData.available : invData,
            "מלאי_כולל": typeof invData === 'object' ? invData.total : invData,
            "כמות_מוזמנת": typeof invData === 'object' ? invData.booked : 0
         });
      }
   }
   console.log(JSON.stringify(formattedResults, null, 2));
}

main().catch(console.error);
