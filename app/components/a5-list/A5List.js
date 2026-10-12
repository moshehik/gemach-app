'use client';

// מדריך האתר (lib/aiGuide/areas/ops.targets.js): כשהדף מעביר guide="ol" / guide="cl" מוצמדים data-guide-id (ol.* = רשימת ההזמנות, cl.* = רשימת הלקוחות). בלי guide - שום תכונה לא מתווספת.
// A5List - מנוע הרשימות החדש (פורט React של createList() ב-scratch/emp-models-build/list-core.js, העיצוב המאושר):
// שדה חיפוש (חיפוש חכם AI + שאלות סטטיסטיקה + ניקוי), לחצן "סינון" אחד עם קבוצות (ספירות, אפשרות בלי תוצאות מוסתרת אלא אם נבחרה,
// "נקה סינון"), מיון עם כיוון, מתג שורות / טבלה, סרגל תוצאות דביק (נצבע אפרסק כשהוא נדבק), עימוד 50 בקפסולה, שורות עם חץ הרחבה
// ולחיצה על השורה, פירוט מורחב (hv-r + פעולות), טבלה עם מיון בכותרות, לחצני ייצוא, מצב ריק, אנימציות, מקלדת ונגישות.
// כל התיעוד של ה-API: docs/a5-staff-models/kit-notes.md.
//
// שני מצבי עימוד:
//   * לקוח (ברירת מחדל): items = כל הרשימה; הסינון / המיון / החיפוש (hay) / העימוד נעשים כאן (listLogic.js).
//   * שרת: מועברים total + page + onPage; items = העמוד הנוכחי בלבד, ההורה מסנן / ממיין / מעמד לפי onStateChange ומספק ספירות
//     לאפשרויות (filters[].options[].count).

import './a5-list.css';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ic, useA5Sprite } from './A5Icon';
import { ExportTrio, HlText, Pager, ViewSwitch } from './A5Parts';
import {
  PAGE_SIZE, clampPage, computeVisible, findSorter, initialSelection, isOptionHidden, optionCount, pageCount, pageSlice,
  filterSummary, totalSelected, wordsOf,
} from './listLogic';

const keyOf = (v) => String(v);

function A5ListInner(props, ref) {
  const {
    items, getId, texts = {}, hay, filters = [], sorts = [], defaultSort, defaultView = 'list', defaultQuery = '',
    rowMain, rowClass, detail, columns = [], onOpen, loading = false, error = null, onRetry,
    searchSlot = null, localSearch = true, onQueryChange, ai = null, onStats = null, exportSpec = null,
    total = null, page: pageProp = 1, onPage, pageSize = PAGE_SIZE,
    barExtra = null, emptyExtra = null, notices = null, onStateChange, onFilterOpen = null, className = '', guide = null,
  } = props;
  const server = total != null;
  const gid = (name) => (guide ? `${guide}.${name}` : undefined); // data-guide-id (מדריך האתר)

  const rootRef = useRef(null);
  const barRef = useRef(null);
  const [q, setQ] = useState(defaultQuery);
  const [aiOn, setAiOn] = useState(false);
  const [sel, setSel] = useState(() => initialSelection(filters));
  const [sort, setSort] = useState(() => defaultSort || { k: (sorts[0] || {}).k, dir: 1 });
  const [view, setView] = useState(defaultView);
  const [pageC, setPageC] = useState(1);
  const [open, setOpen] = useState({});
  const [pop, setPop] = useState(null);
  // תוספת תואמת-לאחור: הדף מקבל הודעה כשחלון "סינון" נפתח / נסגר (רשימות הזמנות / לקוחות טוענות ספירות אפשרויות רק כשהחלון פתוח)
  const filterCb = useRef(null);
  useEffect(() => { filterCb.current = onFilterOpen; });
  const filterOpen = pop === 'filter';
  useEffect(() => { if (filterCb.current) filterCb.current(filterOpen); }, [filterOpen]);
  const [fx, setFx] = useState({ seq: 0, on: false }); // seq: מפתח הרינדור מחדש של הפיד (משחזר את אנימציית הכניסה); on: מחלקת .animate
  const [stuck, setStuck] = useState(false);
  const [slotEl, setSlotEl] = useState(null);

  useA5Sprite();

  /* ---- משבצת החיפוש (portal) ---- */
  useEffect(() => {
    if (!searchSlot) { setSlotEl(null); return undefined; }
    const el = typeof searchSlot === 'string' ? document.getElementById(searchSlot) : searchSlot;
    setSlotEl(el || null);
    return undefined;
  }, [searchSlot]);

  /* ---- נגזרות ---- */
  const words = useMemo(() => (aiOn ? [] : wordsOf(q)), [aiOn, q]);
  const sorter = findSorter(sorts, sort.k);
  const visible = useMemo(() => (server ? items : computeVisible({ items, words, hay, filters, sel, sorts, sort, localSearch })),
    [server, items, words, hay, filters, sel, sorts, sort, localSearch]);
  const n = server ? total : visible.length;
  const pages = pageCount(n, pageSize);
  const curPage = server ? Math.max(1, Math.min(pages, pageProp || 1)) : clampPage(pageC, n, pageSize);
  const shown = server ? items : pageSlice(visible, curPage, pageSize);

  // ספירות לכל אפשרות (optCount): בלקוח - על כל הפריטים שעוברים את החיפוש ואת הקבוצות האחרות; בשרת - count שההורה סיפק
  const counts = useMemo(() => {
    const map = {};
    const base = { items, words, hay, filters, sel, localSearch };
    filters.forEach((f) => f.options.forEach((o) => {
      map[`${f.key}\u0000${o.k}`] = server || typeof o.test !== 'function' ? (o.count == null ? 0 : o.count) : optionCount(base, f, o);
    }));
    return map;
  }, [items, words, hay, filters, sel, localSearch, server]);
  const countOf = (f, o) => counts[`${f.key}\u0000${o.k}`];
  const totalSel = totalSelected(filters, sel);
  // אנימציית "פופ" של התג כשמספר הסינונים משתנה אחרי הטעינה (hf-bdg.pop); המפתח לפי המספר משחזר את האלמנט והאנימציה מתחילה מחדש
  const firstBdg = useRef(true);
  const [popOn, setPopOn] = useState(false);
  useEffect(() => { if (firstBdg.current) { firstBdg.current = false; return; } setPopOn(true); }, [totalSel]);
  const popBdg = popOn && totalSel > 0;
  const offsets = useMemo(() => filters.map((f, idx) => filters.slice(0, idx).reduce((n0, g) => n0 + g.options.length, 0)), [filters]);

  /* ---- הודעת מצב להורה (מצב שרת) / שינוי טקסט החיפוש (חיפוש בשרת) ---- */
  const stateRef = useRef(null);
  const cbRef = useRef(null);
  const qcb = useRef(null);
  useLayoutEffect(() => {
    stateRef.current = { q, ai: aiOn, sel, sort, view, page: curPage, total: n };
    cbRef.current = onStateChange;
    qcb.current = onQueryChange;
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (cbRef.current) cbRef.current(stateRef.current);
  }, [q, aiOn, sel, sort, view, curPage]);
  const firstQ = useRef(true);
  useEffect(() => {
    if (firstQ.current) { firstQ.current = false; return; }
    if (qcb.current && !aiOn) qcb.current(q);
  }, [q, aiOn]);

  /* ---- פעולות ---- */
  const bump = (animated) => setFx((f) => ({ seq: animated ? f.seq + 1 : f.seq, on: animated }));
  const gotoPage = (p, scroll = true) => {
    const np = Math.max(1, Math.min(pages, p));
    if (np === curPage) return;
    if (server) { if (onPage) onPage(np); } else setPageC(np);
    bump(true);
    if (scroll !== false && barRef.current) {
      const top = barRef.current.getBoundingClientRect().top;
      if (top < 70 || top > window.innerHeight - 160) window.scrollTo({ top: window.scrollY + top - 90, behavior: 'smooth' });
    }
  };
  const resetPage = () => { setPageC(1); if (server && onPage && pageProp !== 1) onPage(1); };
  const toggleRow = (id) => setOpen((o) => ({ ...o, [keyOf(id)]: !o[keyOf(id)] }));

  const pickFilter = (g, k) => {
    setSel((s) => { const cur = s[g] || []; return { ...s, [g]: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] }; });
    resetPage(); bump(true);
  };
  const pickSort = (k) => {
    setSort((s) => (s.k === k ? { k, dir: -s.dir } : { k, dir: 1 }));
    resetPage(); bump(true);
  };
  const flipSort = () => { setSort((s) => ({ ...s, dir: -s.dir })); resetPage(); bump(true); };
  const clearFilters = () => { setSel(() => { const s = {}; filters.forEach((f) => { s[f.key] = []; }); return s; }); resetPage(); bump(true); };
  const resetAll = () => {
    setQ(''); setSel(() => { const s = {}; filters.forEach((f) => { s[f.key] = []; }); return s; });
    if (ai && ai.onReset) ai.onReset();
    resetPage(); bump(true);
  };
  const clearQuery = (focus) => {
    setQ(''); if (ai && ai.onReset) ai.onReset();
    resetPage(); bump(false);
    if (focus) { const i = rootRef.current && (slotEl || rootRef.current).querySelector('input[type=search]'); if (i) i.focus(); }
  };
  const setView2 = (v) => { setView(v); bump(true); };

  useImperativeHandle(ref, () => ({
    getState: () => stateRef.current,
    reset: resetAll,
    setPage: (p) => gotoPage(p, false),
    clearQuery,
    // תוספת תואמת-לאחור (רשימות הזמנות / לקוחות): קביעת הבחירה של קבוצת סינון אחת מהדף (למשל ביטול "טווח מותאם" שנסגר בלי בחירה)
    setGroup: (key, keys) => { setSel((s) => ({ ...s, [key]: Array.isArray(keys) ? keys : [] })); resetPage(); bump(true); },
  }));

  /* ---- חלונות הסינון / מיון ---- */
  const popSel = (key) => (slotEl && slotEl.querySelector(`.hf-sel[data-fk="${key}"]`)) || (rootRef.current && rootRef.current.querySelector(`.hf-sel[data-fk="${key}"]`));
  const openPop = (key, focus) => {
    setPop(key);
    if (key && focus) {
      setTimeout(() => {
        const el = popSel(key);
        const o = el && (el.querySelector('.hf-o[aria-selected=true]:not([hidden])') || el.querySelector('.hf-o:not([hidden])'));
        if (o) o.focus();
      }, 30);
    }
  };
  useEffect(() => {
    if (!pop) return undefined;
    const off = (e) => { if (!e.target.closest || !e.target.closest('.hf-sel')) setPop(null); };
    document.addEventListener('click', off);
    return () => document.removeEventListener('click', off);
  }, [pop]);

  const onPopKey = (e) => {
    const t = e.target;
    if (e.key === 'Escape' && pop) {
      e.preventDefault(); const k = pop; setPop(null);
      const tr = popSel(k) && popSel(k).querySelector('.hf-t'); if (tr) tr.focus();
      return;
    }
    const trg = t.closest && t.closest('.hf-t');
    if (trg && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openPop(trg.closest('.hf-sel').dataset.fk, true); return; }
    const o = t.closest && t.closest('[data-hf-o]');
    if (!o) return;
    const all = [...o.closest('.hf-l').querySelectorAll('.hf-o:not([hidden])')];
    const i = all.indexOf(o);
    if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length].focus(); }
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); o.click();
      const g = o.dataset.g; const v = o.dataset.hfO;
      setTimeout(() => { const nx = popSel(g === 'sort' ? 'sort' : 'filter'); const el = nx && nx.querySelector(`.hf-o[data-g="${g}"][data-hf-o="${v}"]`); if (el) el.focus(); }, 0);
    }
  };

  /* ---- סרגל התוצאות הדביק: נצבע אפרסק כשהוא נדבק מתחת לתפריט העליון ---- */
  useEffect(() => {
    const onScroll = () => {
      const b = barRef.current;
      if (!b) return;
      const cs = getComputedStyle(b).getPropertyValue('--snav-h');
      const top = (parseFloat(cs) || 64) + 10;
      setStuck(b.getBoundingClientRect().top <= top + 1 && window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => { window.removeEventListener('scroll', onScroll); document.removeEventListener('scroll', onScroll, true); };
  }, []);

  /* ---- שורה: לחיצה / מקלדת ---- */
  const rowClick = (e, it) => {
    const t = e.target;
    if (t.closest('.hdet a,.hdet button,.hdet input')) return;
    if (t.closest('[data-expand]')) { e.stopPropagation(); toggleRow(getId(it)); return; }
    // onOpen שמחזיר false = אין יעד לשורה הזו - הפרטים נפתחים (תוספת תואמת-לאחור; יומן המיילים: שורה בלי הזמנה / לקוח)
    if (!onOpen || onOpen(it) === false) toggleRow(getId(it));
  };
  const rowKey = (e, it) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!onOpen || onOpen(it) === false) toggleRow(getId(it)); }
  };

  /* ---- ציור ---- */
  const hl = (s) => <HlText text={s} words={words} />;
  const rowCtx = { hl, words };
  const placeholder = aiOn ? (texts.aiPlaceholder || texts.placeholder) : texts.placeholder;

  const onSearchKey = (e) => {
    if (e.key === 'Escape' && e.target.value) { e.stopPropagation(); clearQuery(false); return; }
    if (e.key === 'Enter' && aiOn && e.target.value.trim() && ai && ai.onSubmit) ai.onSubmit(e.target.value.trim());
  };
  const toggleAi = () => {
    setAiOn((v) => !v);
    const i = (slotEl || rootRef.current) && (slotEl || rootRef.current).querySelector('input[type=search]'); if (i) i.focus();
  };

  const filterEl = (
    <div className={`hf-sel${pop === 'filter' ? ' on' : ''}`} data-fk="filter" onKeyDown={onPopKey}>
      <button type="button" className="hf-t" data-guide-id={gid('filter')} aria-haspopup="listbox" aria-expanded={pop === 'filter'} onClick={() => (pop === 'filter' ? setPop(null) : openPop('filter', false))}>
        <Ic id="sliders" /><span className="hf-lbl">סינון</span><span key={totalSel} className={`hf-bdg${totalSel ? ' has' : ''}${popBdg ? ' pop' : ''}`}>{totalSel || ''}</span><Ic id="chev" className="hf-chv" />
      </button>
      <div className="hf-scrim" onClick={() => setPop(null)} />
      <div className="hf-p">
        <div className="hf-all"><button type="button" className="hf-allb" onClick={clearFilters}>נקה סינון</button></div>
        <div className="hf-l" role="listbox" aria-multiselectable="true" aria-label="סינון">
          {filters.map((f, fi) => <FilterGroup key={f.key} f={f} sel={sel[f.key] || []} counts={counts} startIdx={offsets[fi]} onPick={pickFilter} guide={guide} />)}
        </div>
      </div>
    </div>
  );

  const searchEl = (
    <div className="hf-s">
      {ai && ai.loading ? <span className="spinner a5l-sp" aria-hidden="true" /> : <Ic id={aiOn ? 'sparkle' : 'search'} />}
      <input type="search" data-guide-id={gid('search')} autoComplete="off" placeholder={placeholder} aria-label="חיפוש" value={q} onChange={(e) => { setQ(e.target.value); resetPage(); bump(false); }} onKeyDown={onSearchKey} />
      <button type="button" className={`hf-cl${q ? ' on' : ''}`} aria-label="ניקוי חיפוש" onClick={() => clearQuery(true)}><Ic id="x" /></button>
      {ai ? <button type="button" className={`hf-ib${aiOn ? ' on' : ''}`} data-guide-id={gid('ai')} aria-pressed={aiOn} aria-label="חיפוש חכם (AI)" data-tip="חיפוש חכם (AI)" onClick={toggleAi}><Ic id="sparkle" /></button> : null}
      {onStats ? <button type="button" className="hf-ib" data-guide-id={gid('stats')} aria-label="שאלות סטטיסטיקה" data-tip="שאלות סטטיסטיקה" onClick={onStats}><Ic id="sn-chart" /></button> : null}
      {filters.length ? filterEl : null}
    </div>
  );

  const sortEl = sorts.length ? (
    <div className={`hf-sel hf-sort${pop === 'sort' ? ' on' : ''}`} data-fk="sort" onKeyDown={onPopKey}>
      <button type="button" className="hf-t" data-guide-id={gid('sort')} aria-haspopup="listbox" aria-expanded={pop === 'sort'} data-tip={sort.dir > 0 ? 'מיון עולה' : 'מיון יורד'} onClick={() => (pop === 'sort' ? setPop(null) : openPop('sort', false))}>
        <Ic id="sortv" className={sort.dir > 0 ? '' : 'flip'} /><span className="hf-lbl">מיון: <b>{sorter ? sorter.l : ''}</b></span><Ic id="chev" className="hf-chv" />
      </button>
      <div className="hf-scrim" onClick={() => setPop(null)} />
      <div className="hf-p">
        <div className="hf-all"><button type="button" className="hf-allb sdirb" onClick={flipSort}><Ic id="arrlr" size="sm" />{sort.dir > 0 ? 'מהקטן לגדול (א–ת)' : 'מהגדול לקטן (ת–א)'} · הפוך</button></div>
        <div className="hf-l" role="listbox" aria-label="מיון">
          {sorts.map((o, i) => (
            <div key={o.k} className="hf-o" role="option" tabIndex={-1} data-g="sort" data-hf-o={o.k} style={{ '--k': i }} aria-selected={sort.k === o.k} onClick={() => pickSort(o.k)}>
              <span className="hf-ck"><Ic id="check" /></span><span className="hf-oi"><Ic id={o.i || 'list'} /></span><span className="hf-ol">{o.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  /* ---- הפיד ---- */
  let feed;
  if (loading && !shown.length) {
    feed = <div className="hf-empty" role="status"><span className="spinner" aria-hidden="true" /><b>טוען…</b></div>;
  } else if (error && !shown.length) {
    feed = <div className="hf-empty" role="status"><Ic id="alert" size="lg" /><b>{error}</b>{onRetry ? <button type="button" onClick={onRetry}>נסו שוב</button> : null}</div>;
  } else if (!shown.length) {
    feed = (
      <div className="hf-empty" role="status"><Ic id="search" size="lg" /><b>{texts.emptyText || 'לא נמצאו תוצאות'}</b>
        <button type="button" onClick={resetAll}>איפוס החיפוש והסינון</button>{emptyExtra}</div>
    );
  } else if (view === 'table') {
    feed = (
      <div className="tblw" key={`t${fx.seq}`}>
        <table className="rtbl etbl">
          <thead><tr>
            {columns.map((c) => {
              if (!c.k) return <th key={c.t}><span className="thw">{c.t}</span></th>;
              const on = sort.k === c.k;
              return (
                <th key={c.k} className={on ? `sorted ${sort.dir > 0 ? 'asc' : 'desc'}` : ''} aria-sort={on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                  <span className="thw">{c.t}<span className="tsort">
                    <button type="button" className="tsb tu" aria-label={`מיון ${c.t} עולה`} onClick={() => { setSort({ k: c.k, dir: 1 }); resetPage(); bump(false); }}><Ic id="chev" size="sm" /></button>
                    <button type="button" className="tsb td" aria-label={`מיון ${c.t} יורד`} onClick={() => { setSort({ k: c.k, dir: -1 }); resetPage(); bump(false); }}><Ic id="chev" size="sm" /></button>
                  </span></span>
                </th>
              );
            })}
          </tr></thead>
          <tbody>
            {shown.map((it, i) => (
              <tr key={keyOf(getId(it))} className={`erow${rowClass ? ` ${rowClass(it)}` : ''}`} data-id={getId(it)} style={{ '--i': i % 12 }} tabIndex={0}
                onClick={() => { if (onOpen) onOpen(it); }} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget && onOpen) onOpen(it); }}>
                {columns.map((c, ci) => <td key={c.k || ci} className={c.tdClass ? c.tdClass(it) : undefined}>{c.cell(it, rowCtx)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    feed = (
      <div className="hgrp" key={`l${fx.seq}`}>
        {shown.map((it, i) => {
          const id = keyOf(getId(it));
          const isOpen = !!open[id];
          return (
            <article key={id} className={`hrow irow erow${isOpen ? ' open' : ''}${rowClass ? ` ${rowClass(it)}` : ''}`} data-id={id} style={{ '--i': i % 12 }} onClick={(e) => rowClick(e, it)}>
              <div className="li rlink lrow" role="button" tabIndex={0} aria-expanded={isOpen} onKeyDown={(e) => rowKey(e, it)}>
                {rowMain(it, { ...rowCtx, open: isOpen })}
                <button type="button" className="go" data-expand aria-label="פרטים מהירים" data-tip="פרטים מהירים" aria-expanded={isOpen}><Ic id="chev" size="sm" /></button>
              </div>
              <div className="hdet"><div className="hdet-in">{detail ? detail(it, { ...rowCtx, open: isOpen }) : null}</div></div>
            </article>
          );
        })}
      </div>
    );
  }

  const exportKinds = exportSpec && exportSpec.kinds;
  // ייצוא: לכל סוג יש callback ייעודי (onExcel / onDownload / onPrint) או onExport(kind, rows, state, info) כללי.
  // rows = כל הרשימה אחרי חיפוש + סינון + מיון (מצב שרת: העמוד הנוכחי); info = { filterText, query, total, kind } - תיאור הסינון הפעיל לכותרת דף ההדפסה / ה-PDF.
  const doExport = (kind) => {
    if (!exportSpec) return;
    const st = stateRef.current;
    const parts = [filterSummary(filters, st.sel), st.q && !st.ai ? `חיפוש: ${st.q}` : ''].filter(Boolean);
    const info = { kind, filterText: parts.join(' · '), query: st.ai ? '' : st.q, total: n, sort: { key: sort.k, label: sorter ? sorter.l : '', dir: sort.dir }, view };
    const named = { excel: exportSpec.onExcel, download: exportSpec.onDownload, print: exportSpec.onPrint }[kind];
    if (named) named(visible, st, info);
    else if (exportSpec.onExport) exportSpec.onExport(kind, visible, st, info);
  };

  return (
    <div className={`a5l${className ? ` ${className}` : ''}`} ref={rootRef}>
      {slotEl ? createPortal(searchEl, slotEl) : null}
      <div className="hf-bar">
        {slotEl ? null : searchEl}
        <div className="hf-pills" />
        <span className="hf-sr" role="status" aria-live="polite">{`${n} ${texts.countLabel || ''}`}</span>
      </div>
      {notices && notices.length ? (
        <div role="status" aria-live="polite" data-search-notices="1">
          {notices.map((n) => <div key={n.kind || n.text} className="muted" data-notice-kind={n.kind} style={{ padding: '6px 16px' }}><Ic id="info" size="sm" /> <span>{n.text}</span></div>)}
        </div>
      ) : null}
      <div className={`hres-bar${stuck ? ' stuck' : ''}`} ref={barRef}>
        <span className="hres-n">{texts.countLabel}{' '}<b>{n}{texts.countSuffix || ''}</b></span>
        {columns.length ? <ViewSwitch value={view} onChange={setView2} guide={guide} /> : null}
        {sortEl}
        {barExtra}
        <div className="pg-slot"><Pager n={n} page={curPage} pages={pages} pageSize={pageSize} onPage={(p) => gotoPage(p)} /></div>
        {exportSpec ? <span className="hres-x"><ExportTrio what={exportSpec.what} kinds={exportKinds} onPick={doExport} guide={guide} /></span> : null}
      </div>
      <div className={`hfeed hres${fx.on ? ' animate' : ''}`}>{feed}</div>
    </div>
  );
}

// קבוצת סינון: כותרת + אפשרויות. startIdx = האינדקס הרץ של האנימציה (--k) - נשמר ברצף על פני כל הקבוצות
function FilterGroup({ f, sel, counts, startIdx, onPick, guide }) {
  return (
    <>
      <div className="hf-gh" data-gh={f.key} data-guide-id={guide ? `${guide}.filter-${f.key}` : undefined}><Ic id={f.icon} size="sm" />{f.label}</div>
      {f.options.map((o, i) => {
        const c = counts[`${f.key}\u0000${o.k}`];
        const on = sel.includes(o.k);
        return (
          <div key={o.k} className="hf-o" role="option" tabIndex={-1} data-g={f.key} data-hf-o={o.k} style={{ '--k': startIdx + i }} aria-selected={on} hidden={isOptionHidden(c, on)} onClick={() => onPick(f.key, o.k)}>
            <span className="hf-ck"><Ic id="check" /></span><span className="hf-oi"><Ic id={o.i || 'list'} /></span><span className="hf-ol">{o.l}</span><span className="hf-oc">{c}</span>
          </div>
        );
      })}
    </>
  );
}

const A5List = forwardRef(A5ListInner);
export default A5List;
