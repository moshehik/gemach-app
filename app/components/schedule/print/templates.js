// app/components/schedule/print/templates.js — מפת תבניות ההדפסה (מפתח PP-xx -> קומפוננטת React).
// דף חדש = קובץ ב-./pages/PPxx.js (ר' PP15.js לטבלה פשוטה, PP01.js לסיכום + טבלה) + שורה כאן.
// התבנית מקבלת { meta, page } מהמטען של GET /api/schedule/print ומחזירה <Sheet> אחד או כמה (הזמנה בכל עמוד).
import PP01 from './pages/PP01';
import PP02 from './pages/PP02';
import PP03 from './pages/PP03';
import PP04 from './pages/PP04';
import PP07 from './pages/PP07';
import PP08 from './pages/PP08';
import PP09 from './pages/PP09';
import PP10 from './pages/PP10';
import PP11 from './pages/PP11';
import PP12 from './pages/PP12';
import PP13 from './pages/PP13';
import PP15 from './pages/PP15';
import PP18 from './pages/PP18';
import PP19 from './pages/PP19';

const TEMPLATES = {
  'PP-01': PP01,
  'PP-02': PP02,
  'PP-03': PP03,
  'PP-04': PP04,
  'PP-07': PP07,
  'PP-08': PP08,
  'PP-09': PP09,
  'PP-10': PP10,
  'PP-11': PP11,
  'PP-12': PP12,
  'PP-13': PP13,
  'PP-15': PP15,
  'PP-18': PP18,
  'PP-19': PP19,
};

export function getTemplate(key) {
  return TEMPLATES[key] || null;
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);
