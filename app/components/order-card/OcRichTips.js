'use client';

// OcRichTips - הכרטיסים העשירים של הסרגל (data-rich בדמו, richHTML/placeRich שורות 4125-4210; גרסת .gold ב-.rail): ארבעת האריחים (חתימה / משלוח / פריטים / תשלום)
// ושורות השינויים והתשלומים. האזנה מואצלת על שורש הכרטיס (כמו הדמו): ריחוף / מיקוד מקלדת; במגע (hover:none) הקשה ראשונה מציגה (ולא מפעילה לחצן), שנייה על
// אלמנט שאינו לחצן סוגרת; Escape / גלילה / שינוי גודל סוגרים. צמתי הציר העליון (.tlx) מטופלים ב-OcStepper עצמו. התוכן: railRichRows (parts/ocTipLogic.js).
import { useEffect, useId, useRef, useState } from 'react';
import OcPortal from './OcPortal';
import OcRichCard from './OcRichCard';
import { parseRichSpec, railRichRows } from './parts/ocTipLogic';

export default function OcRichTips({ rootRef, getCtx }) {
  const [rich, setRich] = useState(null); // { el, rows, anchor, gold }
  const id = `${useId()}-rail-rt`;
  const curRef = useRef(null);
  const ctxRef = useRef(getCtx);
  useEffect(() => { ctxRef.current = getCtx; });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const setCur = (el) => {
      if (curRef.current && curRef.current !== el) curRef.current.removeAttribute('aria-describedby');
      curRef.current = el;
    };
    const hide = () => { setCur(null); setRich(null); };
    const show = (el) => {
      const { kind, arg } = parseRichSpec(el.getAttribute('data-rich'));
      const rows = railRichRows(kind, arg, ctxRef.current());
      if (!rows.length) { hide(); return; }
      setCur(el);
      el.setAttribute('aria-describedby', id);
      setRich({ el, rows, anchor: el.getBoundingClientRect(), gold: !!el.closest('.rail') });
    };
    const richOf = (e) => { const t = e.target.closest ? e.target.closest('[data-rich]') : null; return t && !t.closest('.tlx') ? t : null; };
    const over = (e) => { const t = richOf(e); if (t && t !== curRef.current) show(t); };
    const out = (e) => { const t = richOf(e); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hide(); };
    const fin = (e) => { const t = richOf(e); if (t) show(t); };
    const fout = (e) => { if (richOf(e)) hide(); };
    const click = (e) => {
      const t = richOf(e);
      const isTouch = window.matchMedia && window.matchMedia('(hover:none)').matches;
      const inBtn = e.target.closest && e.target.closest('button');
      if (t && isTouch && (!inBtn || inBtn === t)) {
        if (curRef.current !== t) { show(t); e.preventDefault(); e.stopPropagation(); } else if (!inBtn) hide();
      } else if (!t) hide();
    };
    const key = (e) => { if (e.key === 'Escape' && curRef.current) hide(); };
    root.addEventListener('mouseover', over);
    root.addEventListener('mouseout', out);
    root.addEventListener('focusin', fin);
    root.addEventListener('focusout', fout);
    root.addEventListener('click', click, true);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      hide();
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', fin);
      root.removeEventListener('focusout', fout);
      root.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [rootRef, id]);
  return rich ? <OcPortal><OcRichCard id={id} rows={rich.rows} anchor={rich.anchor} mode="side" gold={rich.gold} /></OcPortal> : null;
}
