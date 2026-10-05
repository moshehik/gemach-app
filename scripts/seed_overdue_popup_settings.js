// מגדיר לנווה יעקב (org 2 בלבד) את כלל חלונית האיחורים (דיווח 749aaf87):
//   overdue_popup_threshold_days = 0   (איחור מתחיל ביום ההחזרה הצפוי עצמו)
//   overdue_popup_after_hour     = 14  (ומשעה 14:00 שעון ישראל)
// הגמח הראשי לא נוגע (ללא השורות הללו החלונית נשארת כמו היום, לפי late_return_threshold_days).
// ברירת מחדל = dry-run; כתיבה רק עם --write. בדיקת host לפני כל כתיבה (ר' seed-bool-setting.js).
//   node scripts/seed_overdue_popup_settings.js --org=2           (dry-run)
//   node scripts/seed_overdue_popup_settings.js --org=2 --write
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const DEFS = [
  { key: 'overdue_popup_threshold_days', value: '0', name: 'חלונית איחורים: ימי איחור', category: 'תצוגה כללית',
    notes: 'כמה ימים אחרי מועד ההחזרה הצפוי משפחה נחשבת מאחרת בחלונית האיחורים. 0 = כבר ביום ההחזרה הצפוי. ריק = לפי late_return_threshold_days.' },
  { key: 'overdue_popup_after_hour', value: '14', name: 'חלונית איחורים: משעה (0-23)', category: 'תצוגה כללית',
    notes: 'ביום האיחור הראשון (כשימי האיחור שווים לסף) המשפחה תופיע בחלונית רק משעה זו, שעון ישראל. ריק = בלי תנאי שעה.' },
];

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  if (org !== 2) throw new Error('This seed is for org 2 (Neve Yaakov) only. Pass --org=2.');
  const { prisma } = connectOrg(org, write);
  try {
    for (const d of DEFS) {
      const exists = await prisma.systemSetting.findUnique({ where: { key: d.key } });
      if (exists && exists.value === d.value) { console.log(`org2: ${d.key} already = ${d.value}`); continue; }
      const action = exists ? 'update' : 'create';
      console.log(`org2: ${action} ${d.key} = ${d.value}${exists ? ` (was ${exists.value})` : ''}`);
      if (!write) continue;
      if (exists) await prisma.systemSetting.update({ where: { key: d.key }, data: { value: d.value } });
      else await prisma.systemSetting.create({ data: { key: d.key, value: d.value, name: d.name, category: d.category, type: 'number', notes: d.notes } });
    }
    console.log(write ? 'org2: done' : 'dry-run - pass --write to apply');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
