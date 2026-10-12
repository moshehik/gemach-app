// lib/aiGuide/targetsIndex.js - רישום היעדים בלבד (בטוח לדפדפן: בלי דפים, בלי משימות, בלי קטלוגי שרת). מקור אחד: areas/*.targets.js
import * as menu from './areas/menu.targets.js';
import * as home from './areas/home.targets.js';
import * as orders from './areas/orders.targets.js';
import * as people from './areas/people.targets.js';
import * as admin from './areas/admin.targets.js';
import * as ops from './areas/ops.targets.js';

export const TARGET_AREAS = Object.freeze({ menu, home, orders, people, admin, ops });
export const TARGETS = Object.freeze(Object.values(TARGET_AREAS).flatMap((a) => a.targets));
export const DYNAMIC_ID_PATTERNS = Object.freeze(Object.values(TARGET_AREAS).flatMap((a) => a.dynamic || []));
export const TARGETS_BY_ID = Object.freeze(Object.fromEntries(TARGETS.map((t) => [t.id, t])));
// יעדים "וירטואליים" שנגזרים ממזהה (למשל set.key-<מפתח הגדרה>): אזור יכול לייצא resolveDynamic(id) -> יעד או null.
// ה-id מאומת מול התבנית של האזור, לכן ה-AI לא יכול להמציא יעד: רק מזהה שהפונקציה של האזור מכירה.
export function getTarget(id) {
  const key = String(id || '').toLowerCase();
  if (TARGETS_BY_ID[key]) return TARGETS_BY_ID[key];
  for (const a of Object.values(TARGET_AREAS)) {
    if (typeof a.resolveDynamic === 'function') { const t = a.resolveDynamic(key); if (t) return t; }
  }
  return null;
}
