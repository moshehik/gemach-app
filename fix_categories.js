const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.updateMany({
    where: { key: { in: ['BUFFER_DAYS', 'reserve_permission'] } },
    data: { category: '׳”׳–׳׳ ׳•׳×' }
  });

  await prisma.systemSetting.updateMany({
    where: { key: { in: ['PAYMENT_APPROVAL_LEVEL', 'nedarim_plus_terminal', 'full_refund_days', 'REFUND_DAYS_FROM_ORDER', 'REFUND_REPAIRS', 'NO_REFUND_DAYS_BEFORE_EVENT', 'ENABLE_SET_DISCOUNTS'] } },
    data: { category: '׳×׳©׳׳•׳׳™׳' }
  });

  await prisma.systemSetting.updateMany({
    where: { key: { in: ['require_login', 'inventory_include_warehouse'] } },
    data: { category: '׳›׳׳׳™' }
  });

  await prisma.systemSetting.updateMany({
    where: { key: { in: ['hide_internal_messaging', 'hide_gregorian_calendar', 'hide_ai_features', 'enable_ai_specific_employees'] } },
    data: { category: '׳×׳¦׳•׳’׳”' }
  });

  await prisma.systemSetting.updateMany({
    where: { key: { in: ['print_rental_box1', 'print_rental_box2', 'print_rental_footer'] } },
    data: { category: '׳”׳“׳₪׳¡׳”' }
  });

  // Ensure '׳”׳“׳₪׳¡׳”' and '׳›׳׳׳™' etc have a proper name if they were overwritten
  await prisma.systemSetting.updateMany({
    where: { key: 'inventory_include_warehouse' },
    data: { name: '׳¡׳₪׳™׳¨׳× ׳׳׳׳™ ׳׳—׳¡׳', type: 'boolean', notes: '׳”׳¦׳’ ׳•׳¡׳₪׳•׳¨ ׳‘׳׳׳׳™ ׳’׳ ׳₪׳¨׳™׳˜׳™׳ ׳”׳ ׳׳¦׳׳™׳ ׳‘׳׳—׳¡׳/׳¨׳–׳¨׳‘׳”' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'BUFFER_DAYS' },
    data: { name: '׳™׳׳™ ׳׳¨׳•׳•׳— ׳׳”׳–׳׳ ׳”', type: 'number', notes: '׳׳¡׳₪׳¨ ׳”׳™׳׳™׳ ׳׳₪׳ ׳™ ׳•׳׳—׳¨׳™ ׳×׳׳¨׳™׳ ׳׳™׳¨׳•׳¢ ׳©׳‘׳• ׳”׳©׳׳׳” ׳ ׳—׳©׳‘׳× ׳×׳₪׳•׳¡׳” ׳‘׳׳׳׳™.' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'PAYMENT_APPROVAL_LEVEL' },
    data: { name: '׳׳™׳©׳•׳¨ ׳×׳©׳׳•׳ ׳׳׳ ׳”׳¢׳‘׳¨׳× ׳׳©׳¨׳׳™', type: 'text', notes: '׳§׳•׳‘׳¢ ׳׳™ ׳׳•׳¨׳©׳” ׳׳׳©׳¨ ׳×׳©׳׳•׳ (׳›׳׳• ׳׳–׳•׳׳ ׳׳• ׳”׳׳—׳׳”) ׳׳׳ ׳¡׳׳™׳§׳× ׳׳©׳¨׳׳™ (׳›׳•׳׳/׳¢׳•׳‘׳“/׳׳ ׳”׳)' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'nedarim_plus_terminal' },
    data: { name: '׳§׳•׳“ ׳׳•׳¡׳“ ׳ ׳“׳¨׳™׳ ׳₪׳׳•׳¡', type: 'text', notes: '׳”׳§׳•׳“ ׳”׳׳–׳”׳” ׳©׳ ׳”׳׳•׳¡׳“ ׳‘׳׳¢׳¨׳›׳× ׳ ׳“׳¨׳™׳ ׳₪׳׳•׳¡, ׳”׳ ׳“׳¨׳© ׳¢׳‘׳•׳¨ ׳¡׳׳™׳§׳× ׳׳©׳¨׳׳™.' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'ENABLE_SET_DISCOUNTS' },
    data: { name: '׳”׳₪׳¢׳ ׳׳‘׳¦׳¢ ׳¡׳˜׳™׳', type: 'boolean', notes: '׳›׳׳©׳¨ ׳׳§׳•׳— ׳׳–׳׳™׳ ׳©׳׳׳” ׳¨׳׳©׳™׳×, ׳₪׳¨׳™׳˜׳™׳ ׳”׳׳•׳’׳“׳¨׳™׳ ׳›"׳›׳׳•׳ ׳‘..." ׳™׳§׳‘׳׳• ׳–׳™׳›׳•׳™ (׳©׳•׳¨׳× ׳—׳™׳•׳‘ ׳©׳׳™׳׳™׳×)' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'require_login' },
    data: { name: '׳—׳•׳‘׳× ׳”׳×׳—׳‘׳¨׳•׳× ׳׳׳¢׳¨׳›׳×', type: 'boolean', notes: '׳׳©׳×׳׳©׳™׳ ׳™׳¦׳˜׳¨׳›׳• ׳׳”׳–׳™׳ ׳§׳•׳“ ׳¢׳•׳‘׳“ ׳•׳¡׳™׳¡׳׳” ׳‘׳›׳ ׳™׳¡׳” ׳׳׳¢׳¨׳›׳×.' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'print_rental_box1' },
    data: { name: '׳”׳¢׳¨׳•׳× ׳”׳©׳›׳¨׳” - ׳×׳™׳‘׳” 1', type: 'text', notes: '׳”׳˜׳§׳¡׳˜ ׳©׳™׳•׳₪׳™׳¢ ׳‘׳×׳™׳‘׳” ׳”׳¢׳׳™׳•׳ ׳” ׳‘׳”׳“׳₪׳¡׳× ׳›׳¨׳˜׳™׳¡ ׳”׳©׳›׳¨׳”.' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'print_rental_box2' },
    data: { name: '׳”׳¢׳¨׳•׳× ׳”׳©׳›׳¨׳” - ׳×׳™׳‘׳” 2', type: 'text', notes: '׳”׳˜׳§׳¡׳˜ ׳©׳™׳•׳₪׳™׳¢ ׳‘׳×׳™׳‘׳” ׳”׳׳׳¦׳¢׳™׳× ׳‘׳”׳“׳₪׳¡׳× ׳›׳¨׳˜׳™׳¡ ׳”׳©׳›׳¨׳”.' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'print_rental_footer' },
    data: { name: '׳”׳¢׳¨׳•׳× ׳”׳©׳›׳¨׳” - ׳˜׳§׳¡׳˜ ׳×׳—׳×׳•׳ / ׳×׳§׳ ׳•׳', type: 'text', notes: '׳˜׳§׳¡׳˜ ׳—׳×׳™׳׳” ׳©׳™׳•׳₪׳™׳¢ ׳‘׳×׳—׳×׳™׳× ׳›׳¨׳˜׳™׳¡ ׳”׳”׳©׳›׳¨׳”.' }
  });
  await prisma.systemSetting.updateMany({
    where: { key: 'hide_internal_messaging' },
    data: { name: '׳”׳¡׳×׳¨ ׳׳¢׳¨׳›׳× ׳”׳•׳“׳¢׳•׳×', type: 'boolean', notes: '׳”׳¡׳×׳¨ ׳׳× ׳₪׳¢׳׳•׳ ׳”׳”׳×׳¨׳׳•׳× ׳•׳׳¢׳¨׳›׳× ׳”׳”׳•׳“׳¢׳•׳× ׳‘׳™׳ ׳”׳¢׳•׳‘׳“׳™׳ ׳׳”׳׳¢׳¨׳›׳×.' }
  });

  console.log('Fixed categories and names for admin settings');
}

main().catch(console.error).finally(() => prisma.$disconnect());
