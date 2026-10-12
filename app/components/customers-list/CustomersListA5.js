'use client';

// רשימת הלקוחות לניהול (/admin/customers-list) - אותו קונספט בדיוק כמו רשימות העובדים, הדגמים וההזמנות (העיצוב המאושר, ערכת הרשימות
// app/components/a5-list). שורה 1: שם הלקוח; שורה 2: מספר לקוח, טלפון, מייל, עיר, הזמנות, חוב (רק כשיש), הזמנה אחרונה. לחיצה על השורה פותחת
// את כרטיס הלקוח (/customers/<id> - המזהה משמש לניווט בלבד ולא מוצג). אין לדף גרסה ישנה; נגיש רק מאזור הניהול (app/admin/layout.js +
// /api/admin/customers-list: הנהלה ראשית / מתכנת). הנתונים: POST /api/admin/customers-list (עימוד שרת) + /counts. פירוט: docs/a5-staff-models/customers-list-notes.md.

import '@/design-system/components.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatisticsModal from '../StatisticsModal';
import { runPrint } from '../a5-print/runPrint';
import { A5List, A5ListPage, A5Page, Ic, dayTitle, hDateFull, hDateShort, runListExport, useA5 } from '../a5-list';
import useAdminServerList, { smartSearchIds } from '../admin-lists/useAdminServerList';
import RangeDialog from '../admin-lists/RangeDialog';
import {
  DEFAULT_SORT, EXPORT_MAX, SHEET_TITLE, SORTS, buildCustomerFilters, buildCustomersQuery, buildCustomersSheet, countsKey, customerPairs, customerRow, money, sheetFlatRows,
} from './customersLogic';

const SLOT_ID = 'a5l-search-cus';
const ENDPOINT = '/api/admin/customers-list';
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000'; // "חיפוש חכם" בלי תוצאות = רשימה ריקה

// הדפסה / PDF מעוצבים של "רשימת לקוחות" - נקודת החיבור של סוכן ההדפסה (כמו ברשימות האחרות). נקרא עם { kind, rows, state, info, say, sheet }.
export const EXPORT_HOOK = { current: null };

function Pair({ p, hl }) {
  const body = p.bdi ? <bdi>{hl(p.text)}</bdi> : p.bold ? <b><bdi>{p.text}</bdi></b> : p.text;
  return <span className={`lni${p.warn ? ' warn' : ''}${p.mail ? ' mail' : ''}`} data-tip={p.tip}><Ic id={p.icon} />{body}</span>;
}

function CustomersList() {
  const router = useRouter();
  const a5 = useA5();
  const listRef = useRef(null);
  const [stats, setStats] = useState(false);
  const [aiHidden, setAiHidden] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [dlg, setDlg] = useState(false);
  const L = useAdminServerList({ endpoint: ENDPOINT, buildQuery: buildCustomersQuery, countsKey, defaultSort: DEFAULT_SORT });
  const { ui, custom, setCustom, setAiIds, data, busy, error, counts } = L;

  useEffect(() => { setAiHidden(document.body.classList.contains('hide-ai-features')); }, []);
  // שגיאת שרת (למשל 503 "צמצמו את הסינון") כשכבר יש שורות על המסך: הודעה בטוסט (בלי שורות - הערכה מציגה אותה בגוף הרשימה)
  const hadRows = !!(data && data.rows.length);
  useEffect(() => { if (error && hadRows) a5.say(error, 'warn'); }, [error]);

  const firstSel = ui.sel.first || [];
  const customOn = firstSel.includes('custom');
  const prevOn = useRef(false);
  useEffect(() => {
    if (customOn && !prevOn.current && !custom) setDlg(true); // רק במעבר "נבחר" (לא נפתח מחדש אחרי ביטול)
    if (!customOn) { if (custom) setCustom(null); if (dlg) setDlg(false); }
    prevOn.current = customOn;
  }, [customOn, custom, dlg, setCustom]);

  const rows = useMemo(() => (data ? data.rows.map(customerRow) : []), [data]);
  const customLabel = custom ? `${hDateShort(custom.from)} – ${hDateShort(custom.to)}` : 'טווח מותאם…';
  const filters = useMemo(() => buildCustomerFilters(counts, { customLabel }), [counts, customLabel]);

  const ai = useMemo(() => ({
    loading: aiBusy,
    onSubmit: async (prompt) => {
      setAiBusy(true);
      try {
        const ids = await smartSearchIds(prompt, 'customers', (r) => r.id);
        if (!ids.length) a5.say('לא נמצאו לקוחות', 'info', 'החיפוש החכם לא החזיר תוצאות');
        setAiIds(ids.length ? ids : [NO_MATCH_ID]);
      } catch (e) { a5.say((e && e.message) || 'שגיאת תקשורת', 'error'); } finally { setAiBusy(false); }
    },
    onReset: () => setAiIds(null),
  }), [aiBusy, a5, setAiIds]);

  const open = (r) => router.push(`/customers/${r.id}`);
  const printDoc = (r, type) => { window.open(`/print/customer?customerId=${encodeURIComponent(r.id)}&type=${type}`, '_blank', 'noopener'); };

  const rowMain = (r, c) => (
    <>
      <div className="ic-b sq"><Ic id={r.blocked ? 'ban' : 'user'} /></div>
      <div className="t"><b>{c.hl(r.title)}</b><span className="ln mi">
        {customerPairs(r, hDateFull).map((p) => <Pair key={p.key} p={p} hl={c.hl} />)}
      </span></div>
    </>
  );

  const detail = (r) => {
    const row = (k, v) => <div className="hv-r"><small>{k}</small><b>{v}</b></div>;
    return (
      <>
        {r.number ? row('מספר לקוח', <bdi>{r.number}</bdi>) : null}
        {r.phone ? row('טלפון', <bdi dir="ltr">{r.phone}</bdi>) : null}
        {r.email ? row('מייל', <bdi>{r.email}</bdi>) : null}
        {r.address ? row('כתובת', r.address) : null}
        {row('הזמנות', r.orders > 0 ? <><bdi>{r.orders}</bdi> הזמנות{r.activeOrders > 0 ? <> · <bdi>{r.activeOrders}</bdi> פעילות</> : null}</> : 'אין הזמנות')}
        {r.debt > 0 ? row('חוב פתוח', <bdi>{money(r.debt)}</bdi>) : null}
        {r.lastOrder ? row('הזמנה אחרונה', dayTitle(r.lastOrder)) : null}
        {row('תקנון', r.signed ? 'חתם על התקנון' : 'לא חתם על התקנון')}
        {row('תעודת זהות', r.hasId ? 'קיימת' : 'חסרה')}
        {r.marketing ? row('דיוור', 'אישר קבלת דיוור') : null}
        {r.blocked ? row('חסימה', r.blockedReason ? `חסום מהזמנות חדשות · ${r.blockedReason}` : 'חסום מהזמנות חדשות') : null}
        <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
          <button type="button" className="btn primary sm" onClick={() => open(r)}><Ic id="user" size="sm" />כרטיס לקוח</button>
          <button type="button" className="btn sm" onClick={() => printDoc(r, 'card')}><Ic id="print" size="sm" />הדפסת כרטיס</button>
          <button type="button" className="btn sm" onClick={() => printDoc(r, 'account')}><Ic id="wallet" size="sm" />דף חשבון</button>
          <button type="button" className="ibtn" aria-label="שליחת מייל" data-tip="שליחת מייל" onClick={() => { a5.say('שליחת מייל נעשית מכרטיס הלקוח', 'info'); open(r); }}><Ic id="mail" size="sm" /></button>
        </b></div>
      </>
    );
  };

  const numCell = (get, fmt) => ({ tdClass: (r) => `num${get(r) ? '' : ' zero'}`, cell: (r) => (get(r) ? fmt(r) : '') });
  const columns = [
    { k: 'number', t: 'מס׳ לקוח', cell: (r, c) => (r.number ? <bdi>{c.hl(String(r.number))}</bdi> : '') },
    { k: 'name', t: 'שם', cell: (r, c) => <span className="tcn"><Ic id={r.blocked ? 'ban' : 'user'} /><b>{c.hl(r.title)}</b></span> },
    { k: 'phone', t: 'טלפון', cell: (r, c) => (r.phone ? <><Ic id="phone" /><bdi>{c.hl(r.phone)}</bdi></> : '') },
    { k: 'email', t: 'מייל', cell: (r, c) => (r.email ? <><Ic id="mail" /><bdi>{c.hl(r.email)}</bdi></> : '') },
    { k: 'city', t: 'עיר', cell: (r) => (r.city ? <><Ic id="pin" />{r.city}</> : '') },
    { k: 'orders', t: 'הזמנות', ...numCell((r) => r.orders, (r) => r.orders) },
    { k: 'debt', t: 'חוב', ...numCell((r) => r.debt, (r) => <b><bdi>{money(r.debt)}</bdi></b>) },
    { k: 'lastOrder', t: 'הזמנה אחרונה', cell: (r) => (r.lastOrder ? <><Ic id="cal" />{hDateFull(r.lastOrder)}</> : '') },
  ];

  const onExport = async (kind, _list, state, info) => {
    a5.say('מכין את הרשימה…', 'info');
    let res;
    try { res = await L.fetchAll(EXPORT_MAX); } catch { a5.say('הייצוא נכשל', 'error', 'טעינת הרשימה מהשרת נכשלה'); return; }
    const all = res.rows.map(customerRow);
    if (!all.length) { a5.say('אין שורות לייצוא', 'warn', 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים'); return; }
    if (res.truncated) a5.say(`יוצאו ${EXPORT_MAX} הלקוחות הראשונים מתוך ${res.total}`, 'warn', 'צמצמו את הסינון כדי לייצא את כולם');
    const sheet = buildCustomersSheet(all, info.filterText);
    if (EXPORT_HOOK.current && EXPORT_HOOK.current({ kind, rows: all, state, info, say: a5.say, sheet })) return;
    // הדפסה / הורדת PDF: התצוגה המקדימה המעוצבת (a5-print, מסמך 'customers-list'); Excel נשאר קובץ הנתונים
    if (kind !== 'excel') { runPrint({ doc: 'customers-list', kind, say: a5.say, data: { sheet } }); return; }
    const flat = sheetFlatRows(sheet);
    runListExport({ kind, say: a5.say, title: SHEET_TITLE, subtitle: info.filterText, base: 'לקוחות', head: flat.head, rows: flat.rows });
  };

  return (
    <>
      <A5ListPage
        title="לקוחות" backId="cusBack" guide="cl" onBack={() => router.push('/admin')}
        slotId={SLOT_ID} cardIcon="users" cardTitle="רשימת לקוחות"
        cardAction={<button type="button" className="btn navy" id="btnNew" data-guide-id="cl.new" onClick={() => router.push('/customers/new')}><Ic id="plus" />לקוח חדש</button>}
      >
        <A5List
          ref={listRef}
          guide="cl"
          items={rows}
          getId={(r) => r.id}
          texts={{ placeholder: 'חיפוש לקוח (שם, טלפון, מייל, עיר)…', aiPlaceholder: 'בקשו מה-AI למצוא לקוחות (למשל: לקוחות מירושלים עם חוב)…', countLabel: 'לקוחות', emptyText: 'לא נמצאו לקוחות התואמים את החיפוש' }}
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
          rowClass={(r) => (r.blocked ? 'off' : '')}
          rowMain={rowMain}
          detail={detail}
          columns={columns}
          onOpen={open}
          searchSlot={SLOT_ID}
          ai={aiHidden ? null : ai}
          onStats={aiHidden ? null : () => setStats(true)}
          notices={data ? data.notices : []}
          exportSpec={{ what: 'רשימת הלקוחות', onExport }}
          loading={data === null || (busy && !rows.length)}
          error={error}
          onRetry={L.reload}
        />
      </A5ListPage>
      {dlg ? (
        <RangeDialog
          title="טווח הזמנה ראשונה"
          onDone={(r) => { setCustom(r); setDlg(false); }}
          onCancel={() => { setDlg(false); if (listRef.current) listRef.current.setGroup('first', firstSel.filter((k) => k !== 'custom')); }}
        />
      ) : null}
      {stats ? <StatisticsModal isOpen onClose={() => setStats(false)} pageContext="customers" position={null} /> : null}
    </>
  );
}

export default function CustomersListA5() {
  return <A5Page name="gm-cus"><CustomersList /></A5Page>;
}
