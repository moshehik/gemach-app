'use client';

// כרטיסי ריחוף עשירים (העיצוב: #rt / richHTML / placeRich; בפלטה .pl-rt) - ריחוף / מיקוד / הקשה על [data-rich]. כחול כהה
// בתוכן, זהב במסילה (rt-navy / rt-gold בעיצוב). התוכן נבנה ב-React מתוך specs ("pay", "orders", "det", "sig", "chg|f:phone1").

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import CcIcon from './CcIcon';
import CcPortal from './CcPortal';

function place(rt, el) {
  if (!rt || !el) return;
  rt.style.left = '0px';
  rt.style.top = '0px';
  const r = el.getBoundingClientRect();
  const w = rt.offsetWidth;
  const h = rt.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const g = 12;
  let x;
  let y;
  let side;
  const wide = vw >= 700;
  if (wide && r.right + g + w <= vw - 8) { x = r.right + g; y = r.top + r.height / 2 - h / 2; side = 'r'; } else if (wide && r.left - g - w >= 8) { x = r.left - g - w; y = r.top + r.height / 2 - h / 2; side = 'l'; } else {
    x = r.left + r.width / 2 - w / 2;
    if (r.top - g - h >= 8) { y = r.top - g - h; side = 't'; } else { y = r.bottom + g; side = 'b'; }
  }
  x = Math.max(8, Math.min(vw - w - 8, x));
  y = Math.max(8, Math.min(vh - h - 8, y));
  rt.style.left = `${x}px`;
  rt.style.top = `${y}px`;
  rt.dataset.side = side;
  const a = rt.querySelector('.ra');
  if (a) {
    if (side === 'r' || side === 'l') { a.style.top = `${Math.max(14, Math.min(h - 14, r.top + r.height / 2 - y))}px`; a.style.left = ''; } else { a.style.left = `${Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x))}px`; a.style.top = ''; }
  }
}

export const RichLine = ({ icon, children }) => (
  <div className="rr1">{icon ? <CcIcon name={icon} size="sm" anim={false} /> : null}<span>{children}</span></div>
);

/** render(spec) → JSX | null. מחזיר את האלמנט לרינדור (ב-portal). */
export default function CcRich({ rootRef, render }) {
  const [cur, setCur] = useState(null); // {spec, el, gold}
  const rtRef = useRef(null);
  const hide = useCallback(() => setCur(null), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const pick = (e) => (e.target && e.target.closest ? e.target.closest('[data-rich]') : null);
    const over = (e) => { const t = pick(e); if (t && (!cur || cur.el !== t)) setCur({ spec: t.getAttribute('data-rich'), el: t, gold: !!t.closest('.rail') }); };
    const out = (e) => { const t = pick(e); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hide(); };
    const fin = (e) => { const t = pick(e); if (t) setCur({ spec: t.getAttribute('data-rich'), el: t, gold: !!t.closest('.rail') }); };
    const fout = (e) => { if (pick(e)) hide(); };
    root.addEventListener('mouseover', over);
    root.addEventListener('mouseout', out);
    root.addEventListener('focusin', fin);
    root.addEventListener('focusout', fout);
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    return () => {
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', fin);
      root.removeEventListener('focusout', fout);
      window.removeEventListener('scroll', hide, { capture: true });
    };
  }, [rootRef, cur, hide]);

  const content = cur ? render(cur.spec) : null;
  useLayoutEffect(() => {
    if (cur && content && rtRef.current) {
      if (!cur.el.isConnected) { setCur(null); return; }
      const anc = cur.el.classList.contains('tx') ? (cur.el.querySelector('.dot') || cur.el) : cur.el;
      place(rtRef.current, anc);
    }
  });

  return (
    <CcPortal>
      <div className={`pl-rt${cur && content ? ' on' : ''}${cur && cur.gold ? ' gold' : ''}`} id="rt" role="tooltip" ref={rtRef}>
        {content}
        {content ? <i className="ra" /> : null}
      </div>
    </CcPortal>
  );
}
