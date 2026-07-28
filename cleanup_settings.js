const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ACTIVE_SETTINGS = [
  'max_items_per_order',
  'item_locations',
  'useModelNames',
  'NEDARIM_MOSAD',
  'useFileNamesForImages',
  'require_login',
  'ENABLE_SET_DISCOUNTS',
  'hide_ai_features',
  'enable_alterations',
  'REFUND_DAYS',
  'hide_dress_images',
  'hide_gregorian_calendar',
  'REFUND_PERCENTAGE',
  'REFUND_DAYS_FROM_ORDER',
  'REFUND_REPAIRS',
  'enable_ai_specific_employees',
  'barcodePrefixLength',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'inventory_include_warehouse',
  'print_rental_box1',
  'print_rental_box2',
  'print_rental_footer',
  'hide_internal_messaging',
  'BRAND_LOGO'
];

async function main() {
  const allSettings = await prisma.systemSetting.findMany();
  
  let deletedCount = 0;
  for (const setting of allSettings) {
    if (!ACTIVE_SETTINGS.includes(setting.key)) {
      console.log(`Deleting unused setting: ${setting.key}`);
      await prisma.systemSetting.delete({
        where: { id: setting.id }
      });
      deletedCount++;
    }
  }
  
  console.log(`Cleanup complete. Deleted ${deletedCount} unused settings.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
