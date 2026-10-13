#!/usr/bin/env node
/**
 * נווה יעקב (org2) בלבד: הממשק החדש ("A5") הופך לברירת המחדל של כל העובדות בכל מסך שיש לו גרסה חדשה (בקשת הבעלים 12.10.2026:
 * "כל האתר יעלה ויפתח כברירת מחדל לכל העובדות בגמ"ח נווה, ותשאיר את האופציה לחזור לקודם").
 *
 * איך: שורת SystemSetting `ui_variant_<screen>` = 'a5' לכל מסך ברשומה (lib/uiVariantScreens.js) עם legacyExists && newExists. סדר ההכרעה
 * (lib/uiVariant.js): עקיפה אישית של העובדת > הגדרת הארגון > ברירת מחדל לפי תפקיד. לכן עובדת שנכנסת בלי העדפה שמורה מקבלת חדש, ועובדת
 * שבחרה בעצמה (עקיפה אישית) נשארת עם בחירתה - וגם יכולה לחזור לחדש בלחצן "חזרה לממשק החדש" שבכותרת הישנה. האפשרות לחזור לישן נשארת
 * (אייקון המעבר בכל מסך, "האתר הישן" בתפריט החדש, "עיצוב ותצוגה"). הגמ"ח הראשי לא נוגע: הסקריפט מסרב לרוץ מול org1.
 *
 * הרשימה נגזרת מהרשומה (מסך חדש שנוסף בעתיד ייכנס בהרצה הבאה). לא נוגע ב-login_page_new (דף הכניסה החדש כבר ברירת מחדל).
 *
 *   node scripts/seed_neve_new_ui_default.js --org=2                                  (dry-run: מדפיס שורות הארגון + עקיפות אישיות קיימות)
 *   node scripts/seed_neve_new_ui_default.js --org=2 --write --confirm-host <ep-xxxx>  (כותב את הגדרות הארגון; הבעלים מאשר בזמן ההרצה)
 *   ... --clear-user-legacy-overrides  (רק עם --write) מסיר בנוסף עקיפות אישיות 'legacy' של עובדות פעילות במסכים האלה (במקום לכתוב להן a5),
 *                                      כך שגם הן יקבלו את ברירת המחדל החדשה ושינוי ארגוני עתידי עדיין יחול עליהן. ברירת מחדל: לא נוגעים בבחירות אישיות.
 *   --use-test-db  מריץ מול TEST_DATABASE_URL (בדיקות מקומיות בלבד; בלי בדיקת זהות נווה). אסור לשלב עם --org=2 מול ייצור.
 *
 * בטיחות: org1 נדחה; ה-host חייב להיות שונה מה-host של org1; שם הגמ"ח (gmach_name) חייב להכיל "נווה"; כתיבה דורשת --write ו---confirm-host
 * שווה בדיוק ל-endpoint של ה-DB (ep-xxxx). dry-run כברירת מחדל. הכתיבה עוברת דרך Prisma רגיל (בלי AuditLog אוטומטי - הסקריפט מדפיס קודם -> חדש).
 */
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { PrismaClient } = require('@prisma/client');
const { loadEnvFiles, parseOrgArg, resolveDbUrl } = require('./lib/db-env');
const { applyUserVariant, endpointId, describeDbTarget } = require('./set-ui-variant');

const ROOT = path.join(__dirname, '..');
const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; } };

async function loadScreens() {
  const reg = await import(pathToFileURL(path.join(ROOT, 'lib', 'uiVariantScreens.js')).href);
  const prefs = await import(pathToFileURL(path.join(ROOT, 'lib', 'designPrefsSchema.js')).href);
  const screens = reg.UI_SCREEN_REGISTRY.filter((s) => s.legacyExists && s.newExists).map((s) => s.id);
  return { screens, labelOf: (id) => (reg.getScreenEntry(id) || {}).label || id, parseStoredDesignPrefs: prefs.parseStoredDesignPrefs };
}

function parseArgs(argv) {
  const { org, rest } = parseOrgArg(argv);
  const o = { org, write: false, clearLegacy: false, useTest: false, confirmHost: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--write') o.write = true;
    else if (a === '--clear-user-legacy-overrides') o.clearLegacy = true;
    else if (a === '--use-test-db') o.useTest = true;
    else if (a === '--confirm-host') o.confirmHost = rest[++i];
    else if (a.startsWith('--confirm-host=')) o.confirmHost = a.slice('--confirm-host='.length);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (o.clearLegacy && !o.write) throw new Error('--clear-user-legacy-overrides requires --write');
  return o;
}

async function main() {
  const argvHasOrg = process.argv.slice(2).some((a) => /^--org=/.test(a));
  const o = parseArgs(process.argv.slice(2));
  loadEnvFiles();

  let url;
  if (o.useTest) {
    url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('--use-test-db: TEST_DATABASE_URL is not set');
  } else {
    if (!argvHasOrg || o.org !== 2) throw new Error('This script targets Neve Yaakov only: pass --org=2 (org 1 / the main gemach is refused)');
    url = resolveDbUrl(2);
    const mainHost = hostOf(process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || '');
    if (!hostOf(url) || hostOf(url) === mainHost) throw new Error(`SAFETY ABORT: org2 host "${hostOf(url)}" is empty or equals the main gemach's host`);
  }
  const target = describeDbTarget(url);
  console.log(`DB host: ${target.host} | mode: ${o.write ? 'WRITE' : 'dry-run'}${o.useTest ? ' | TEST DB (--use-test-db)' : ''}`);
  if (o.write && !o.useTest) {
    const f = String(o.confirmHost || '').trim().toLowerCase();
    if (f.length < 8 || (f !== target.host.toLowerCase() && f !== endpointId(target.host))) {
      throw new Error(`--confirm-host must equal the DB host or its ep-xxxx endpoint id (got "${o.confirmHost || ''}")`);
    }
  }

  const { screens, labelOf, parseStoredDesignPrefs } = await loadScreens();
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    if (!o.useTest) {
      const nameRow = await prisma.systemSetting.findUnique({ where: { key: 'gmach_name' } });
      if (!nameRow || !/נווה/.test(nameRow.value || '')) throw new Error(`SAFETY ABORT: gmach_name is ${JSON.stringify(nameRow && nameRow.value)} - this is not Neve Yaakov`);
      console.log(`gmach_name = ${nameRow.value}  (identity OK)`);
    }

    console.log(`\nOrg settings (${screens.length} screens with both versions):`);
    let changes = 0;
    for (const id of screens) {
      const key = `ui_variant_${id}`;
      const row = await prisma.systemSetting.findUnique({ where: { key } });
      const cur = row ? row.value : null;
      const action = cur === 'a5' ? 'ok' : (row ? 'update' : 'create');
      console.log(`  ${key.padEnd(34)} ${String(cur === null ? '(no row)' : cur).padEnd(8)} -> a5   [${action}]  ${labelOf(id)}`);
      if (action === 'ok') continue;
      changes++;
      if (o.write) {
        // category נשאר ריק בכוונה (כמו scripts/set-ui-variant.js): אף פקד גלוי לא מתווסף למסך ההגדרות.
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: 'a5' },
          create: { key, value: 'a5', name: `${key} (internal rollout flag)`, type: 'text' },
        });
      }
    }
    console.log(`${changes} setting(s) ${o.write ? 'written' : 'would change'}.`);

    console.log('\nExplicit personal overrides of active employees (uiVariants in Employee.themeColor):');
    const emps = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, legacyId: true, firstName: true, lastName: true, roleId: true, themeColor: true },
      orderBy: [{ roleId: 'asc' }, { firstName: 'asc' }],
    });
    let withLegacy = 0;
    const toClear = [];
    for (const e of emps) {
      const uv = (parseStoredDesignPrefs(e.themeColor) || {}).uiVariants;
      if (!uv) continue;
      const legacyScreens = screens.filter((s) => uv[s] === 'legacy');
      const name = `${e.firstName || ''} ${e.lastName || ''}`.trim();
      console.log(`  role=${e.roleId} legacyId=${e.legacyId ?? '-'} ${name}: ${legacyScreens.length ? `LEGACY on [${legacyScreens.join(', ')}]` : 'no legacy override'}`);
      if (legacyScreens.length) { withLegacy++; toClear.push({ e, legacyScreens }); }
    }
    console.log(`${withLegacy} employee(s) explicitly keep the OLD design on at least one screen (they keep it unless --clear-user-legacy-overrides is used).`);

    if (o.clearLegacy) {
      for (const { e, legacyScreens } of toClear) {
        for (const s of legacyScreens) {
          const r = await applyUserVariant(prisma, { id: e.id }, s, null, { dry: false });
          console.log(`  cleared uiVariants.${s} for legacyId=${e.legacyId ?? '-'} (${r.status})`);
        }
      }
    }
    if (!o.write) console.log('\nDRY RUN - nothing written. Add --write --confirm-host <ep-xxxx> to apply.');
    else console.log('\nDone. The running app picks the org settings up within ~30s (settings cache); personal cookies refresh on the next full page load.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
