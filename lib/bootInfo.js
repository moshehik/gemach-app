// מידע על "הפעלה" (boot) של האינסטנס/התהליך הזה - לספירת cold starts. ר' docs/cpu-measurement-2026-10-06.md.
// כל תהליך שרת חדש (אינסטנס קר ב-Vercel / הפעלה מחדש של dev) מקבל bootId חדש; הוא נשמר על globalThis כדי שכל המודולים
// והנתיבים באותו תהליך יראו את אותו ערך (ב-webpack/Next אותו קובץ יכול להיטען כמה פעמים לתהליך).
// bootId מוחזר בכותרת x-boot-id מ-withCpuTiming (lib/cpuTiming.js), הקליינט שולח אותו עם שורת הלוג, וכך
// "מספר bootId שונים ביום" = "מספר cold starts ביום" (ר' שאילתה במסמך).

import { randomUUID } from 'node:crypto';

function createState() {
  return {
    bootId: randomUUID().replace(/-/g, '').slice(0, 12),
    bootAt: new Date().toISOString(),
    bootAtMs: Date.now(),
    requests: 0,
  };
}

function state() {
  if (!globalThis.__gemachBootInfo) globalThis.__gemachBootInfo = createState();
  return globalThis.__gemachBootInfo;
}

export function getBootId() {
  return state().bootId;
}

/** נקרא ע"י withCpuTiming על כל בקשה שנמדדה - לספירת בקשות לכל boot. */
export function noteRequest() {
  state().requests += 1;
}

export function getBootInfo() {
  const s = state();
  const mem = typeof process.memoryUsage === 'function' ? process.memoryUsage() : null;
  return {
    bootId: s.bootId,
    bootAt: s.bootAt,
    uptimeSec: Math.round((Date.now() - s.bootAtMs) / 1000),
    requestsSinceBoot: s.requests, // רק בקשות שעברו דרך withCpuTiming
    region: process.env.VERCEL_REGION || null,
    deployment: (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || '').slice(0, 12) || null,
    node: process.version,
    rssMb: mem ? Math.round(mem.rss / 1048576) : null,
  };
}

/** לבדיקות בלבד */
export function __resetBootInfoForTests() {
  globalThis.__gemachBootInfo = createState();
}
