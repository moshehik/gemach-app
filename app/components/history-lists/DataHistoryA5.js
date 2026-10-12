'use client';

// היסטוריית נתונים (/admin/data-history) - אותו קונספט בדיוק כמו רשימות ההזמנות / הלקוחות / העובדים / הדגמים (העיצוב המאושר, ערכת הרשימות app/components/a5-list):
// כותרת עם חץ חזרה ל"ניהול" ומתג הישן/חדש, חיפוש חצי רוחב מתחת לכותרת (בתוך פרטי השינוי, כמו הדף הישן; בלי חיפוש חכם / סטטיסטיקה - אין להם שרת ליומן),
// לחצן "סינון" אחד (סוג רשומה / פעולה / עובד / תקופה), סרגל תוצאות דביק (שורות / טבלה, מיון, עימוד 50 בקפסולה, XL / הורדה / הדפסה),
// שורות 21px/14px: "הזמנה #53375 · עודכנה" ובשורה 2 מתי / מי / כמה שדות, חץ פרטים מהירים = "לפני ← אחרי" לכל שדה + מעבר לרשומה.
// הנתונים: POST /api/admin/data-history (עימוד שרת, סך חסום ל-100,000, ספירות האפשרויות נטענות רק כשחלון הסינון פתוח). פירוט: docs/a5-staff-models/data-history-notes.md.

import '@/design-system/components.css';
import './history-lists.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ACTION_TRANSLATIONS, FIELD_TRANSLATIONS } from '@/components/HistoryViewer';
import { labelChangeValue } from '@/components/modern/changesDisplay';
import PageVariantToggle from '../variant/PageVariantToggle';
import { runPrint } from '../a5-print/runPrint';
import { A5List, A5ListPage, A5Page, Ic, dayKey, dayTitle, hDateFull, hDateShort, relDay, runListExport, timeHM, useA5 } from '../a5-list';
import useAdminServerList from '../admin-lists/useAdminServerList';
import RangeDialog from '../admin-lists/RangeDialog';
import { ENTITY_META } from '../../../lib/adminAuditList.js';
import { EXPORT_MAX, PRINT_MAX, printLimitText, printTooLong, totalSuffix } from './historyShared';
import {
  DEFAULT_SORT, SHEET_TITLE, SORTS, auditPairs, auditRow, buildAuditFilters, buildAuditQuery, buildAuditSheet, changeLines, changeSummary, countsKey,
  formatChangeValue, sheetFlatRows,
} from './dataHistoryLogic';

// מדריך האתר: guide="dhs" מצמיד data-guide-id (dhs.back / dhs.search / dhs.filter / dhs.sort / dhs.view / dhs.export-* ...) - lib/aiGuide/areas/admin.targets.js
const SLOT_ID = 'a5l-search-dhs';
const ENDPOINT = '/api/admin/data-history';
const KNOWN_TYPES = Object.keys(ENTITY_META);

const dateFns = { hDate: (iso) => hDateFull(iso), hm: (iso) => timeHM(iso), rel: (iso) => relDay(iso), dayKey: (iso) => dayKey(iso), dayLabel: (k) => dayTitle(k) };
const fmt = {
  label: (k) => FIELD_TRANSLATIONS[k] || k,
  value: (k, v) => formatChangeValue(k, v, dateFns, labelChangeValue),
};

function Pair({ p }) {
  const body = p.bdi ? <bdi>{p.text}</bdi> : p.bold ? <b><bdi>{p.text}</bdi></b> : p.text;
  return <span className={`lni${p.warn ? ' warn' : ''}`} data-tip={p.tip}><Ic id={p.icon} />{body}</span>;
}

function Diff({ line }) {
  if (line.masked) return <span className="hh-mask">הערך מוסתר</span>;
  if (!line.before) return <bdi>{line.after}</bdi>;
  return (
    <>
      <bdi className="hh-old">{line.before}</bdi>
      <span className="hh-arr" aria-label="שונה ל"><Ic id="arrl" size="sm" /></span>
      <bdi className="hh-new">{line.after}</bdi>
    </>
  );
}

function DataHistory() {
  const router = useRouter();
  const a5 = useA5();
  const listRef = useRef(null);
  const [names, setNames] = useState({}); // שמות העובדים שנצברו מהספירות (כיתוב אפשרות שנבחרה לא נעלם כשהספירה שלה יורדת)
  const [dlg, setDlg] = useState(false);
  const L = useAdminServerList({ endpoint: ENDPOINT, buildQuery: buildAuditQuery, countsKey, defaultSort: DEFAULT_SORT });
  const { ui, custom, setCustom, data, busy, error, counts } = L;

  // שגיאת שרת (למשל 503 "צמצמו את הסינון") כשכבר יש שורות על המסך: הודעה בטוסט (בלי שורות - הערכה מציגה אותה בגוף הרשימה)
  const hadRows = !!(data && data.rows.length);
  useEffect(() => { if (error && hadRows) a5.say(error, 'warn'); }, [error]);

  // "טווח מותאם": בחירה באפשרות פותחת חלון כהה עם לוח עברי; ביטול מבטל את הבחירה; הסרת הבחירה מנקה את הטווח
  const periodSel = ui.sel.period || [];
  const customOn = periodSel.includes('custom');
  const prevOn = useRef(false);
  useEffect(() => {
    if (customOn && !prevOn.current && !custom) setDlg(true);
    if (!customOn) { if (custom) setCustom(null); if (dlg) setDlg(false); }
    prevOn.current = customOn;
  }, [customOn, custom, dlg, setCustom]);

  useEffect(() => { if (counts && counts.employeeNames) setNames((n) => ({ ...n, ...counts.employeeNames })); }, [counts]);
  const rows = useMemo(() => (data ? data.rows.map((r) => auditRow(r, ACTION_TRANSLATIONS)) : []), [data]);
  const customLabel = custom ? `${hDateShort(custom.from)} – ${hDateShort(custom.to)}` : 'טווח מותאם…';
  const filters = useMemo(() => buildAuditFilters(counts, { customLabel, sel: ui.sel, names, knownTypes: KNOWN_TYPES }), [counts, customLabel, ui.sel, names]);

  const open = (r) => { if (r.entity && r.entity.href) router.push(r.entity.href); };
  // לחיצה על שורה פותחת את כרטיס הרשומה; לרשומה בלי כרטיס (נמחקה / אין לה דף) - false = הערכה פותחת את הפירוט המהיר (כמו לחיצה על החץ)
  const onOpen = (r) => { if (r.entity && r.entity.href) { open(r); return true; } return false; };

  const rowMain = (r, c) => (
    <>
      <div className="ic-b sq" data-tip={r.typeLabel}><Ic id={r.icon} /></div>
      <div className="t"><b>{c.hl(r.title)}</b><span className="ln mi">
        {auditPairs(r, dateFns).map((p) => <Pair key={p.key} p={p} />)}
      </span></div>
    </>
  );

  const detail = (r) => {
    const row = (k, v, key) => <div className="hv-r" key={key || k}><small>{k}</small><b>{v}</b></div>;
    const lines = changeLines(r.changes, fmt);
    const hidden = Math.max(0, (r.n || 0) - lines.length);
    return (
      <>
        {row('מתי', <bdi>{dayTitle(r.t)} · {timeHM(r.t)}</bdi>)}
        {row('מי ביצע', r.system ? 'המערכת (פעולה אוטומטית)' : r.who)}
        {row('סוג רשומה', r.typeLabel)}
        {r.entity && r.entity.who ? row('לקוח', r.entity.who) : null}
        {lines.map((l) => row(l.label, <Diff line={l} />, l.key))}
        {r.big ? row('שינוי', 'גדול מדי להצגה כאן') : null}
        {!lines.length && !r.big ? row('שינוי', 'אין שדות להצגה (שינוי פנימי)') : null}
        {hidden > 0 ? <div className="hv-r" key="more"><small /><b className="hh-more">ועוד {hidden} שדות</b></div> : null}
        {r.entity && r.entity.href ? (
          <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
            <button type="button" className="btn primary sm" onClick={() => open(r)}><Ic id={r.icon === 'trash' ? 'file' : r.icon} size="sm" />פתיחת הרשומה</button>
          </b></div>
        ) : null}
      </>
    );
  };

  const columns = [
    { k: 'time', t: 'זמן', cell: (r) => <><Ic id="clock" /><bdi>{hDateFull(r.t)} · {timeHM(r.t)}</bdi></> },
    { k: 'type', t: 'רשומה', cell: (r, c) => <span className="tcn"><Ic id={r.icon} /><b>{c.hl(r.subject)}</b></span> },
    { k: 'action', t: 'פעולה', cell: (r) => r.verb },
    { k: 'employee', t: 'עובד', cell: (r) => (r.system ? <><Ic id="gear" />מערכת</> : <><Ic id="user" />{r.who}</>) },
    { k: 'size', t: 'השינוי', cell: (r) => <span className="hh-sum">{changeSummary(r, fmt, 2)}</span> },
  ];

  const onExport = async (kind, _list, state, info) => {
    if (printTooLong(kind, info.total)) {
      await a5.confirm({ title: 'הרשימה ארוכה מדי להדפסה', sub: printLimitText(PRINT_MAX), okLabel: 'הבנתי', icon: 'alert', cancelLabel: 'חזרה' });
      return;
    }
    a5.say('מכין את היומן…', 'info');
    let res;
    try { res = await L.fetchAll(EXPORT_MAX); } catch { a5.say('הייצוא נכשל', 'error', 'טעינת היומן מהשרת נכשלה'); return; }
    const all = res.rows.map((r) => auditRow(r, ACTION_TRANSLATIONS));
    if (!all.length) { a5.say('אין שורות לייצוא', 'warn', 'היומן ריק לפי החיפוש והסינון הנוכחיים'); return; }
    if (res.truncated) a5.say(`יוצאו ${EXPORT_MAX} השורות הראשונות מתוך ${res.total}`, 'warn', 'צמצמו את הסינון כדי לייצא את כולן');
    const sheet = buildAuditSheet(all, info.filterText, dateFns, fmt, ui.sort.k === 'time' && ui.sort.dir > 0);
    if (kind !== 'excel') { runPrint({ doc: 'data-history', kind, say: a5.say, data: { sheet } }); return; }
    const flat = sheetFlatRows(sheet);
    runListExport({ kind, say: a5.say, title: SHEET_TITLE, subtitle: info.filterText, base: 'יומן שינויים', head: flat.head, rows: flat.rows });
  };

  return (
    <>
      <A5ListPage
        guide="dhs" title="היסטוריית נתונים" backId="dhsBack" onBack={() => router.push('/admin')} slotId={SLOT_ID}
        tools={<PageVariantToggle screen="data_history" placement="header" systemTip />}
        cardIcon="sn-history" cardTitle="יומן שינויים"
      >
        <A5List
          ref={listRef}
          guide="dhs"
          items={rows}
          getId={(r) => r.id}
          texts={{
            placeholder: 'חיפוש בפרטי השינוי (למשל טלפון, שם, עיר, מספר הזמנה)…',
            countLabel: 'שינויים',
            countSuffix: totalSuffix(data && data.totalCapped),
            emptyText: 'לא נמצאו שינויים התואמים את החיפוש והסינון',
          }}
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
          rowClass={(r) => (r.action === 'DELETE' ? 'off' : '')}
          rowMain={rowMain}
          detail={detail}
          columns={columns}
          onOpen={onOpen}
          searchSlot={SLOT_ID}
          notices={data ? data.notices : []}
          exportSpec={{ what: 'יומן השינויים', onExport }}
          loading={data === null || (busy && !rows.length)}
          error={error}
          onRetry={L.reload}
        />
      </A5ListPage>
      {dlg ? (
        <RangeDialog
          title="טווח תאריכים"
          onDone={(r) => { setCustom(r); setDlg(false); }}
          onCancel={() => { setDlg(false); if (listRef.current) listRef.current.setGroup('period', periodSel.filter((k) => k !== 'custom')); }}
        />
      ) : null}
    </>
  );
}

export default function DataHistoryA5() {
  return <A5Page name="gm-dhs"><DataHistory /></A5Page>;
}
