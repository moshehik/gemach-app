// app/components/schedule/print/templates.js — מפת תבניות ההדפסה (מפתח PP-xx -> קומפוננטת React).
// דף חדש = קובץ ב-./pages/PPxx.js (ר' PP15.js לטבלה פשוטה, PP01.js לסיכום + טבלה) + שורה כאן.
// התבנית מקבלת { meta, page } מהמטען של GET /api/schedule/print ומחזירה <Sheet> אחד או כמה (הזמנה בכל עמוד).
import PP01 from './pages/PP01';
import PP15 from './pages/PP15';

const TEMPLATES = {
  'PP-01': PP01,
  'PP-15': PP15,
};

export function getTemplate(key) {
  return TEMPLATES[key] || null;
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);
