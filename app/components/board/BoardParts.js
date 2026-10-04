'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ScheduleIcon from '../schedule/ScheduleIcon';
import { LzPortal } from '../schedule/LzPortal';
import { STAGE_META, dressCountText } from '../schedule/scheduleMeta';
import {
  CATEGORY, WEEKDAYS, cellAlert, customerName, dayStageRows, isOrderLate, jumpMonths, localKey, monthTitle,
  orderCategory, stageCountText, validItems,
} from './boardLogic';

// רכיבי התצוגה של הלוח החודשי - כולם רכיבי פלטה (design-system/COMPONENTS.md) ורכיבי הלו״ז (schedule.css), בשמות של
// העיצוב המאושר (תצוגות-עיצוב/סיימתי-לעבוד/לוח-חודשי.html). אין כאן קריאות API.

export const Ic = ScheduleIcon;
// כלל האיחור של הארגון (late_return_threshold_days + non_working_days_extra) - BoardPage מספק, כל רכיב שמסמן איחור קורא
export const LateContext = createContext({});
export const useLateCfg = () => useContext(LateContext);
const WD_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// ---------- שורת החיפוש + מסנן השלבים (E01 + S01) ----------
// בדיוק הרכיב של חיפוש ההיסטוריה בכרטיס ההזמנה (היסטוריה 2/8/9/12/14 בפלטה, כרטיס-הזמנה.html #hfBar): גלולה עם אייקון
// חיפוש, לחצן ניקוי (hf-cl), ובתוכה לחצן "סינון" (hf-t) שפותח רשימה עם תיבות סימון, אייקון ומונה לכל שלב.
// החיפוש עצמו נשלח לשרת ב-Enter כמו בדף הקודם (search ב-/api/orders, רק בחודש המוצג); הסינון מסתיר מונים בתאים.
export function BoardSearchBar({ value, onChange, onSubmit, onClear, stages, totals, selected, onToggle, onShowAll, filterDisabled }) {
  const [open, setOpen] = useState(false);
  const selRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (selRef.current && !selRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); selRef.current?.querySelector('.hf-t')?.focus(); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const pills = selected.length && selected.length <= 3 ? selected : [];
  const metaOf = (k) => STAGE_META[k] || STAGE_META.order;
  const stageOf = (k) => stages.find((s) => s.key === k);
  return (
    <div className="hf-bar bd-search" id="bdSearch">
      <form className="hf-s" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <Ic name="search" />
        <input
          id="bdQ"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="חיפוש הזמנה (מספר הזמנה, שם לקוח)..."
          aria-label="חיפוש הזמנה לפי מספר הזמנה או שם לקוח"
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore=""
          data-form-type="other"
        />
        <button type="button" className={'hf-cl' + (value ? ' on' : '')} aria-label="ניקוי חיפוש" data-tip="ניקוי חיפוש" onClick={onClear} tabIndex={value ? 0 : -1}>
          <Ic name="x" />
        </button>
        <div className={'hf-sel' + (open ? ' on' : '')} ref={selRef}>
          <button
            type="button"
            className="hf-t"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls="bdStageList"
            disabled={filterDisabled}
            onClick={() => setOpen((v) => !v)}
          >
            <Ic name="sliders" />
            <span className="hf-lbl">סינון</span>
            <span className={'hf-bdg' + (selected.length ? ' has' : '')}>{selected.length || ''}</span>
            <Ic name="chev" className="hf-chv" />
          </button>
          <div className="hf-scrim" onClick={() => setOpen(false)} />
          <div className="hf-p">
            <div className="hf-all"><button type="button" className="hf-allb" onClick={onShowAll}>הצג הכל</button></div>
            <div className="hf-l" id="bdStageList" role="listbox" aria-multiselectable="true" aria-label="סינון לפי שלב">
              {stages.filter((s) => s.enabled).map((s, n) => {
                const on = selected.includes(s.key);
                return (
                  <div
                    key={s.key}
                    className="hf-o"
                    role="option"
                    tabIndex={0}
                    aria-selected={on}
                    style={{ '--k': n }}
                    onClick={() => onToggle(s.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(s.key); } }}
                  >
                    <span className="hf-ck"><Ic name="check" /></span>
                    <span className="hf-oi"><Ic name={metaOf(s.key).icon} /></span>
                    <span className="hf-ol">{s.label}</span>
                    <span className="hf-oc">{totals[s.key] || 0}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </form>
      {pills.length ? (
        <div className="hf-pills">
          {pills.map((k) => {
            const st = stageOf(k);
            if (!st) return null;
            return (
              <button key={k} type="button" className="hf-pill" aria-label={'הסרת סינון ' + st.label} onClick={() => onToggle(k)}>
                <span className="hf-pi"><Ic name={metaOf(k).icon} className="sm" /></span>{st.label}<Ic name="x" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ---------- כותרת החודש: הקודם / שם החודש (בורר חודשים) / הבא (MATCH-1, MATCH-2, E08, S07) ----------
// בורר החודשים = רכיב הלוח של הפלטה (.hc, לוח 1-6): 13 חודשים סביב החודש המוצג, החודש הנוכחי מסומן (today) והמוצג
// מודגש (on); החצים מזיזים את החלון ב-13 חודשים. בלי אייקון יומן ליד הכותרת (הבעלים, S07).
export function MonthHead({ date, today, onPrev, onNext, onPick }) {
  const [open, setOpen] = useState(false);
  const [win, setWin] = useState(0);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); wrapRef.current?.querySelector('.lz-jump')?.focus(); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); };
  }, [open]);
  const months = open ? jumpMonths(date, win) : [];
  const todayTitle = monthTitle(today);
  return (
    <div className="hc-h">
      <button type="button" className="hc-n" aria-label="החודש הקודם" data-tip="החודש הקודם" onClick={onPrev}><Ic name="chev" className="sm" /></button>
      <span className="lz-jw" ref={wrapRef}>
        <button
          type="button"
          className="hc-t lz-jump"
          id="mJump"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-tip="קפיצה לחודש"
          onClick={() => { setWin(0); setOpen((v) => !v); }}
        >
          {monthTitle(date)}<Ic name="chev" className="sm" />
        </button>
        {open ? (
          <div className="lz-pop bd-mp" role="dialog" aria-label="קפיצה לחודש">
            <div className="hc">
              <div className="hc-h">
                <button type="button" className="hc-n" aria-label="חודשים קודמים" data-tip="חודשים קודמים" onClick={() => setWin((w) => w - 1)}><Ic name="chev" className="sm" /></button>
                <span className="hc-t">קפיצה לחודש</span>
                <button type="button" className="hc-n hc-nn" aria-label="חודשים הבאים" data-tip="חודשים הבאים" onClick={() => setWin((w) => w + 1)}><Ic name="chev" className="sm" /></button>
              </div>
              <div className="hc-g bd-mpg">
                {months.map((m) => {
                  const parts = m.title.split(' ');
                  const year = parts.pop();
                  const isOn = m.title === monthTitle(date);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      className={'hc-d bd-mpd' + (m.title === todayTitle ? ' today' : '') + (isOn ? ' on' : '')}
                      aria-pressed={isOn}
                      onClick={() => { setOpen(false); onPick(m.date); }}
                    >
                      <span>{parts.join(' ')}</span><small>{year}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </span>
      <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" data-tip="החודש הבא" onClick={onNext}><Ic name="chev" className="sm" /></button>
    </div>
  );
}

// ---------- תא יום בגריד ----------
// כמו dayCell בעיצוב: אות היום (MATCH-4), שם החודש ביום הראשון, סימן התראה אחד (S10 + איחור החזרה E12, JDG-5), פרשה וחגים
// כטקסט פשוט (E10), מוני שלבים באותו גוון (S02), ושורות הזמנה קצרות כשיש עד 2 הזמנות; מעל 2 - אייקון "תצוגה מורחבת"
// (JDG-3: כמו היום, רק מעל 2). לחיצה על התא = מעבר ללו״ז היומי (S06). בלי תאריך לועזי (E11).
export function DayCell({ cell, orders, stageDay, stages, selected, onOpenDay, onExpand, onOrder, enableAlterations }) {
  const rows = dayStageRows(stageDay, stages, selected);
  const stageAlerts = rows.reduce((a, r) => a + (r.alerts ? r.alerts : 0), 0);
  const lateCfg = useLateCfg();
  const lateCount = orders.filter((o) => isOrderLate(o, lateCfg)).length;
  const alert = cellAlert(stageAlerts, lateCount);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const label = cell.hebrewLong + (total ? ' · ' + total + ' פעולות' : '') + (orders.length ? ' · ' + orders.length + ' הזמנות' : '');
  const open = (e) => {
    if (e.target.closest && e.target.closest('button,a')) return;
    onOpenDay(cell);
  };
  return (
    <div
      className={'hc-d lz-day' + (cell.isShabbat ? ' sh' : '') + (cell.isToday ? ' today' : '') + (lateCount ? ' bd-latecell' : '')}
      role="listitem"
      data-d={cell.key}
      onClick={open}
    >
      <span className="lz-dh">
        {/* הקישור הסמנטי של התא (ממצא נגישות 3): רק כותרת היום. לחיצה בעכבר בכל שטח התא עושה אותו דבר (S06) */}
        <a
          className="bd-dlink"
          href={'/schedule?date=' + cell.key}
          aria-label={label}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenDay(cell); }}
        >
          <b>{cell.letter}</b>
          {cell.monthName ? <em>{cell.monthName}</em> : null}
        </a>
        <span className="bd-dhx">
          {orders.length > 2 ? (
            <button type="button" className="ibtn bd-ex" aria-label={'תצוגה מורחבת ליום זה (' + orders.length + ' הזמנות)'} data-tip="תצוגה מורחבת ליום זה" onClick={(e) => { e.stopPropagation(); onExpand(cell); }}>
              <Ic name="eye" className="sm" />
            </button>
          ) : null}
          {alert ? (
            <span className="tabmk debt lz-al" role="img" aria-label={alert.tip} data-tip={alert.tip}><Ic name="alert" className="sm" /></span>
          ) : null}
        </span>
      </span>
      {cell.notes.length ? <span className="bd-notes">{cell.notes.join(' · ')}</span> : null}
      {rows.length ? (
        <span className="lz-rows">
          {rows.map((r) => (
            <span key={r.stage.key} className={'lz-pr' + (r.alerts ? ' al' : '')} data-tip={stageCountText(r.stage, r.total) + (r.alerts ? ' · ' + r.alerts + ' עם התראה' : '')}>
              <Ic name={(STAGE_META[r.stage.key] || STAGE_META.order).icon} /><b>{r.total}</b>
            </span>
          ))}
        </span>
      ) : null}
      {orders.length > 0 && orders.length <= 2 ? (
        <span className="bd-cos">
          {orders.map((o) => <CellOrder key={o.orderId} order={o} onOrder={onOrder} enableAlterations={enableAlterations} />)}
        </span>
      ) : null}
    </div>
  );
}

function CellOrder({ order, onOrder, enableAlterations }) {
  const late = isOrderLate(order, useLateCfg());
  const cat = orderCategory(order, enableAlterations);
  return (
    <button
      type="button"
      className={'bd-co' + (late ? ' bd-late' : '')}
      style={{ '--bd-cat': CATEGORY[cat].bar }}
      aria-haspopup="menu"
      aria-label={customerName(order) + ' #' + order.orderId + (late ? ' · באיחור החזרה' : '')}
      onClick={(e) => { e.stopPropagation(); onOrder(order, e.currentTarget); }}
    >
      <span className="bd-con">{customerName(order) || 'ללא שם'}</span>
      <bdi className="bd-coi">{late ? <Ic name="alert" className="sm" /> : null}#{order.orderId}</bdi>
    </button>
  );
}

// ---------- גריד החודש (MATCH-3: שורת ימי השבוע; S08: תאים ריקים בקצוות) ----------
export function MonthGrid({ weeks, head, ordersByDate, stagesDays, stages, selected, onOpenDay, onExpand, onOrder, enableAlterations }) {
  return (
    <div className="hc lz-hc">
      {head}
      <div className="hc-w" aria-hidden="true">{WD_SHORT.map((x) => <span key={x}>{x}</span>)}</div>
      <div className="hc-g lz-g" role="list" aria-label="ימי החודש">
        {weeks.flat().map((cell, i) => (cell ? (
          <DayCell
            key={cell.key}
            cell={cell}
            orders={ordersByDate[cell.key] || []}
            stageDay={stagesDays ? stagesDays[cell.key] : null}
            stages={stages}
            selected={selected}
            onOpenDay={onOpenDay}
            onExpand={onExpand}
            onOrder={onOrder}
            enableAlterations={enableAlterations}
          />
        ) : <span key={'e' + i} className="hc-e bd-empty" aria-hidden="true" />))}
      </div>
    </div>
  );
}

// ---------- תצוגת רשימה (S03; בנייד אוטומטית) ----------
// S11 "לא להכניס": בלי שורות סיכום ליום (מונים + חץ). במקומן: כותרת יום של הפלטה (hday, כמו ביומן ההיסטוריה) ומתחתיה
// שורות ההזמנות של אותו יום (אותה שורה כמו בחלון היום). מוצגים רק ימים עם הזמנות או עם התראה.
export function DayList({ weeks, head, ordersByDate, stagesDays, stages, selected, onOpenDay, onOrder, onHint, enableAlterations }) {
  const lateCfg = useLateCfg();
  const days = weeks.flat().filter(Boolean).map((cell) => {
    const orders = ordersByDate[cell.key] || [];
    const rows = dayStageRows(stagesDays ? stagesDays[cell.key] : null, stages, selected);
    const late = orders.filter((o) => isOrderLate(o, lateCfg)).length;
    const alert = cellAlert(rows.reduce((a, r) => a + r.alerts, 0), late);
    return { cell, orders, alert, late };
  }).filter((d) => d.orders.length || d.alert);
  return (
    <div className="card items-card lz-lcard bd-lcard">
      {head}
      <div className="hres">
        <div className="hgrp">
          {days.length ? days.map(({ cell, orders, alert, late }) => (
            <section key={cell.key} className={'bd-lday' + (cell.isToday ? ' lz-today' : '')} aria-label={cell.hebrewLong}>
              <button type="button" className={'hday bd-hday' + (late ? ' bd-latecell' : '')} onClick={() => onOpenDay(cell)} data-tip="ללו״ז של היום הזה">
                <b>{cell.hebrewLong}</b>
                {cell.notes.length ? <small>{cell.notes.join(' · ')}</small> : null}
                {alert ? <span className="tabmk debt lz-al" role="img" aria-label={alert.tip} data-tip={alert.tip}><Ic name="alert" className="sm" /></span> : null}
              </button>
              {orders.map((o) => <OrderRow key={o.orderId} order={o} enableAlterations={enableAlterations} onOrder={onOrder} onHint={onHint} />)}
            </section>
          )) : (
            <div className="empty" role="status"><Ic name="cal" className="lg" /><div>אין הזמנות בחודש הזה</div></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- שורת הזמנה (E13 בעיצוב שורות הלו״ז: lz-r / li lrow / ic-b) ----------
// שם · מספר · תגית סטטוס · פס צבע לפי הסטטוס · לחצן מידע עגול (E14). לחיצה על השורה = תפריט הפעולות (E15).
export function OrderRow({ order, enableAlterations, onOrder, onHint }) {
  const cat = orderCategory(order, enableAlterations);
  const meta = CATEGORY[cat];
  const late = isOrderLate(order, useLateCfg());
  const name = customerName(order) || 'ללא שם';
  const items = validItems(order).length;
  const parts = [order.customerPhone || order.customer?.phone1 || '', dressCountText(items)].filter(Boolean);
  const infoRef = useRef(null);
  return (
    <article className={'hrow irow lz-r bd-or' + (late ? ' lz-late bd-late' : '')} style={{ '--bd-cat': meta.bar }}>
      <div
        className="li lrow"
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-label={'פעולות להזמנה #' + order.orderId + ' של ' + name}
        onClick={(e) => { if (e.target.closest('.bd-info')) return; onOrder(order, e.currentTarget); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOrder(order, e.currentTarget); } }}
      >
        <div className="ic-b"><Ic name="file" /></div>
        <div className="t">
          <b>{name} <bdi>#{order.orderId}</bdi></b>
          {parts.length ? (
            <span className="ln">{parts.map((p, i) => <span key={i} className="lz-p">{i ? ' · ' : ''}<bdi dir={i === 0 && /\d/.test(p) ? 'ltr' : undefined}>{p}</bdi></span>)}</span>
          ) : null}
        </div>
        <div className="lz-act">
          {late ? <span className="chip red bd-latechip"><Ic name="alert" />איחור</span> : null}
          {cat !== 'other' ? <span className={'chip ' + meta.chip}><Ic name={meta.icon} />{meta.label}</span> : null}
          <button
            ref={infoRef}
            type="button"
            className="ibtn bd-info"
            aria-label="פרטים נוספים"
            onMouseEnter={() => onHint(order, infoRef.current)}
            onMouseLeave={() => onHint(null)}
            onFocus={() => onHint(order, infoRef.current)}
            onBlur={() => onHint(null)}
            onClick={(e) => { e.stopPropagation(); onHint(order, infoRef.current, true); }}
          >
            <Ic name="info" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------- חלונית הפרטים בריחוף על לחצן המידע (E14): רמז עשיר של הפלטה (.pl-rt) ----------
// אותן שורות כמו בדף הקודם, בלי התאריך הלועזי (תאריכי אירוע בעברית בלבד, JDG-6). "ציפוף ימים" רק כשיש ערך וההגדרה
// hide_custom_spacing כבויה. צבע "שולם": ירוק כששולם במלואו, כתום חלקי, אדום בלי תשלום (כמו קודם).
export function InfoHint({ hint, enableAlterations, hideCustomSpacing }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!hint || !ref.current || !hint.el) { setPos(null); return; }
    const r = hint.el.getBoundingClientRect();
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    let y = r.top - h - 10;
    let side = 't';
    if (y < 8) { y = r.bottom + 10; side = 'b'; }
    setPos({ x, y, side, ax: Math.max(12, Math.min(w - 12, r.left + r.width / 2 - x)) });
  }, [hint]);
  if (!hint) return null;
  const o = hint.order;
  const v = validItems(o);
  const cat = orderCategory(o, enableAlterations);
  const paidCls = o.totalPaid >= o.totalAmount && o.totalAmount > 0 ? 'bd-paid' : (o.totalPaid > 0 ? 'bd-part' : 'bd-unpaid');
  const rows = [
    ['טלפון', <bdi key="p" dir="ltr">{o.customerPhone || 'לא הוזן'}</bdi>],
    ['תאריך אירוע', o.eventDateHebrew || 'לא צוין'],
  ];
  if (!hideCustomSpacing && o.customSpacing !== null && o.customSpacing !== undefined) rows.push(['ציפוף ימים', o.customSpacing + ' ' + (o.customSpacing === 1 ? 'יום' : 'ימים')]);
  rows.push(['פריטים בהזמנה', v.length], ['הושכר', v.filter((i) => i.isTaken).length], ['הוחזר', v.filter((i) => i.isReturned).length]);
  rows.push(['סה״כ לתשלום', '₪' + (o.totalAmount || 0)], ['שולם', <span key="s" className={paidCls}>₪{o.totalPaid || 0}</span>], ['סטטוס', CATEGORY[cat].label]);
  return (
    <LzPortal>
      <div
        ref={ref}
        className="pl-rt on bd-rt"
        role="tooltip"
        data-side={pos ? pos.side : 't'}
        style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: -9999 }}
      >
        <div className="rh">פרטים על הזמנה #{o.orderId}</div>
        {rows.map(([k, val]) => <div className="rr" key={k}><small>{k}</small><b>{val}</b></div>)}
        <span className="ra" style={pos ? { insetInlineStart: 'auto', left: pos.ax - 6 } : undefined} />
      </div>
    </LzPortal>
  );
}

// ---------- תפריט הפעולות להזמנה (E15): תפריט הפלטה (.menu, פריט 15) ----------
export function ActionMenu({ menu, onClose, onOrderCard, onCustomerCard, onRental }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = menu.el.getBoundingClientRect();
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w));
    let y = r.bottom + 4;
    if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 4);
    setPos({ x, y });
    setTimeout(() => ref.current?.querySelector('button')?.focus(), 30);
  }, [menu]);
  useEffect(() => {
    if (!menu) return undefined;
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const b = [...(ref.current?.querySelectorAll('button') || [])];
        const i = b.indexOf(document.activeElement);
        e.preventDefault();
        b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length]?.focus();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [menu, onClose]);
  if (!menu) return null;
  const o = menu.order;
  const custId = o.customerId || o.customer?.id;
  return (
    <LzPortal>
      <div className="bd-menu-bg" onMouseDown={onClose} />
      <div className="bd-menu-w" ref={ref} style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: -9999 }}>
        <div className="menu open" role="menu" aria-label={'פעולות להזמנה #' + o.orderId}>
          <div className="bd-menu-h">הזמנה #{o.orderId}</div>
          <button type="button" role="menuitem" onClick={() => onOrderCard(o)}><Ic name="file" />כרטיס הזמנה</button>
          {custId ? <button type="button" role="menuitem" onClick={() => onCustomerCard(custId)}><Ic name="user" />כרטיס לקוח</button> : null}
          <button type="button" role="menuitem" onClick={() => onRental(o)}><Ic name="box" />כרטיס השכרה</button>
        </div>
      </div>
    </LzPortal>
  );
}

export { WEEKDAYS };
