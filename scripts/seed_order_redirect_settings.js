// Seeds order_new_redirect_screen / order_edit_redirect_screen (feature: configurable
// screen to jump to after finishing a new order / finishing edits to an existing order -
// see lib/orderRedirectScreens.js for the screen list + resolver, app/orders/new/page.js
// and app/orders/[id]/page.js's handleExit for where they're consumed).
//
// These are generic settings (not org-specific by nature), so per the standing procedure
// in CLAUDE.md ("Settings-panel structural sync...") both keys must exist in BOTH orgs'
// DBs, but with each org's own requested value - never copy one org's value onto the
// other. Idempotent: only creates a row if the key doesn't already exist, never
// overwrites an existing value.
//
// Usage:
//   node scripts/seed_order_redirect_settings.js org1   (main gemach - uses .env's own
//     PROD_DATABASE_URL, values preserve the CURRENT behavior: 'order'/'orders_list')
//   node scripts/seed_order_redirect_settings.js org2   (Neve Yaakov - reads
//     scratch/new_gemach_db.env's PROD_DATABASE_URL fresh at run time, per the "org-2's
//     DB host changes over time" lesson in CLAUDE.md; values requested: 'new_order' both)

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const crypto = require('crypto');

const ORG = process.argv[2];
if (ORG !== 'org1' && ORG !== 'org2') {
  console.error('Usage: node scripts/seed_order_redirect_settings.js <org1|org2>');
  process.exit(1);
}

function resolveUrl() {
  if (ORG === 'org1') {
    const envText = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
    const m = envText.match(/^PROD_DATABASE_URL="([^"]+)"/m);
    if (!m) throw new Error('PROD_DATABASE_URL not found in .env');
    return m[1];
  }
  const envText = fs.readFileSync(path.resolve(__dirname, '../scratch/new_gemach_db.env'), 'utf8');
  const m = envText.match(/^PROD_DATABASE_URL="([^"]+)"/m);
  if (!m) throw new Error('PROD_DATABASE_URL not found in scratch/new_gemach_db.env');
  return m[1];
}

// Values preserve each org's CURRENT effective behavior, except where the owner
// explicitly asked for a different one:
//   org1 (main gemach): keep current behavior - new order -> the order just created;
//     finishing edits (exit) -> orders list (unchanged from before this feature).
//   org2 (Neve Yaakov): owner asked for "new order" in both cases.
const VALUES = {
  org1: { order_new_redirect_screen: 'order', order_edit_redirect_screen: 'orders_list' },
  org2: { order_new_redirect_screen: 'new_order', order_edit_redirect_screen: 'new_order' },
};

const NAMES = {
  order_new_redirect_screen: 'מסך יעד לאחר יצירת הזמנה חדשה',
  order_edit_redirect_screen: 'מסך יעד לאחר סיום עריכת הזמנה קיימת',
};
const NOTES = {
  order_new_redirect_screen: 'לאיזה מסך לעבור מיד לאחר יצירת הזמנה חדשה בהצלחה (כפתור "יצירה").',
  order_edit_redirect_screen: 'לאיזה מסך לעבור בסיום עריכת הזמנה קיימת - בלחיצה על כפתור היציאה/חזרה מכרטיס ההזמנה (לא בלחיצה על "שמירה" עצמה, שנשארת בכרטיס לאפשר המשך עריכה).',
};

async function main() {
  const url = resolveUrl();
  const host = url.match(/@([^/]+)\//)[1];
  console.error(`[${ORG}] target host:`, host);

  const values = VALUES[ORG];
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const key of Object.keys(values)) {
      const existing = await client.query('SELECT key FROM "SystemSetting" WHERE key = $1', [key]);
      if (existing.rows.length > 0) {
        console.error(`  already exists, skipped: ${key}`);
        continue;
      }
      await client.query(
        `INSERT INTO "SystemSetting" (id, "legacyId", key, value, name, category, notes, type, "updatedAt")
         VALUES ($1, NULL, $2, $3, $4, $5, $6, 'select', now())`,
        [crypto.randomUUID(), key, values[key], NAMES[key], 'הזמנות', NOTES[key]]
      );
      console.error(`  created: ${key} = ${values[key]}`);
    }
  } finally {
    await client.end();
  }
  console.error('Done.');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
