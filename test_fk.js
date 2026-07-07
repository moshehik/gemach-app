const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('PRAGMA foreign_key_list(OrderItem)').then(x => {console.log(x); process.exit(0);});
