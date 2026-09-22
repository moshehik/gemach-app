// מוסיף את hide_marketing_consent_field (דיווח cd9b9bb9, הגמח הראשי): כשדלוק, תיבת
// "מאשר/ת קבלת דיוורים ועדכונים" לא מוצגת בכלל בטופסי לקוח (הזמנה חדשה, כרטיס לקוח,
// הרשמה עצמית בעמדת לקוח) ואין אכיפה שלה - גם אם require_marketing_consent דלוקה.
// לפי הנוהל ב-CLAUDE.md: המפתח נוצר בשני הגמחים, אבל הערך המבוקש בפועל (true) מוזן
// רק לגמח שביקש (הראשי) - הגמח השני מקבל 'false' ששומר על ההתנהגות הקיימת שלו.
// אידמפוטנטי (לא דורס ערך קיים). node scripts/seed_hide_marketing_consent_field_setting.js --org=1|2
'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

async function main() {
  const { org } = parseOrgArg(process.argv.slice(2));
  const url = resolveDbUrl(org);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const key = 'hide_marketing_consent_field';
    const exists = await prisma.systemSetting.findUnique({ where: { key } });
    if (exists) {
      console.log(`org${org}: already exists, skipped: ${key} = ${exists.value}`);
      return;
    }
    // הגמח הראשי (org1) הוא זה שביקש את ההסרה; נווה יעקב (org2) נשאר עם ההתנהגות הקיימת (false).
    const value = org === 1 ? 'true' : 'false';
    await prisma.systemSetting.create({
      data: {
        key,
        value,
        name: 'הסתר שדה אישור דיוור',
        category: 'הזמנות',
        type: 'boolean',
        notes: 'כשמופעל, תיבת "מאשר/ת קבלת דיוורים ועדכונים" לא מוצגת בכלל בטופסי לקוח ואין אכיפה שלה - גם אם require_marketing_consent דלוקה.',
      },
    });
    console.log(`org${org}: added setting ${key} = ${value}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
