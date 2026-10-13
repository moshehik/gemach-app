// lib/aiGuide/index.js - הרישום המלא (יעדים + דפים + משימות) לשרת ולבדיקות. הלקוח מייבא רק את targetsIndex.js.
import * as menu from './areas/menu.js';
import * as home from './areas/home.js';
import * as orders from './areas/orders.js';
import * as people from './areas/people.js';
import * as admin from './areas/admin.js';
import * as ops from './areas/ops.js';
export { TARGETS, TARGET_AREAS, DYNAMIC_ID_PATTERNS, TARGETS_BY_ID, getTarget } from './targetsIndex.js';

export const AREAS = Object.freeze({ menu, home, orders, people, admin, ops });
export const PAGES = Object.freeze(Object.values(AREAS).flatMap((a) => a.pages));
export const TASKS = Object.freeze(Object.values(AREAS).flatMap((a) => a.tasks));
export const SKIPPED_ROUTES = Object.freeze(Object.assign({}, ...Object.values(AREAS).map((a) => a.skip || {})));
