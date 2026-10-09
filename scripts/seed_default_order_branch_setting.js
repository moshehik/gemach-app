// default_order_branch (ניהול -> סניפים): הסניף שנבחר מראש בשדה "סניף ביצוע" בהזמנה חדשה. ריק = בלי ברירת מחדל (ההתנהגות הנוכחית אחרי
// שהוסרה "זכירת הסניף האחרון"). נוצר רק אם חסר, בערך ריק; ערך קיים לעולם לא נדרס. הערך עצמו נקבע בעמוד ההגדרות (או --value=<שם סניף> בכוונה).
// dry-run כברירת מחדל; כתיבה רק עם --write.
//   node scripts/seed_default_order_branch_setting.js --org=1            (dry-run)
//   node scripts/seed_default_order_branch_setting.js --org=2 --write
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const KEY = 'default_order_branch';
const NAME = 'סניף ביצוע - ברירת מחדל בהזמנה חדשה';
const NOTES = 'הסניף שיהיה תמיד נבחר מראש בשדה "סניף ביצוע" בהזמנה חדשה (שם מדויק מתוך רשימת הסניפים). ריק = בלי ברירת מחדל.';

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const valueArg = rest.find((a) => a.startsWith('--value='));
  const value = valueArg ? valueArg.slice('--value='.length) : '';
  const { prisma } = connectOrg(org, write);
  try {
    const exists = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    if (exists) {
      console.log(`org${org}: ${KEY} already exists (= "${exists.value}"), nothing to do (an existing value is never overwritten here)`);
      return;
    }
    console.log(`org${org}: create ${KEY} = "${value}"`);
    if (!write) { console.log('dry-run - pass --write to apply'); return; }
    await prisma.systemSetting.create({ data: { key: KEY, value, name: NAME, category: 'סניפים', type: 'text', notes: NOTES } });
    console.log(`org${org}: done`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
