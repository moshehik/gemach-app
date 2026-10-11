'use client';

// רשימת ההזמנות לניהול (/admin/orders-list) - אותו קונספט בדיוק כמו רשימות העובדים והדגמים (העיצוב המאושר, ערכת הרשימות app/components/a5-list):
// כותרת עם חץ חזרה ל"ניהול", חיפוש חצי רוחב מתחת לכותרת עם חיפוש חכם + שאלות סטטיסטיקה ולחצן "סינון" אחד, סרגל תוצאות דביק (שורות / טבלה, מיון,
// עימוד 50 בקפסולה, XL / הורדה / הדפסה), שורות 21px/14px עם זוגות אייקון + ערך (אפס לא מוצג), חץ פרטים מהירים, לחיצה על השורה פותחת את כרטיס ההזמנה.
// אין לדף הזה גרסה ישנה (כמו NO_LEGACY_PAGES) והוא נגיש רק מאזור הניהול (app/admin/layout.js + /api/admin/orders-list: הנהלה ראשית / מתכנת).
// הנתונים: POST /api/admin/orders-list (עימוד שרת - לעולם לא כל ההזמנות) + /counts (ספירת אפשרויות הסינון). פירוט: docs/a5-staff-models/orders-list-notes.md.

import '@/design-system/components.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatisticsModal from '../StatisticsModal';
import { runPrint } from '../a5-print/runPrint';
import { A5List, A5Page, A5SearchSlot, Ic, dayKey, dayTitle, hDateFull, hDateShort, runListExport, useA5 } from '../a5-list';
import { hebrewMonthTitle } from '../schedule/hebrewCalendar';
import useAdminServerList, { smartSearchIds } from '../admin-lists/useAdminServerList';
import RangeDialog from '../admin-lists/RangeDialog';
import {
  DEFAULT_SORT, EXPORT_MAX, SHEET_TITLE, SORTS, buildOrderFilters, buildOrdersQuery, buildOrdersSheet, countsKey, itemsText, money, orderPairs, orderRow,
  sheetFlatRows, stateIcon, stateWord,
} from './ordersLogic';

const SLOT_ID = 'a5l-search-ord';
const ENDPOINT = '/api/admin/orders-list';
const NO_MATCH_ID = 2147483647; // "חיפוש חכם" בלי תוצאות = רשימה ריקה (מזהה שלא קיים)

// הדפסה / PDF מעוצבים של "דוח הזמנות" - נקודת החיבור של סוכן ההדפסה. ערך חוזר true = כבר טיפל; אחרת ברירת המחדל של הערכה (runListExport).
// נקרא עם { kind, rows, state, info, say, sheet }: sheet = המפרט (docs/a5-staff-models/print-specs.md), rows = כל הרשימה המסוננת והממוינת (לא רק העמוד).
export const EXPORT_HOOK = { current: null };

function Pair({ p, hl }) {
  const body = p.bdi ? <bdi>{hl(p.text)}</bdi> : p.bold ? <b><bdi>{p.text}</bdi></b> : p.text;
  return <span className={`lni${p.warn ? ' warn' : ''}`} data-tip={p.tip}><Ic id={p.icon} />{body}</span>;
}

const sheetFns = {
  dayKey: (iso) => dayKey(iso),
  monthLabel: (dk) => hebrewMonthTitle(dk),
  dayLabel: (dk) => hDateShort(dk),
};

function OrdersList() {
  const router = useRouter();
  const a5 = useA5();
  const listRef = useRef(null);
  const [stats, setStats] = useState(false);
  const [aiHidden, setAiHidden] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [dlg, setDlg] = useState(false);
  const L = useAdminServerList({ endpoint: ENDPOINT, buildQuery: buildOrdersQuery, countsKey, defaultSort: DEFAULT_SORT });
  const { ui, custom, setCustom, setAiIds, data, busy, error, counts } = L;

  useEffect(() => { setAiHidden(document.body.classList.contains('hide-ai-features')); }, []);
  // שגיאת שרת (למשל 503 "צמצמו את הסינון") כשכבר יש שורות על המסך: הודעה בטוסט (בלי שורות - הערכה מציגה אותה בגוף הרשימה)
  const hadRows = !!(data && data.rows.length);
  useEffect(() => { if (error && hadRows) a5.say(error, 'warn'); }, [error]);

  // "טווח מותאם": בחירה באפשרות פותחת חלון כהה עם לוח עברי; ביטול מבטל את הבחירה; הסרת הבחירה מנקה את הטווח
  const periodSel = ui.sel.period || [];
  const customOn = periodSel.includes('custom');
  const prevOn = useRef(false);
  useEffect(() => {
    if (customOn && !prevOn.current && !custom) setDlg(true); // רק במעבר "נבחר" (לא נפתח מחדש אחרי ביטול)
    if (!customOn) { if (custom) setCustom(null); if (dlg) setDlg(false); }
    prevOn.current = customOn;
  }, [customOn, custom, dlg, setCustom]);

  const rows = useMemo(() => (data ? data.rows.map(orderRow) : []), [data]);
  const customLabel = custom ? `${hDateShort(custom.from)} – ${hDateShort(custom.to)}` : 'טווח מותאם…';
  const filters = useMemo(() => buildOrderFilters(counts, { customLabel, branchNames: counts && counts.branchNames ? counts.branchNames : [] }), [counts, customLabel]);

  const ai = useMemo(() => ({
    loading: aiBusy,
    onSubmit: async (prompt) => {
      setAiBusy(true);
      try {
        const ids = await smartSearchIds(prompt, 'orders', (r) => r.orderId);
        if (!ids.length) a5.say('לא נמצאו הזמנות', 'info', 'החיפוש החכם לא החזיר תוצאות');
        setAiIds(ids.length ? ids : [NO_MATCH_ID]);
      } catch (e) { a5.say((e && e.message) || 'שגיאת תקשורת', 'error'); } finally { setAiBusy(false); }
    },
    onReset: () => setAiIds(null),
  }), [aiBusy, a5, setAiIds]);

  const open = (r) => router.push(`/orders/${r.orderId}`);
  const printOrder = (r) => { window.open(`/print/order?orderId=${encodeURIComponent(r.orderId)}&type=order`, '_blank'); };

  const rowMain = (r, c) => (
    <>
      <div className="ic-b sq"><Ic id={r.state === 'deleted' ? 'trash' : 'file'} /></div>
      <div className="t"><b>{c.hl(r.title)}</b><span className="ln mi">
        {orderPairs(r, hDateFull).map((p) => <Pair key={p.key} p={p} hl={c.hl} />)}
      </span></div>
    </>
  );

  const detail = (r) => {
    const row = (k, v) => <div className="hv-r"><small>{k}</small><b>{v}</b></div>;
    const pay = r.debt > 0 ? <>חוב פתוח · <bdi>{money(r.debt)}</bdi></> : r.credit > 0 ? <>זיכוי ממתין · <bdi>{money(r.credit)}</bdi></> : r.total > 0 ? 'שולם במלואו' : 'אין סכום לתשלום';
    return (
      <>
        {row('לקוח', r.title)}
        {r.customerPhone ? row('טלפון', <bdi dir="ltr">{r.customerPhone}</bdi>) : null}
        {r.itemsCount > 0 ? row('פריטים', itemsText(r.items, r.itemsCount)) : null}
        {r.eventDate ? row('תאריך אירוע', dayTitle(r.eventDate)) : null}
        {r.orderDate ? row('נוצרה', hDateFull(r.orderDate)) : null}
        {row('סטטוס', stateWord(r.state))}
        {row('סכום', <bdi>{money(r.total)}</bdi>)}
        {row('שולם', <bdi>{money(r.paid)}</bdi>)}
        {row('מצב תשלום', pay)}
        {r.isDelivery ? row('משלוח', 'הזמנה עם משלוח') : null}
        {r.branch ? row('סניף', r.branch) : null}
        <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
          <button type="button" className="btn primary sm" onClick={() => open(r)}><Ic id="file" size="sm" />כרטיס הזמנה</button>
          <button type="button" className="btn sm" onClick={() => printOrder(r)}><Ic id="print" size="sm" />הדפסת הזמנה</button>
          {r.customerId ? <button type="button" className="btn sm" onClick={() => router.push(`/customers/${r.customerId}`)}><Ic id="user" size="sm" />כרטיס לקוח</button> : null}
          <button type="button" className="ibtn" aria-label="שליחת סיכום במייל" data-tip="שליחת סיכום במייל" onClick={() => { a5.say('שליחת הסיכום נעשית מכרטיס ההזמנה', 'info'); open(r); }}><Ic id="mail" size="sm" /></button>
        </b></div>
      </>
    );
  };

  const numCell = (get, fmt) => ({ tdClass: (r) => `num${get(r) ? '' : ' zero'}`, cell: (r) => (get(r) ? fmt(r) : '') });
  const columns = [
    { k: 'orderId', t: 'מס׳ הזמנה', cell: (r, c) => <bdi>{c.hl(String(r.orderId))}</bdi> },
    { k: 'customerName', t: 'לקוח', cell: (r, c) => <span className="tcn"><Ic id={r.state === 'deleted' ? 'trash' : 'file'} /><b>{c.hl(r.title)}</b></span> },
    { k: 'eventDate', t: 'תאריך אירוע', cell: (r) => (r.eventDate ? <><Ic id="gift" />{hDateFull(r.eventDate)}</> : '') },
    { k: 'itemsCount', t: 'פריטים', ...numCell((r) => r.itemsCount, (r) => r.itemsCount) },
    { k: 'status', t: 'סטטוס', cell: (r) => <><Ic id={stateIcon(r.state)} />{stateWord(r.state)}</> },
    { k: 'total', t: 'סכום', ...numCell((r) => r.total, (r) => <bdi>{money(r.total)}</bdi>) },
    { k: 'paid', t: 'שולם', ...numCell((r) => r.paid, (r) => <bdi>{money(r.paid)}</bdi>) },
    { k: 'balance', t: 'חוב / זיכוי', ...numCell((r) => r.debt || r.credit, (r) => (r.debt > 0 ? <b><bdi>{money(r.debt)}</bdi></b> : <><Ic id="wallet" /><bdi>{money(r.credit)}</bdi></>)) },
  ];

  const onExport = async (kind, _list, state, info) => {
    a5.say('מכין את הרשימה…', 'info');
    let res;
    try { res = await L.fetchAll(EXPORT_MAX); } catch { a5.say('הייצוא נכשל', 'error', 'טעינת הרשימה מהשרת נכשלה'); return; }
    const all = res.rows.map(orderRow);
    if (!all.length) { a5.say('אין שורות לייצוא', 'warn', 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים'); return; }
    if (res.truncated) a5.say(`יוצאו ${EXPORT_MAX} ההזמנות הראשונות מתוך ${res.total}`, 'warn', 'צמצמו את הסינון כדי לייצא את כולן');
    const sheet = buildOrdersSheet(all, info.filterText, sheetFns);
    if (EXPORT_HOOK.current && EXPORT_HOOK.current({ kind, rows: all, state, info, say: a5.say, sheet })) return;
    // הדפסה / הורדת PDF: התצוגה המקדימה המעוצבת (a5-print, מסמך 'orders-list'); Excel נשאר קובץ הנתונים
    if (kind !== 'excel') { runPrint({ doc: 'orders-list', kind, say: a5.say, data: { sheet } }); return; }
    const flat = sheetFlatRows(sheet);
    runListExport({ kind, say: a5.say, title: SHEET_TITLE, subtitle: info.filterText, base: 'הזמנות', head: flat.head, rows: flat.rows });
  };

  return (
    <>
      <div className="app" id="app">
        <div className="topbar">
          <button type="button" className="back" id="ordBack" aria-label="חזרה למרכז הניהול" data-tip="חזרה למרכז הניהול" onClick={() => router.push('/admin')}><Ic id="back" /></button>
          <div className="ttl"><h1><small>ניהול</small>הזמנות</h1></div>
        </div>
        <A5SearchSlot id={SLOT_ID} />
        <div className="layout one">
          <main className="main">
            <section className="panel on" id="p-list">
              <div className="card hist">
                <div className="card-h"><div className="ico gold"><Ic id="file" size="lg" /></div><h2>רשימת הזמנות</h2>
                  <button type="button" className="btn navy" id="btnNew" onClick={() => router.push('/orders/new')}><Ic id="plus" />הזמנה חדשה</button></div>
                <A5List
                  ref={listRef}
                  items={rows}
                  getId={(r) => r.orderId}
                  texts={{ placeholder: 'חיפוש הזמנה (מספר הזמנה, שם לקוח, טלפון, ברקוד, דגם, תאריך עברי)…', aiPlaceholder: 'בקשו מה-AI למצוא הזמנות (למשל: הזמנות עם חוב מהחודש שעבר)…', countLabel: 'הזמנות', emptyText: 'לא נמצאו הזמנות התואמות את החיפוש' }}
                  localSearch={false}
                  total={data ? data.total : 0}
                  page={L.page}
                  onPage={L.setPage}
                  onQueryChange={L.onQueryChange}
                  onStateChange={L.onStateChange}
                  onFilterOpen={L.onFilterOpen}
                  filters={filters}
                  sorts={SORTS}
                  defaultSort={DEFAULT_SORT}
                  rowClass={(r) => (r.state === 'deleted' ? 'off gone' : '')}
                  rowMain={rowMain}
                  detail={detail}
                  columns={columns}
                  onOpen={open}
                  searchSlot={SLOT_ID}
                  ai={aiHidden ? null : ai}
                  onStats={aiHidden ? null : () => setStats(true)}
                  notices={data ? data.notices : []}
                  exportSpec={{ what: 'רשימת ההזמנות', onExport }}
                  loading={data === null || (busy && !rows.length)}
                  error={error}
                  onRetry={L.reload}
                />
              </div>
            </section>
          </main>
        </div>
      </div>
      {dlg ? (
        <RangeDialog
          title="טווח תאריכי אירוע"
          onDone={(r) => { setCustom(r); setDlg(false); }}
          onCancel={() => { setDlg(false); if (listRef.current) listRef.current.setGroup('period', periodSel.filter((k) => k !== 'custom')); }}
        />
      ) : null}
      {stats ? <StatisticsModal isOpen onClose={() => setStats(false)} pageContext="orders" position={null} /> : null}
    </>
  );
}

export default function OrdersListA5() {
  return <A5Page name="gm-ord"><OrdersList /></A5Page>;
}
