const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const models = [
        'Customer', 'AuditLog', 'Employee', 'Notification', 'Shift',
        'DressModel', 'DressItem', 'Order', 'Payment', 'PaymentObligation',
        'OrderItem', 'PriceList', 'SystemSetting', 'PriceRule',
        'PageVisitLog', 'EmailLog', 'QueryLog', 'NotificationTag'
    ];
    
    const results = {};
    for (const model of models) {
        // get the model fields from prisma._baseDmmf
        const dmmfModel = prisma._baseDmmf.modelMap[model];
        if (!dmmfModel) continue;
        
        results[model] = {};
        const fields = dmmfModel.fields.filter(f => f.kind === 'scalar');
        
        for (const field of fields) {
            // Find if there is any record where this field is not null
            // We use raw query or Prisma's findFirst
            const record = await prisma[model.toLowerCase()].findFirst({
                where: {
                    [field.name]: {
                        not: null
                    }
                }
            });
            results[model][field.name] = !!record;
        }
    }
    console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
