'use client';

// DcItemsTab - לשונית "פריטים ומלאי" של כרטיס הדגם: רשימת הפריטים על ערכת הרשימות החדשה (a5-list) + "הוסף פריט" + חלון עריכת פריט.
// itemsCfg ב-model-card.js: חיפוש, סינון (סטטוס / מיקום / מידה), מיון, שורות / טבלה, פירוט מורחב עם עריכה ופרטים, ייצוא.
// כל עריכה (מיקום, קרטון, תיקון, לא בשימוש, מחיקה/שחזור, הוספה) נכנסת לעגלה ("שינויים בכרטיס") ונשמרת בלחיצה על "שמור".
import { useEffect, useMemo, useRef } from 'react';
// מדריך האתר (lib/aiGuide/areas/people.targets.js): guide="dci" ל-A5List / A5ListPage מוסיף data-guide-id dci.search, dci.filter, dci.sort, dci.ai, dci.stats, dci.view, dci.export-excel, dci.export-print (נבנים בתוך a5-list).
import { A5List, sortItems, findSorter } from '../../a5-list';
import OcIcon from '../../order-card/OcIcon';
import { DcAddItemDialog, DcEditItemDialog, DcItemInfoDialog } from '../dialogs/DcItemDialogs';
import QuickTransferDialog from '../../branches/QuickTransferDialog';
import { activeBranches, branchConfigFromSettings, isMultiBranchEnabled, mainBranch } from '@/lib/branches';
import { Tip } from '../DcParts';
import { exportItemsXlsx, runDressDoc } from '../dcPrint';
import useDcListAi from '../useDcListAi';
import {
  ST_ICON, ST_LABEL, bcFor, hFull, isItemPending, itemAuditSummary, itemSortKey, locIcon, pad2, stOf,
} from '@/lib/dressCardLogic';
import { getIsraelTodayKey } from '@/lib/hebrewDate';

const ICO = { normal: 'dress', repair: 'scissors', unused: 'ban', deleted: 'trash' };
let tempSeq = 0;

export default function DcItemsTab({ dc, ui, active }) {
  const listRef = useRef(null);
  const { cur, saved, prefix, locations } = dc;
  // הוספה / עריכה / מחיקה / שחזור של פריט - feature:dress_items_manage (הנהלה ראשית ומתכנת תמיד). בלי ההרשאה: צפייה בלבד, והשרת חוסם בכל מקרה
  const canManage = !!dc.canManageItems;
  const lastLoc = useRef('');
  // ריבוי סניפים (multi_branch_enabled, ברירת מחדל כבוי): עמודת / שדה סניף לפריט + חלונית "העברה מהירה". כבוי = שום שינוי בכרטיס.
  const multi = isMultiBranchEnabled(dc.settings);
  const branchCfg = useMemo(() => branchConfigFromSettings(dc.settings), [dc.settings]);
  const branchNames = useMemo(() => (multi ? activeBranches(branchCfg).map((b) => b.name) : []), [multi, branchCfg]);
  const aiS = useDcListAi({ dc, ui, which: 'items' });
  const intent = dc.listIntent;
  const intentKey = intent ? intent.n : 0;

  const sizes = useMemo(() => [...new Set(cur.items.map((i) => i.size).filter((s) => s !== ''))].sort((a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b), 'he')), [cur.items]);
  const locOpts = useMemo(() => [...new Set([...locations, ...cur.items.map((i) => i.loc).filter(Boolean)])], [locations, cur.items]);

  // "צ'יפ" ברייל -> אותו מסנן כבחירה התחלתית של הרשימה (הרשימה נבנית מחדש לפי intentKey - כמו goFilter בעיצוב: איפוס חיפוש/סינון ואז הסינון)
  const def = useMemo(() => {
    const f = intent && intent.type === 'filter' ? intent.filter : null;
    return { status: f === 'avail' ? ['normal'] : f === 'repair' ? ['repair'] : f === 'unused' ? ['unused'] : [], loc: f === 'reserve' ? ['רזרבה'] : [] };
  }, [intent]);

  const filters = useMemo(() => [
    { key: 'status', label: 'סטטוס', icon: 'sliders', def: def.status, options: [
      { k: 'normal', l: 'תקין', i: 'check', test: (it) => stOf(it) === 'normal' },
      { k: 'att', l: 'דורש טיפול', i: 'alert', test: (it) => !it.del && (it.repair || it.unused) },
      { k: 'repair', l: 'בתיקון', i: 'scissors', test: (it) => stOf(it) === 'repair' },
      { k: 'unused', l: 'לא בשימוש', i: 'ban', test: (it) => stOf(it) === 'unused' },
      { k: 'deleted', l: 'מחוק', i: 'trash', test: (it) => it.del }] },
    { key: 'loc', label: 'מיקום', icon: 'pin', def: def.loc, options: locOpts.map((v) => ({ k: v, l: v, i: locIcon(v), test: (it) => it.loc === v })) },
    ...(multi && branchNames.length ? [{ key: 'branch', label: 'סניף', icon: 'pin', def: [], options: [...new Set([...branchNames, ...cur.items.map((i) => i.branch).filter(Boolean)])].map((v) => ({ k: v, l: v, i: 'pin', test: (it) => it.branch === v })) }] : []),
    { key: 'size', label: 'מידה', icon: 'dress', def: [], options: sizes.map((s) => ({ k: s, l: `מידה ${s}`, i: 'tag', test: (it) => it.size === s })) },
  ], [def, locOpts, sizes, multi, branchNames, cur.items]);

  const sorts = useMemo(() => [
    { k: 'size', l: 'מידה', i: 'dress', get: itemSortKey },
    { k: 'serial', l: 'מס׳ סידורי', i: 'hash', get: (it) => Number(it.serial) || 0 },
    { k: 'bc', l: 'ברקוד', i: 'scan', get: (it) => bcFor(it, prefix) },
    { k: 'loc', l: 'מיקום', i: 'pin', get: (it) => it.loc },
    { k: 'carton', l: 'מס׳ קרטון', i: 'hash', get: (it) => Number(it.carton) || 0 },
    { k: 'status', l: 'סטטוס', i: 'sliders', get: (it) => ['normal', 'repair', 'unused', 'deleted'].indexOf(stOf(it)) },
  ], [prefix]);

  // ---------- פעולות ----------
  const openInfo = async (id) => {
    const it = dc.cur.items.find((x) => String(x.id) === String(id));
    if (!it) return;
    dc.ensureRentals();
    await ui.openDialog(DcItemInfoDialog, { item: it, prefix, rentalsStore: dc.rentalsStore }, { layer: 2 });
  };
  const editItem = async (it) => {
    if (!canManage) { openInfo(it.id); return; }
    const r = await ui.openDialog(DcEditItemDialog, { item: it, prefix, locations: locOpts, branches: multi ? branchNames : null, onInfo: openInfo });
    if (!r) return;
    if (r.action === 'delete') dc.deleteItem(it.id);
    else if (r.action === 'restore') dc.patchItem(it.id, { del: false });
    else dc.patchItem(it.id, { loc: r.loc, carton: r.carton, ...(multi ? { branch: r.branch || '' } : {}), repair: r.st === 'repair', unused: r.st === 'unused', why: r.why });
  };
  const addItem = async () => {
    if (!canManage) return;
    const r = await ui.openDialog(DcAddItemDialog, { items: cur.items, prefix, locations: locOpts, defaultLoc: lastLoc.current || locOpts[0] });
    if (!r) return;
    lastLoc.current = r.loc;
    dc.addItemLocal({ id: -(++tempSeq), size: r.size, serial: r.serial, bc: '', loc: r.loc, carton: '', repair: false, unused: false, why: '', del: false, ent: getIsraelTodayKey(), since: null });
  };

  // "העברה מהירה": חלונית רצף ברקודים - שיוך לסניף / למחסן / ממחסן / לרזרבה / קרטון. כותבת ישר לשרת (לא דרך עגלת השינויים) ומרעננת את הרשימה בסגירה
  // ההעברה המהירה: הרשאת המלאי (page:dresses_catalog) - אותה הרשאה שפותחת את הכרטיס הזה, והשרת בודק שוב (requireItemTransferAccess); לא תלויה בהרשאת ניהול הפריט
  const quickTransfer = () => ui.openDialog(QuickTransferDialog, { branches: branchNames, defaultBranch: (mainBranch(branchCfg) || {}).name || '', onApplied: () => dc.refreshFromServer() }, { dismissable: true });

  // ---------- סריקה: איתור פריט, פתיחת הפירוט וגלילה ----------
  const locateId = intent && intent.type === 'locate' ? intent.id : null;
  useEffect(() => {
    if (!active || locateId == null) return undefined;
    let tries = 0; let done = false;
    const sorted = sortItems(cur.items, findSorter(sorts, 'size'), 1);
    const idx = sorted.findIndex((x) => String(x.id) === String(locateId));
    const needPage = idx < 0 ? 1 : Math.floor(idx / 50) + 1;
    const step = () => {
      if (done) return;
      const row = document.querySelector(`#p-items .hrow[data-id="${String(locateId).replace(/"/g, '')}"]`);
      if (!row) {
        if (tries === 2 && listRef.current && needPage > 1) listRef.current.setPage(needPage);
        if (++tries < 20) setTimeout(step, 60);
        return;
      }
      done = true;
      if (!row.classList.contains('open')) { const b = row.querySelector('[data-expand]'); if (b) b.click(); }
      setTimeout(() => row.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
    };
    const t = setTimeout(step, 30);
    return () => { done = true; clearTimeout(t); };
  }, [intentKey, active]);

  const detail = (it) => {
    const st = stOf(it); const bc = bcFor(it, prefix);
    const r = (k, v) => <div className="hv-r" key={k}><small>{k}</small><b>{v}</b></div>;
    const { added, last } = itemAuditSummary(dc.historyRows, bc);
    return (
      <>
        {r('ברקוד', <bdi>{bc}</bdi>)}{r('מידה', it.size)}{r('סטטוס', ST_LABEL[st])}{it.unused ? r('סיבה', it.why || '—') : null}
        {r('מיקום', it.loc || '—')}{multi ? r('סניף', it.branch || 'לא שויך') : null}{r('מס׳ קרטון', it.carton || '—')}
        {r('פרטי הוספה', `${it.ent ? hFull(it.ent) : '—'}${added ? ` · ${added.who}` : ''}`)}
        {last && last !== added ? r('עודכן', `${hFull(last.ts.slice(0, 10))} · ${last.who}`) : null}
        {it.del
          ? (canManage ? <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns"><button type="button" className="btn sm" onClick={() => dc.patchItem(it.id, { del: false })}><OcIcon name="undo" size="sm" />שחזור</button></b></div> : null)
          : (
            <div className="hv-r hv-act"><small>{canManage ? 'פרטים ועריכה' : 'פרטים'}</small><b className="hv-btns">
              <button type="button" className="ibtn" aria-label="פרטים והיסטוריית השכרות" data-tip="פרטים והיסטוריית השכרות" onClick={() => openInfo(it.id)}><OcIcon name="info" size="sm" /></button>
              {canManage ? <button type="button" className="ibtn" aria-label="עריכת פריט" data-tip="עריכת פריט" onClick={() => editItem(it)}><OcIcon name="pencil" size="sm" /></button> : null}
            </b></div>
          )}
      </>
    );
  };

  const columns = [
    { k: 'size', t: 'מידה', cell: (it, c) => <b>{c.hl(it.size)}</b> },
    { k: 'serial', t: 'סידורי', cell: (it) => <bdi>{pad2(it.serial)}</bdi> },
    { k: 'bc', t: 'ברקוד', cell: (it, c) => <bdi>{c.hl(bcFor(it, prefix))}</bdi> },
    { k: 'loc', t: 'מיקום', cell: (it, c) => <><OcIcon name={locIcon(it.loc)} />{c.hl(it.loc)}</> },
    ...(multi ? [{ k: 'branch', t: 'סניף', cell: (it) => (it.branch || '—') }] : []),
    { k: 'carton', t: 'קרטון', cell: (it) => (it.carton || '—') },
    { k: 'status', t: 'סטטוס', cell: (it) => <><OcIcon name={ST_ICON[stOf(it)]} />{ST_LABEL[stOf(it)]}{isItemPending(saved, it) ? ' · ממתין' : ''}</> },
  ];

  return (
    <div className="card hist items-card" data-guide-id="dc.items-card">
      <div className="card-h">
        <div className="ico gold"><OcIcon name="box" size="lg" /></div><h2>פריטים ומלאי</h2>
        {multi && branchNames.length
          ? <button type="button" className="btn" id="dcQuickBtn" data-guide-id="dc.quick-transfer" aria-haspopup="dialog" onClick={quickTransfer}><OcIcon name="scan" />העברה מהירה</button>
          : null}
        {canManage
          ? <button type="button" className="btn navy" id="dcAddBtn" data-guide-id="dc.item-add" aria-haspopup="dialog" onClick={addItem}><OcIcon name="plus" />הוסף פריט</button>
          : <span id="dcItemsRo"><Tip text="צפייה בלבד: הוספה, עריכה ומחיקה של פריטים דורשות הרשאת ניהול פריטי דגם" /></span>}
      </div>
      <A5List
        guide="dci"
        key={intentKey}
        ref={listRef}
        items={aiS.narrow(cur.items, (it, f) => f.ids.has(String(it.id)) || f.bcs.has(bcFor(it, prefix)))}
        getId={(it) => it.id}
        texts={{ placeholder: 'חיפוש פריט…', aiPlaceholder: 'בקשו מה-AI למצוא פריטים בדגם (למשל: פריטים שנמצאים ברזרבה)…', countLabel: 'פריטים', emptyText: aiS.emptyText || 'אין תוצאות' }}
        ai={aiS.ai}
        onStats={aiS.onStats}
        hay={(it) => [it.size, pad2(it.serial), bcFor(it, prefix), it.loc, it.branch, it.carton, ST_LABEL[stOf(it)], it.why].join(' ')}
        filters={filters}
        sorts={sorts}
        defaultSort={{ k: 'size', dir: 1 }}
        rowClass={(it) => `${dc.hit === it.id ? 'enter' : ''}${isItemPending(saved, it) ? ' pending' : ''}${it.del ? ' off gone' : stOf(it) === 'unused' ? ' off' : ''}`}
        rowMain={(it, c) => {
          const st = stOf(it); const bc = bcFor(it, prefix); const pend = isItemPending(saved, it);
          return (
            <>
              <div className="ic-b"><OcIcon name={ICO[st]} /><span className="rlbl">פריט</span></div>
              <div className="t">
                <b><span data-tip="מידה">{c.hl(it.size)}</span> · <span data-tip="מספר סידורי">{c.hl(pad2(it.serial))}</span></b>
                <span className="ln mi">
                  <span className="lni" data-tip="ברקוד"><OcIcon name="scan" /><bdi>{c.hl(bc)}</bdi></span>
                  <span className="lni"><OcIcon name={locIcon(it.loc)} />{c.hl(it.loc)}</span>
                  {multi && it.branch ? <span className="lni" data-tip="סניף"><OcIcon name="pin" />{c.hl(it.branch)}</span> : null}
                  {it.carton ? <span className="lni" data-tip="מספר קרטון"><OcIcon name="hash" />{c.hl(it.carton)}</span> : null}
                  <span className={`lni${st === 'normal' ? '' : ' warn'}`}><OcIcon name={ST_ICON[st]} />{ST_LABEL[st]}{st === 'unused' && it.why ? <> · {c.hl(it.why)}</> : null}</span>
                  {pend ? <span className="lni warn"><OcIcon name="pencil" />ממתין לשמירה</span> : null}
                </span>
              </div>
            </>
          );
        }}
        detail={detail}
        columns={columns}
        onOpen={canManage ? editItem : undefined}
        exportSpec={{
          what: 'רשימת הפריטים',
          onExport: (kind, list, state) => (kind === 'excel' ? exportItemsXlsx({ dc, ui, list }) : runDressDoc({ dc, ui, kind: kind === 'print' ? 'print' : 'download', which: 'items', list, state, filters })),
        }}
      />
      {aiS.modal}
    </div>
  );
}
