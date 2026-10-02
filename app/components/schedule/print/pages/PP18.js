// app/components/schedule/print/pages/PP18.js — תבנית "דף משלוח חזור (למשלוחן)" (דף 18): אותה תבנית כמו PP10 בכיוון חזור
// (איסוף מהלקוחה, ברקוד DBK). נתונים: lib/schedule/print/pages/PP-18.js.
import { CourierSheet } from './PP10';

export default function PP18({ meta, page }) {
  return CourierSheet({ meta, page, out: false });
}
