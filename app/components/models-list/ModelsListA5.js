'use client';

// רשימת הדגמים החדשה (/dashboard/dresses) - העיצוב המאושר: תצוגות-עיצוב/עובדים-ודגמים/models.html
// (scratch/emp-models-build/models.js + models.app.html), על ערכת הרשימות app/components/a5-list.
// כל התכונות של הדף הישן נשמרו: חיפוש חופשי בשרת (שם / קוד / מידה / מס' סידורי, כולל הצלת מקלדת אנגלית והודעות notices), סטטוס
// פעילים (ברירת מחדל) / לא פעילים / מחוקים / הכל, מיון, מחיקה ושחזור (הנהלה ראשית / מתכנת בלבד - כמו בישן), "החזר לפעילות" (לכולם, כמו בישן),
// "דגם חדש" (הנהלה ראשית / מתכנת), כרטיס דגם (/dashboard/dresses/<id>). אישורים בחלון כהה (לא window.confirm), הודעות בטוסט (לא alert).
//
// עימוד: הערכה תומכת גם בעימוד שרת, אבל כאן כל הקטלוג נטען (limit=500 לעמוד, קטלוג של ~120 דגמים) והעימוד של 50 לעמוד נעשה בלקוח - כי
// הסינון הקבוצתי עם ספירות לכל אפשרות ("אפשרות בלי תוצאות מוסתרת") והמיון לפי עמודות נגזרות (לא בשימוש / רזרבה / בתיקון / השכרות) דורשים את
// כל הקבוצה. החיפוש החופשי נשאר בשרת (lib/listSearch.js: קידומת דגם, מידה מדויקת, מקלדת אנגלית). הנתונים: /api/dresses?fields=summary&counts=1
// (counts=1 = תוספת תואמת-לאחור לתצורת summary; ר' app/api/dresses/route.js) דרך buildDressesListParams, כדי שמפתח המטמון של apiCache ייגזר מאותה פונקציה.
// ייצוא: Excel = קובץ xlsx אמיתי (runListExport). הדפסה והורדת PDF = התצוגה המקדימה המעוצבת של app/components/a5-print (מסמך 'models-list'): כל הדגמים שאחרי
// החיפוש + הסינון + המיון (גם כשהרשימה מעומדת ל-50 בלקוח - ההדפסה היא על כל השורות, לא על העמוד הנוכחי); ה-PDF נוצר בשרת מאותם גיליונות.

import '@/design-system/components.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { buildDressesListParams } from '@/app/lib/prefetchRoutes';
import StatisticsModal from '../StatisticsModal';
import PageVariantToggle from '../variant/PageVariantToggle';
import { runPrint } from '../a5-print/runPrint';
import {
  A5List, A5ListPage, A5Page, Ic, dayTitle, hDateFull, relDay, runListExport, useA5,
} from '../a5-list';
import {
  CATALOG_PAGE, SORTS, buildFilters, mergePages, modelRow, rowClass, rowIcon, isInactive, sizesPlain, statusReason, statusText,
} from './modelsLogic';

const SLOT_ID = 'a5l-search-mdl';
const SEARCH_DEBOUNCE_MS = 400; // כמו הדף הישן (debounce של קריאות ה-API)

const catalogUrl = (search, page) => {
  const p = buildDressesListParams({ page, limit: CATALOG_PAGE, filterStatus: 'all', search, sortKey: 'name', sortDir: 'asc' });
  p.set('counts', '1');
  return `/api/dresses?${p.toString()}`;
};

// "pair" של שורה 2: אייקון + מספר, רק כשהערך גדול מ-0 (ספירה אפס לא מוצגת)
const Pair = ({ ico, tip, val }) => (val ? <span className="lni" data-tip={tip}><Ic id={ico} /><b>{val}</b></span> : null);

function ModelsList() {
  const router = useRouter();
  const a5 = useA5();
  const [data, setData] = useState(null); // דגמים גולמיים מהשרת (אחרי חיפוש)
  const [notices, setNotices] = useState([]);
  const [loadErr, setLoadErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(''); // החיפוש ששולח לשרת (אחרי debounce)
  const [isHead, setIsHead] = useState(false);
  const [aiIds, setAiIds] = useState(null); // חיפוש חכם: מזהי הדגמים שהתוצאות שייכות להם
  const [aiBusy, setAiBusy] = useState(false);
  const [stats, setStats] = useState(false);
  const [aiHidden, setAiHidden] = useState(false);
  const timer = useRef(null);
  const seq = useRef(0);

  const load = useCallback(async (q) => {
    const my = ++seq.current;
    setBusy(true); setLoadErr('');
    try {
      const first = await fetchSharedJson(catalogUrl(q, 1), { ttl: TTL.LIST });
      let pages = [first];
      const tp = (first && first.totalPages) || 1;
      if (tp > 1) pages = pages.concat(await Promise.all(Array.from({ length: Math.min(tp, 20) - 1 }, (_, i) => fetchSharedJson(catalogUrl(q, i + 2), { ttl: TTL.LIST }))));
      if (my !== seq.current) return;
      setData(mergePages(pages));
      setNotices(Array.isArray(first && first.notices) ? first.notices : []);
    } catch (e) {
      if (my !== seq.current) return;
      setLoadErr('טעינת הדגמים נכשלה');
      setData((d) => d || []);
    } finally {
      if (my === seq.current) setBusy(false);
    }
  }, []);
  useEffect(() => { load(query); }, [query, load]);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => { const roleId = d && d.employee ? d.employee.roleId : null; setIsHead(roleId === 0 || roleId === 2); }).catch(() => {});
    setAiHidden(document.body.classList.contains('hide-ai-features'));
  }, []);

  const onQueryChange = useCallback((q) => { clearTimeout(timer.current); timer.current = setTimeout(() => setQuery(q.trim()), SEARCH_DEBOUNCE_MS); }, []);

  const rows = useMemo(() => {
    const all = (data || []).map(modelRow);
    return aiIds ? all.filter((r) => aiIds.has(r.id)) : all;
  }, [data, aiIds]);
  const filters = useMemo(() => buildFilters(rows), [rows]);

  // חיפוש חכם (smart-search, הקשר 'dresses' = פריטים): התוצאות מצמצמות את הרשימה לדגמים שאליהם הפריטים שייכים
  const ai = useMemo(() => ({
    loading: aiBusy,
    onSubmit: async (prompt) => {
      setAiBusy(true);
      try {
        const call = (extra) => fetch('/api/ai/smart-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, pageContext: 'dresses', ...extra }) });
        const res = await call({});
        const first = await res.json().catch(() => ({}));
        if (!res.ok) { a5.say(first.error || 'שגיאה בחיפוש החכם', 'error'); return; }
        let rowsAll = first.data || [];
        for (let p = 2; p <= Math.min(first.totalPages || 1, 10); p++) {
          const r = await call({ page: p, whereClause: first.whereClause });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) break;
          rowsAll = rowsAll.concat(j.data || []);
        }
        setAiIds(new Set(rowsAll.map((x) => x.dressModelId).filter(Boolean)));
      } catch { a5.say('שגיאת תקשורת', 'error'); } finally { setAiBusy(false); }
    },
    onReset: () => setAiIds(null),
  }), [aiBusy, a5]);

  /* ---- פעולות ---- */
  const afterChange = () => load(query);
  const apiError = async (res, fallback) => { const j = await res.json().catch(() => ({})); return j.error || fallback; };
  const doDelete = async (m) => {
    if (!(await a5.confirm({ title: `מחיקת הדגם ${m.name}?`, sub: 'הדגם יעבור לרשימת המחוקים וניתן יהיה לשחזר אותו משם. לא ניתן למחוק דגם שיש לו פריטים מקושרים.', okLabel: 'מחק דגם', icon: 'trash' }))) return;
    try {
      const res = await fetch(`/api/dresses/${m.id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) { a5.say(`הדגם ${m.name} הועבר למחוקים`, 'ok'); afterChange(); } else a5.say(j.error || 'שגיאה במחיקת הדגם', 'error');
    } catch { a5.say('שגיאה בתקשורת', 'error'); }
  };
  const doRestore = async (m) => {
    if (!(await a5.confirm({ title: `לשחזר את הדגם ${m.name}?`, sub: 'הדגם יחזור לקטלוג ויופיע שוב ברשימות.', okLabel: 'שחזר דגם', icon: 'undo' }))) return;
    try {
      const res = await fetch(`/api/dresses/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isDeleted: false }) });
      if (res.ok) { a5.say(`הדגם ${m.name} שוחזר`, 'ok'); afterChange(); } else a5.say(await apiError(res, 'שגיאה בשחזור הדגם'), 'error');
    } catch { a5.say('שגיאה בתקשורת', 'error'); }
  };
  const doReturn = async (m) => {
    const noItems = m.usable <= 0;
    if (!(await a5.confirm({
      title: `להחזיר את הדגם ${m.name} לפעילות?`,
      sub: noItems ? 'שימו לב: לדגם זה אין פריטים פעילים במלאי. כדי שיהיה פעיל לחלוטין יש להיכנס לכרטיס הדגם ולהוסיף פריטים או להחזירם לשימוש.' : 'תאריך היציאה מהמאגר יימחק והדגם יחזור לקטלוג הפעיל.',
      okLabel: 'החזר לפעילות', icon: 'undo',
    }))) return;
    try {
      const res = await fetch(`/api/dresses/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exitDateFromRepo: null }) });
      if (res.ok) {
        if (noItems) a5.say(`הדגם ${m.name} עדיין לא פעיל`, 'warn', 'אין לו פריטים בשימוש - יש להוסיף פריטים בכרטיס הדגם');
        else a5.say(`הדגם ${m.name} חזר לפעילות`, 'ok');
        afterChange();
      } else a5.say(await apiError(res, 'שגיאה בהחזרת הדגם לפעילות'), 'error');
    } catch { a5.say('שגיאה בתקשורת', 'error'); }
  };
  const open = (m) => router.push(`/dashboard/dresses/${m.id}`);

  /* ---- שורה / פירוט / טבלה ---- */
  const rowMain = (m, c) => (
    <>
      <div className="ic-b sq"><Ic id={rowIcon(m)} /></div>
      <div className="t"><b>{c.hl(m.name)}</b><span className="ln mi">
        {m.code != null ? <span className="lni" data-tip="קוד דגם"><Ic id="hash" /><bdi>{c.hl(String(m.code))}</bdi></span> : null}
        <Pair ico="box" tip="פריטים" val={m.items} />
        <Pair ico="ban" tip="לא בשימוש" val={m.inactive} />
        <Pair ico="flag" tip="רזרבה" val={m.reserve} />
        <Pair ico="scissors" tip="בתיקון" val={m.repair} />
        <Pair ico="refresh" tip="השכרות" val={m.rentals} />
        {m.entry ? <span className="lni" data-tip="נכנס למאגר"><Ic id="cal" />{hDateFull(m.entry)}</span> : null}
      </span></div>
    </>
  );

  const detail = (m) => {
    const r = (k, v) => <div className="hv-r"><small>{k}</small><b>{v}</b></div>;
    const inv = <><bdi>{m.items}</bdi> פריטים · <bdi>{m.inactive}</bdi> לא בשימוש · <bdi>{m.reserve}</bdi> רזרבה · <bdi>{m.repair}</bdi> בתיקון{m.delItems ? <> · <bdi>{m.delItems}</bdi> מחוקים</> : null}</>;
    const sizes = m.sizes.length ? <span>{m.sizes.map((s, i) => <span key={s[0]}>{i ? ' · ' : ''}<bdi dir="ltr">{s[0]} ({s[1]})</bdi></span>)}</span> : 'אין פריטים במלאי';
    return (
      <>
        {m.code != null ? r('קוד דגם', <bdi>{m.code}</bdi>) : null}
        {r('קטגוריה', m.cat || 'ללא קטגוריה')}
        {r('פריטים', inv)}
        {r('מידות במלאי', sizes)}
        {r('השכרות', <><bdi>{m.rentals}</bdi> השכרות עד היום</>)}
        {m.entry ? r('נכנס למאגר', dayTitle(m.entry)) : null}
        {m.exit ? r('יצא מהמאגר', dayTitle(m.exit)) : null}
        {m.upd ? r('עדכון אחרון', relDay(m.upd)) : null}
        {r('סטטוס', statusReason(m))}
        <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
          <button type="button" className="btn primary sm" onClick={() => open(m)}><Ic id="dress" size="sm" />כרטיס דגם</button>
          {m.deleted
            ? (isHead ? <button type="button" className="btn sm" onClick={() => doRestore(m)}><Ic id="undo" size="sm" />שחזור</button> : null)
            : isInactive(m)
              ? <button type="button" className="btn sm" onClick={() => doReturn(m)}><Ic id="undo" size="sm" />החזר לפעילות</button>
              : (isHead ? <button type="button" className="ibtn danger" aria-label="מחיקת דגם" data-tip="מחיקת דגם" onClick={() => doDelete(m)}><Ic id="trash" size="sm" /></button> : null)}
        </b></div>
      </>
    );
  };

  const num = (k, t, get) => ({ k, t, cell: (m) => get(m), tdClass: (m) => `num${get(m) ? '' : ' zero'}` });
  const columns = [
    { k: 'code', t: 'קוד', cell: (m, c) => (m.code != null ? <bdi>{c.hl(String(m.code))}</bdi> : '') },
    { k: 'name', t: 'שם דגם', cell: (m, c) => <span className="tcn"><Ic id={rowIcon(m)} /><b>{c.hl(m.name)}</b></span> },
    { k: 'entry', t: 'תאריך כניסה', cell: (m) => (m.entry ? <><Ic id="cal" />{hDateFull(m.entry)}</> : '') },
    num('items', 'פריטים', (m) => m.items),
    num('inactive', 'לא בשימוש', (m) => m.inactive),
    num('reserve', 'רזרבה', (m) => m.reserve),
    num('repair', 'בתיקון', (m) => m.repair),
    num('rentals', 'השכרות', (m) => m.rentals),
    { k: 'status', t: 'סטטוס', cell: (m) => statusText(m) },
  ];

  const printDoc = (kind) => (list, state) => runPrint({ doc: 'models-list', kind, say: a5.say, data: { rows: list, state, filters, statusText } });
  const onExport = (kind, list, state, info) => {
    runListExport({
      kind, say: a5.say, title: 'קטלוג דגמים', subtitle: info.filterText, base: 'דגמים',
      head: ['קוד', 'שם דגם', 'קטגוריית מחיר', 'תאריך כניסה', 'פריטים', 'לא בשימוש', 'רזרבה', 'בתיקון', 'פריטים מחוקים', 'השכרות', 'מידות', 'סטטוס'],
      rows: list.map((m) => [m.code == null ? '' : m.code, m.name, m.cat, m.entry ? hDateFull(m.entry) : '', m.items, m.inactive, m.reserve, m.repair, m.delItems, m.rentals, sizesPlain(m), statusText(m)]),
    });
  };

  return (
    <>
      <A5ListPage
        title="דגמים" backId="mdlBack" onBack={() => router.push('/admin')}
        tools={<PageVariantToggle screen="models_list" placement="header" systemTip />}
        slotId={SLOT_ID} cardIcon="dress" cardTitle="קטלוג דגמים"
        cardAction={isHead ? <button type="button" className="btn navy" id="btnNew" onClick={() => router.push('/dashboard/dresses/new')}><Ic id="plus" />דגם חדש</button> : null}
      >
        <A5List
          items={rows}
          getId={(m) => m.id}
          texts={{ placeholder: 'חיפוש דגם (שם, קוד, מידה, מס׳ סידורי)…', aiPlaceholder: 'בקשו מה-AI למצוא דגמים (למשל: דגמים שלא הושכרו השנה)…', countLabel: 'דגמים', emptyText: 'לא נמצאו דגמים התואמים את החיפוש' }}
          localSearch={false}
          onQueryChange={onQueryChange}
          filters={filters}
          sorts={SORTS}
          defaultSort={{ k: 'name', dir: 1 }}
          rowClass={rowClass}
          rowMain={rowMain}
          detail={detail}
          columns={columns}
          onOpen={open}
          searchSlot={SLOT_ID}
          ai={aiHidden ? null : ai}
          onStats={aiHidden ? null : () => setStats(true)}
          notices={notices}
          exportSpec={{ what: 'רשימת הדגמים', onExport, onPrint: printDoc('print'), onDownload: printDoc('download') }}
          loading={data === null || (busy && !rows.length)}
          error={loadErr}
          onRetry={() => load(query)}
        />
      </A5ListPage>
      {stats ? <StatisticsModal isOpen onClose={() => setStats(false)} pageContext="dresses" position={null} /> : null}
    </>
  );
}

export default function ModelsListA5() {
  return <A5Page name="gm-mdl"><ModelsList /></A5Page>;
}
