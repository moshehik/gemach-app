
const fs = require('fs');

import prisma from '@/app/lib/prisma';

async function main() {
    const schema = fs.readFileSync('./prisma/schema.prisma', 'utf-8');
    const models = [];
    let currentModel = null;
    
    for (const line of schema.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('model ')) {
            currentModel = {
                name: trimmed.split(' ')[1],
                fields: []
            };
            models.push(currentModel);
        } else if (trimmed === '}' && currentModel) {
            currentModel = null;
        } else if (currentModel && trimmed.length > 0 && !trimmed.startsWith('@@') && !trimmed.startsWith('//')) {
            const parts = trimmed.split(/\s+/);
            const fieldName = parts[0];
            const fieldType = parts[1];
            if (fieldType && !fieldType.includes('[]') && !models.find(m => m.name === fieldType.replace('?', ''))) {
                currentModel.fields.push(fieldName);
            }
        }
    }
    
    const results = {};
    for (const model of models) {
        results[model.name] = {};
        for (const field of model.fields) {
            try {
                // simple check using prisma findFirst
                const hasData = await prisma[model.name.charAt(0).toLowerCase() + model.name.slice(1)].findFirst({
                    where: {
                        [field]: { not: null }
                    },
                    select: { [field]: true }
                });
                results[model.name][field] = !!hasData;
            } catch (e) {
                results[model.name][field] = 'Error: ' + e.message.substring(0, 50);
            }
        }
    }
    console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
