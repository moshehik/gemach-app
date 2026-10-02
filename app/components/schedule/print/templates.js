// app/components/schedule/print/templates.js — מפת תבניות ההדפסה (מפתח PP-xx -> קומפוננטת React).
// דף חדש = קובץ ב-./pages/PPxx.js (ר' PP15.js לטבלה פשוטה, PP01.js לסיכום + טבלה) + שורה כאן.
// התבנית מקבלת { meta, page } מהמטען של GET /api/schedule/print ומחזירה <Sheet> אחד או כמה (הזמנה בכל עמוד).
import PP01 from './pages/PP01';
import PP02 from './pages/PP02';
import PP13 from './pages/PP13';
import PP15 from './pages/PP15';
import PP19 from './pages/PP19';

const TEMPLATES = {
  'PP-01': PP01,
  'PP-02': PP02,
  'PP-13': PP13,
  'PP-15': PP15,
  'PP-19': PP19,
};

export function getTemplate(key) {
  return TEMPLATES[key] || null;
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);
