'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LzPortal } from '../schedule/LzPortal';
import { CATEGORY, categoryOrder, filterDayOrders, isOrderLate, orderCategory } from './boardLogic';
import { Ic, OrderRow, useLateCfg } from './BoardParts';

// חלון "הזמנות ליום" (E17, "יפתח ויציג כמו בדף הלו״ז עם הפירוט של הבאנר הימני"; E13 "כמו השאלה הקודמת"; GAP-6
// "שינוי מלא של החלון בדומה ללו״ז"): אותו פריסה כמו /schedule - ציר כהה בצד ימין (st-sidenav / st-stab של הלו״ז) עם
// "הכל" ושורה לכל סטטוס הזמנה (מונה על האייקון; "באיחור החזרה" עם משולש התראה), ולידו כרטיס פנינה (lz-st) עם שדה הסינון
// של הדף הקודם (שם / טלפון / מספר) ושורות ההזמנה בעיצוב שורות הלו״ז (OrderRow). לחיצה על שורה = תפריט הפעולות (E15),
// לחצן המידע העגול = חלונית הפרטים (E14). הדפסת פרוט היום נשארת בכותרת רק בארגון עם enable_batch_print_prep (כמו קודם).
export default function BoardDayDialog({ day, enableAlterations, enableBatchPrintPrep, onClose, onOrder, onHint, onPrint }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(null); // null = הכל | קטגוריה | 'late'
  const boxRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const orders = day.orders;
  const lateCfg = useLateCfg();
  const late = (o) => isOrderLate(o, lateCfg);

  const counts = useMemo(() => {
    const c = { late: 0 };
    for (const o of orders) {
      const k = orderCategory(o, enableAlterations);
      c[k] = (c[k] || 0) + 1;
      if (late(o)) c.late++;
    }
    return c;
  }, [orders, enableAlterations, lateCfg]);

  const visible = useMemo(() => {
    let list = filterDayOrders(orders, q);
    if (filter === 'late') list = list.filter((o) => late(o));
    else if (filter) list = list.filter((o) => orderCategory(o, enableAlterations) === filter);
    // שורות באיחור ראשונות (כמו שורות עם התראה בלו״ז), השאר בסדר המקורי
    return list.map((o, i) => ({ o, i, r: late(o) ? 0 : 1 })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.o);
  }, [orders, q, filter, enableAlterations, lateCfg]);

  useEffect(() => {
    const prev = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => boxRef.current?.querySelector('#bdDayQ')?.focus(), 60);
    const key = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        // תפריט / חלונית פתוחים מעל החלון סוגרים קודם את עצמם (capture + preventDefault)
        e.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', key);
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus();
    };
  }, []);

  const cats = categoryOrder(enableAlterations).filter((k) => counts[k]);
  const stab = (key, label, icon, n, extra) => (
    <button
      key={key || 'all'}
      type="button"
      className={'st-stab lz-stab' + (filter === key ? ' on' : '') + (n ? '' : ' fut')}
      aria-pressed={filter === key}
      onClick={() => setFilter(key)}
      data-tip={label + (n ? ' · ' + n : '') + ' · לחיצה לסינון'}
    >
      <span className="st-sic">
        <Ic name={icon} />
        {n && key !== 'late' ? <span className="sn-badge lz-rem" role="img" aria-label={n + ' הזמנות'}>{n}</span> : null}
      </span>
      <span className="st-slb"><span className="lz-nm">{label}</span>{extra}</span>
      {key === 'late' && n ? <span className="sn-badge lz-al2" role="img" aria-label={n + ' באיחור'}>{n}</span> : null}
      <span className="st-sgo"><Ic name="chev" className="sm" /></span>
    </button>
  );

  return (
    <LzPortal>
      <div className="scrim on bd-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="dlg bd-day" role="dialog" aria-modal="true" aria-labelledby="bdDayT" ref={boxRef}>
          <div className="bd-dh">
            <div className="bd-dht">
              <span className="adm-hi"><Ic name="cal" /></span>
              <div>
                <h2 id="bdDayT">הזמנות ליום</h2>
                <div className="faint">{day.cell.hebrewLong}{day.cell.notes.length ? ' · ' + day.cell.notes.join(' · ') : ''}</div>
              </div>
            </div>
            <div className="bd-dx">
              {enableBatchPrintPrep && orders.length ? (
                <button type="button" className="ibtn bd-rb" aria-label="הדפסת פרוט ההזמנות ליום זה" data-tip="הדפסת פרוט ההזמנות ליום זה" onClick={() => onPrint(orders)}>
                  <Ic name="print" />
                </button>
              ) : null}
              <button type="button" className="ibtn bd-rb" aria-label="סגירה" data-tip="סגירה" onClick={onClose}><Ic name="x" /></button>
            </div>
          </div>
          <div className="lz-layout bd-dl">
            <aside className="rail lz-rail" aria-label="סטטוס ההזמנות ביום">
              <div className="st-sidenav lz-snav">
                <div className="lz-rh">הזמנות היום</div>
                <nav className="st-stabs" aria-label="סינון לפי סטטוס">
                  {stab(null, 'הכל', 'rows', orders.length, <small>{orders.length} הזמנות</small>)}
                  {counts.late ? stab('late', 'באיחור החזרה', 'alert', counts.late) : null}
                  {cats.map((k) => stab(k, CATEGORY[k].label, CATEGORY[k].icon, counts[k]))}
                </nav>
              </div>
            </aside>
            <div className="lz-main">
              <div className="inpw bd-dq">
                <Ic name="search" />
                <input
                  id="bdDayQ"
                  className="inp"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="חיפוש הזמנה ביום זה (שם, טלפון, מספר)..."
                  aria-label="חיפוש הזמנה ביום זה (שם, טלפון, מספר)"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore=""
                  data-form-type="other"
                />
                {q ? <button type="button" className="inpx" aria-label="נקה סינון" data-tip="נקה סינון" onClick={() => setQ('')}><Ic name="x" className="sm" /></button> : null}
              </div>
              <div className="card lz-st bd-dst">
                {visible.length ? (
                  <div className="hres"><div className="hgrp">
                    {visible.map((o) => <OrderRow key={o.orderId} order={o} enableAlterations={enableAlterations} onOrder={onOrder} onHint={onHint} />)}
                  </div></div>
                ) : (
                  <div className="empty" role="status"><Ic name="search" className="lg" /><div className="lz-empty-t">אין הזמנות שתואמות לסינון</div></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LzPortal>
  );
}
