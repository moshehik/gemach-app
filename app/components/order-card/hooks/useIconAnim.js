'use client';

// useIconAnim - אנימציות האייקונים של העיצוב (כרטיס-הזמנה.html, בלוק "ICON-ANIM", שורות 4715-4755): כל svg.ic מקבל ia-<שם> (האנימציה הייחודית לאייקון) + ia-h
// (אנימציית ריחוף/מיקוד על האייקון או על האב האינטראקטיבי שלו), ואייקון שנוסף לדף מקבל ia-in (אנימציית כניסה, ia-dr לאייקוני "ציור") שמוסרת בסיומה.
// כל ה-CSS וה-keyframes כבר בפלטה (design-system/components.css ~שורות 44-73, 1787-1810: .ia-<שם>{--ia-a..}, svg.ic.ia-in, svg.ic.ia-h:hover, ו-prefers-reduced-motion = ללא אנימציה);
// כאן רק המנגנון שבדמו מוסיף את המחלקות (MutationObserver), מוגבל לשורש הכרטיס (כולל החלונות / הטולטיפ ב-portal שלו). הבדלים מהדמו: מזהה האייקון מ-#gmi-<שם>;
// בלי ia-ov (כללי data-ico של הדמו לא קיימים באתר); מכבד prefers-reduced-motion גם במחלקות (לא רק ב-CSS).
import { useEffect } from 'react';

const DRAW = new Set('check x plus minus chev arrl arrr arrlr'.split(' '));
const SKIP_IN = '.cl.enter,.success,#toast .tb,.dhero.fresh,.stat.fresh,.tx.fresh,.dbadge,.big-ck'; // כניסות draw/pop שכבר קיימות
const SKIP_H = '.gl,.cl-i,.cart-t';
const PREFIX = 'gmi-';

export const iconIdOf = (svg) => {
  const u = svg.querySelector('use');
  const href = u ? (u.getAttribute('href') || u.getAttribute('xlink:href') || '') : '';
  return href.replace(/^#/, '').replace(PREFIX, '');
};

/** מוסיף ia-<שם> ו-ia-h (אחת לאייקון). מחזיר את מזהה האייקון (ריק = לא אייקון ספרייה). */
export function prepIcon(svg) {
  if (svg.__ia !== undefined) return svg.__ia;
  const id = iconIdOf(svg);
  svg.__ia = id;
  if (!id) return id;
  svg.classList.add(`ia-${id}`);
  if (!svg.closest(SKIP_H)) svg.classList.add('ia-h');
  return id;
}

export default function useIconAnim(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof MutationObserver === 'undefined') return undefined;
    const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const pending = new Set();
    const timers = new Set();
    let first = true;
    let last = 0;
    let raf = 0;
    const flush = () => {
      raf = 0;
      const list = [...pending];
      pending.clear();
      const now = performance.now();
      const cap = first ? 1e9 : (now - last < 250 ? 0 : 14); // כניסה מדורגת: לא יותר מ-14 אייקונים בפעימה, ולא פעימות צפופות
      first = false;
      let n = 0;
      for (const s of list) {
        if (!s.isConnected) continue;
        const id = prepIcon(s);
        if (!id || reduced || n >= cap || s.closest(SKIP_IN) || s.classList.contains('ia-in')) continue;
        s.classList.add('ia-in');
        if (DRAW.has(id)) s.classList.add('ia-dr');
        n++;
        const t = setTimeout(() => { timers.delete(t); if (s.getClientRects().length) s.classList.remove('ia-in', 'ia-dr'); }, 800);
        timers.add(t);
      }
      if (n) last = now;
    };
    const scan = (node) => {
      if (node.nodeType !== 1) return;
      if (node.matches && node.matches('svg.ic')) pending.add(node);
      if (node.querySelectorAll) node.querySelectorAll('svg.ic').forEach((s) => pending.add(s));
    };
    const schedule = () => { if (!raf) raf = setTimeout(flush, 30); };
    const onEnd = (e) => {
      const s = e.target;
      if (s.classList && s.classList.contains('ia-in') && (e.animationName === 'gm-ia-in' || e.animationName === 'gm-ia-draw')) s.classList.remove('ia-in', 'ia-dr');
    };
    root.addEventListener('animationend', onEnd);
    const mo = new MutationObserver((ms) => {
      let any = false;
      for (const m of ms) for (const n of m.addedNodes) { scan(n); any = true; }
      if (any) schedule();
    });
    mo.observe(root, { childList: true, subtree: true });
    scan(root);
    schedule();
    return () => {
      mo.disconnect();
      root.removeEventListener('animationend', onEnd);
      if (raf) clearTimeout(raf);
      timers.forEach(clearTimeout);
    };
  }, [rootRef]);
}
