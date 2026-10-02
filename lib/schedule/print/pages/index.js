// lib/schedule/print/pages/index.js — מפת מודולי הדפים (מפתח PP-xx -> { build, toRows, SHEET_NAME }).
//
// דף חדש: 1) lib/schedule/print/pages/PP-xx.js עם build()/toRows() (ר' PP-15.js לחוזה המלא);
//         2) שורה כאן; 3) תבנית React ב-app/components/schedule/print/pages/PPxx.js + שורה ב-templates.js;
//         4) status: 'ready' ברשומת ה-registry. דף שחסר כאן מקבל 501 מה-API ("הדף עדיין לא נבנה").
import * as PP01 from './PP-01';
import * as PP03 from './PP-03';
import * as PP04 from './PP-04';
import * as PP08 from './PP-08';
import * as PP09 from './PP-09';
import * as PP15 from './PP-15';

export const PAGE_MODULES = {
  'PP-01': PP01,
  'PP-03': PP03,
  'PP-04': PP04,
  'PP-08': PP08,
  'PP-09': PP09,
  'PP-15': PP15,
};

export function getPageModule(key) {
  return PAGE_MODULES[key] || null;
}
