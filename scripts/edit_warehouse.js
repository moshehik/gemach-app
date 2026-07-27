const fs = require('fs');
const path = require('path');

// --- 1. Edit app/api/dresses/route.js ---
let dressesApi = fs.readFileSync('app/api/dresses/route.js', 'utf8');

dressesApi = dressesApi.replace(
  /const eventDateStr = searchParams\.get\('eventDate'\);/,
  `const eventDateStr = searchParams.get('eventDate');
    const warehouseSetting = await prisma.systemSetting.findUnique({ where: { key: 'inventory_include_warehouse' } });
    const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';`
);

dressesApi = dressesApi.replace(
  /const isUnusable = item\.inRepair \|\| item\.notInUse \|\| item\.isDeleted \|\|[\s\n]*\(item\.location && \(item\.location\.includes\('מחסן'\) \|\| item\.location\.includes\('warehouse'\) \|\| item\.location\.includes\('רזרבה'\) \|\| item\.location\.includes\('reserve'\)\)\);/,
  `const isWarehouse = item.location && (item.location.includes('מחסן') || item.location.includes('warehouse') || item.location.includes('רזרבה') || item.location.includes('reserve'));
        const isUnusable = item.inRepair || item.notInUse || item.isDeleted || (!includeWarehouse && isWarehouse);`
);

dressesApi = dressesApi.replace(
  /isDeleted: i\.isDeleted,/,
  `isDeleted: i.isDeleted,
          isUnusable: i.inRepair || i.notInUse || i.isDeleted || (!includeWarehouse && (i.location && (i.location.includes('מחסן') || i.location.includes('warehouse') || i.location.includes('רזרבה') || i.location.includes('reserve')))),`
);

fs.writeFileSync('app/api/dresses/route.js', dressesApi, 'utf8');

// --- 2. Edit lib/inventory.js ---
let inventory = fs.readFileSync('lib/inventory.js', 'utf8');

// Function 1: getAvailableInventory
inventory = inventory.replace(
  /const minDate = new Date\(targetMinDate\);/,
  `const minDate = new Date(targetMinDate);
  const warehouseSetting = await prisma.systemSetting.findUnique({ where: { key: 'inventory_include_warehouse' } });
  const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';`
);

inventory = inventory.replace(
  /OR: \[\s*\{\s*location: null\s*\},[\s\n]*\{\s*AND: \[\s*\{\s*location: \{\s*not: \{\s*contains: 'מחסן'\s*\}\s*\}\s*\},[\s\n]*\{\s*location: \{\s*not: \{\s*contains: 'רזרבה'\s*\}\s*\}\s*\},[\s\n]*\{\s*location: \{\s*not: \{\s*contains: 'warehouse'\s*\}\s*\}\s*\},[\s\n]*\{\s*location: \{\s*not: \{\s*contains: 'reserve'\s*\}\s*\}\s*\}\s*\]\s*\}\s*\]/g,
  `...(includeWarehouse ? {} : {
        OR: [
          { location: null },
          {
            AND: [
              { location: { not: { contains: 'מחסן' } } },
              { location: { not: { contains: 'רזרבה' } } },
              { location: { not: { contains: 'warehouse' } } },
              { location: { not: { contains: 'reserve' } } }
            ]
          }
        ]
      })`
);

// Function 2: getBulkAvailableInventory
inventory = inventory.replace(
  /const weekendSetting = settingsRaw\.find\(s => s\.key === 'inventory_skip_weekends'\);[\s\n]*if \(weekendSetting\) skipWeekends = weekendSetting\.value === 'true';/,
  `const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
  if (weekendSetting) skipWeekends = weekendSetting.value === 'true';
  const warehouseSetting = settingsRaw.find(s => s.key === 'inventory_include_warehouse');
  const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';`
);

fs.writeFileSync('lib/inventory.js', inventory, 'utf8');

// --- 3. Edit app/customer-interface/page.js ---
let clientUi = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// Fix zoom CSS -> apply style zoom instead of var(--grid-min-width)
clientUi = clientUi.replace(
  /<div className="modern-grid" style=\{\{ '--grid-min-width': `\$\{280 \* zoomLevel\}px` \}\}>/,
  `<div className="modern-grid" style={{ zoom: zoomLevel }}>`
);

// Completely skip unusable items in UI Map
clientUi = clientUi.replace(
  /if \(item\.notInUse \|\| item\.isDeleted\) return;/,
  `if (item.notInUse || item.isDeleted || item.isUnusable) return;`
);

// Change showZeroSizes text
clientUi = clientUi.replace(
  /הצג חסרים במלאי \(0\)/,
  `הצג חסרים במלאי (תפוסה מלאה)`
);

fs.writeFileSync('app/customer-interface/page.js', clientUi, 'utf8');
