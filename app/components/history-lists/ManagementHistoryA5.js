'use client';

// היסטוריית שאילתות ו-API (/management/history) - אותו קונספט כמו רשימות הניהול האחרות (ערכת הרשימות app/components/a5-list): כותרת עם חץ חזרה ומתג הישן/חדש,
// חיפוש חצי רוחב (נתיב / שאילתה / שגיאה / שם עובד; בלי חיפוש חכם / סטטיסטיקה - אין להם שרת ליומן הזה), לחצן "סינון" אחד (סוג / מצב / עובד / תקופה),
// סרגל תוצאות דביק (שורות / טבלה, מיון, עימוד 50, XL / הורדה / הדפסה), שורות 21px/14px (נתיב או שם מסך + מתי / מי / נפח / משך / תקלה),
// חץ פרטים מהירים = הנתיב המלא והפרמטרים שנשלחו (במקום החלון "הצג פרמטרי שאילתה").
// ניהול הרשומות (הדף הישן: מחק נבחרים / ישן מ-90 יום / הכל) - אותו חוזה של DELETE /api/history עם קוד מנהל, בחלון כהה (PinDialog), לחצן "ניהול רשומות" בסרגל התוצאות.
// הנתונים: POST /api/admin/management-history (עימוד שרת, סך חסום ל-100,000, ספירות האפשרויות רק כשחלון הסינון פתוח). פירוט: docs/a5-staff-models/management-history-notes.md.

import '@/design-system/components.css';
import './history-lists.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageVariantToggle from '../variant/PageVariantToggle';
import { runPrint } from '../a5-print/runPrint';
import { A5List, A5ListPage, A5Page, Dlg, DlgBadge, Ic, dayKey, dayTitle, hDateShort, relDay, runListExport, timeHM, useA5 } from '../a5-list';
import useAdminServerList from '../admin-lists/useAdminServerList';
import RangeDialog from '../admin-lists/RangeDialog';
import PinDialog from './PinDialog';
import { EXPORT_MAX, PRINT_MAX, printLimitText, printTooLong, totalSuffix } from './historyShared';
import {
  DEFAULT_SORT, DEFAULT_TYPES, OLD_RECORDS_DAYS, SHEET_TITLE, SORTS, buildVisitFilters, buildVisitQuery, buildVisitSheet, countsKey, formatSize, sheetFlatRows,
  visitPairs, visitRow,
} from './visitLogLogic';

// מדריך האתר: guide="mgh" מצמיד data-guide-id (mgh.back / mgh.search / mgh.filter / mgh.sort / mgh.view / mgh.export-* ...) - lib/aiGuide/areas/admin.targets.js
const SLOT_ID = 'a5l-search-mgh';
const ENDPOINT = '/api/admin/management-history';
const INITIAL_SEL = { types: DEFAULT_TYPES.slice() };
const dateFns = { hm: (iso) => timeHM(iso), rel: (iso) => relDay(iso), dayKey: (iso) => dayKey(iso), dayLabel: (k) => dayTitle(k) };

function Pair({ p }) {
  const body = p.bdi ? <bdi>{p.text}</bdi> : p.bold ? <b><bdi>{p.text}</bdi></b> : p.text;
  return <span className={`lni${p.warn ? ' warn' : ''}`} data-tip={p.tip}><Ic id={p.icon} />{body}</span>;
}

/** החלון "ניהול רשומות": שלוש הפעולות של הדף הישן. */
function ManageDialog({ onPick, onClose, total }) {
  return (
    <Dlg labelledBy="a5-mg-t" onClose={onClose} focusSel=".btn.primary">
      <DlgBadge icon="trash" />
      <h2 id="a5-mg-t">ניהול רשומות</h2>
      <div className="sub">{total ? `בהיסטוריה כ-${total.toLocaleString('he-IL')} רשומות. מחיקה דורשת קוד מנהל ואי אפשר לבטל אותה.` : 'מחיקה דורשת קוד מנהל ואי אפשר לבטל אותה.'}</div>
      <div className="dbtns">
        <button type="button" className="btn primary lg block" onClick={() => onPick('select')}><Ic id="check" />בחירת רשומות למחיקה</button>
        <button type="button" className="btn lg block" onClick={() => onPick('old')}><Ic id="clock" />מחיקת רשומות ישנות מ-{OLD_RECORDS_DAYS} יום</button>
        <button type="button" className="btn lg block" onClick={() => onPick('all')}><Ic id="trash" />מחיקת כל ההיסטוריה</button>
        <button type="button" className="btn ghost block" onClick={onClose}><Ic id="back" size="sm" />חזרה</button>
      </div>
    </Dlg>
  );
}

function ManagementHistory() {
  const router = useRouter();
  const a5 = useA5();
  const listRef = useRef(null);
  const [names, setNames] = useState({}); // שמות העובדים שנצברו מהספירות (כיתוב אפשרות שנבחרה לא נעלם כשהספירה שלה יורדת)
  const meId = useRef(null);
  const [dlg, setDlg] = useState(false);
  const [manage, setManage] = useState(false);
  const [selMode, setSelMode] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [pin, setPin] = useState(null); // { mode: 'selected'|'old'|'all', ids?: string[] }
  const L = useAdminServerList({ endpoint: ENDPOINT, buildQuery: buildVisitQuery, countsKey, defaultSort: DEFAULT_SORT, initialSel: INITIAL_SEL });
  const { ui, custom, setCustom, data, busy, error, counts } = L;

  const hadRows = !!(data && data.rows.length);
  useEffect(() => { if (error && hadRows) a5.say(error, 'warn'); }, [error]);

  const periodSel = ui.sel.period || [];
  const customOn = periodSel.includes('custom');
  const prevOn = useRef(false);
  useEffect(() => {
    if (customOn && !prevOn.current && !custom) setDlg(true);
    if (!customOn) { if (custom) setCustom(null); if (dlg) setDlg(false); }
    prevOn.current = customOn;
  }, [customOn, custom, dlg, setCustom]);

  // הבחירה למחיקה חלה על העמוד המוצג בלבד: מתאפסת כשהרשימה (עמוד / סינון / מיון) מתחלפת
  useEffect(() => { setPicked(new Set()); }, [data]);

  useEffect(() => { if (counts && counts.employeeNames) setNames((n) => ({ ...n, ...counts.employeeNames })); }, [counts]);
  const rows = useMemo(() => (data ? data.rows.map(visitRow) : []), [data]);
  // התראת "מעל 10,000 רשומות" (כמו הישן): לחצן בכותרת הכרטיס (טולטיפ עם הנוסח, לחיצה פותחת את "ניהול רשומות") - לא שורה בזרימה בין הכותרת לסרגל, כדי שהסרגל יישאר באותו מקום בכל הדפים
  const bigLogNotice = data && data.notices ? data.notices.find((n) => n.kind === 'large-log') : null;
  const [bigLogText, setBigLogText] = useState('');
  useEffect(() => { if (bigLogNotice) setBigLogText(bigLogNotice.text); }, [bigLogNotice]);
  const bigLog = !!bigLogText;
  const customLabel = custom ? `${hDateShort(custom.from)} – ${hDateShort(custom.to)}` : 'טווח מותאם…';
  const filters = useMemo(() => buildVisitFilters(counts, { customLabel, sel: ui.sel, names }), [counts, customLabel, ui.sel, names]);

  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const togglePage = () => setPicked(allOnPage ? new Set() : new Set(rows.map((r) => r.id)));

  /* ----- מחיקה: הקוד נשלח רק ל-DELETE /api/history (חוזה הדף הישן). מחזיר הודעת שגיאה (מחרוזת) או '' בהצלחה. ----- */
  const currentEmployeeId = async () => {
    if (meId.current) return meId.current;
    try {
      const r = await fetch('/api/me', { cache: 'no-store' });
      const j = await r.json();
      meId.current = (j && (j.id || (j.employee && j.employee.id))) || '';
    } catch { meId.current = ''; }
    return meId.current;
  };
  const runDelete = async (code) => {
    const mode = pin.mode;
    const body = { username: await currentEmployeeId(), password: code };
    if (mode === 'selected') body.ids = pin.ids;
    else if (mode === 'old') body.olderThanDays = OLD_RECORDS_DAYS;
    else body.deleteAll = true;
    let j;
    try {
      const res = await fetch('/api/history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) return (j && j.message) || 'המחיקה נכשלה';
    } catch { return 'שגיאת תקשורת'; }
    setPin(null); setPicked(new Set()); setSelMode(false);
    a5.say(typeof j.deletedCount === 'number' ? `נמחקו ${j.deletedCount.toLocaleString('he-IL')} רשומות` : 'הרשומות נמחקו', 'ok');
    L.reload();
    return '';
  };
  const askDelete = (mode, ids) => setPin({ mode, ids });
  const pinCopy = pin && ({
    selected: { title: `למחוק ${pin.ids ? pin.ids.length : 0} רשומות?`, sub: 'הרשומות שנבחרו יימחקו לצמיתות מהיסטוריית השאילתות.' },
    old: { title: `למחוק רשומות מעל ${OLD_RECORDS_DAYS} יום?`, sub: `רשומות מ-${OLD_RECORDS_DAYS} הימים האחרונים לא יימחקו.` },
    all: { title: 'למחוק את כל ההיסטוריה?', sub: 'כל הרשומות יימחקו לצמיתות ואי אפשר לשחזר אותן.' },
  })[pin.mode];

  const rowMain = (r, c) => (
    <>
      {selMode ? <input type="checkbox" className="hh-chk" aria-label="בחירת רשומה למחיקה" checked={picked.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /> : null}
      <div className="ic-b sq" data-tip={r.error ? 'שאילתה / ביקור עם תקלה' : r.api ? 'שאילתת שרת (API)' : 'ביקור במסך'}><Ic id={r.icon} /></div>
      <div className="t"><b>{r.api ? <bdi dir="ltr">{c.hl(r.title)}</bdi> : c.hl(r.title)}</b><span className="ln mi">
        {visitPairs(r, dateFns).map((p) => <Pair key={p.key} p={p} />)}
      </span></div>
    </>
  );

  const detail = (r) => {
    const row = (k, v) => <div className="hv-r" key={k}><small>{k}</small><b>{v}</b></div>;
    return (
      <>
        {row('מתי', <bdi>{dayTitle(r.t)} · {timeHM(r.t)}</bdi>)}
        {row('סוג', r.api ? 'שאילתת שרת (API)' : `ביקור במסך · ${r.screen}`)}
        {row('נתיב', <bdi dir="ltr">{r.path}</bdi>)}
        {r.whoText ? row('עובד', r.guest ? 'אורח (לא מחובר)' : r.whoText) : null}
        {r.size != null ? row('נפח הנתונים', <bdi>{formatSize(r.size)}</bdi>) : null}
        {r.ms ? row('משך', <bdi>{r.ms} ms</bdi>) : null}
        {r.error ? row('תקלה', r.error) : null}
        {r.query ? row('פרמטרים שנשלחו', <pre className="hh-q">{r.query}</pre>) : null}
        <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
          <button type="button" className="btn sm" onClick={() => askDelete('selected', [r.id])}><Ic id="trash" size="sm" />מחיקת הרשומה</button>
        </b></div>
      </>
    );
  };

  const columns = [
    ...(selMode ? [{ t: 'בחירה', cell: (r) => <input type="checkbox" className="hh-chk" aria-label="בחירת רשומה למחיקה" checked={picked.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /> }] : []),
    { k: 'time', t: 'זמן', cell: (r) => <><Ic id="clock" /><bdi>{dayTitle(r.t)} · {timeHM(r.t)}</bdi></> },
    { k: 'employee', t: 'עובד', cell: (r) => (r.whoText ? <><Ic id={r.guest ? 'users' : 'user'} />{r.whoText}</> : '') },
    { k: 'path', t: 'נתיב / שאילתה', tdClass: () => 'hh-pth', cell: (r, c) => <><Ic id={r.api ? 'online' : 'eye'} /><bdi dir="ltr" title={r.path}>{c.hl(r.title)}</bdi></> },
    { k: 'size', t: 'נפח נתונים', tdClass: (r) => `num${r.size != null ? '' : ' zero'}`, cell: (r) => (r.size != null ? <bdi>{formatSize(r.size)}</bdi> : '') },
    { k: 'duration', t: 'משך', tdClass: (r) => `num${r.ms ? '' : ' zero'}`, cell: (r) => (r.ms ? <bdi>{r.ms} ms</bdi> : '') },
    { k: 'status', t: 'תקלות', cell: (r) => (r.error ? <><Ic id="alert" />{r.error.length > 50 ? `${r.error.slice(0, 50)}…` : r.error}</> : <Ic id="check" />) },
  ];

  const onExport = async (kind, _list, state, info) => {
    if (printTooLong(kind, info.total)) {
      await a5.confirm({ title: 'הרשימה ארוכה מדי להדפסה', sub: printLimitText(PRINT_MAX), okLabel: 'הבנתי', icon: 'alert', cancelLabel: 'חזרה' });
      return;
    }
    a5.say('מכין את היומן…', 'info');
    let res;
    try { res = await L.fetchAll(EXPORT_MAX); } catch { a5.say('הייצוא נכשל', 'error', 'טעינת היומן מהשרת נכשלה'); return; }
    const all = res.rows.map(visitRow);
    if (!all.length) { a5.say('אין שורות לייצוא', 'warn', 'היומן ריק לפי החיפוש והסינון הנוכחיים'); return; }
    if (res.truncated) a5.say(`יוצאו ${EXPORT_MAX} השורות הראשונות מתוך ${res.total}`, 'warn', 'צמצמו את הסינון כדי לייצא את כולן');
    const sheet = buildVisitSheet(all, info.filterText, dateFns, ui.sort.k === 'time' && ui.sort.dir > 0);
    if (kind !== 'excel') { runPrint({ doc: 'visit-log', kind, say: a5.say, data: { sheet } }); return; }
    const flat = sheetFlatRows(sheet);
    runListExport({ kind, say: a5.say, title: SHEET_TITLE, subtitle: info.filterText, base: 'יומן שאילתות', head: flat.head, rows: flat.rows });
  };

  const barExtra = selMode ? (
    <>
      <div className="hf-sel hf-sort"><button type="button" className="hf-t" onClick={togglePage} data-tip="בחירה / ביטול בחירה של כל הרשומות בעמוד"><Ic id="check" /><span className="hf-lbl">{allOnPage ? 'בטל בחירת העמוד' : 'בחר את העמוד'}</span></button></div>
      <div className="hf-sel hf-sort"><button type="button" className="hf-t" disabled={!picked.size} onClick={() => askDelete('selected', [...picked])}><Ic id="trash" /><span className="hf-lbl">מחק נבחרים ({picked.size})</span></button></div>
      <div className="hf-sel hf-sort"><button type="button" className="hf-t" onClick={() => { setSelMode(false); setPicked(new Set()); }}><Ic id="x" /><span className="hf-lbl">סיום בחירה</span></button></div>
    </>
  ) : (
    <div className="hf-sel hf-sort"><button type="button" className="hf-t" onClick={() => setManage(true)} data-tip="מחיקת רשומות מההיסטוריה (דורש קוד מנהל)" data-guide-id="mgh.manage-records"><Ic id="trash" /><span className="hf-lbl">ניהול רשומות</span></button></div>
  );

  return (
    <>
      <A5ListPage
        guide="mgh" title="שאילתות ו-API" backId="mghBack" onBack={() => router.push('/admin')} slotId={SLOT_ID}
        tools={<PageVariantToggle screen="management_history" placement="header" systemTip />}
        cardIcon="online" cardTitle="היסטוריית שאילתות ו-API"
        cardAction={bigLog ? (
          <button type="button" className="btn navy" data-tip={bigLogText} onClick={() => setManage(true)}><Ic id="alert" />היומן גדול</button>
        ) : null}
      >
        <A5List
          ref={listRef}
          guide="mgh"
          items={rows}
          getId={(r) => r.id}
          texts={{
            placeholder: 'חיפוש נתיב, שאילתה, שגיאה או שם עובד…',
            countLabel: 'רשומות',
            countSuffix: totalSuffix(data && data.totalCapped),
            emptyText: 'לא נמצאו רשומות תואמות',
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
          rowMain={rowMain}
          detail={detail}
          columns={columns}
          searchSlot={SLOT_ID}
          barExtra={barExtra}
          exportSpec={{ what: 'יומן השאילתות', onExport }}
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
      {manage ? (
        <ManageDialog
          total={data && data.overall}
          onClose={() => setManage(false)}
          onPick={(m) => { setManage(false); if (m === 'select') setSelMode(true); else askDelete(m, null); }}
        />
      ) : null}
      {pin ? <PinDialog title={pinCopy.title} sub={pinCopy.sub} onDone={runDelete} onCancel={() => setPin(null)} /> : null}
    </>
  );
}

export default function ManagementHistoryA5() {
  return <A5Page name="gm-mgh"><ManagementHistory /></A5Page>;
}
