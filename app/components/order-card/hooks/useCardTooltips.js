'use client';

// useCardTooltips - הטולטיפ הפשוט של הכרטיס (#tt בדמו = .pl-tt בפלטה), כל ההתנהגויות של הדמו (כרטיס-הזמנה.html שורות 4210-4223, 4335-4350):
//  - ריחוף / מיקוד מקלדת על [data-tip]; Escape וגלילה סוגרים; מיקום מעל מרכז הרכיב, מתהפך מתחתיו כשאין מקום מתחת לתפריט העליון (placeTip, parts/ocTipLogic.js).
//  - מגע: touchstart על button[data-tip] מציג 1.4 ש׳; לחיצה על לחצן עזרה .tip מציגה 3.5 ש׳ (בדמו - הדרך היחידה לראות אותו במגע).
//  - tipify: כל לחצן-אייקון בלי טקסט נראה מקבל data-tip אוטומטית (aria-label / title / ICON_TIP), ו-data-ico לפי האייקון; לחצן עם טקסט - מוסר title (כמו בדמו).
//  - נגישות (מעבר לדמו): aria-describedby מהרכיב לטולטיפ (role=tooltip, id) בזמן ההצגה.
//  - prefers-reduced-motion: ה-transition של .pl-tt בפלטה מבוטל שם; כאן אין אנימציה משלנו.
import { useEffect } from 'react';
import { ICON_TIP, tipLabelFor, placeTip } from '../parts/ocTipLogic';
import { navBottomOf } from '../OcRichCard';

const TIP_ID = 'oc-pl-tt';
const iconOf = (b) => { const u = b.querySelector('use'); return u ? (u.getAttribute('href') || '').replace(/^#/, '').replace('gmi-', '') : ''; };

/** מוסיף data-tip לכל לחצן-אייקון בלי טקסט (פונקציה טהורה על DOM - לבדיקות עם jsdom מדומה). מחזיר כמה לחצנים עודכנו. */
export function tipifyRoot(root) {
  let n = 0;
  root.querySelectorAll('button,[role=button]').forEach((b) => {
    const icon = iconOf(b);
    if (icon && b.dataset.ico !== icon) b.dataset.ico = icon;
    if (b.hasAttribute('data-rich')) return;
    const text = b.textContent || '';
    const label = tipLabelFor({ text, hasTip: !!b.dataset.tip, isTipBtn: b.classList.contains('tip'), ariaLabel: b.getAttribute('aria-label') || '', title: b.getAttribute('title') || '', icon });
    if (!b.dataset.tip && !b.classList.contains('tip') && text.replace(/\s+/g, '').trim()) { if (b.hasAttribute('title')) b.removeAttribute('title'); return; }
    if (label) {
      b.dataset.tip = label;
      b.removeAttribute('title');
      if (!b.hasAttribute('aria-label')) b.setAttribute('aria-label', label);
      n++;
    }
  });
  return n;
}

export default function useCardTooltips(rootRef, ttRef) {
  useEffect(() => {
    const root = rootRef.current;
    const tt = ttRef.current;
    if (!root || !tt) return undefined;
    if (!tt.id) tt.id = TIP_ID;
    let cur = null;
    let timer = 0;
    const clearTimer = () => { if (timer) { clearTimeout(timer); timer = 0; } };
    const hide = () => {
      clearTimer();
      tt.classList.remove('on');
      if (cur && cur.removeAttribute) cur.removeAttribute('aria-describedby');
      cur = null;
    };
    const show = (el, holdMs = 0) => {
      clearTimer();
      if (cur && cur !== el && cur.removeAttribute) cur.removeAttribute('aria-describedby');
      cur = el;
      tt.textContent = el.getAttribute('data-tip');
      tt.classList.add('on');
      el.setAttribute('aria-describedby', tt.id);
      const p = placeTip(el.getBoundingClientRect(), tt.offsetWidth, tt.offsetHeight, { vw: window.innerWidth, vh: window.innerHeight, navBottom: navBottomOf() }, 'above', 10);
      tt.style.left = `${Math.max(10, Math.min(window.innerWidth - tt.offsetWidth - 10, p.x))}px`;
      tt.style.top = `${p.y}px`;
      if (holdMs) timer = setTimeout(hide, holdMs);
    };
    const tipOf = (e) => (e.target.closest ? e.target.closest('[data-tip]') : null);
    const over = (e) => { const t = tipOf(e); if (t && t !== cur) show(t); else if (!t && cur) hide(); };
    const out = (e) => { if (tipOf(e)) hide(); };
    const fin = (e) => { const t = tipOf(e); if (t && t.matches(':focus-visible')) show(t); };
    const key = (e) => { if (e.key === 'Escape' && cur) hide(); };
    const touch = (e) => { const b = e.target.closest ? e.target.closest('button[data-tip]') : null; if (b) show(b, 1400); };
    const click = (e) => { const tp = e.target.closest ? e.target.closest('.tip') : null; if (tp && tp.dataset.tip) show(tp, 3500); };
    root.addEventListener('mouseover', over);
    root.addEventListener('mouseout', out);
    root.addEventListener('focusin', fin);
    root.addEventListener('focusout', out);
    root.addEventListener('touchstart', touch, { passive: true });
    root.addEventListener('click', click);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', hide, { passive: true });
    // tipify: ראשוני + בכל שינוי DOM (דחוי ל-rAF, כמו בדמו)
    let raf = 0;
    tipifyRoot(root);
    const mo = new MutationObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; tipifyRoot(root); }); });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      hide();
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', fin);
      root.removeEventListener('focusout', out);
      root.removeEventListener('touchstart', touch);
      root.removeEventListener('click', click);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', hide);
    };
  }, [rootRef, ttRef]);
}

export { ICON_TIP };
