'use client';

// hook: מחסנית "אחורה / קדימה" + "נצפו לאחרונה" של המעטפת החדשה.
// הלוגיקה הטהורה כולה ב-lib/menu/navHistory.js וב-lib/menu/recents.js (נבדקת ב-scripts/test_menu_logic.mjs);
// כאן רק החיבור ל-React / sessionStorage / הראוטר, לפי docs/menu-a5-build-plan.md סעיף 5.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  NAV_HISTORY_STORAGE_KEY,
  back as navBack,
  buttonLabels,
  clear as navClear,
  clearNavHistoryStorage,
  createNavHistory,
  current as navCurrent,
  deserializeNavHistory,
  forward as navForward,
  go as navGo,
  normalizeNavPath,
  recentsView,
  relabel,
  serializeNavHistory,
  shouldRecordPath,
  visit as navVisit,
} from '@/lib/menu/navHistory';
import { defaultLabel, parseEntityPath, legacyItemToRecent } from '@/lib/menu/recents';
import { findActive } from '@/lib/menu/buildMenuTree';
import { getHistory } from '@/lib/historyManager';

// עמודים שאינם בעץ התפריט החדש אבל אפשר להגיע אליהם (תווית קריאה במקום נתיב גולמי).
const EXTRA_LABELS = {
  '/refunds': 'זיכויים וחובות',
  '/deliveries': 'משלוחים',
  '/messages': 'הודעות',
  '/admin': 'לוח ניהול',
  '/admin/permissions': 'הרשאות',
  '/admin/site': 'ניהול אתר',
  '/dashboard/pricelist': 'מחירון',
  '/employees/report': 'דוח נוכחות',
  '/schedule': 'לוז',
  '/orders': 'הזמנות',
  '/customers': 'לקוחות',
  '/rentals': 'השכרות',
  '/alterations': 'תיקונים',
};

const ENTITY_PREFIX_LABELS = [
  ['/orders/', 'הזמנה', 'file'],
  ['/customers/', 'לקוח', 'user'],
  ['/dashboard/dresses/', 'דגם', 'dress'],
];
// איזה סוג ישות של agy_history מתאים לתחילית נתיב
const LEGACY_TYPE_PREFIX = { order: '/orders/', customer: '/customers/', dress: '/dashboard/dresses/', rental: '/rentals' };

function readStorage() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(NAV_HISTORY_STORAGE_KEY) : null;
  } catch (e) {
    return null;
  }
}
function writeStorage(state) {
  try {
    sessionStorage.setItem(NAV_HISTORY_STORAGE_KEY, serializeNavHistory(state));
  } catch (e) { /* פרטיות / מכסה - ההיסטוריה פשוט לא נשמרת */ }
}

/**
 * @param {object} tree  עץ התפריט (buildMenuTree)
 * @param {string} [queryString]  מחרוזת ה-query של הכתובת; שינוי שלה (בלי שינוי נתיב: /?scope=a -> /?scope=b) נרשם כביקור חדש
 * @returns {{ state, labels, view, canBack, canForward, goBack, goForward, goTo, clearAll, clearOnLogout, navigate }}
 */
export default function useNavHistory(tree, queryString = '') {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState(createNavHistory);
  const ref = useRef(state); // המצב העדכני לשימוש במטפלי אירועים (state משמש רק לרינדור)
  const loaded = useRef(false);
  const pendingKey = useRef(null); // ניווט שהגיע מאחורה/קדימה/קפיצה - לא נרשם כביקור חדש

  const commit = useCallback((next) => {
    if (!next || next === ref.current) return;
    ref.current = next;
    writeStorage(next);
    setState(next);
  }, []);

  // טעינה מ-sessionStorage (נפרד לכל טאב: טאב חדש מתחיל ריק - מכוון).
  useEffect(() => {
    const loadedState = deserializeNavHistory(readStorage());
    ref.current = loadedState;
    loaded.current = true;
    setState(loadedState);
  }, []);

  // ביקור חדש בכל שינוי נתיב (+ #hash).
  const visitHere = useCallback(() => {
    if (!loaded.current || typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const href = `${pathname}${search}${hash}`;
    if (!shouldRecordPath(href)) return;
    const key = normalizeNavPath(href);
    if (pendingKey.current) {
      const expected = pendingKey.current;
      pendingKey.current = null;
      if (expected === key) return; // הגענו לעמוד שהמחסנית כבר מצביעה עליו
    }
    const act = findActive(tree, pathname, hash, search); // כולל ?scope= — אחרת כל פריטי "בית" נרשמים כ"חיפוש כללי"
    let label = '';
    let icon = 'file';
    if (act.itemId || act.tabId) {
      for (const tab of (tree && tree.tabs) || []) {
        if (act.itemId) {
          const it = (tab.items || []).find((x) => x.id === act.itemId);
          if (it) { label = it.label; icon = it.icon; break; }
        } else if (tab.id === act.tabId) { label = tab.label; icon = tab.icon; break; }
      }
    }
    const ent = parseEntityPath(href);
    if (ent) {
      label = defaultLabel(ent.type, ent.id);
      icon = ent.type === 'customer' ? 'user' : ent.type === 'dress' ? 'dress' : ent.type === 'rental' ? 'bag' : 'file';
    }
    if (!label || (!ent && ENTITY_PREFIX_LABELS.some(([pre]) => pathname.startsWith(pre)))) {
      // /orders/<uuid>, /customers/<uuid>, /dashboard/dresses/<id>: תווית כללית עד שהדף משדר את השם (agy_history_updated).
      const hit = ENTITY_PREFIX_LABELS.find(([pre]) => pathname.startsWith(pre));
      if (hit) { label = hit[1]; icon = hit[2]; }
    }
    if (!label) label = EXTRA_LABELS[pathname] || pathname;
    commit(navVisit(ref.current, { path: href, label, icon }));
  }, [pathname, queryString, tree, commit]); // queryString רק מפעיל ביקור חדש; הערך נקרא מ-window.location

  useEffect(() => {
    visitHere();
  }, [visitHere]);

  useEffect(() => {
    const onHash = () => visitHere();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [visitHere]);

  // תוויות עשירות (שם לקוחה / מספר הזמנה) מ-agy_history הישן: דפים שמשדרים agy_history_updated.
  useEffect(() => {
    const enrich = () => {
      let next = ref.current;
      try {
        const items = getHistory();
        // הפריט שהדף הנוכחי הוסיף הרגע (ראשון ברשימה): הדף מכיר את הישות לפי מספר הזמנה / מזהה ולא לפי ה-uuid שבכתובת,
        // לכן מתייגים את הרשומה הנוכחית אם סוג הישות מתאים לנתיב שלה.
        const first = items[0];
        const cur = navCurrent(next);
        if (first && cur && typeof first.timestamp === 'number' && Date.now() - first.timestamp < 10000) {
          const pre = LEGACY_TYPE_PREFIX[first.type];
          const bare = cur.path.split(/[?#]/)[0];
          if (pre && bare.startsWith(pre) && first.name) {
            next = relabel(next, cur.key, { label: first.subtext ? `${first.name} · ${first.subtext}` : first.name });
          }
        }
        for (const raw of items) {
          const r = legacyItemToRecent(raw);
          if (!r || !r.href || !r.label) continue;
          next = relabel(next, normalizeNavPath(r.href), { label: r.label, icon: r.icon });
        }
      } catch (e) { /* ignore */ }
      commit(next);
    };
    window.addEventListener('agy_history_updated', enrich);
    return () => window.removeEventListener('agy_history_updated', enrich);
  }, [commit]);

  // ניווט פנימי לנתיב (כולל #hash באותו עמוד) - אותו כלל כמו handleNavClick ב-AppShell.js.
  const navigate = useCallback((path) => {
    if (typeof window === 'undefined') return;
    const hashIdx = path.indexOf('#');
    if (hashIdx !== -1) {
      const targetPath = path.slice(0, hashIdx).split('?')[0] || '/';
      const targetHash = path.slice(hashIdx);
      if (targetPath === window.location.pathname) {
        if (window.location.hash !== targetHash) window.location.hash = targetHash;
        return;
      }
    }
    router.push(path);
  }, [router]);

  const stepTo = useCallback((next) => {
    if (!next || next === ref.current) return;
    const cur = navCurrent(next);
    commit(next);
    if (cur) {
      pendingKey.current = cur.key;
      // אם הניווט לא הניב שינוי נתיב (אותה כתובת) הדגל לא נשאר תלוי ומשבית ביקור עתידי.
      setTimeout(() => { if (pendingKey.current === cur.key) pendingKey.current = null; }, 4000);
      navigate(cur.path);
    }
  }, [commit, navigate]);

  const labels = buttonLabels(state);

  return {
    state,
    labels,
    view: recentsView(state),
    canBack: !labels.backDisabled,
    canForward: !labels.forwardDisabled,
    goBack: () => stepTo(navBack(ref.current)),
    goForward: () => stepTo(navForward(ref.current)),
    goTo: (index) => stepTo(navGo(ref.current, index)),
    clearAll: () => commit(navClear(ref.current)),
    clearOnLogout: () => clearNavHistoryStorage(),
    navigate,
  };
}

