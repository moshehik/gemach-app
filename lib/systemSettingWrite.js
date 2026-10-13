// lib/systemSettingWrite.js - כתיבת SystemSetting אחת בדרך שהתוסף האוטומטי של Prisma רושם בהיסטוריה (create / update, לא upsert).
// משמש את /api/branches ואת /api/schedule/settings. החזרה: true כשנכתב בפועל (ערך שונה / שורה חדשה).
import prisma from '@/app/lib/prisma';

/** @param {string} key @param {string} value @param {{ name?: string, category?: string, type?: string }} [meta] - לשורה חדשה בלבד */
export async function writeSystemSetting(key, value, meta = {}) {
  const existing = await prisma.systemSetting.findUnique({ where: { key }, select: { id: true, value: true } });
  if (existing) {
    if (existing.value === value) return false;
    await prisma.systemSetting.update({ where: { key }, data: { value } });
    return true;
  }
  await prisma.systemSetting.create({ data: { key, value, name: meta.name || key, category: meta.category || null, type: meta.type || 'text' } });
  return true;
}
