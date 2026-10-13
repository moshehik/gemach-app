'use client';

// פאנל התפוסה / הפריט של החיפוש (docs/search-capacity-embed.md): רכיב אחד משותף לחיפוש הראשי (HomeA5) ולחיפוש המהיר שבתפריט (MenuSearchPanel).
// קלט: מה שהוקלד. parseSearchIntent (אותו קוד כמו בשרת) מחליט אם יש בכלל פאנל - רק אז נשלחת בקשה ל-GET /api/search-panel, בלי לחסום הקלדה
// (בקשה בלתי תלויה, מתבטלת כשההקלדה משתנה, שלד טעינה בזמן ההמתנה). הרשאות מוכרעות בשרת: מי שאין לה - לא מקבלת פאנל ולא רואה כלום.
//
// עיצוב (13.10.2026, החלטת הבעלים): בלי תגיות (chips) בפאנל. ריבועי stat של הפלטה (.capstats / .capst) בראש; כל מה שמתחתיהם הוא **שורות תוצאה רגילות**
// באותה רשימה ובאותו מקטע "תוצאות (N)" של החיפוש (HomeResults.js, דרך prop lead): אותו רכיב שורה (home/ResultRow.js: .li.rlink.lrow + .ic-b/.rlbl + .t + .go),
// אותם אייקונים/תוויות (lib/searchPanelRows.js), כותרות קבוצה (.rgrp-h) ומצב ריק (.empty). "איפה אני?" = שורת תוצאה ראשונה שנפתחת במקום
// (הרחבה .hres > .hrow.open > .hdet > .hdet-in > .hv-r כמו הרחבת שורת לו״ז, schedule/StageRow.js RowDetails). בחיפוש המהיר (compact) אותו עיקרון בשורות
// התפריט (.sn-link + .sn-li + .sn-k, כותרות .sn-st) - הרשימה מוזנת ל-MenuSearchPanel דרך אותו hook. CSS מקומי רק למה שחסר: searchPanel.css.

import './searchPanel.css';
import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { parseSearchIntent } from '@/lib/searchIntent';
import { Ic as MenuIc, SnLi } from '../menu/menuParts';
import { Ic } from '../home/homeIcon';
import { ResultRow, Stx, ResultGroupHead, ResultEmpty } from '../home/ResultRow';
import { GROUP_ROW, rowStatuses, whereLocation, whereOrders } from '@/lib/searchPanelRows';

const CACHE_MS = 10 * 1000; // אותה בקשה תוך 10 שניות (למשל פתיחה/סגירה של התפריט) לא יוצאת שוב
const memo = new Map(); // url -> { at, body }

/** GET json עם ביטול, שלד טעינה ומטמון קצר. url ריק = לא עושים כלום. */
function useApi(url) {
  const [res, setRes] = useState({ url: '', state: 'idle', body: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return undefined;
    const hit = memo.get(url);
    if (hit && Date.now() - hit.at < CACHE_MS && tick === 0) {
      setRes({ url, state: hit.body.panel ? 'ok' : 'empty', body: hit.body });
      return undefined;
    }
    const ctl = new AbortController();
    setRes((r) => ({ url, state: 'loading', body: r.url === url ? r.body : null }));
    fetch(url, { signal: ctl.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((body) => {
        memo.set(url, { at: Date.now(), body });
        if (memo.size > 30) memo.delete(memo.keys().next().value);
        setRes({ url, state: body.panel ? 'ok' : 'empty', body });
      })
      .catch((e) => { if (e && e.name === 'AbortError') return; setRes({ url, state: 'error', body: null }); });
    return () => ctl.abort();
  }, [url, tick]);
  if (!url) return { state: 'idle', panel: null, retry: () => {} };
  const stale = res.url !== url;
  return { state: stale ? 'loading' : res.state, panel: stale || !res.body ? null : res.body.panel || null, retry: () => { memo.delete(url); setTick((t) => t + 1); } };
}

/**
 * @param {string} query   הטקסט (לא מדובנס - ההשהיה בצד הקורא)
 * @param {{view?: 'panel'|'where', enabled?: boolean}} [opts]  view=where: "איפה אני?" (נטען רק כשפותחים אותו)
 * @returns {{state: 'idle'|'loading'|'ok'|'empty'|'error', panel: object|null, pickModel: Function, pickSize: Function, sel: object, intent: object, retry: Function}}
 */
export function useSearchPanel(query, { view = 'panel', enabled = true, sel: external = null } = {}) {
  const intent = useMemo(() => parseSearchIntent(query), [query]);
  const sig = intent.signature;
  const [sel, setSel] = useState({ sig: '', model: null, size: null });
  const own = sel.sig === sig ? sel : { sig, model: null, size: null }; // בחירה ידנית תקפה רק לאותה כוונה
  const cur = external || own;
  const url = useMemo(() => {
    if (intent.kind === 'none' || !enabled) return '';
    const p = new URLSearchParams({ q: String(query || '').trim() });
    if (view === 'where') p.set('view', 'where');
    if (cur.model != null) p.set('model', String(cur.model));
    if (cur.size) p.set('size', cur.size);
    return '/api/search-panel?' + p.toString();
  }, [intent.kind, enabled, view, query, cur.model, cur.size]);
  const api = useApi(url);
  return {
    ...api,
    sel: cur,
    intent,
    pickModel: (prefix) => setSel({ sig, model: prefix, size: null }),
    pickSize: (size) => setSel({ sig, model: cur.model, size }),
  };
}

function rowLine(r) {
  const parts = [];
  parts.push(<>הזמנה <bdi>#{r.orderId}</bdi></>);
  if (r.hebDate) parts.push(r.hebDate);
  if (r.state === 'returned' && r.returnedHeb) parts.push(<>הוחזר {r.returnedHeb}</>);
  if (r.barcode) parts.push(<>ברקוד <bdi dir="ltr">{r.barcode}</bdi></>);
  if (r.size) parts.push(<>מידה <bdi>{r.size}</bdi></>);
  if (r.phone) parts.push(<bdi dir="ltr">{r.phone}</bdi>);
  return parts.map((p, i) => <Fragment key={i}>{i ? ' · ' : null}{p}</Fragment>);
}

/**
 * שורת תוצאה אחת של הפאנל. רגילה: ResultRow של דף הבית (כותרת b.rt + סטטוס Stx, שורה קטנה .ln). compact (תפריט): .sn-link + .sn-li + .sn-k.
 * @param {{compact?: boolean, url?: string, onOpen?: Function, onAct?: Function, open?: boolean, icon: string, kind: string, title: any, line?: any, stx?: object[], data?: object}} p
 */
function PRow({ compact, url = '', onOpen, onAct, open, icon, kind, title, line, stx = [], data }) {
  if (!compact) {
    return (
      <ResultRow icon={icon} kind={kind} url={url} onAct={onAct} open={open} data={data}>
        <b className="rt">{title}{stx.map((s) => <Stx key={s.label} s={s} />)}</b>
        {line ? <span className="ln">{line}</span> : null}
      </ResultRow>
    );
  }
  const inner = (
    <>
      <SnLi n={icon} />
      <span className="sp-col">
        <span className="sp-rt"><b>{title}</b>{stx.map((s) => <span key={s.label} className="sn-k sp-st">{s.label}</span>)}</span>
        {line ? <span className="sp-ln">{line}</span> : null}
      </span>
      {onAct ? <MenuIc n="chev" cls="go" /> : null}
    </>
  );
  if (onAct) return <button type="button" className={`sn-link sp-link${open ? ' sp-open' : ''}`} aria-expanded={!!open} onClick={onAct} {...data}>{inner}</button>;
  if (url) return <a className="sn-link sp-link" href={url} onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(url); } }} {...data}>{inner}</a>;
  return <div className="sn-link sp-link" {...data}>{inner}</div>;
}

function Tile({ cls, label, children, sub }) {
  return (
    <div className={`capst ${cls}`}>
      <span>{label}</span>
      {children}
      {sub ? <small className="sp-sub">{sub}</small> : null}
    </div>
  );
}

const STATUS_TEXT = { returned: 'הוחזר', repair: 'בתיקון', notInUse: 'לא בשימוש', free: 'פנוי' };

function ModelTiles({ p }) {
  const t = p.tiles;
  return (
    <div className="capstats sp-tiles" data-guide-id="srch.panel-tiles" role="group" aria-label="סיכום תפוסה">
      <Tile cls="cs-stock" label="במלאי"><b>{t.stock}</b></Tile>
      <Tile cls="cs-busy" label={p.date.isToday ? 'בתפוסה היום' : 'בתפוסה בתאריך'}><b>{t.busy}</b></Tile>
      <Tile cls="cs-res" label="רזרבה"><b>{t.reserve}</b></Tile>
    </div>
  );
}

function ItemTiles({ p }) {
  const t = p.tiles;
  const st = t.status;
  let main;
  let sub = '';
  if (st.kind === 'out') {
    main = <b className="sp-txt" data-sp-status="out">{st.name || 'מושכר'}</b>;
    sub = st.phone ? <bdi dir="ltr">{st.phone}</bdi> : (st.name ? '' : 'אצל משפחה');
    if (st.openCount > 1) sub = <>{sub} · {st.openCount} השכרות פתוחות</>;
  } else {
    main = <b className="sp-txt" data-sp-status={st.kind}>{STATUS_TEXT[st.kind] || 'פנוי'}</b>;
    if (st.kind === 'returned' && st.atHeb) sub = st.atHeb;
    else if (st.kind === 'free' && t.rentCount === 0) sub = 'טרם הושכר';
  }
  return (
    <div className="capstats sp-tiles" data-guide-id="srch.panel-tiles" role="group" aria-label="סיכום הפריט">
      <Tile cls="cs-stock" label="סטטוס" sub={sub}>{main}</Tile>
      <Tile cls="cs-res" label="פעמים שהושכר"><b>{t.rentCount}</b></Tile>
      <Tile cls="cs-busy" label="הזמנות שחייבות אותו"><b>{t.required}</b></Tile>
    </div>
  );
}

// הרחבת "איפה אני?": אותו עיצוב כמו הרחבת שורת לו״ז (StageRow.js RowDetails): .hdet > .hdet-in > .hv-r (small = תווית, b = ערך), שבב "מיקום: ..." עם אייקון סיכה,
// כפתור "מעבר להזמנה" (.btn.ghost.sm) לכל הזמנה, ובתחתית - מעבר להזמנות הרלוונטיות כשיש כמה. מושכרים קודם (מיון השרת), אחר כך לפי מיקום.
function DetailRow({ label, children }) {
  return (
    <div className="hv-r">
      <small>{label}</small>
      <b>{children}</b>
    </div>
  );
}

function OrderBtn({ id, text, compact, onOpen }) {
  const url = '/orders/' + id;
  return compact
    ? <a className="btn ghost sm sp-ordbtn" href={url} onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(url); } }}>{text}</a>
    : <Link className="btn ghost sm sp-ordbtn" href={url}>{text}</Link>;
}

function WhereItem({ r, model, compact, onOpen }) {
  const flags = [r.late ? 'באיחור' : '', r.alter ? 'בהתאמה' : '', r.orphan ? 'לא במלאי' : ''].filter(Boolean);
  const out = r.state === 'out';
  return (
    <>
      <DetailRow label="שמלה">
        <span className="sp-itm" data-sp-where={r.state}>
          <span>
            דגם <bdi dir="ltr">{model.prefix}</bdi>{r.size ? <> · מידה <bdi>{r.size}</bdi></> : null} · <bdi dir="ltr">{r.barcode}</bdi>
            {flags.length ? ' · ' + flags.join(' · ') : ''}
          </span>
          <span className="chip gray"><Ic id="pin" />מיקום: {whereLocation(r)}</span>
        </span>
      </DetailRow>
      {out ? (
        <DetailRow label="אצל">
          <span className="sp-itm">
            <span>
              {r.name || 'משפחה'}
              {r.phone ? <> · <bdi dir="ltr">{r.phone}</bdi></> : null}
              {r.orderId ? <> · הזמנה <bdi>#{r.orderId}</bdi></> : null}
              {r.hebDate ? ' · ' + r.hebDate : ''}
            </span>
            {r.orderId ? <OrderBtn id={r.orderId} text="מעבר להזמנה" compact={compact} onOpen={onOpen} /> : null}
          </span>
        </DetailRow>
      ) : (r.returnedHeb ? <DetailRow label="הוחזר">{r.returnedHeb}</DetailRow> : null)}
    </>
  );
}

function WhereExpand({ w, wh, compact, onOpen, more, setMore }) {
  const lim = compact ? 6 : 12;
  let body;
  if (wh.state === 'error') body = <DetailRow label="מיקום">לא ניתן לטעון את המיקומים. <button type="button" className="sp-lnk" onClick={wh.retry}>נסו שוב</button></DetailRow>;
  else if (!w) body = <div className="sp-skel sp-skel-line" aria-busy="true" />;
  else if (w.rows.length === 0) body = <DetailRow label="מיקום">לא נמצאו ברקודים</DetailRow>;
  else {
    const rows = more ? w.rows : w.rows.slice(0, lim);
    const orders = whereOrders(w.rows);
    body = (
      <>
        {rows.map((r) => <WhereItem key={r.key} r={r} model={w.model} compact={compact} onOpen={onOpen} />)}
        {w.rows.length > lim ? <DetailRow label=" "><button type="button" className="sp-lnk" aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'הצג פחות' : `עוד ${w.rows.length - lim}`}</button></DetailRow> : null}
        {w.truncated ? <DetailRow label=" ">מוצגים {w.rows.length} מתוך {w.total}</DetailRow> : null}
        {orders.length > 1 ? (
          <DetailRow label="הזמנות">
            <span className="sp-itm">
              <span>מעבר להזמנות הרלוונטיות:</span>
              {orders.map((id) => <OrderBtn key={id} id={id} text={`#${id}`} compact={compact} onOpen={onOpen} />)}
            </span>
          </DetailRow>
        ) : null}
      </>
    );
  }
  return (
    <div className="hres sp-xp" data-sp-sec="where" aria-label="מיקום כל ברקוד">
      <div className="hrow open">
        <div className="hdet"><div className="hdet-in">{body}</div></div>
      </div>
    </div>
  );
}

function Skeleton({ compact }) {
  return (
    <section className={`sp${compact ? ' sp-compact' : ''}`} aria-busy="true" aria-label="טוען תפוסה" data-sp-state="loading">
      <div className="sp-head"><span className="sp-skel sp-skel-line" /></div>
      <div className="capstats sp-tiles">
        {[0, 1, 2].map((i) => <div key={i} className="capst"><span className="sp-skel sp-skel-line sp-skel-s" /><span className="sp-skel sp-skel-num" /></div>)}
      </div>
    </section>
  );
}

const NONE = Object.freeze({ state: 'none', head: null, lead: Object.freeze([]) });

/**
 * המודל של הפאנל: head = כותרת + ריבועים (מעל כרטיס התוצאות), lead = שורות תוצאה שנכנסות לרשימת התוצאות (HomeResults prop lead / רשימת התפריט).
 * @param {string} query   @param {{compact?: boolean, onOpen?: (url: string) => void, enabled?: boolean}} [opts]
 *   compact = החיפוש המהיר שבתפריט (שורות sn-link, פחות שורות); onOpen = ניווט במעטפת (סוגר את הפאנל)
 * @returns {{state: string, head: any, lead: Array<{key: string, node: any, count: number, orderId?: any, barcode?: string}>}}
 */
export function useSearchPanelModel(query, { compact = false, onOpen, enabled = true } = {}) {
  const s = useSearchPanel(query, { enabled });
  const [whereOpen, setWhereOpen] = useState(false);
  const [more, setMore] = useState({}); // קבוצה / "where" -> הורחב
  const sigNow = s.intent.signature + '|' + (s.sel.model ?? '') + '|' + (s.sel.size ?? '');
  useEffect(() => { setWhereOpen(false); setMore({}); }, [sigNow]);
  const wh = useSearchPanel(query, { view: 'where', enabled: enabled && whereOpen, sel: s.sel });
  return buildPanelModel({ s, wh, whereOpen, setWhereOpen, more, setMore, compact, onOpen });
}

/** הבנייה עצמה (בלי hooks) - נבדקת ישירות בבדיקות הרינדור (scripts/test_search_panel_rows.mjs) עם נתוני פאנל סינתטיים. */
export function buildPanelModel({ s, wh, whereOpen, setWhereOpen, more, setMore, compact = false, onOpen }) {
  const cls = `sp${compact ? ' sp-compact' : ''}`;
  if (s.state === 'idle' || s.state === 'empty') return NONE;
  if (s.state === 'loading' && !s.panel) return { state: 'loading', head: <Skeleton compact={compact} />, lead: [] };
  if (s.state === 'error') {
    return {
      state: 'error',
      head: (
        <section className={cls} role="status" data-sp-state="error">
          <div className="sp-empty">לא ניתן לטעון את נתוני התפוסה. <button type="button" className="sp-lnk" onClick={s.retry}>נסו שוב</button></div>
        </section>
      ),
      lead: [],
    };
  }
  const p = s.panel;
  if (!p) return NONE;
  const lead = [];

  if (p.mode === 'choose') {
    for (const c of p.candidates) {
      lead.push({
        key: 'choose-' + c.prefix,
        count: 1,
        node: <PRow compact={compact} icon={GROUP_ROW.choose.icon} kind={GROUP_ROW.choose.kind} onAct={() => s.pickModel(c.prefix)} title={<>{c.name ? c.name + ' ' : 'דגם '}<bdi dir="ltr">{c.prefix}</bdi></>} line="לחצו לבחירת הדגם" data={{ 'data-sp-act': 'choose' }} />,
      });
    }
    return {
      state: 'choose',
      head: (
        <section className={cls} data-sp-state="choose" aria-label="בחירת דגם">
          <div className="sp-head"><b>נמצאו {p.candidatesTotal} דגמים תואמים - בחרו דגם</b></div>
        </section>
      ),
      lead,
    };
  }

  const isItem = p.mode === 'item';
  const sizeShown = isItem ? p.item.size : (p.sizes && p.sizes.length ? p.sizes.join(', ') : '');
  const T = isItem
    ? { out: 'המקומות בהם הוא מושכר', returned: 'המקומות בהם הוחזר', pending: 'הזמנות שצריכות את הדגם והמידה שלו', outEmpty: 'הפריט לא מושכר כרגע', retEmpty: 'הפריט עוד לא הוחזר מאף הזמנה', pendEmpty: 'אין הזמנות עתידיות שמחכות לדגם ולמידה' }
    : { out: 'בחוץ (מושכרים)', returned: 'הוחזרו (האחרונים)', pending: 'הזמנות שצריכות את הדגם והמידה ועדיין לא נלקחו', outEmpty: 'אין פריטים בחוץ', retEmpty: 'אין פריטים שהוחזרו', pendEmpty: 'אין הזמנות עתידיות שממתינות' };
  const whereLabel = isItem ? 'איפה המידה שלי?' : 'איפה אני?';
  const modelName = p.model.name || p.model.prefix;
  const whereSub = isItem ? `המיקום של כל הברקודים בדגם ${modelName} מידה ${p.item.size}` : `המיקום של כל ברקוד בדגם ${modelName}${sizeShown ? ' מידה ' + sizeShown : ''}`;

  // 1) "איפה אני?" - שורת התוצאה הראשונה; לחיצה פותחת מתחתיה את הרחבת המיקומים (ולחיצה חוזרת סוגרת)
  lead.push({
    key: 'where',
    count: 1,
    node: <PRow compact={compact} icon={GROUP_ROW.where.icon} kind={GROUP_ROW.where.kind} onAct={() => setWhereOpen((v) => !v)} open={whereOpen} title={whereLabel} line={whereSub} data={{ 'data-guide-id': 'srch.panel-where', 'data-sp-act': 'where' }} />,
  });
  if (whereOpen) {
    lead.push({ key: 'where-x', count: 0, node: <WhereExpand w={wh.panel} wh={wh} compact={compact} onOpen={onOpen} more={!!more.where} setMore={(v) => setMore((m) => ({ ...m, where: v }))} /> });
  }

  // 2) בחוץ / הוחזרו / ממתינות - כותרות קבוצה ושורות תוצאה באותה רשימה
  const lim = compact ? 4 : 8;
  const group = (id, title, sec, emptyText) => {
    lead.push({
      key: 'h-' + id,
      count: 0,
      node: compact ? <div className="sn-st sp-sh" data-sp-sec={id}>{title} <bdi className="faint">({sec.total})</bdi></div> : <ResultGroupHead title={title} count={sec.total} />,
    });
    if (sec.total === 0) {
      lead.push({ key: 'e-' + id, count: 0, node: compact ? <div className="sn-empty">{emptyText}</div> : <ResultEmpty>{emptyText}</ResultEmpty> });
      return;
    }
    const rows = more[id] ? sec.rows : sec.rows.slice(0, lim);
    const gr = GROUP_ROW[id];
    for (const r of rows) {
      lead.push({
        key: id + '-' + r.key,
        count: 1,
        orderId: r.orderId,
        barcode: id === 'pending' ? '' : r.barcode,
        node: <PRow compact={compact} icon={gr.icon} kind={gr.kind} url={'/orders/' + r.orderId} onOpen={onOpen} title={r.name || `הזמנה #${r.orderId}`} line={rowLine(r)} stx={rowStatuses(r, id)} data={{ 'data-sp-row': r.state }} />,
      });
    }
    if (sec.rows.length > lim) {
      lead.push({ key: 'm-' + id, count: 0, node: <button type="button" className="sp-more" aria-expanded={!!more[id]} onClick={() => setMore((m) => ({ ...m, [id]: !m[id] }))}>{more[id] ? 'הצג פחות' : `עוד ${sec.rows.length - lim}`}</button> });
    }
    if (more[id] && sec.total > sec.rows.length) {
      lead.push({ key: 'n-' + id, count: 0, node: <div className="sp-empty">מוצגות {sec.rows.length} מתוך {sec.total}</div> });
    }
  };
  group('out', T.out, p.sections.out, T.outEmpty);
  group('returned', T.returned, p.sections.returned, T.retEmpty);
  group('pending', T.pending, p.sections.pending, T.pendEmpty);

  // 3) הכותרת: טקסט פשוט (בלי תגיות). הפעולות השימושיות הן קישורי / כפתורי טקסט שקטים (.sp-lnk), לא שבבים.
  const metaParts = [];
  if (!isItem) {
    metaParts.push(p.date.isToday ? 'היום' : p.date.label);
    if (p.tiles.free != null) metaParts.push(<>פנויים <bdi>{p.tiles.free}</bdi></>);
  } else {
    if (p.itemMissing) metaParts.push('הברקוד לא נמצא במלאי');
    if (p.item.serial != null) metaParts.push(<>מס׳ סידורי <bdi>{p.item.serial}</bdi></>);
    if (p.item.location) metaParts.push(<>מיקום <bdi>{p.item.location}</bdi></>);
    for (const f of p.flags || []) metaParts.push(f);
  }
  const showSizes = !isItem && p.perSize && p.perSize.length > 1;
  const head = (
    <section className={`${cls}${s.state === 'loading' ? ' sp-refresh' : ''}`} data-guide-id="srch.panel" data-sp-state="ok" data-sp-mode={p.mode} aria-label={isItem ? 'פרטי הפריט' : 'תפוסת הדגם'}>
      <div className="sp-head">
        <b>
          {isItem ? <>ברקוד <bdi dir="ltr">{p.item.barcode}</bdi> · </> : <>דגם <bdi dir="ltr">{p.model.prefix}</bdi>{p.model.name ? ' · ' : ''}</>}
          {p.model.name || (isItem ? `דגם ${p.model.prefix}` : '')}
          {sizeShown ? <> · מידה <bdi>{sizeShown}</bdi></> : null}
        </b>
      </div>
      {metaParts.length || p.modelLink ? (
        <div className="sp-meta">
          {metaParts.map((m, i) => <Fragment key={i}>{i ? ' · ' : null}{m}</Fragment>)}
          {p.modelLink ? (
            <>
              {metaParts.length ? ' · ' : null}
              {compact
                ? <a className="sp-lnk" href={p.modelLink} onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(p.modelLink); } }}>כרטיס הדגם</a>
                : <Link className="sp-lnk" href={p.modelLink}>כרטיס הדגם</Link>}
            </>
          ) : null}
        </div>
      ) : null}
      {isItem ? <ItemTiles p={p} /> : <ModelTiles p={p} />}
      {showSizes ? (
        <div className="sp-sizes" aria-label="פירוט לפי מידה">
          <span className="sp-meta">פירוט לפי מידה:</span>
          {p.perSize.map((z) => (
            <button type="button" key={z.key} className="sp-lnk" data-tip={`במלאי ${z.stock} · בתפוסה ${z.busy} · רזרבה ${z.reserve}`} onClick={() => s.pickSize(z.size)}>
              {z.size} <bdi>{z.free}/{z.stock}</bdi>
            </button>
          ))}
        </div>
      ) : null}
      {!isItem && s.sel.size ? <div className="sp-sizes"><button type="button" className="sp-lnk" onClick={() => s.pickSize(null)}>חזרה לכל המידות</button></div> : null}
    </section>
  );
  return { state: 'ok', head, lead };
}
