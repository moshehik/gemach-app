'use client';

// לשונית "הזמנות" (העיצוב: pOrders / ordRow / ordersTable). החלטות הבעלים: מתג רשימה / טבלה (vsw), שורת "משלוח" בפירוט (רק בארגון
// עם משלוחים - enable_deliveries), "שלם ₪" מהשורה (pay), הדפסת סיכום הזמנה מהשורה (prtsum, /print/order הקיים). הוסרו: "הזמנה חדשה",
// מתג "פעילות בלבד", "נפתחה · שם העובד", סטטוס פריטים + סטטוס תשלום בשורה (ostat). תאריכים עבריים בלבד.

import { useState } from 'react';
import Link from 'next/link';
import { getHebrewDateString } from '@/lib/hebrewDate';
import CcIcon from '../CcIcon';
import { SortTh, ViewSwitch, sortRows } from '../CcViewSwitch';
import { deliveryText, orderEventIso, orderItemModels, orderPaid, orderRequired, sortOrders } from '../customerCardLogic';

const money = (n) => `₪${Math.abs(Number(n) || 0).toLocaleString('he-IL')}`;
const heb = (d) => (d ? getHebrewDateString(d) : '');

export function eventLabel(o) {
  if (o.isAbroad) {
    const from = o.fromDate ? heb(o.fromDate) : '-';
    const to = (o.toDate || o.returnDate) ? heb(o.toDate || o.returnDate) : '-';
    return `לקיחה ${from} · החזרה ${to}`;
  }
  const iso = orderEventIso(o);
  return iso ? heb(iso) : '—';
}

function OrderRow({ o, open, onToggle, cc, showDelivery }) {
  const tot = orderRequired(o);
  const paid = orderPaid(o);
  const debt = Math.round((tot - paid) * 100) / 100;
  const its = orderItemModels(o).join(', ') || '—';
  const id = `det-${o.orderId}`;
  return (
    <article className={`hrow irow${open ? ' open' : ''}`}>
      <div className="li rlink lrow" role="button" tabIndex={0} data-act="oopen" aria-expanded={open} aria-controls={id}
        onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
        <div className="ic-b"><CcIcon name="file" /><span className="rlbl">הזמנה</span></div>
        <div className="t"><b>הזמנה <bdi>#{o.orderId}</bdi></b><span className="ln">{o.isDeleted ? 'בוטלה · ' : ''}אירוע {eventLabel(o)} · <bdi dir="ltr">{money(tot)}</bdi></span></div>
        <span className="go" aria-hidden="true"><CcIcon name="chev" size="sm" /></span>
      </div>
      <div className="hdet" id={id}>
        <div className="hdet-in">
          <div className="hv-r"><small>נפתחה</small><b>{heb(o.orderDate || o.createdAt) || '—'}</b></div>
          <div className="hv-r"><small>אירוע</small><b>{eventLabel(o)}</b></div>
          <div className="hv-r"><small>פריטים</small><b>{its}</b></div>
          {showDelivery ? <div className="hv-r"><small>משלוח</small><b>{deliveryText(o) || 'ללא משלוח'}</b></div> : null}
          <div className="hv-r"><small>סכום</small><b><bdi dir="ltr">{money(tot)}</bdi></b></div>
          <div className="hv-r"><small>שולם</small><b><bdi dir="ltr">{money(paid)}</bdi></b></div>
          <div className="hv-r"><small>יתרה</small><b>{debt > 0 ? <bdi dir="ltr">{money(debt)}</bdi> : 'שולם במלואו'}</b></div>
          <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
            <Link className="btn sm" href={`/orders/${o.orderId}`} data-act="open-order" onClick={(e) => { if (cc.dirty) { e.preventDefault(); cc.exit(`/orders/${o.orderId}`); } }}><CcIcon name="ext" size="sm" />פתיחת הזמנה</Link>
            {debt > 0 && !o.isDeleted && !cc.readOnly ? <button type="button" className="btn sm" data-act="pay-now" disabled={cc.paying} onClick={() => cc.pay(o.orderId)}><CcIcon name="card" size="sm" />שלם <bdi dir="ltr">{money(debt)}</bdi></button> : null}
            <button type="button" className="ibtn" aria-label="הדפסת סיכום הזמנה" data-tip="הדפסת סיכום הזמנה" onClick={() => cc.printOrder(o.orderId)}><CcIcon name="print" size="sm" /></button>
          </b></div>
        </div>
      </div>
    </article>
  );
}

const COLS = [['no', 'הזמנה'], ['event', 'אירוע'], ['items', 'פריטים'], ['tot', 'סכום']];

export default function CcOrdersTab({ cc }) {
  const [view, setView] = useState('list');
  const [open, setOpen] = useState({});
  const [sort, setSort] = useState({ col: 'event', dir: -1 });
  const list = sortOrders(cc.cur.orders || []);
  const showDelivery = cc.settings.enable_deliveries === 'true';
  const val = (o, k) => (k === 'no' ? Number(o.orderId) : k === 'event' ? String(orderEventIso(o) || '') : k === 'items' ? orderItemModels(o).length : orderRequired(o));
  let body;
  if (!list.length) body = <div className="empty">אין הזמנות ללקוחה זו</div>;
  else if (view === 'table') {
    body = (
      <div className="tblw"><table className="rtbl"><thead><tr>{COLS.map(([k, t]) => <SortTh key={k} col={k} label={t} sort={sort} onSort={setSort} />)}</tr></thead>
        <tbody>{sortRows(list, sort, val).map((o) => (
          <tr key={o.id}><td><b><Link href={`/orders/${o.orderId}`} className="cc-tlink"><bdi>#{o.orderId}</bdi></Link></b></td><td>{eventLabel(o)}</td><td>{orderItemModels(o).length || '—'}</td><td><bdi dir="ltr">{money(orderRequired(o))}</bdi></td></tr>
        ))}</tbody></table></div>
    );
  } else {
    body = <div className="hgrp">{list.map((o) => <OrderRow key={o.id} o={o} cc={cc} showDelivery={showDelivery} open={!!open[o.orderId]} onToggle={() => setOpen((s) => ({ ...s, [o.orderId]: !s[o.orderId] }))} />)}</div>;
  }
  return (
    <div className="card items-card">
      <div className="card-h"><div className="ico teal"><CcIcon name="file" size="lg" /></div><h2>הזמנות</h2></div>
      <div className="hres-bar"><span className="hres-n">הזמנות <b>{list.length}</b></span><ViewSwitch value={view} onChange={setView} /></div>
      <div className="hres">{body}</div>
    </div>
  );
}
