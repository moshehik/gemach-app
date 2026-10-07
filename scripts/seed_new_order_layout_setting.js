// new_order_layout (צורת טופס "הזמנה חדשה": 'wizard' = אשף שלבים, 'continuous' = טופס רציף בעמוד אחד נגלל).
// הגדרה כללית (לא ארגונית מטבעה), לכן לפי הנוהל היא חייבת להיות בשני ה-DB - אבל כל גמח עם הערך שלו: ברירת המחדל 'wizard'
// (ההתנהגות הקיימת), ואותו ערך לעולם לא נדרס כאן. הדלקת הטופס הרציף = לשנות את הערך בעמוד ההגדרות (הזמנות -> "מסך ההזמנה")
// או להריץ עם --value=continuous על גמח אחד בכוונה. dry-run כברירת מחדל; כתיבה רק עם --write. לא הורץ בבנייה.
//   node scripts/seed_new_order_layout_setting.js --org=1            (dry-run)
//   node scripts/seed_new_order_layout_setting.js --org=2 --write
//   node scripts/seed_new_order_layout_setting.js --org=2 --value=continuous --write   (נוצר רק אם חסר)
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const KEY = 'new_order_layout';
const NAME = 'צורת טופס הזמנה חדשה (אשף שלבים / עמוד רציף)';
const NOTES = 'באיזו צורה מוצג טופס "הזמנה חדשה" החדש (A5): אשף שלבים (ברירת מחדל) או טופס רציף בעמוד אחד נגלל. אותה לוגיקה ושמירה בשתי הצורות. לא משפיע על האשף הישן.';

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const valueArg = rest.find((a) => a.startsWith('--value='));
  const value = valueArg ? valueArg.slice('--value='.length) : 'wizard';
  if (value !== 'wizard' && value !== 'continuous') throw new Error(`--value must be wizard|continuous (got "${value}")`);
  const { prisma } = connectOrg(org, write);
  try {
    const exists = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    if (exists) {
      console.log(`org${org}: ${KEY} already exists (= ${exists.value}), nothing to do (an existing value is never overwritten here)`);
      return;
    }
    console.log(`org${org}: create ${KEY} = ${value}`);
    if (!write) { console.log('dry-run - pass --write to apply'); return; }
    await prisma.systemSetting.create({ data: { key: KEY, value, name: NAME, category: 'הזמנות', type: 'select', notes: NOTES } });
    console.log(`org${org}: done`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
