#!/usr/bin/env node
/**
 * המרה חד-פעמית: דחיסת הלוגו השמור (SystemSetting BRAND_LOGO) באותה פונקציה בדיוק שמשמשת את העלאת הלוגו
 * (lib/logoCompress.js). הלוגו של הגמח הראשי היה base64 של ~2.48MB - נקרא מה-DB בכל אינסטנס קר ובכל קריאת הגדרות.
 *
 * ברירת מחדל = dry-run: קורא, מחשב, מדפיס לפני/אחרי ושומר תצוגה מקדימה לקובץ מקומי - לא כותב ל-DB.
 *
 *   node scripts/compress_brand_logo.js --org=1                                  (dry-run, קריאה בלבד)
 *   node scripts/compress_brand_logo.js --org=1 --write --expect-host=<חלק מה-host> --expect-name=<חלק מ-gmach_name>
 *
 * בטיחות:
 *  - org 1 = הגמח הראשי, org 2 = נווה יעקב (scripts/lib/db-env.js). ה-host חייב להיות שונה מה-host של הגמח השני.
 *  - זיהוי הגמח: מדפיס את host ואת gmach_name מה-DB. ב---write חובה גם --expect-host וגם --expect-name,
 *    והסקריפט נעצר אם אחד מהם לא תואם (חלק מהמחרוזת, לא רגיש לאותיות).
 *  - לפני כתיבה: הערך המקורי נשמר במלואו בקובץ מקומי scratch/brand-logo-backups/ (gitignored) ומאומת, ורק אז מתבצע UPDATE.
 *    שחזור: להעתיק את תוכן הקובץ בחזרה לשדה value של השורה BRAND_LOGO (או להריץ עם --restore=<קובץ> --write).
 *  - נוגע בשורה אחת בלבד (key = 'BRAND_LOGO'), עם prisma רגיל (לא כותב שורת AuditLog של 2.5MB).
 *  - אם הלוגו כבר קטן (<= 150KB ובמימדים עד 512px) - לא נוגע בו (אלא עם --force).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'scratch', 'brand-logo-backups');
const ALREADY_SMALL_BYTES = 150 * 1024;
const hostOf = (url) => (String(url).match(/@([^/?]+)/) || [])[1] || '';
const arg = (rest, name) => { const a = rest.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const fmt = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)}MB` : `${(n / 1024).toFixed(1)}KB`);

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const force = rest.includes('--force');
  const expectHost = arg(rest, 'expect-host');
  const expectName = arg(rest, 'expect-name');
  const restoreFile = arg(rest, 'restore');

  const url = resolveDbUrl(org);
  const host = hostOf(url);
  const otherHost = hostOf(resolveDbUrl(org === 1 ? 2 : 1));
  if (!host || host === otherHost) throw new Error(`SAFETY ABORT: org${org} host "${host}" is empty or equals the other org's host "${otherHost}"`);
  console.log(`org${org} DB host: ${host} | mode: ${write ? 'WRITE' : 'dry-run'}`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const nameRow = await prisma.systemSetting.findUnique({ where: { key: 'gmach_name' }, select: { value: true } });
    const gmachName = (nameRow && nameRow.value) || '';
    console.log(`identity: gmach_name = "${gmachName}"`);
    if (write && (!expectHost || !expectName)) throw new Error('--write requires both --expect-host=... and --expect-name=... (identity check)');
    if (expectHost && !host.toLowerCase().includes(expectHost.toLowerCase())) throw new Error(`IDENTITY ABORT: host "${host}" does not contain "${expectHost}"`);
    if (expectName && !gmachName.toLowerCase().includes(expectName.toLowerCase())) throw new Error(`IDENTITY ABORT: gmach_name "${gmachName}" does not contain "${expectName}"`);

    // שחזור מגיבוי מקומי
    if (restoreFile) {
      const original = fs.readFileSync(path.resolve(restoreFile), 'utf8');
      console.log(`restore: ${path.resolve(restoreFile)} (${fmt(original.length)})`);
      if (!write) { console.log('dry-run - pass --write to restore'); return; }
      await prisma.systemSetting.update({ where: { key: 'BRAND_LOGO' }, data: { value: original } });
      console.log('restored.');
      return;
    }

    const row = await prisma.systemSetting.findUnique({ where: { key: 'BRAND_LOGO' } });
    if (!row || !row.value) { console.log('BRAND_LOGO: no row / empty value - nothing to do'); return; }
    const original = row.value;
    console.log(`BRAND_LOGO: current value length ${original.length} chars (~${fmt(original.length)}), updatedAt ${row.updatedAt && row.updatedAt.toISOString()}`);

    const { compressLogoDataUrl, parseDataUrl, LOGO_MAX_PX } = await import(pathToFileURL(path.join(ROOT, 'lib', 'logoCompress.js')).href);
    const sharp = (await import('sharp')).default;
    const parsed = parseDataUrl(original);
    if (!parsed) throw new Error('BRAND_LOGO is not a base64 data URL - refusing to touch it');
    const meta = await sharp(parsed.buffer, { failOn: 'none' }).metadata();
    console.log(`original image: ${meta.format} ${meta.width}x${meta.height}, ${fmt(parsed.buffer.length)}, alpha=${!!meta.hasAlpha}`);
    if (!force && original.length <= ALREADY_SMALL_BYTES * 1.34 && Math.max(meta.width || 0, meta.height || 0) <= LOGO_MAX_PX) {
      console.log('already small enough - nothing to do (use --force to recompress anyway)');
      return;
    }

    const r = await compressLogoDataUrl(original);
    console.log(`compressed: ${r.mime} ${r.width}x${r.height}, ${fmt(r.bytes)} (data URL ${r.dataUrl.length} chars) - saves ${(100 - (r.dataUrl.length / original.length) * 100).toFixed(1)}% in the DB`);

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = r.mime === 'image/webp' ? 'webp' : 'png';
    const previewPath = path.join(BACKUP_DIR, `org${org}-preview-${stamp}.${ext}`);
    fs.writeFileSync(previewPath, r.buffer);
    console.log(`preview image saved for visual check: ${previewPath}`);

    if (!write) { console.log('dry-run - nothing written. Pass --write (with --expect-host/--expect-name) to apply.'); return; }

    // 1. גיבוי מלא של הערך המקורי + אימות לפני כל כתיבה
    const backupPath = path.join(BACKUP_DIR, `org${org}-BRAND_LOGO-original-${stamp}.txt`);
    fs.writeFileSync(backupPath, original, 'utf8');
    const back = fs.readFileSync(backupPath, 'utf8');
    if (back.length !== original.length || back !== original) throw new Error('backup verification failed - aborting before any DB write');
    console.log(`backup of the original value saved + verified: ${backupPath}`);

    // 2. UPDATE של השורה היחידה
    await prisma.systemSetting.update({ where: { key: 'BRAND_LOGO' }, data: { value: r.dataUrl } });
    const after = await prisma.systemSetting.findUnique({ where: { key: 'BRAND_LOGO' }, select: { value: true } });
    if (!after || after.value !== r.dataUrl) throw new Error('post-write verification failed (value differs) - restore from the backup file above');
    console.log(`done: BRAND_LOGO ${original.length} -> ${after.value.length} chars. Servers pick it up within ~30s (settings cache) / immediately on cold instances.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exitCode = 1; });
