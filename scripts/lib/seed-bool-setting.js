// עזר משותף לסקריפטי seed של SystemSetting בוליאני לפי גמח (org 1 = ראשי, org 2 = נווה יעקב).
// ברירת מחדל = dry-run (רק מדפיס מה היה קורה); כתיבה בפועל רק עם --write.
// בדיקת host: ה-DB שנבחר חייב להיות שונה מה-DB של הגמח השני (מונע את הדליפה בין הגמחים
// שקרתה ב-seed_phase1_settings) - ומודפס לפני כל כתיבה.
//   node scripts/<seed>.js --org=2          (dry-run)
//   node scripts/<seed>.js --org=2 --write
// org אחד מקבל value=true, השני נוצר עם 'false' (שומר על ההתנהגות הקיימת) - לפי הנוהל ב-CLAUDE.md.
'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./db-env');

const hostOf = (url) => (String(url).match(/@([^/?]+)/) || [])[1] || '';

async function seedBoolSetting({ key, name, category, notes, trueForOrg }) {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const url = resolveDbUrl(org);
  const host = hostOf(url);
  const otherHost = hostOf(resolveDbUrl(org === 1 ? 2 : 1));
  if (!host || host === otherHost) {
    throw new Error(`SAFETY ABORT: org${org} host "${host}" is empty or equals the other org's host "${otherHost}"`);
  }
  console.log(`org${org} DB host: ${host} | mode: ${write ? 'WRITE' : 'dry-run'}`);

  const value = org === trueForOrg ? 'true' : 'false';
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const exists = await prisma.systemSetting.findUnique({ where: { key } });
    if (exists && (exists.value === value || org !== trueForOrg)) {
      console.log(`org${org}: ${key} already exists (= ${exists.value}), nothing to do`);
      return;
    }
    console.log(`org${org}: ${exists ? 'update' : 'create'} ${key} = ${value}${exists ? ` (was ${exists.value})` : ''}`);
    if (!write) { console.log('dry-run - pass --write to apply'); return; }
    if (exists) {
      await prisma.systemSetting.update({ where: { key }, data: { value } });
    } else {
      await prisma.systemSetting.create({ data: { key, value, name, category, type: 'boolean', notes } });
    }
    console.log(`org${org}: done`);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { seedBoolSetting };
