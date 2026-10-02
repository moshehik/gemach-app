// app/components/schedule/print/templates.js — מפת תבניות ההדפסה (מפתח PP-xx -> קומפוננטת React).
// דף חדש = קובץ ב-./pages/PPxx.js (ר' PP15.js לטבלה פשוטה, PP01.js לסיכום + טבלה) + שורה כאן.
// התבנית מקבלת { meta, page } מהמטען של GET /api/schedule/print ומחזירה <Sheet> אחד או כמה (הזמנה בכל עמוד).
import PP01 from './pages/PP01';
import PP07 from './pages/PP07';
import PP10 from './pages/PP10';
import PP11 from './pages/PP11';
import PP12 from './pages/PP12';
import PP15 from './pages/PP15';
import PP18 from './pages/PP18';

const TEMPLATES = {
  'PP-01': PP01,
  'PP-07': PP07,
  'PP-10': PP10,
  'PP-11': PP11,
  'PP-12': PP12,
  'PP-15': PP15,
  'PP-18': PP18,
};

export function getTemplate(key) {
  return TEMPLATES[key] || null;
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);
