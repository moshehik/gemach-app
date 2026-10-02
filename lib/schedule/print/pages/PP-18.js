// lib/schedule/print/pages/PP-18.js — "דף משלוח חזור (למשלוחן)" (דף 18): אותו דף כמו 10 בכיוון חזור (שלב 9, ברקוד DBK).
// העיצוב: courierPage('18','return',…). ההחלטה PP-18 "כן - כמו שהוא". מחליף בעיצוב את /print/delivery-courier?direction=return.
// כל הלוגיקה ב-PP-10.js (buildCourierData); כאן רק הכיוון.
import { buildCourierData, courierToRows } from './PP-10';

export const SHEET_NAME = 'דף משלוח חזור';

export function build({ day }) {
  return buildCourierData({ day, out: false });
}

export const toRows = courierToRows;
