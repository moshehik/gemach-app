'use client';

// "פעולות ושינויים" (R41 + A21 + A22): הפיד של GET /api/orders/[id]/history (lib/history/orderHistory.js) - חיפוש, סינון
// קטגוריות מרובה עם ספירות, רשימה / טבלה עם מיון, לפני ← אחרי בפרטי השורה, ושורות מסמכים ואישורים ("הודפס…", "נשלח מייל…",
// "אישור מנהל: …"). ייצוא Excel / הורדה (PDF) / הדפסה של מה שמוצג (אותו סינון וחיפוש) - כל ייצוא נרשם (HISTORY_EXPORTED).
// מבנה: pHistory() + hfFeed() + hfSync() בדגימה (כרטיס-הזמנה.html): .card.hist > .hf-bar (.hf-s, .hf-sel, .hf-pills, .hf-sr) +
// .hres-bar (.hres-n, .vsw, .hres-x) + .hfeed. תאריכים עבריים בלבד; סכומים ב-<bdi dir="ltr">.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OcIcon, { XlGlyph } from '../OcIcon';
import OcViewSwitch from '../OcViewSwitch';
import { fmtMoney, fmtSignedMoney } from '../orderCardLogic';
import { downloadRowsAsXlsx } from '@/lib/xlsxExport';
import {
  filterCategories, effectiveSelection, visibleEntries, categoryCount, searchWords, shortHebrew, ROW_CATEGORY_LABEL, sortTableRows,
  exportRows, EXPORT_COLUMNS, historyPrintPath, historyFileBase,
} from './ocHistoryModel';
import OcHistoryTable from './OcHistoryTable';
import Hl from './OcHighlight';

export default function OcHistoryFeed({ oc, ui, entries, loading, error, onRetry, truncated }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState('list');
  const [sort, setSort] = useState({ col: 'date', dir: -1 });
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState('');
  const [cur, setCur] = useState(0); // roving-focus index of the filter listbox
  const selRef = useRef(null);
  const trigRef = useRef(null);
  const all = useMemo(() => entries || [], [entries]);
  // בחירה בפועל: בלי קטגוריות שהתרוקנו (אחרי רענון) - אין סינון נסתר; התפריט מציג רק קטגוריות עם ספירה > 0 (בעלים 2026-10-06)
  const effSel = useMemo(() => effectiveSelection(all, sel), [all, sel]);
  const cats = useMemo(() => filterCategories(all, { q, keep: effSel }), [all, q, effSel]);
  const words = useMemo(() => searchWords(q), [q]);
  const list = useMemo(() => visibleEntries(all, { selected: effSel, q }), [all, effSel, q]);
  useEffect(() => { if (effSel.length !== sel.length) setSel(effSel); }, [effSel, sel.length]);
  const orderId = oc.order && oc.order.orderId;

  // סגירת תפריט הסינון בלחיצה מחוץ לו / Escape
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => { if (selRef.current && !selRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const inside = selRef.current && selRef.current.contains(document.activeElement);
      setMenuOpen(false);
      if (inside && trigRef.current) trigRef.current.focus(); // keyboard users land back on the trigger
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  // opening the filter menu: focus the first option (the panel turns visible in the same commit)
  const optionEls = () => (selRef.current ? Array.from(selRef.current.querySelectorAll('[role="option"]')) : []);
  useEffect(() => {
    if (!menuOpen) return;
    setCur(0);
    const first = optionEls()[0];
    if (first) first.focus();
  }, [menuOpen]);

  const toggle = useCallback((k) => setSel((s) => (k === 'all' ? [] : (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))), []);
  // "סמן הכל" = כל הקטגוריות עם שורות בהיסטוריה (ספירה > 0 בלי קשר לחיפוש) - לא רק מה שגלוי תחת חיפוש פעיל, אחרת אחרי ניקוי החיפוש נראות שאר הקטגוריות כלא נבחרות ושורותיהן מוסתרות
  const allKeys = useMemo(() => filterCategories(all).map((c) => c[0]), [all]);
  const allOn = allKeys.length > 0 && allKeys.every((k) => effSel.includes(k));
  const resetAll = () => { setSel([]); setQ(''); };

  const focusOption = (n) => {
    const els = optionEls();
    if (!els.length) return;
    const i = Math.max(0, Math.min(els.length - 1, n));
    setCur(i);
    els[i].focus();
  };
  // listbox keys: ArrowUp/Down move (roving focus), Home/End jump, Space/Enter toggle the focused option, Tab leaves + closes
  const onListKey = (e) => {
    const els = optionEls();
    const i = els.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusOption(i < 0 ? 0 : i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusOption(i < 0 ? 0 : i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusOption(0); }
    else if (e.key === 'End') { e.preventDefault(); focusOption(els.length - 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && i >= 0 && cats[i]) { e.preventDefault(); toggle(cats[i][0]); }
    else if (e.key === 'Tab') setMenuOpen(false);
  };

  const exportAs = async (kind) => {
    if (busy) return;
    if (!list.length) { ui.toast('info', 'אין רישומים לייצוא'); return; }
    setBusy(kind);
    try {
      if (kind === 'excel') {
        // exactly what is on screen: in the table view the column sort applies too
        const shownList = view === 'table' ? sortTableRows(list, sort) : list;
        const ok = await downloadRowsAsXlsx(exportRows(shownList), historyFileBase(orderId), { sheetName: 'היסטוריה', columns: EXPORT_COLUMNS });
        if (!ok) throw new Error('empty');
        ui.toast('info', 'קובץ Excel של ההיסטוריה יורד');
        oc.logEvent('HISTORY_EXPORTED', { format: 'xlsx', rows: list.length });
      } else if (kind === 'download') {
        const res = await fetch('/api/pdf', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: historyPrintPath(orderId, { selected: sel, q, pdf: true }), filename: historyFileBase(orderId) }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${historyFileBase(orderId)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        ui.toast('info', 'ההיסטוריה יורדת כקובץ');
        oc.logEvent('HISTORY_EXPORTED', { format: 'pdf', rows: list.length });
      } else {
        const w = window.open(historyPrintPath(orderId, { selected: sel, q }), '_blank');
        if (!w) throw new Error('popup');
        ui.toast('info', 'ההיסטוריה נשלחה להדפסה');
        oc.logEvent('HISTORY_EXPORTED', { format: 'print', rows: list.length });
      }
    } catch (e) {
      ui.toast('error', kind === 'print' && e && e.message === 'popup' ? 'הדפדפן חסם את חלון ההדפסה' : 'הייצוא נכשל', 'נסו שוב');
    } finally {
      setBusy('');
    }
  };

  const nameOf = Object.fromEntries(cats.map((c) => [c[0], c[1]]));
  const iconOf = Object.fromEntries(cats.map((c) => [c[0], c[2]]));
  const pills = effSel.length && effSel.length <= 3 ? effSel : [];

  return (
    <div className="card hist">
      <div className="card-h"><div className="ico gold"><OcIcon name="clock" size="lg" /></div><h2>פעולות ושינויים</h2></div>
      <div className="hf-bar" id="hfBar">
        <div className="hf-s">
          <OcIcon name="search" />
          <input id="hfQ" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore placeholder="חיפוש בהיסטוריה" aria-label="חיפוש בהיסטוריה" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className={`hf-cl${q ? ' on' : ''}`} aria-label="ניקוי חיפוש" onClick={() => setQ('')}><OcIcon name="x" /></button>
          <div className={`hf-sel${menuOpen ? ' on' : ''}`} ref={selRef}>
            <button type="button" className="hf-t" ref={trigRef} aria-haspopup="listbox" aria-expanded={menuOpen} aria-controls="hfList" onClick={() => setMenuOpen((v) => !v)}>
              <OcIcon name="sliders" /><span className="hf-lbl">סינון</span><span className={`hf-bdg${effSel.length ? ' has' : ''}`}>{effSel.length || ''}</span><OcIcon name="chev" className="hf-chv" />
            </button>
            <div className="hf-scrim" onClick={() => setMenuOpen(false)} />
            <div className="hf-p">
              {cats.length ? <div className="hf-all"><button type="button" className="hf-allb" onClick={() => setSel(allOn ? [] : allKeys.slice())}>{allOn ? 'הסר הכל' : 'סמן הכל'}</button></div> : null}
              {!cats.length ? <div className="empty" role="status">אין רישומים לסינון</div> : null}
              <div className="hf-l" id="hfList" hidden={!cats.length} role="listbox" aria-multiselectable="true" aria-label="סינון היסטוריה" onKeyDown={onListKey}>
                {cats.map(([k, l, i], n) => (
                  <div key={k} className="hf-o" role="option" id={`hfo-${k}`} tabIndex={n === cur ? 0 : -1} style={{ '--k': n }} aria-selected={effSel.includes(k)}
                    onClick={() => { setCur(n); toggle(k); }} onFocus={() => setCur(n)}>
                    <span className="hf-ck"><OcIcon name="check" /></span><span className="hf-oi"><OcIcon name={i} /></span><span className="hf-ol">{l}</span><span className="hf-oc">{categoryCount(all, k, q)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="hf-pills">
          {pills.map((k) => (
            <button key={k} type="button" className="hf-pill" aria-label={`הסרת סינון ${nameOf[k]}`} onClick={() => toggle(k)}>
              <span className="hf-pi"><OcIcon name={iconOf[k]} size="sm" /></span>{nameOf[k]}<OcIcon name="x" />
            </button>
          ))}
        </div>
        <span className="hf-sr" role="status" aria-live="polite">{`${list.length} רישומים`}</span>
      </div>
      <div className="hres-bar">
        <span className="hres-n">תוצאות <b id="hfN">{list.length}</b></span>
        <OcViewSwitch value={view} onChange={setView} />
        <span className="hres-x">
          <button type="button" className="xlbtn xlg" data-hx="excel" aria-label="ייצוא ל-Excel" data-tip="ייצוא ההיסטוריה לקובץ Excel" disabled={!!busy} onClick={() => exportAs('excel')}><XlGlyph kind="excel" /></button>
          <button type="button" className="xlbtn xld" data-hx="download" aria-label="הורדה" data-tip="הורדת ההיסטוריה כקובץ" disabled={!!busy} onClick={() => exportAs('download')}><XlGlyph kind="download" /></button>
          <button type="button" className="xlbtn xlp" data-hx="print" aria-label="הדפסה" data-tip="הדפסת ההיסטוריה" disabled={!!busy} onClick={() => exportAs('print')}><XlGlyph kind="print" /></button>
        </span>
      </div>
      {truncated ? <div className="faint sm" role="note">מוצגים 2000 הרישומים האחרונים</div> : null}
      <div className="hfeed hres" id="hfeed" aria-busy={loading ? 'true' : undefined}>
        {error ? (
          <div className="hf-empty" role="status"><OcIcon name="alert" size="lg" /><b>טעינת ההיסטוריה נכשלה</b><button type="button" onClick={onRetry}>נסו שוב</button></div>
        ) : !entries ? (
          <div className="hf-empty" role="status"><span className="spinner" aria-hidden="true" /><b>טוען היסטוריה...</b></div>
        ) : !list.length ? (
          <div className="hf-empty" role="status"><OcIcon name="search" size="lg" /><b>לא נמצאו רישומים</b><button type="button" onClick={resetAll}>איפוס</button></div>
        ) : view === 'table' ? (
          <OcHistoryTable entries={list} sort={sort} onSort={setSort} words={words} />
        ) : (
          <div className="hgrp">
            {list.map((e, i) => {
              const auto = words.length > 0 && !words.every((w) => String(e.text).toLowerCase().includes(w));
              const isOpen = open[e.id] !== undefined ? open[e.id] : auto;
              return <FeedRow key={e.id} e={e} i={i} words={words} open={isOpen} onToggle={() => setOpen((o) => ({ ...o, [e.id]: !isOpen }))} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function amountText(e) {
  if (typeof e.amt !== 'number' || !e.amt) return null;
  return e.kind === 'pay' ? fmtMoney(e.amt) : fmtSignedMoney(e.amt);
}

function FeedRow({ e, i, words, open, onToggle }) {
  const det = e.det || [];
  const bf = det.find((x) => x[0] === 'לפני');
  const af = det.find((x) => x[0] === 'אחרי');
  const amt = amountText(e);
  const init = String(e.who || '?').trim()[0] || '?';
  const onKey = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onToggle(); } };
  return (
    <article className={`hrow${open ? ' open' : ''}`} data-hv={e.id} style={{ '--i': Math.min(i, 12) }}>
      <div className="li rlink lrow" role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={onKey}>
        <div className="ic-b"><OcIcon name={e.icon || 'clock'} /><span className="rlbl">{ROW_CATEGORY_LABEL[e.cat] || 'רישום'}</span></div>
        <div className="t">
          <b><Hl text={e.text} words={words} /></b>
          <span className="ln">
            {shortHebrew(e.dateHe)}
            {e.time && !e.dateOnly ? <> · <bdi>{e.time}</bdi></> : null}
            {e.who ? <> · <Hl text={e.who} words={words} /></> : null}
            {e.sub ? <> · <Hl text={e.sub} words={words} /></> : null}
            {amt ? <> · <bdi dir="ltr">{amt}</bdi></> : null}
          </span>
        </div>
        <span className="go" aria-hidden="true"><OcIcon name="chev" size="sm" /></span>
      </div>
      <div className="hdet">
        <div className="hdet-in">
          <div className="hv-r"><small>מבצע</small><b><span className="av">{init}</span><Hl text={e.who || 'לא ידוע'} words={words} /></b></div>
          <div className="hv-r"><small>שעה</small><b>{e.time && !e.dateOnly ? <bdi><Hl text={e.time} words={words} /></bdi> : `${e.weekdayHe || ''} ${e.dateHe || ''}`.trim()}</b></div>
          {e.sub ? <div className="hv-r"><small>פרטים</small><b><Hl text={e.sub} words={words} /></b></div> : null}
          {bf && af ? <div className="hv-r"><small>שינוי</small><b><bdi><Hl text={bf[1]} words={words} /></bdi> ← <bdi><Hl text={af[1]} words={words} /></bdi></b></div> : null}
          {det.filter(([k]) => !(bf && af && (k === 'לפני' || k === 'אחרי'))).map(([k, v], n) => (
            <div className="hv-r" key={`${k}-${n}`}><small>{k}</small><b><Hl text={v} words={words} /></b></div>
          ))}
        </div>
      </div>
    </article>
  );
}
