#!/usr/bin/env node
/**
 * מדליק / מכבה גרסת מסך "ישן / A5" (lib/uiVariant.js) בלי שום ממשק גלוי באתר.
 *
 *   4.10.2026: בלי --apply הסקריפט רק מדפיס מה היה משתנה (dry-run הוא ברירת המחדל). כדי לכתוב מוסיפים --apply.
 *
 *   ארגון (SystemSetting ui_variant_<screen>, משפיע על כל העובדים של אותו גמ"ח):
 *     node scripts/set-ui-variant.js --screen order_card --value a5 --scope org --confirm-host <host-מלא | ep-xxxx> [--apply]
 *
 *   עובד בודד (Employee.themeColor JSON, מפתח uiVariants; עוקף את הארגון):
 *     node scripts/set-ui-variant.js --screen shell --value a5 --scope user --employee <id|legacyId> --confirm-host <...> [--apply]
 *     node scripts/set-ui-variant.js --screen shell --clear   --scope user --employee <id|legacyId> --confirm-host <...> --apply  (הסרת העקיפה)
 *
 *   --screen  shell | home | order_card | customer_card | profile | admin_hub | attendance | error_report
 *             (= המסכים ברשומה lib/uiVariantScreens.js; scripts/test_page_variant_switch.mjs בודק שהרשימות זהות)
 *   בלי שורה בארגון ובלי עקיפה אישית: ברירת המחדל לפי תפקיד (מתכנת - חדש, כל השאר - ישן; החלטת הבעלים 4.10.2026).
 *   --value   legacy | a5
 *   --scope   org | user
 *   --employee  מזהה העובד: UUID, או legacyId (ספרות בלבד)
 *   --clear   (scope=user בלבד) מסיר את העקיפה האישית של המסך במקום לקבוע ערך
 *   --dry-run מדפיס מה היה משתנה, בלי לכתוב (ברירת המחדל; נשאר לתאימות)
 *   --apply   כותב בפועל (בלעדיו - dry-run). לא יחד עם --dry-run.
 *   --confirm-host  חובה: שם ה-host המלא של ה-DB, או מזהה ה-endpoint המלא שלו (ep-xxxx, עם או בלי -pooler).
 *                   לפחות 8 תווים; התאמה מדויקת בלבד (לא תת-מחרוזת כמו "neon"). בלי התאמה הסקריפט מסרב לרוץ.
 *   --i-know-this-is-prod  נדרש לכל DB שלא זוהה בוודאות כ"לא ייצור" (ר' למטה) — כלומר כמעט תמיד.
 *   --not-prod  מצהיר שה-DB מקומי (localhost / 127.0.0.1 / ::1 / *.localhost / *.test / *.local). מתקבל רק כשה-host
 *               באמת כזה; לא מתקבל ל-host של Neon, ולא יחד עם --i-know-this-is-prod.
 *
 * ה-DB: DATABASE_URL מהסביבה (נטען מ-.env.local/.env של הריפו אם לא הוגדר בתהליך). שני הגמ"חים הם שני
 * DB נפרדים — כדי לפנות ל-org2 מייצאים DATABASE_URL של org2 לפני ההרצה (ר' CLAUDE.md, "Settings & the two orgs").
 * הסקריפט מדפיס את שם השרת שאליו יכתוב, ומסרב אם --confirm-host לא מתאים (כלל בדיקת ה-host).
 *
 * זיהוי ייצור — סגור-בכישלון (fail-closed): כל DB נחשב ייצור, אלא אם זוהה בוודאות כלא-ייצור:
 *   (א) ה-endpoint שלו שווה לזה של TEST_DATABASE_URL בסביבה, או
 *   (ב) ניתן --not-prod וה-host הוא host מקומי (ר' LOCAL_DEV_HOST_RE).
 * כל מקרה אחר — כולל worktree נקי שבו יש רק DATABASE_URL בלי PROD_DATABASE_URL*, host של Neon שאינו ברשימה,
 * ו-localhost בלי --not-prod — דורש --i-know-this-is-prod (גם ל---dry-run). DATABASE_URL עצמו לעולם לא
 * נחשב "מוכר": העובדה שהוא מוגדר לא אומרת כלום על זהותו. PROD_DATABASE_URL / _ORG2 / DATABASE_URL_ORG2
 * רק מוסיפים תווית ברורה ("PROD (main gemach)") ומונעים --not-prod בטעות.
 *
 * הכתיבה עוברת דרך Prisma client רגיל. שים לב: הרחבת ה-AuditLog של האפליקציה (app/lib/prisma.js) נטענת
 * רק בתוך Next (היא תלויה ב-@/ וב-next/headers), ולכן כתיבה מסקריפט עצמאי לא נרשמת ביומן — הסקריפט
 * מדפיס במקום זה ערך קודם → חדש, ולא כותב שורות AuditLog ידנית.
 */

'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');

// אותה רשימה כמו UI_SCREEN_IDS ב-lib/uiVariantScreens.js (הסקריפט CommonJS סינכרוני; הבדיקה משווה בין השתיים).
const SCREENS = ['shell', 'home', 'order_card', 'customer_card', 'profile', 'admin_hub', 'attendance', 'error_report'];
const VALUES = ['legacy', 'a5'];
const SCOPES = ['org', 'user'];
const KNOWN_FLAGS = new Set(['screen', 'value', 'scope', 'employee', 'confirm-host', 'dry-run', 'apply', 'clear', 'help', 'i-know-this-is-prod', 'not-prod']);
const BOOLEAN_FLAGS = new Set(['dry-run', 'apply', 'clear', 'help', 'i-know-this-is-prod', 'not-prod']);
const MIN_CONFIRM_HOST = 8; // מחרוזת אישור קצרה מדי ("ep", "neon") לא מזהה שרת
const MAX_CAS_ATTEMPTS = 3; // ניסיונות compare-and-swap לכתיבת themeColor של עובד
// משתני הסביבה שמצביעים על DB-ים מוכרים: [שם משתנה, תווית, האם ייצור].
const KNOWN_DB_ENV = [
  ['PROD_DATABASE_URL', 'PROD (main gemach)', true],
  ['PROD_DATABASE_URL_ORG2', 'PROD (org2 / Neve Yaakov)', true],
  ['DATABASE_URL_ORG2', 'org2 (Neve Yaakov)', true], // יכול להיות ה-DB החי של נווה יעקב (scripts/lib/db-env.js)
  ['TEST_DATABASE_URL', 'TEST', false],
];
// hosts שמותר להצהיר עליהם --not-prod: מקומיים בלבד. host של Neon (ep-xxxx…neon.tech) לעולם לא עובר כאן —
// ענף TEST של Neon מזוהה רק דרך TEST_DATABASE_URL בסביבה.
const LOCAL_DEV_HOST_RE = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:localhost|test|local))$/i;
const MAX_PREFS_BYTES = 8192; // אותה מגבלה כמו PUT /api/me/design-prefs

const USAGE = [
  'Usage:',
  `  node scripts/set-ui-variant.js --screen <${SCREENS.join('|')}> --value <legacy|a5> --scope org --confirm-host <full DB host | ep-xxxx> [--apply]`,
  '  node scripts/set-ui-variant.js --screen <...> --value <legacy|a5> --scope user --employee <id|legacyId> --confirm-host <...> [--apply]',
  '  node scripts/set-ui-variant.js --screen <...> --clear --scope user --employee <id|legacyId> --confirm-host <...> [--apply]',
  'DRY RUN by default: nothing is written unless --apply is given.',
  'Reads DATABASE_URL from the environment; refuses to run unless --confirm-host EXACTLY matches the DB host (or its full ep-xxxx endpoint id, min 8 chars).',
  'Every database is treated as PRODUCTION and needs --i-know-this-is-prod, unless it is the TEST_DATABASE_URL host',
  'or a local host (localhost / 127.0.0.1 / *.test / *.local) declared with --not-prod. See the header of this file.',
].join('\n');

function settingKey(screen) {
  return `ui_variant_${screen}`;
}

/** מפרק --flag value / --flag=value. זורק Error עם הודעה ברורה על קלט לא תקין. */
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    let name = arg.slice(2);
    let value;
    const eq = name.indexOf('=');
    if (eq !== -1) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    if (!KNOWN_FLAGS.has(name)) throw new Error(`Unknown flag: --${name}`);
    if (BOOLEAN_FLAGS.has(name)) {
      opts[name] = true;
      continue;
    }
    if (value === undefined) {
      value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`Flag --${name} needs a value`);
    }
    opts[name] = value;
  }
  if (opts.help) return opts;

  if (!SCREENS.includes(opts.screen)) throw new Error(`--screen must be one of: ${SCREENS.join(', ')}`);
  if (!SCOPES.includes(opts.scope)) throw new Error(`--scope must be one of: ${SCOPES.join(', ')}`);
  if (opts.clear) {
    if (opts.scope !== 'user') throw new Error('--clear is only for --scope user (for org use --value legacy)');
    if (opts.value !== undefined) throw new Error('--clear and --value are mutually exclusive');
  } else if (!VALUES.includes(opts.value)) {
    throw new Error(`--value must be one of: ${VALUES.join(', ')}`);
  }
  if (opts.scope === 'user') {
    if (!opts.employee || !/^[A-Za-z0-9_-]{1,64}$/.test(opts.employee)) {
      throw new Error('--scope user needs --employee <id or legacyId>');
    }
  } else if (opts.employee !== undefined) {
    throw new Error('--employee is only valid with --scope user');
  }
  if (!opts['confirm-host']) throw new Error('--confirm-host <full DB host or ep-xxxx endpoint id> is required');
  if (opts['not-prod'] && opts['i-know-this-is-prod']) throw new Error('--not-prod and --i-know-this-is-prod are mutually exclusive');
  if (opts.apply && opts['dry-run']) throw new Error('--apply and --dry-run are mutually exclusive');
  return opts;
}

/** host מקומי (Postgres על המחשב / docker) — היחיד שמותר להצהיר עליו --not-prod. */
function isLocalDevHost(host) {
  return LOCAL_DEV_HOST_RE.test(String(host || '').trim().toLowerCase());
}

/** מחלץ host/db מתוך connection string בלי לחשוף סיסמה. */
function describeDbTarget(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  return { host: parsed.hostname, database: parsed.pathname.replace(/^\//, '') || '(default)' };
}

/** מזהה ה-endpoint של Neon מתוך host: התווית הראשונה בלי סיומת -pooler (ep-cool-sky-123456). */
function endpointId(host) {
  const first = String(host || '').trim().toLowerCase().split('.')[0];
  return first.replace(/-pooler$/, '');
}

/** ה-DB-ים המוכרים מהסביבה: [{ env, label, prod, host, endpoint }]. URL לא תקין מדולג. */
function collectKnownDbs(env = process.env) {
  const out = [];
  for (const [name, label, prod] of KNOWN_DB_ENV) {
    const raw = env[name];
    if (!raw) continue;
    try {
      const host = new URL(raw).hostname.toLowerCase();
      out.push({ env: name, label, prod, host, endpoint: endpointId(host) });
    } catch (e) {}
  }
  return out;
}

/**
 * כלל בדיקת ה-host (מחמיר): --confirm-host חייב להיות ה-host המלא של ה-DB, או מזהה ה-endpoint המלא שלו
 * (עם או בלי -pooler) — שוויון מדויק, לא תת-מחרוזת. לפחות 8 תווים.
 *  - מסרב אם המחרוזת מזהה יותר מ-DB מוכר אחד (endpoint שונים) — כשהיא דו-משמעית.
 *  - זיהוי ייצור סגור-בכישלון: prod=true תמיד, אלא אם ה-endpoint הוא של TEST_DATABASE_URL (ולא גם של PROD —
 *    סביבה סותרת = ייצור), או opts.notProd עם host מקומי (isLocalDevHost). opts.notProd על host לא-מקומי או על
 *    DB ייצור מוכר — סירוב. prod בלי opts.allowProd — סירוב. knownDbs ריק (worktree נקי) = הכול ייצור.
 * knownDbs: תוצאת collectKnownDbs(); ברירת מחדל [] (בלי סביבה).
 * @returns {{ok:boolean, prod?:boolean, label?:string|null, reason?:string}}
 */
function checkHost(host, confirm, knownDbs = [], opts = {}) {
  const f = String(confirm || '').trim().toLowerCase();
  if (f.length < MIN_CONFIRM_HOST) {
    return { ok: false, reason: `--confirm-host must be at least ${MIN_CONFIRM_HOST} characters (the full DB host or its ep-xxxx endpoint id)` };
  }
  const h = String(host || '').trim().toLowerCase();
  if (h.includes('%')) {
    return { ok: false, reason: 'DB host contains a percent-encoded character - refusing' };
  }
  const ep = endpointId(h);
  const firstLabel = h.split('.')[0]; // ep-xxxx או ep-xxxx-pooler
  if (!h || (f !== h && f !== ep && f !== firstLabel)) {
    return { ok: false, reason: `--confirm-host "${confirm}" is not the exact DB host or endpoint id of "${host}"` };
  }
  const matched = new Set(knownDbs.filter((k) => f === k.host || f === k.endpoint).map((k) => k.endpoint));
  if (matched.size > 1) {
    return { ok: false, reason: `--confirm-host "${confirm}" matches more than one known database - use the full host` };
  }
  const prodHit = knownDbs.find((k) => k.prod && k.endpoint === ep);
  const testHit = prodHit ? null : knownDbs.find((k) => !k.prod && k.endpoint === ep);
  if (opts.notProd && prodHit) {
    return { ok: false, reason: `--not-prod was given but the target DB is a known PRODUCTION database (${prodHit.label}, from ${prodHit.env})`, prod: true };
  }
  if (opts.notProd && !testHit && !isLocalDevHost(h)) {
    return { ok: false, reason: `--not-prod is only accepted for a local host (localhost / 127.0.0.1 / *.test / *.local); "${host}" is not one and is treated as PRODUCTION. If it is the TEST branch, set TEST_DATABASE_URL to it; otherwise re-run with --i-know-this-is-prod`, prod: true };
  }
  // סגור-בכישלון: ייצור אלא אם זוהה בוודאות אחרת.
  let prod = true;
  let label = prodHit ? prodHit.label : null;
  if (testHit) { prod = false; label = testHit.label; }
  else if (opts.notProd) { prod = false; label = 'local dev (--not-prod)'; }
  if (prod && !opts.allowProd) {
    const why = prodHit
      ? `${prodHit.label}, from ${prodHit.env}`
      : 'not positively identified as non-production, so it is treated as production - fail-closed';
    const hint = prodHit ? '' : '; for the TEST branch set TEST_DATABASE_URL to this host, for a local DB add --not-prod';
    return { ok: false, reason: `the target DB is PRODUCTION (${why}). Re-run with --i-know-this-is-prod if that is really intended${hint}`, prod: true };
  }
  return { ok: true, prod, label };
}

/**
 * בונה את ערך Employee.themeColor החדש (JSON) עם/בלי עקיפה, ושומר את שאר ההעדפות.
 * value=null → מסיר את המסך מ-uiVariants.
 * ערך legacy קיים בעמודה ('standard' וכו') נחשב "אין העדפות" — אותו כלל כמו ב-API.
 */
async function buildUserThemeColor(existingRaw, screen, value) {
  const { parseStoredDesignPrefs, mergeDesignPrefs, sanitizeDesignPrefs } = await import(
    pathToFileURL(path.join(ROOT, 'lib', 'designPrefsSchema.js')).href
  );
  const existing = parseStoredDesignPrefs(existingRaw) || {};
  const nextVariants = { ...(existing.uiVariants || {}) };
  if (value === null) delete nextVariants[screen];
  else nextVariants[screen] = value;

  // mergeDesignPrefs מחליף את uiVariants כולו כשהוא ב-patch; ריק → מסירים את המפתח לגמרי.
  let next = mergeDesignPrefs(existing, { uiVariants: nextVariants });
  if (Object.keys(nextVariants).length === 0) {
    const { uiVariants: _removed, ...rest } = sanitizeDesignPrefs(existing);
    next = { v: 1, ...rest };
  }
  const serialized = JSON.stringify(next);
  if (serialized.length > MAX_PREFS_BYTES) throw new Error('Resulting prefs are too large');
  return { previous: existing.uiVariants ? existing.uiVariants[screen] : undefined, next, serialized };
}

/**
 * כותב עקיפה למשתמש בשיטת compare-and-swap: קורא את Employee.themeColor, בונה JSON חדש וכותב עם
 * updateMany where themeColor = הערך שנקרא. אם מישהו (PUT /api/me/design-prefs) שינה את העמודה בינתיים,
 * count=0 → קוראים מחדש ובונים מחדש. אחרי MAX_CAS_ATTEMPTS כישלונות זורק שגיאה (לא דורס בשקט).
 * @returns {{status:'written'|'dry'|'nothing', employee, built, attempts}}
 */
async function applyUserVariant(prisma, where, screen, newValue, { dry = false, maxAttempts = MAX_CAS_ATTEMPTS } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const employee = await prisma.employee.findFirst({
      where,
      select: { id: true, legacyId: true, firstName: true, lastName: true, isActive: true, themeColor: true },
    });
    if (!employee) throw new Error('Employee not found');
    const built = await buildUserThemeColor(employee.themeColor, screen, newValue);
    if (newValue === null && built.previous === undefined) return { status: 'nothing', employee, built, attempts: attempt };
    if (dry) return { status: 'dry', employee, built, attempts: attempt };
    const res = await prisma.employee.updateMany({
      where: { id: employee.id, themeColor: employee.themeColor },
      data: { themeColor: built.serialized },
    });
    if (res.count === 1) return { status: 'written', employee, built, attempts: attempt };
  }
  throw new Error(`Employee prefs kept changing while writing (${maxAttempts} attempts) - nothing was overwritten; try again`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  require(path.join(__dirname, 'lib', 'db-env.js')).loadEnvFiles();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const target = describeDbTarget(url);
  if (process.env.PROD_DATABASE_URL && process.env.PROD_DATABASE_URL !== url) {
    console.warn('WARNING: PROD_DATABASE_URL is also set and differs from DATABASE_URL - the app itself reads PROD_DATABASE_URL first. This script writes to DATABASE_URL only.');
  }

  const knownDbs = collectKnownDbs();
  console.log(`DB target: host=${target.host} database=${target.database}`);
  const hostCheck = checkHost(target.host, opts['confirm-host'], knownDbs, { allowProd: !!opts['i-know-this-is-prod'], notProd: !!opts['not-prod'] });
  if (hostCheck.ok) console.log(`DB identity: ${hostCheck.label || '(not one of the known PROD/TEST/org2 env URLs - treated as production)'}${hostCheck.prod ? '  ** PRODUCTION **' : ''}`);
  if (!hostCheck.ok) {
    console.error(`REFUSING TO RUN: ${hostCheck.reason}`);
    process.exit(2);
  }

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: url });
  const dry = !opts.apply; // dry-run הוא ברירת המחדל (4.10.2026); --apply כותב
  const newValue = opts.clear ? null : opts.value;

  try {
    if (opts.scope === 'org') {
      const key = settingKey(opts.screen);
      const row = await prisma.systemSetting.findUnique({ where: { key } });
      console.log(`[org] ${key}: ${row ? JSON.stringify(row.value) : '(no row => role default: programmer a5, everyone else legacy)'} -> ${JSON.stringify(newValue)}`);
      if (dry) return console.log('DRY RUN - nothing written. Add --apply to write.');
      // category נשאר ריק בכוונה: מסך ההגדרות מציג רק שורות עם category, כך שלא מתווסף אף פקד גלוי.
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: newValue },
        create: { key, value: newValue, name: `${key} (internal rollout flag)`, type: 'text' },
      });
      console.log('OK: written. The running app picks it up within ~30s (settings cache).');
      return;
    }

    const isNumeric = /^\d+$/.test(opts.employee); // legacyId רק לקלט ספרות (כלל אבטחה של הריפו)
    const where = isNumeric ? { legacyId: parseInt(opts.employee, 10) } : { id: opts.employee };
    const result = await applyUserVariant(prisma, where, opts.screen, newValue, { dry });
    const { employee, built } = result;
    const label = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || '(no name)';
    console.log(`[user] employee legacyId=${employee.legacyId ?? '-'} "${label}"${employee.isActive ? '' : ' (INACTIVE)'}`);
    console.log(`[user] uiVariants.${opts.screen}: ${built.previous === undefined ? '(no override)' : JSON.stringify(built.previous)} -> ${newValue === null ? '(no override)' : JSON.stringify(newValue)}`);
    if (result.status === 'nothing') return console.log('Nothing to clear - no override is set. Nothing written.');
    if (result.status === 'dry') return console.log('DRY RUN - nothing written. Add --apply to write.');
    if (result.attempts > 1) console.log(`(prefs changed concurrently; succeeded on attempt ${result.attempts})`);
    console.log('OK: written. It reaches the employee\'s browser cookie on their next full page load (DesignPrefsSync), i.e. the second load after a fresh login.');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { SCREENS, parseArgs, describeDbTarget, checkHost, endpointId, collectKnownDbs, isLocalDevHost, buildUserThemeColor, applyUserVariant, settingKey };

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
}
