'use client';

// לשונית "היסטוריה" (העיצוב: pHistory / hfFeed / hfTable). היסטוריה מעורבת אמיתית (hmix) מ-GET /api/customers/[id]/history:
// שינויי פרטים (שורה לכל שדה), הזמנות, תשלומים, זיכויים, מיילים, הדפסות/ייצוא/אישורי מנהל של הכרטיס החדש - כולל הפעולות
// האמיתיות שאין בדגימה (הערה אוטומטית, חסימה / ביטול חסימה, עדכון בנק - hreal). חיפוש + סינון רב-בחירה לפי קטגוריות (hfilter),
// מתג רשימה / טבלה + Excel / הורדה (PDF) / הדפסה (hexp). תאריכים עבריים בלבד. ייצוא נרשם כ-HISTORY_EXPORTED.

import { useEffect, useMemo, useRef, useState } from 'react';
import CcIcon, { XlGlyph } from '../CcIcon';
import { SortTh, ViewSwitch, sortRows } from '../CcViewSwitch';
import { histCats, histIn, histRowData, histVisible, histWords, displayName, safeFileBase } from '../customerCardLogic';
import { logCustomerEvent } from '../ccEvents';

const CAT_LABEL = { cust: 'פרטים', orders: 'הזמנה', pay: 'תשלום', docs: 'מסמך' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => `₪${Math.abs(Number(n) || 0).toLocaleString('he-IL')}`;

function Hl({ text, words }) {
  const s = String(text ?? '');
  if (!words.length || !s) return s;
  const re = new RegExp(`(${words.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = s.split(re);
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="hf-mk">{p}</mark> : p))}</>;
}

// HTML עצמאי לייצוא (PDF / הדפסה) - בלי משתני CSS של האתר (מוסכמת דפי ההדפסה: חלון חדש אין לו :root)
export function historyExportHtml(rows, title) {
  const tr = rows.map((r) => `<tr><td>${esc(r.act)}</td><td>${esc(r.dateText)}</td><td>${esc(r.prev)}</td><td>${esc(r.new)}</td><td>${esc(r.who)}</td></tr>`).join('');
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;background:#fff}h1{font-size:20px;margin:0 0 12px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h1>${esc(title)}</h1>
<table><thead><tr><th>פעולה</th><th>תאריך</th><th>קודם</th><th>חדש</th><th>עובד מבצע</th></tr></thead><tbody>${tr}</tbody></table></body></html>`;
}

export default function CcHistoryTab({ cc, ui, active }) {
  const [entries, setEntries] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const [popOpen, setPopOpen] = useState(false);
  const [view, setView] = useState('list');
  const [sort, setSort] = useState({ col: 'date', dir: -1 });
  const [open, setOpen] = useState({});
  const selRef = useRef(null);
  const loaded = useRef(-1);

  const fetchPage = async (cur) => {
    try {
      const res = await fetch(`/api/customers/${cc.customerId}/history?limit=200${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת ההיסטוריה');
      setEntries((prev) => (cur && prev ? [...prev, ...(data.entries || [])] : (data.entries || [])));
      setCursor(data.nextCursor || null);
      setErr('');
    } catch (e) {
      setErr(e.message || 'שגיאה בטעינת ההיסטוריה');
      if (!cur) setEntries([]);
    }
  };
  // נטען כשהלשונית נפתחת, ושוב אחרי כל פעולה שנרשמת (שמירה, תשלום, הדפסה...)
  useEffect(() => {
    if (!active || loaded.current === cc.historyTick) return;
    loaded.current = cc.historyTick;
    fetchPage(null);
  }, [active, cc.historyTick]);

  useEffect(() => {
    if (!popOpen) return undefined;
    const off = (e) => { if (selRef.current && !selRef.current.contains(e.target)) setPopOpen(false); };
    const esc2 = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setPopOpen(false); } };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc2, true);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc2, true); };
  }, [popOpen]);

  const list = entries || [];
  const words = histWords(q);
  const cats = useMemo(() => histCats(list), [list]);
  const visible = useMemo(() => histVisible(list, sel, q), [list, sel, q]);
  const count = (k) => histVisible(list, [], q).filter((e) => histIn(e, k)).length;
  const allOn = cats.length && cats.every(([k]) => sel.includes(k));
  const toggle = (k) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const tableRows = useMemo(() => sortRows(visible.map((e) => ({ e, r: histRowData(e) })), sort, (x, k) => x.r[k]), [visible, sort]);
  const exportRows = () => tableRows.map(({ e, r }) => ({ ...r, dateText: `${e.hebrewDate} · ${e.time}` }));
  const title = `היסטוריה · ${displayName(cc.saved)}`;

  const exportX = async (kind) => {
    const rows = exportRows();
    if (!rows.length) { ui.toast('info', 'אין רישומים לייצוא'); return; }
    const base = safeFileBase(title);
    try {
      if (kind === 'excel') {
        const XLSX = await import('xlsx');
        const { buildRowsWorkbook } = await import('@/lib/xlsxExport');
        const wb = buildRowsWorkbook(XLSX, rows.map((r) => ({ 'פעולה': r.act, 'תאריך': r.dateText, 'קודם': r.prev, 'חדש': r.new, 'עובד מבצע': r.who })), { sheetName: 'היסטוריה' });
        XLSX.writeFile(wb, `${base}.xlsx`, { cellDates: true });
        logCustomerEvent(cc.customerId, 'HISTORY_EXPORTED', { format: 'xlsx', rows: rows.length });
        ui.toast('info', 'קובץ Excel של ההיסטוריה ירד');
      } else if (kind === 'download') {
        ui.toast('info', 'מכין קובץ…');
        const { downloadPdf } = await import('@/app/lib/pdfClient');
        await downloadPdf({ html: historyExportHtml(rows, title), filename: base }, `${base}.pdf`);
        logCustomerEvent(cc.customerId, 'HISTORY_EXPORTED', { format: 'pdf', rows: rows.length });
        ui.toast('info', 'ההיסטוריה ירדה כקובץ');
      } else {
        const w = window.open('', '_blank', 'width=1000,height=800');
        if (!w) { ui.toast('error', 'הדפדפן חסם את חלון ההדפסה'); return; }
        w.document.open();
        w.document.write(historyExportHtml(rows, title));
        w.document.close();
        setTimeout(() => { try { w.focus(); w.print(); } catch { /* closed */ } }, 300);
        logCustomerEvent(cc.customerId, 'HISTORY_EXPORTED', { format: 'print', rows: rows.length });
      }
    } catch (e2) {
      ui.toast('error', (e2 && e2.message) || 'הייצוא נכשל');
    }
  };

  let feed;
  if (entries === null) feed = <div className="hf-empty" role="status"><span className="spinner" aria-hidden="true" /><b>טוען היסטוריה…</b></div>;
  else if (err && !list.length) feed = <div className="hf-empty" role="status"><CcIcon name="alert" size="lg" /><b>{err}</b><button type="button" onClick={() => fetchPage(null)}>נסו שוב</button></div>;
  else if (!visible.length) feed = <div className="hf-empty" role="status"><CcIcon name="search" size="lg" /><b>לא נמצאו רישומים</b><button type="button" data-hf-resetall onClick={() => { setSel([]); setQ(''); }}>איפוס</button></div>;
  else if (view === 'table') {
    feed = (
      <div className="tblw"><table className="rtbl"><thead><tr>
        {[['act', 'פעולה'], ['date', 'תאריך'], ['prev', 'קודם'], ['new', 'חדש'], ['who', 'עובד מבצע']].map(([k, t]) => <SortTh key={k} col={k} label={t} sort={sort} onSort={setSort} />)}
      </tr></thead><tbody>{tableRows.map(({ e, r }) => (
        <tr key={e.id}><td><b><Hl text={r.act} words={words} /></b></td><td>{e.hebrewDate} · <bdi>{e.time}</bdi></td><td><Hl text={r.prev} words={words} /></td><td><Hl text={r.new} words={words} /></td><td><Hl text={r.who} words={words} /></td></tr>
      ))}</tbody></table></div>
    );
  } else {
    feed = (
      <div className="hgrp">
        {visible.map((e, i) => {
          const o = !!open[e.id] || (words.length > 0 && !words.every((x) => String(e.title).toLowerCase().includes(x)));
          const amt = e.amount ? (e.amountKind === 'pay' ? money(e.amount) : `${e.amountKind === 'crd' ? '−' : '+'}${money(e.amount)}`) : '';
          const who = e.actor?.name || '';
          const pairs = (e.details || []).filter(([k]) => !(e.from !== undefined && (k === 'לפני' || k === 'אחרי')));
          const toggle2 = () => setOpen((s) => ({ ...s, [e.id]: !o }));
          return (
            <article key={e.id} className={`hrow${o ? ' open' : ''}`} data-hv={e.id} style={{ '--i': Math.min(i, 12) }}>
              <div className="li rlink lrow" role="button" tabIndex={0} aria-expanded={o} onClick={toggle2} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle2(); } }}>
                <div className="ic-b"><CcIcon name={e.icon || 'clock'} /><span className="rlbl">{CAT_LABEL[e.category] || 'רישום'}</span></div>
                <div className="t"><b><Hl text={e.title} words={words} /></b><span className="ln">{e.hebrewDate} · <bdi>{e.time}</bdi> · <Hl text={who} words={words} />{e.detail ? <> · <Hl text={e.detail} words={words} /></> : null}{amt ? <> · <bdi dir="ltr">{amt}</bdi></> : null}</span></div>
                <span className="go" aria-hidden="true"><CcIcon name="chev" size="sm" /></span>
              </div>
              <div className="hdet"><div className="hdet-in">
                <div className="hv-r"><small>מבצע</small><b><span className="av">{(who || '?').trim().charAt(0)}</span><Hl text={who} words={words} /></b></div>
                <div className="hv-r"><small>שעה</small><b><bdi>{e.time}</bdi></b></div>
                {e.detail ? <div className="hv-r"><small>פרטים</small><b><Hl text={e.detail} words={words} /></b></div> : null}
                {e.from !== undefined || e.to !== undefined ? <div className="hv-r"><small>שינוי</small><b><bdi><Hl text={e.from} words={words} /></bdi> ← <bdi><Hl text={e.to} words={words} /></bdi></b></div> : null}
                {pairs.map(([k, v], j) => <div className="hv-r" key={`${k}-${j}`}><small>{k}</small><b><Hl text={v} words={words} /></b></div>)}
                {e.entityRef && e.entityRef.href ? <div className="hv-r"><small>קישור</small><b><a href={e.entityRef.href} className="cc-tlink">הזמנה <bdi>#{e.entityRef.orderId}</bdi></a></b></div> : null}
              </div></div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="card hist">
      <div className="card-h"><div className="ico gold"><CcIcon name="clock" size="lg" /></div><h2>פעולות ושינויים</h2></div>
      <div className="hf-bar" id="hfBar">
        <div className="hf-s">
          <CcIcon name="search" />
          <input id="hfQ" type="search" autoComplete="off" placeholder="חיפוש בהיסטוריה" aria-label="חיפוש בהיסטוריה" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); } }} />
          <button type="button" className={`hf-cl${q ? ' on' : ''}`} aria-label="ניקוי חיפוש" data-tip="ניקוי חיפוש" onClick={() => setQ('')}><CcIcon name="x" /></button>
          <div className={`hf-sel${popOpen ? ' on' : ''}`} ref={selRef}>
            <button type="button" className="hf-t" aria-haspopup="listbox" aria-expanded={popOpen} aria-controls="hfList" onClick={() => setPopOpen((v) => !v)}>
              <CcIcon name="sliders" /><span className="hf-lbl">סינון</span><span className={`hf-bdg${sel.length ? ' has' : ''}`}>{sel.length || ''}</span><CcIcon name="chev" className="hf-chv" anim={false} />
            </button>
            <div className="hf-scrim" onClick={() => setPopOpen(false)} />
            <div className="hf-p">
              <div className="hf-all"><button type="button" className="hf-allb" onClick={() => setSel(allOn ? [] : cats.map(([k]) => k))}>{allOn ? 'הסר הכל' : 'סמן הכל'}</button></div>
              <div className="hf-l" id="hfList" role="listbox" aria-multiselectable="true" aria-label="סינון היסטוריה">
                {cats.map(([k, l, ic], n) => (
                  <div key={k} className="hf-o" role="option" id={`hfo-${k}`} tabIndex={-1} style={{ '--k': n }} aria-selected={sel.includes(k)}
                    onClick={() => toggle(k)} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(k); } }}>
                    <span className="hf-ck"><CcIcon name="check" anim={false} /></span><span className="hf-oi"><CcIcon name={ic} anim={false} /></span><span className="hf-ol">{l}</span><span className="hf-oc">{count(k)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="hf-pills">
          {sel.length && sel.length <= 3 ? sel.map((k) => { const c = cats.find((x) => x[0] === k); return c ? <button key={k} type="button" className="hf-pill" aria-label={`הסרת סינון ${c[1]}`} onClick={() => toggle(k)}><span className="hf-pi"><CcIcon name={c[2]} size="sm" anim={false} /></span>{c[1]}<CcIcon name="x" anim={false} /></button> : null; }) : null}
        </div>
        <span className="hf-sr" role="status" aria-live="polite">{`${visible.length} רישומים`}</span>
      </div>
      <div className="hres-bar">
        <span className="hres-n">תוצאות <b id="hfN">{visible.length}</b></span>
        <ViewSwitch value={view} onChange={setView} />
        <span className="hres-x">
          <button type="button" className="xlbtn xlg" aria-label="ייצוא ל-Excel" data-tip="ייצוא ההיסטוריה לקובץ Excel" onClick={() => exportX('excel')}><XlGlyph kind="excel" /></button>
          <button type="button" className="xlbtn xld" aria-label="הורדה" data-tip="הורדת ההיסטוריה כקובץ" onClick={() => exportX('download')}><XlGlyph kind="download" /></button>
          <button type="button" className="xlbtn xlp" aria-label="הדפסה" data-tip="הדפסת ההיסטוריה" onClick={() => exportX('print')}><XlGlyph kind="print" /></button>
        </span>
      </div>
      <div className="hfeed hres" id="hfeed">{feed}</div>
      {cursor ? <div className="cc-more"><button type="button" className="btn sm" onClick={() => fetchPage(cursor)}><CcIcon name="chev" size="sm" />רישומים ישנים יותר</button></div> : null}
    </div>
  );
}
