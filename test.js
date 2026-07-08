const { PrismaClient } = require(" @prisma/client\); const p = new PrismaClient(); p.dressModel.findFirst({include: {items: true}}).then(m => console.log(m.items.length));
