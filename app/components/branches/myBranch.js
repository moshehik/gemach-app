// myBranch.js - "הסניף של המחשב הזה" (docs/branches-plan.md, שלב ד). נשמר ב-localStorage (ברירות מחדל בצד הלקוח) וגם בעוגייה gm_my_branch -
// השרת קורא אותה ב-POST /api/returns/scan כדי לדעת באיזה סניף נסרקה ההחזרה, בלי לשנות את בקשת הסריקה (lib/returnBranchAdvice.js).
import { LEGACY_LAST_ORDER_BRANCH_KEY, MY_BRANCH_COOKIE, MY_BRANCH_STORAGE_KEY } from '@/lib/branches';

const get = (k) => { try { return window.localStorage.getItem(k) || ''; } catch { return ''; } };

/** הסניף השמור במחשב הזה (ואם אין - הסניף האחרון שנבחר בטופס הזמנה ישן), או '' */
export function readMyBranch() {
  if (typeof window === 'undefined') return '';
  return get(MY_BRANCH_STORAGE_KEY) || get(LEGACY_LAST_ORDER_BRANCH_KEY);
}

export function saveMyBranch(name) {
  try { window.localStorage.setItem(MY_BRANCH_STORAGE_KEY, name || ''); } catch { /* חסום - best effort */ }
  try { document.cookie = `${MY_BRANCH_COOKIE}=${encodeURIComponent(name || '')}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* ignore */ }
}
