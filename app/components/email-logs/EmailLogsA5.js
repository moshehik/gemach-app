'use client';

// יומן שליחת המיילים החדש (/admin/site-settings/email-logs, מתכנת בלבד) - אותו קונספט בדיוק כמו רשימות העובדים / הדגמים / ההזמנות (העיצוב המאושר, ערכת a5-list):
// כותרת עם חץ חזרה + חיפוש חצי רוחב מתחת לכותרת + לחצן "סינון" אחד, סרגל תוצאות דביק (שורות / טבלה, מיון, עימוד 50 בקפסולה, XL / הורדה / הדפסה),
// שורות 21px/14px עם זוגות אייקון + ערך (אפס / ריק לא מוצג), חץ פרטים מהירים, לחצן שורה פותח את כרטיס ההזמנה / הלקוח כשיש.
// אין כאן חיפוש חכם ושאלות סטטיסטיקה: אין להם שרת ליומן המיילים (smart-search / statistics לא מכירים את הטבלה) - שני הלחצנים הושמטו.
// הנתונים: POST /api/admin/email-logs (עימוד שרת - לעולם לא כל הטבלה) + /counts (ספירת אפשרויות הסינון). פירוט: docs/a5-staff-models/email-logs-notes.md.

import '@/design-system/components.css';
import './email-logs.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageVariantToggle from '../variant/PageVariantToggle';
import { runPrint } from '../a5-print/runPrint';
import { A5List, A5ListPage, A5Page, Ic, dayKey, dayTitle, hDateFull, hDateShort, runListExport, timeHM, useA5 } from '../a5-list';
import useAdminServerList from '../admin-lists/useAdminServerList';
import RangeDialog from '../admin-lists/RangeDialog';
import {
  DEFAULT_SORT, EXPORT_MAX, SHEET_TITLE, SORTS, buildEmailFilters, buildEmailLogSheet, buildEmailQuery, countsKey, emailExcelRows, emailPairs, emailRow, openTarget, rowIcon,
} from './emailLogsLogic';
import { STATUS_ICON, STATUS_WORD, typeIcon, typeLabel } from '../../../lib/adminEmailLogs';

const SLOT_ID = 'a5l-search-eml';
const ENDPOINT = '/api/admin/email-logs';

function Pair({ p, hl }) {
  const body = p.bdi ? <bdi>{hl(p.text)}</bdi> : p.bold ? <b><bdi>{p.text}</bdi></b> : p.text;
  return <span className={`lni${p.warn ? ' warn' : ''}`} data-tip={p.tip}><Ic id={p.icon} />{body}</span>;
}

const sheetFns = {
  dayKey: (iso) => dayKey(iso),
  dayLabel: (dk) => dayTitle(dk),
  time: (iso) => timeHM(iso),
};

function EmailLogs() {
  const router = useRouter();
  const a5 = useA5();
  const listRef = useRef(null);
  const [dlg, setDlg] = useState(false);
  const L = useAdminServerList({ endpoint: ENDPOINT, buildQuery: buildEmailQuery, countsKey, defaultSort: DEFAULT_SORT });
  const { ui, custom, setCustom, data, busy, error, counts } = L;

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

  const rows = useMemo(() => (data ? data.rows.map(emailRow) : []), [data]);
  const customLabel = custom ? `${hDateShort(custom.from)} – ${hDateShort(custom.to)}` : 'טווח מותאם…';
  const filters = useMemo(() => buildEmailFilters(counts, { customLabel }), [counts, customLabel]);

  // לחיצה על שורה: כרטיס ההזמנה / הלקוח כשיש; בלי יעד - השורה נפתחת (false = "לא טופל" -> הערכה פותחת את הפרטים)
  const open = (r) => {
    const target = openTarget(r);
    if (!target) return false;
    router.push(target);
    return true;
  };

  const rowMain = (r, c) => (
    <>
      <div className="ic-b sq"><Ic id={rowIcon(r)} /></div>
      <div className="t"><b><bdi>{c.hl(r.title)}</bdi></b><span className="ln mi">
        {emailPairs(r, hDateFull, timeHM).map((p) => <Pair key={p.key} p={p} hl={c.hl} />)}
      </span></div>
    </>
  );

  const detail = (r) => {
    const row = (k, v) => <div className="hv-r"><small>{k}</small><b>{v}</b></div>;
    const customer = [r.customerName, r.customerNo != null ? `#${r.customerNo}` : ''].filter(Boolean).join(' · ');
    return (
      <>
        {row('נמען', <bdi dir="ltr">{r.to}</bdi>)}
        {r.cc ? row('עותק', <bdi dir="ltr">{r.cc}</bdi>) : null}
        {r.subject ? row('נושא', r.subject) : null}
        {r.bodyHidden ? row('תוכן', 'מוסתר - המייל מכיל סיסמה זמנית') : r.bodyPreview ? row('תוכן', <span className="el-body">{r.bodyPreview}</span>) : null}
        {r.fileCount > 0 ? row(r.fileCount === 1 ? 'קובץ מצורף' : 'קבצים מצורפים', r.files.join(' · ')) : null}
        {customer ? row('לקוח', customer) : null}
        {r.orderNo ? row('הזמנה', <bdi>{r.orderNo}</bdi>) : null}
        {r.senderName ? row('נשלח על ידי', r.senderName) : null}
        {row('נשלח', `${dayTitle(r.sentAt)} · ${timeHM(r.sentAt)}`)}
        {r.acknowledgedAt ? row('אישור קריאה', `${hDateFull(r.acknowledgedAt)} · ${timeHM(r.acknowledgedAt)}`) : null}
        {r.error ? row('סיבת הכשל', <span className="el-err">{r.error}</span>) : null}
        {r.driveLinks.length ? row('קבצים בדרייב', (
          <span className="el-links">{r.driveLinks.map((d, i) => (d.url
            ? <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" dir="ltr">{d.text}</a>
            : <bdi key={i} dir="ltr">{d.text}</bdi>))}</span>
        )) : null}
        {r.orderNo || r.customerId ? (
          <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
            {r.orderNo ? <button type="button" className="btn primary sm" onClick={() => router.push(`/orders/${r.orderNo}`)}><Ic id="file" size="sm" />כרטיס הזמנה</button> : null}
            {r.customerId ? <button type="button" className={`btn${r.orderNo ? '' : ' primary'} sm`} onClick={() => router.push(`/customers/${r.customerId}`)}><Ic id="user" size="sm" />כרטיס לקוח</button> : null}
          </b></div>
        ) : null}
      </>
    );
  };

  const numCell = (get, fmt) => ({ tdClass: (r) => `num${get(r) ? '' : ' zero'}`, cell: (r) => (get(r) ? fmt(r) : '') });
  const columns = [
    { k: 'to', t: 'נמען', cell: (r, c) => <span className="tcn"><Ic id={rowIcon(r)} /><b><bdi>{c.hl(r.title)}</bdi></b></span> },
    { k: 'type', t: 'סוג', cell: (r) => <><Ic id={typeIcon(r.type)} />{typeLabel(r.type)}</> },
    { k: 'status', t: 'סטטוס', cell: (r) => <><Ic id={STATUS_ICON[r.state] || 'check'} />{STATUS_WORD[r.state]}</> },
    { k: 'sentAt', t: 'זמן שליחה', cell: (r) => <><Ic id="clock" />{[hDateFull(r.sentAt), timeHM(r.sentAt)].filter(Boolean).join(' · ')}</> },
    { k: 'subject', t: 'נושא', cell: (r) => r.subject },
    { k: 'files', t: 'קבצים', ...numCell((r) => r.fileCount, (r) => r.fileCount) },
    { k: 'order', t: 'הזמנה', ...numCell((r) => r.orderNo, (r) => <bdi>{r.orderNo}</bdi>) },
  ];

  const onExport = async (kind, _list, state, info) => {
    a5.say('מכין את הרשימה…', 'info');
    let res;
    try { res = await L.fetchAll(EXPORT_MAX); } catch { a5.say('הייצוא נכשל', 'error', 'טעינת הרשימה מהשרת נכשלה'); return; }
    const all = res.rows.map(emailRow);
    if (!all.length) { a5.say('אין שורות לייצוא', 'warn', 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים'); return; }
    if (res.truncated) a5.say(`יוצאו ${EXPORT_MAX} המיילים הראשונים מתוך ${res.total}`, 'warn', 'צמצמו את הסינון כדי לייצא את כולם');
    // הדפסה / הורדת PDF: התצוגה המקדימה המעוצבת (a5-print, מסמך 'email-log'); Excel = קובץ הנתונים המלא
    if (kind !== 'excel') { runPrint({ doc: 'email-log', kind, say: a5.say, data: { sheet: buildEmailLogSheet(all, info.filterText, sheetFns) } }); return; }
    const flat = emailExcelRows(all, { date: (iso) => hDateFull(iso), time: (iso) => timeHM(iso) });
    runListExport({ kind, say: a5.say, title: SHEET_TITLE, subtitle: info.filterText, base: 'יומן מיילים', head: flat.head, rows: flat.rows });
  };

  return (
    <>
      <A5ListPage
        title="יומן מיילים" backId="emlBack" backLabel="חזרה להגדרות האתר" onBack={() => router.push('/admin/site-settings')}
        tools={<PageVariantToggle screen="email_logs" placement="header" systemTip />}
        slotId={SLOT_ID} cardIcon="mail" cardTitle="יומן שליחת מיילים"
      >
        <A5List
          ref={listRef}
          items={rows}
          getId={(r) => r.id}
          texts={{ placeholder: 'חיפוש מייל (נמען, נושא או תוכן)…', countLabel: 'מיילים', emptyText: 'לא נמצאו מיילים התואמים את החיפוש' }}
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
          rowMain={rowMain}
          detail={detail}
          columns={columns}
          onOpen={open}
          searchSlot={SLOT_ID}
          notices={data ? data.notices : []}
          exportSpec={{ what: 'יומן המיילים', onExport }}
          loading={data === null || (busy && !rows.length)}
          error={error}
          onRetry={L.reload}
        />
      </A5ListPage>
      {dlg ? (
        <RangeDialog
          title="טווח תאריכי שליחה"
          onDone={(r) => { setCustom(r); setDlg(false); }}
          onCancel={() => { setDlg(false); if (listRef.current) listRef.current.setGroup('period', periodSel.filter((k) => k !== 'custom')); }}
        />
      ) : null}
    </>
  );
}

export default function EmailLogsA5() {
  return <A5Page name="gm-eml"><EmailLogs /></A5Page>;
}
