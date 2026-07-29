const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const nameMap = {
  'max_items_per_order': 'כמות פריטים מקסימלית להזמנה',
  'item_locations': 'מיקומי פריטים',
  'useModelNames': 'השתמש בשמות דגמים',
  'NEDARIM_MOSAD': 'קוד מוסד נדרים פלוס',
  'useFileNamesForImages': 'השתמש בשמות קבצים לתמונות',
  'enable_alterations': 'אפשר תיקונים',
  'REFUND_DAYS': 'ימי זכאות להחזר',
  'REFUND_PERCENTAGE': 'אחוז החזר',
  'REFUND_DAYS_FROM_ORDER': 'ימי החזר מיום ההזמנה',
  'REFUND_REPAIRS': 'החזר על תיקונים',
  'barcodePrefixLength': 'אורך קידומת ברקוד',
  'NO_REFUND_DAYS_BEFORE_EVENT': 'ימים ללא החזר לפני אירוע'
};

async function main() {
  const allSettings = await prisma.systemSetting.findMany();
  
  let deletedCount = 0;
  let updatedCount = 0;

  for (const setting of allSettings) {
    // 1. Check for corrupt keys or values
    if (/^\d+$/.test(setting.key) || setting.value === '[object Object]') {
      console.log(`Deleting corrupt setting: ${setting.key}`);
      await prisma.systemSetting.delete({ where: { id: setting.id } });
      deletedCount++;
      continue;
    }

    // 2. Fix English names
    if (nameMap[setting.key] && setting.name === setting.key) {
      console.log(`Renaming ${setting.key} to ${nameMap[setting.key]}`);
      await prisma.systemSetting.update({
        where: { id: setting.id },
        data: { name: nameMap[setting.key] }
      });
      updatedCount++;
    }

    // 3. Fix garbled text in item_locations
    if (setting.key === 'item_locations' && setting.value && setting.value.includes('\uFFFD')) {
      console.log(`Clearing garbled item_locations value`);
      await prisma.systemSetting.update({
        where: { id: setting.id },
        data: { value: '' }
      });
      updatedCount++;
    }
  }

  console.log(`Validation complete. Deleted ${deletedCount} corrupt settings. Updated ${updatedCount} settings.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
