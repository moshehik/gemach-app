// עזר משותף לסקריפטי seed של SystemSetting בוליאני לפי גמח (org 1 = ראשי, org 2 = נווה יעקב).
// ברירת מחדל = dry-run (רק מדפיס מה היה קורה); כתיבה בפועל רק עם --write.
// בדיקת host: ה-DB שנבחר חייב להיות שונה מה-DB של הגמח השני (מונע את הדליפה בין הגמחים
// שקרתה ב-seed_phase1_settings) - ומודפס לפני כל כתיבה.
//   node scripts/<seed>.js --org=2          (dry-run)
//   node scripts/<seed>.js --org=2 --write
//
// שתי צורות להגדרת היעד של מפתח:
//   1. trueForOrg: N  (הצורה המקורית) - org N מקבל 'true' וגם מתעדכן אם הערך הקיים שונה; הגמח השני נוצר
//      עם 'false' אם חסר, וערך קיים שלו לעולם לא משתנה (לפי הנוהל ב-CLAUDE.md).
//   2. targets: { 1: { value, overwrite }, 2: { value, overwrite } }  - ערך יעד מפורש לכל גמח.
//      overwrite=true: אם הערך הקיים שונה מהיעד הוא מתעדכן. overwrite=false: נוצר אם חסר, וערך קיים
//      שונה רק מדווח (לא נדרס).
// ההתנהגות של trueForOrg זהה בדיוק למה שהיה לפני שהתווספה צורה 2.
'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./db-env');

const hostOf = (url) => (String(url).match(/@([^/?]+)/) || [])[1] || '';

/** היעד של המפתח בגמח נתון: { value: 'true'|'false', overwrite: boolean } */
function targetFor(def, org) {
  if (def.targets) {
    const t = def.targets[org];
    if (!t || (t.value !== 'true' && t.value !== 'false')) {
      throw new Error(`${def.key}: targets[${org}] must be { value: 'true'|'false', overwrite: boolean }`);
    }
    return { value: t.value, overwrite: !!t.overwrite };
  }
  const isTrueOrg = org === def.trueForOrg;
  return { value: isTrueOrg ? 'true' : 'false', overwrite: isTrueOrg };
}

/**
 * מחבר לגמח org אחרי בדיקת host (ה-host לא ריק ושונה מה-host של הגמח השני). מחזיר { prisma, host }.
 * הקורא אחראי ל-$disconnect.
 */
function connectOrg(org, write) {
  const url = resolveDbUrl(org);
  const host = hostOf(url);
  const otherHost = hostOf(resolveDbUrl(org === 1 ? 2 : 1));
  if (!host || host === otherHost) {
    throw new Error(`SAFETY ABORT: org${org} host "${host}" is empty or equals the other org's host "${otherHost}"`);
  }
  console.log(`org${org} DB host: ${host} | mode: ${write ? 'WRITE' : 'dry-run'}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }), host };
}

/**
 * מיישם (או מדפיס במצב dry-run) הגדרה אחת ב-org אחד. מחזיר { key, before, after, action, kept } כאשר
 * before = הערך שנמצא (null = חסר), after = הערך אחרי הפעולה (ב-dry-run: הערך שהיה נכתב),
 * action = 'none' | 'create' | 'update', kept = true אם קיים ערך שונה מהיעד שלא נדרס בכוונה.
 */
async function applySetting(prisma, org, def, write) {
  const { key, name, category, notes } = def;
  const { value, overwrite } = targetFor(def, org);
  const exists = await prisma.systemSetting.findUnique({ where: { key } });
  if (exists && (exists.value === value || !overwrite)) {
    const kept = exists.value !== value;
    console.log(`org${org}: ${key} already exists (= ${exists.value}), nothing to do` +
      (kept ? ` [intended target would be ${value}, but an existing value of this org is never overwritten here]` : ''));
    return { key, before: exists.value, after: exists.value, action: 'none', kept };
  }
  const action = exists ? 'update' : 'create';
  console.log(`org${org}: ${action} ${key} = ${value}${exists ? ` (was ${exists.value})` : ''}`);
  if (!write) return { key, before: exists ? exists.value : null, after: value, action, kept: false };
  if (exists) {
    await prisma.systemSetting.update({ where: { key }, data: { value } });
  } else {
    await prisma.systemSetting.create({ data: { key, value, name, category, type: 'boolean', notes } });
  }
  return { key, before: exists ? exists.value : null, after: value, action, kept: false };
}

async function seedBoolSetting(def) {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const { prisma } = connectOrg(org, write);
  try {
    const r = await applySetting(prisma, org, def, write);
    if (r.action === 'none') return;
    if (!write) { console.log('dry-run - pass --write to apply'); return; }
    console.log(`org${org}: done`);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { seedBoolSetting, applySetting, connectOrg, targetFor, hostOf };
