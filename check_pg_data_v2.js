const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

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
                // Using raw query to get total count of non-null and distinct count
                // field name in quotes to prevent reserved word issues
                const query = `SELECT count("${field}") as total_count, count(distinct "${field}") as distinct_count FROM "${model.name}" WHERE "${field}" IS NOT NULL`;
                const res = await prisma.$queryRawUnsafe(query);
                
                results[model.name][field] = {
                    totalCount: Number(res[0].total_count),
                    distinctCount: Number(res[0].distinct_count)
                };
            } catch (e) {
                results[model.name][field] = {
                    error: e.message.substring(0, 50)
                };
            }
        }
    }
    console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
