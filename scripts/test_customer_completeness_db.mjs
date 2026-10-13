// השוואת "לקוח תקין" מול נתוני DB אמיתיים - קריאה בלבד, ורק מול TEST (נעצר אם ה-DB אינו TEST_DATABASE_URL).
// בודק שלוש צורות של אותה הגדרה (lib/customerCompleteness.js) נותנות בדיוק אותה קבוצת לקוחות, לכל מדיניות:
//   1. בדיקה בזיכרון (isCustomerComplete) על כל הלקוחות הפעילים   2. SQL מדויק (completeIdsSql)   3. תנאי Prisma גסים + id NOT IN של שוליים (מה שהשרת מריץ)
// שימוש:  node --no-warnings --import ./scripts/new-order-tests/register.mjs scripts/test_customer_completeness_db.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildCompletenessSpec, isCustomerComplete, prismaCompleteConditions, completeEdgeSql, completeIdsSql } from '../lib/customerCompleteness.js';
import { normalizeEmail } from '../lib/emailUtils.js';

const PROJ = process.env.PROJ || process.cwd();
for (const f of ['.env']) {
  for (const line of fs.readFileSync(path.join(PROJ, f), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const host = (u) => (String(u).match(/@([^/?]+)/) || [])[1];
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL missing');
const require = createRequire(path.join(PROJ, 'package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url } } });
console.log('DB host (TEST only):', host(url));

const SETS = {
  'ראשי (מייל + כתובת, בלי ת"ז)': { require_customer_email: 'true', require_full_address: 'true', hide_marketing_consent_field: 'true' },
  'נווה (ת"ז + כתובת + דיוור)': { require_customer_email: 'false', require_full_address: 'true', require_customer_id_number: 'true', require_marketing_consent: 'true' },
  'מינימלי (ברירות מחדל)': {},
  'mandatory_fields: מייל,עיר,רחוב': { mandatory_fields: 'אימייל,עיר,רחוב' },
  'בלי קבוצות': { mandatory_field_groups: '[]' },
  'שתי קבוצות + customer_required_fields': { mandatory_field_groups: '[["phone2","email"],["city","street"]]', customer_required_fields: 'firstName,lastName,phone1,zeout' },
};

let bad = 0;
try {
  const live = Object.fromEntries((await prisma.systemSetting.findMany()).map((r) => [r.key, r.value]));
  SETS['הגדרות TEST בפועל'] = live;
  const rows = await prisma.customer.findMany({ where: { isDeleted: false }, select: { id: true, firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true, email: true, emailSuffix: true, zeout: true, marketingConsent: true, notes: true, officeNotes: true, bankName: true, bankBranch: true, bankAccount: true, bankAccountName: true } });
  console.log('active customers:', rows.length);
  for (const [name, settings] of Object.entries(SETS)) {
    const spec = buildCompletenessSpec(settings);
    const js = new Set(rows.filter((c) => isCustomerComplete(c, spec)).map((c) => c.id));
    const sqlIds = new Set((await prisma.$queryRawUnsafe(completeIdsSql(spec))).map((r) => r.id));
    const edgeSql = completeEdgeSql(spec);
    const edge = edgeSql ? (await prisma.$queryRawUnsafe(edgeSql)).map((r) => r.id) : [];
    const where = { AND: [{ isDeleted: false }, ...prismaCompleteConditions(spec), ...(edge.length ? [{ id: { notIn: edge } }] : [])] };
    const prismaIds = new Set((await prisma.customer.findMany({ where, select: { id: true } })).map((r) => r.id));
    const diff = (a, b) => [...a].filter((x) => !b.has(x));
    const okSql = diff(js, sqlIds).length === 0 && diff(sqlIds, js).length === 0;
    const okPrisma = diff(js, prismaIds).length === 0 && diff(prismaIds, js).length === 0;
    if (!okSql || !okPrisma) bad++;
    console.log(`${okSql && okPrisma ? 'OK ' : 'BAD'} ${name}: מפתחות=[${spec.keys}] קבוצות=${JSON.stringify(spec.groups)} | תקינים=${js.size} (sql=${sqlIds.size}, prisma=${prismaIds.size}) מתוך ${rows.length} | שוליים=${edge.length}`);
    if (!okSql) console.log('   sql diff', diff(js, sqlIds).slice(0, 3), diff(sqlIds, js).slice(0, 3));
    if (!okPrisma) console.log('   prisma diff', diff(js, prismaIds).slice(0, 3), diff(prismaIds, js).slice(0, 3));
  }
  // דוגמאות שוליים: ערכי רווחים בלבד / מיילים מיוחדים שקיימים בנתונים
  const ws = rows.filter((c) => ['firstName', 'lastName', 'phone1', 'city', 'street', 'zeout'].some((k) => c[k] && !String(c[k]).trim())).length;
  const junkMail = rows.filter((c) => (c.email || c.emailSuffix) && !normalizeEmail(c.email, c.emailSuffix)).length;
  console.log(`edge data in TEST: whitespace-only text values=${ws}, junk emails=${junkMail}`);
} finally {
  await prisma.$disconnect();
}
process.exit(bad ? 1 : 0);
