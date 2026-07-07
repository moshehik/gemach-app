const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting migration of dressName to dressModelId...");
    const models = await prisma.dressModel.findMany();
    
    for (const model of models) {
        if (!model.name) continue;
        const res = await prisma.dressItem.updateMany({
            where: { dressName: model.name },
            data: { dressModelId: model.id }
        });
        if (res.count > 0) {
            console.log(`Updated ${res.count} items for model: ${model.name}`);
        }
    }
    console.log("Migration finished.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
