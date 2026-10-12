// lib/aiGuide/targetsIndex.js - רישום היעדים בלבד (בטוח לדפדפן: בלי דפים, בלי משימות, בלי קטלוגי שרת). מקור אחד: areas/*.targets.js
import * as menu from './areas/menu.targets.js';
import * as home from './areas/home.targets.js';
import * as orders from './areas/orders.targets.js';
import * as people from './areas/people.targets.js';
import * as admin from './areas/admin.targets.js';

export const TARGET_AREAS = Object.freeze({ menu, home, orders, people, admin });
export const TARGETS = Object.freeze(Object.values(TARGET_AREAS).flatMap((a) => a.targets));
export const DYNAMIC_ID_PATTERNS = Object.freeze(Object.values(TARGET_AREAS).flatMap((a) => a.dynamic || []));
export const TARGETS_BY_ID = Object.freeze(Object.fromEntries(TARGETS.map((t) => [t.id, t])));
export function getTarget(id) { return TARGETS_BY_ID[String(id || '').toLowerCase()] || null; }
