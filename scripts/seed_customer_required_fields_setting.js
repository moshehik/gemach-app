// מוסיף את customer_required_fields (כרטיס הלקוח החדש, תשובת הבעלים 4.10.2026: "מקום בהגדרות לקבוע איזה שדות הם חובה").
// CC-O7 (תשובת הבעלים 4.10.2026): הערך שנזרע לא קבוע ולא זהה לשני הגמחים - הוא מחושב לכל ארגון בקריאה בלבד מהגדרות החובה
// שהארגון כבר קבע (require_customer_email, require_full_address, require_customer_id_number [נווה יעקב], mandatory_fields)
// על גבי הבסיס שם פרטי + שם משפחה + טלפון, כך שכל גמח שומר את השדות שכבר דרש (lib/customerRequiredFields.js
// computeCustomerRequiredFieldsFromLegacy). ה-dry-run מדפיס את הערך המחושב + ה-host + מקור כל שדה, לאישור הבעלים לפני כל כתיבה.
//
// כלל הבטיחות של הריפו (memory: org1/org2 settings cross-contamination) - לא הורץ ולא מורץ אוטומטית:
//   * --org=1|2 חובה (אין ברירת מחדל לגמח הראשי);
//   * ברירת המחדל היא DRY-RUN (קריאה בלבד): מדפיס את ה-host של ה-DB והערך שהיה נכתב, בלי לכתוב;
//   * כתיבה רק עם --apply וגם --expect-host=<תחילית ה-host שהודפסה ב-dry-run> שתואמת.
//   node scripts/seed_customer_required_fields_setting.js --org=2
//   node scripts/seed_customer_required_fields_setting.js --org=2 --apply --expect-host=ep-xxxx
// אידמפוטנטי (לא דורס ערך קיים).
'use strict';

const KEY = 'customer_required_fields';
// שדות ההגדרה בלי ה-value (הערך מחושב לכל ארגון - ר' main).
const ROW_BASE = {
  key: KEY,
  name: 'שדות חובה בכרטיס לקוח',
  category: 'הזמנות',
  type: 'text',
  notes: 'השדות שחייבים להיות מלאים בכרטיס הלקוח החדש - נבדק בכל שמירה (עריכה ולקוח חדש), במסך ובשרת.',
};

// ההגדרות שמהן מחושב הערך (קריאה בלבד).
const SOURCE_KEYS = ['require_customer_email', 'require_full_address', 'require_customer_id_number', 'mandatory_fields', 'strict_mandatory_fields', 'mandatory_field_groups', 'require_marketing_consent'];

/** הערך של הארגון מתוך מפת ההגדרות הקיימות שלו (ESM של lib נטען דינמית). */
async function computeValue(settingsMap) {
  const lib = await import('../lib/customerRequiredFields.js');
  return lib.computeCustomerRequiredFieldsFromLegacy(settingsMap);
}

/** פענוח דגלים בלי גישה ל-DB. זורק על --org חסר/לא תקין. */
function parseArgs(argv) {
  let org = null;
  let apply = false;
  let expectHost = null;
  for (const a of argv) {
    const m = /^--org=(.*)$/.exec(a);
    if (m) org = m[1];
    else if (a === '--apply') apply = true;
    else if (a.startsWith('--expect-host=')) expectHost = a.slice('--expect-host='.length).trim() || null;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (org === null) throw new Error('--org=1|2 is required (no default org)');
  if (org !== '1' && org !== '2') throw new Error(`--org must be 1 or 2, got ${org}`);
  if (apply && !expectHost) throw new Error('--apply requires --expect-host=<host prefix printed by the dry run>');
  return { org: Number(org), apply, expectHost };
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return '(unparsable url)'; }
}

/** האם מותר לכתוב ל-host הזה. */
function hostMatches(host, expectHost) {
  return !!expectHost && typeof host === 'string' && host.startsWith(expectHost);
}

async function main() {
  const { org, apply, expectHost } = parseArgs(process.argv.slice(2));
  const { resolveDbUrl } = require('./lib/db-env');
  const url = resolveDbUrl(org);
  const host = hostOf(url);
  console.log(`org${org}: target DB host = ${host}`);
  if (apply && !hostMatches(host, expectHost)) {
    throw new Error(`SAFETY ABORT: host ${host} does not start with --expect-host=${expectHost}`);
  }
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: [KEY, ...SOURCE_KEYS] } } }); // קריאה בלבד
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const exists = rows.find((r) => r.key === KEY);
    if (exists) {
      console.log(`org${org}: already exists, nothing to do: ${KEY} = ${exists.value}`);
      return;
    }
    const computed = await computeValue(map);
    for (const k of SOURCE_KEYS) console.log(`org${org}:   source ${k} = ${map.has(k) ? JSON.stringify(map.get(k)) : '(not set)'}`);
    for (const k of computed.keys) console.log(`org${org}:   field ${k} <- ${computed.reasons[k].join(', ')}`);
    if (map.get('mandatory_field_groups')) console.log(`org${org}:   note: mandatory_field_groups and require_marketing_consent stay enforced separately on creation (not expressible as fields)`);
    if (!apply) {
      console.log(`org${org}: DRY RUN - would create ${KEY} = ${computed.value} on host ${host}. Owner approval needed, then re-run with --apply --expect-host=${host.split('.')[0]}`);
      return;
    }
    await prisma.systemSetting.create({ data: { ...ROW_BASE, value: computed.value } });
    console.log(`org${org}: added setting ${KEY} = ${computed.value}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
}

module.exports = { parseArgs, hostMatches, hostOf, ROW_BASE, SOURCE_KEYS, computeValue };
