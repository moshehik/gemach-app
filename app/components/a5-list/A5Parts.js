'use client';

// מדריך האתר: כשמועבר guide ("ol" / "cl" - lib/aiGuide/areas/ops.targets.js) מוצמדים data-guide-id (ol.view, ol.export-excel, cl.view, cl.export-excel ...).
// A5Parts - החלקים הקטנים של ערכת הרשימות, מיוצאים גם לשימוש עצמאי (כרטיס דגם: פריטים / השכרות / היסטוריה):
// ViewSwitch (מתג שורות / טבלה), ExportTrio (xlbtn xlg / xld / xlp), Pager (קפסולת עימוד עם חיצים בפנים וידית חלקה),
// A5SearchSlot (משבצת החיפוש מתחת לכותרת הדף), HlText (הדגשת מילות החיפוש).
// כל ה-markup זהה בדיוק לעיצוב המאושר (scratch/emp-models-build/list-core.js + shared.js).

import { useLayoutEffect, useRef } from 'react';
import { DlGlyph, Ic, PrtGlyph, XlGlyph } from './A5Icon';
import { pageList, pageRange, splitHighlight } from './listLogic';

/** מתג שורות / טבלה (.vsw + .vknob + .vopt). value: 'list' | 'table'. */
export function ViewSwitch({ value, onChange, guide = null }) {
  const tbl = value === 'table';
  return (
    <div className={`vsw${tbl ? ' t' : ''}`} role="group" aria-label="מצב תצוגה" data-guide-id={guide ? `${guide}.view` : undefined}>
      <span className="vknob" aria-hidden="true" />
      <button type="button" className={`vopt${tbl ? '' : ' on'}`} data-view="list" aria-label="תצוגת שורות" aria-pressed={!tbl} data-tip="שורות" onClick={() => onChange('list')}><Ic id="rows" /></button>
      <button type="button" className={`vopt${tbl ? ' on' : ''}`} data-view="table" aria-label="תצוגת טבלה" aria-pressed={tbl} data-tip="טבלה" onClick={() => onChange('table')}><Ic id="table" /></button>
    </div>
  );
}

/**
 * שלושת לחצני הייצוא של המערכת (exportBtns בעיצוב): Excel / הורדה (PDF) / הדפסה. what = "רשימת העובדים".
 * onPick('excel' | 'download' | 'print'). kinds: תת-קבוצה של השלושה (ברירת מחדל: כולם).
 */
export function ExportTrio({ what, onPick, kinds = ['excel', 'download', 'print'], disabled = false, guide = null }) {
  const b = (kind, cls, label, tip, glyph) => (kinds.includes(kind)
    ? <button type="button" className={`xlbtn ${cls}`} data-hx={kind} data-guide-id={guide ? `${guide}.export-${kind}` : undefined} aria-label={label} data-tip={tip} disabled={disabled} onClick={() => onPick(kind)}>{glyph}</button>
    : null);
  return (
    <>
      {b('excel', 'xlg', 'ייצוא ל-Excel', `ייצוא ${what} לקובץ Excel`, <XlGlyph />)}
      {b('download', 'xld', 'הורדה', `הורדת ${what} כקובץ PDF (באותו עיצוב כמו ההדפסה)`, <DlGlyph />)}
      {b('print', 'xlp', 'הדפסה', `הדפסת ${what}`, <PrtGlyph />)}
    </>
  );
}

/**
 * קפסולת העימוד: [הקודם] [מספרי עמודים עם ידית נעה] [הבא] בתוך מסגרת אחת (pagerHTML + placeKnob בעיצוב).
 * לא מציג כלום כשיש עמוד אחד. n = סך השורות, page = העמוד הנוכחי (1..pages).
 */
export function Pager({ n, page, pages, pageSize, onPage }) {
  const wrapRef = useRef(null);
  const knobRef = useRef(null);
  const last = useRef(null); // המיקום הקודם של הידית (לאנימציה בין עמודים)
  const nums = pageList(page, pages);

  const place = (first) => {
    const wrap = wrapRef.current;
    const k = knobRef.current;
    if (!wrap || !k) { last.current = null; return; }
    const on = wrap.querySelector('.pg-b.on');
    if (!on) { k.style.opacity = 0; return; }
    const L = on.offsetLeft;
    const W = on.offsetWidth;
    if (first || !last.current) k.style.transition = 'none';
    k.style.opacity = 1;
    k.style.left = `${L}px`;
    k.style.width = `${W}px`;
    if (first || !last.current) { void k.offsetWidth; k.style.transition = ''; }
    last.current = { L, W };
  };
  useLayoutEffect(() => { place(false); });
  useLayoutEffect(() => {
    const onResize = () => place(true);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (pages < 2) return null;
  const { from, to } = pageRange(n, page, pageSize);
  return (
    <div className="pgr" role="navigation" aria-label="מעבר בין עמודים">
      <span className="pg-info">שורות <b><bdi dir="ltr">{from}–{to}</bdi></b></span>
      <div className="pg-ctl">
        <div className="pg-nums" ref={wrapRef}>
          <button type="button" className="pg-n" data-pg="prev" aria-label="העמוד הקודם" data-tip="הקודם" disabled={page <= 1} onClick={() => onPage(page - 1)}><Ic id="arrr" /></button>
          <span className="pg-knob" aria-hidden="true" ref={knobRef} />
          {nums.map((p, i) => (p === '…'
            ? <span key={`g${i}`} className="pg-gap" aria-hidden="true">…</span>
            : <button key={p} type="button" className={`pg-b${p === page ? ' on' : ''}`} data-pg={p} aria-label={`עמוד ${p}`} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>{p}</button>))}
          <button type="button" className="pg-n" data-pg="next" aria-label="העמוד הבא" data-tip="הבא" disabled={page >= pages} onClick={() => onPage(page + 1)}><Ic id="arrl" /></button>
        </div>
      </div>
    </div>
  );
}

/**
 * משבצת החיפוש מתחת לכותרת הדף ("שורת החיפוש בחצי רוחב", .hf-bar.adm-bar > .fslot). הדף מציב אותה בין הכותרת למעטפת התוכן ומעביר
 * את ה-id ל-<A5List searchSlot="...">; הרשימה מציירת את שדה החיפוש לתוכה (portal). בלי משבצת - החיפוש בראש הרשימה.
 */
export function A5SearchSlot({ id = 'a5l-search-slot' }) {
  return (
    <div className="a5l a5l-slotwrap">
      <div className="hf-bar adm-bar"><span id={id} className="fslot" /></div>
    </div>
  );
}

/** טקסט עם מילות החיפוש מודגשות (<mark class="hf-mk">). */
export function HlText({ text, words }) {
  const parts = splitHighlight(text, words);
  if (parts.length === 1 && !parts[0].mark) return parts[0].t;
  return parts.map((p, i) => (p.mark ? <mark key={i} className="hf-mk">{p.t}</mark> : p.t));
}
