// lib/schedule/print/pages/index.js — מפת מודולי הדפים (מפתח PP-xx -> { build, toRows, SHEET_NAME }).
//
// דף חדש: 1) lib/schedule/print/pages/PP-xx.js עם build()/toRows() (ר' PP-15.js לחוזה המלא);
//         2) שורה כאן; 3) תבנית React ב-app/components/schedule/print/pages/PPxx.js + שורה ב-templates.js;
//         4) status: 'ready' ברשומת ה-registry. דף שחסר כאן מקבל 501 מה-API ("הדף עדיין לא נבנה").
import * as PP01 from './PP-01';
import * as PP07 from './PP-07';
import * as PP10 from './PP-10';
import * as PP11 from './PP-11';
import * as PP12 from './PP-12';
import * as PP15 from './PP-15';
import * as PP18 from './PP-18';

export const PAGE_MODULES = {
  'PP-01': PP01,
  'PP-07': PP07,
  'PP-10': PP10,
  'PP-11': PP11,
  'PP-12': PP12,
  'PP-15': PP15,
  'PP-18': PP18,
};

export function getPageModule(key) {
  return PAGE_MODULES[key] || null;
}
