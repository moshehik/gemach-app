const { PrismaClient, Prisma } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

import prisma from '@/app/lib/prisma';

async function main() {
    console.log("Starting JSON export from database...");
    
    // Get all model names from Prisma metadata
    const models = Prisma.dmmf.datamodel.models.map(m => m.name);
    const exportData = {};
    
    for (const modelName of models) {
        // lowerCamelCase for prisma client (e.g. 'DressModel' -> 'dressModel')
        const modelDelegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
        
        console.log(`Exporting table: ${modelName}...`);
        try {
            const records = await prisma[modelDelegateName].findMany();
            exportData[modelName] = records;
            console.log(`- Exported ${records.length} records.`);
        } catch(e) {
            console.error(`- Error exporting ${modelName}:`, e.message);
        }
    }
    
    // Write to JSON file
    const outputPath = path.join(process.cwd(), 'backup_data.json');
    console.log(`Writing data to ${outputPath}...`);
    
    // We stringify carefully handling Date and BigInt (though Prisma usually returns Date objects which JSON.stringify handles)
    const jsonString = JSON.stringify(exportData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    , 2);
    
    fs.writeFileSync(outputPath, jsonString, 'utf-8');
    
    console.log("===============================");
    console.log("Export completed successfully!");
    console.log("File saved to:", outputPath);
    console.log("===============================");
}

main()
    .catch(e => {
        console.error("Critical Export Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
