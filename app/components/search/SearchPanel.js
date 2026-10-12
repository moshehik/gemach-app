'use client';

// פאנל התפוסה / הפריט של החיפוש (docs/search-capacity-embed.md): רכיב אחד משותף לחיפוש הראשי (HomeA5) ולחיפוש המהיר שבתפריט (MenuSearchPanel).
// קלט: מה שהוקלד. parseSearchIntent (אותו קוד כמו בשרת) מחליט אם יש בכלל פאנל - רק אז נשלחת בקשה ל-GET /api/search-panel, בלי לחסום הקלדה
// (בקשה בלתי תלויה, מתבטלת כשההקלדה משתנה, שלד טעינה בזמן ההמתנה). הרשאות מוכרעות בשרת: מי שאין לה - לא מקבלת פאנל ולא רואה כלום.
//
// עיצוב: ריבועי stat של הפלטה (.capstats / .capst, אותם כרטיסים כמו תפוסה בחיפוש המתקדם), שורות הרשימה של הפלטה (.li.rlink.lrow) בחיפוש הראשי
// ושורות התפריט (.sn-link) בחיפוש המהיר (compact). CSS מקומי רק למה שחסר בפלטה: searchPanel.css.

import './searchPanel.css';
import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { parseSearchIntent } from '@/lib/searchIntent';
import { Ic } from '../menu/menuParts';

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

function Chip({ cls = '', children }) {
  return <span className={`chip${cls ? ' ' + cls : ''}`}>{children}</span>;
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
function rowChips(r) {
  return (
    <>
      {r.late ? <Chip cls="rose">באיחור</Chip> : null}
      {r.draft ? <Chip cls="amber">טיוטה</Chip> : null}
      {r.alter ? <Chip cls="amber">בהתאמה</Chip> : null}
      {r.requires ? <Chip cls="gold">חייבת את הפריט</Chip> : null}
    </>
  );
}

function Row({ r, compact, onOpen }) {
  const url = '/orders/' + r.orderId;
  const title = r.name || `הזמנה #${r.orderId}`;
  if (compact) {
    return (
      <a className="sn-link sp-link" href={url} data-sp-row={r.state} onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(url); } }}>
        <span className="sp-rt"><b>{title}</b>{rowChips(r)}</span>
        <span className="sp-ln">{rowLine(r)}</span>
      </a>
    );
  }
  return (
    <Link className="li rlink lrow" href={url} data-sp-row={r.state}>
      <div className="t">
        <b>{title}{rowChips(r)}</b>
        <span className="ln">{rowLine(r)}</span>
      </div>
      <Ic n="chev" cls="go" />
    </Link>
  );
}

function Section({ id, title, sec, compact, onOpen, emptyText }) {
  const lim = compact ? 4 : 8;
  const [more, setMore] = useState(false);
  const rows = more ? sec.rows : sec.rows.slice(0, lim);
  return (
    <div className="sp-sec" data-sp-sec={id}>
      <div className={compact ? 'sn-st sp-sh' : 'sp-sh'}>{title} <bdi className="faint">({sec.total})</bdi></div>
      {sec.total === 0 ? <div className="sp-empty">{emptyText}</div> : (
        <div className={compact ? 'sp-rows' : 'list sp-rows'} aria-label={title}>
          {rows.map((r) => <Row key={r.key} r={r} compact={compact} onOpen={onOpen} />)}
        </div>
      )}
      {sec.rows.length > lim ? (
        <button type="button" className="sp-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? 'הצג פחות' : `עוד ${sec.rows.length - lim}`}</button>
      ) : null}
      {more && sec.total > sec.rows.length ? <div className="sp-empty">מוצגות {sec.rows.length} מתוך {sec.total}</div> : null}
    </div>
  );
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

const WHERE_CHIP = { out: 'rose', repair: 'amber', notInUse: 'amber', reserve: 'gold', warehouse: '', place: 'ok', unknown: '' };

function WhereRow({ r, compact, onOpen }) {
  const url = r.state === 'out' && r.orderId ? '/orders/' + r.orderId : '';
  const head = (
    <>
      <bdi dir="ltr">{r.barcode}</bdi>{r.size ? <> · מידה <bdi>{r.size}</bdi></> : null}
      <Chip cls={WHERE_CHIP[r.state]}>{r.stateLabel}</Chip>
      {r.late ? <Chip cls="rose">באיחור</Chip> : null}
      {r.alter ? <Chip cls="amber">בהתאמה</Chip> : null}
      {r.orphan ? <Chip>לא במלאי</Chip> : null}
    </>
  );
  const parts = [];
  if (r.state === 'out') {
    parts.push(r.name ? <>אצל <b>{r.name}</b></> : 'אצל משפחה');
    if (r.phone) parts.push(<bdi dir="ltr">{r.phone}</bdi>);
    if (r.orderId) parts.push(<>הזמנה <bdi>#{r.orderId}</bdi></>);
    if (r.hebDate) parts.push(r.hebDate);
  } else {
    parts.push(r.placeKnown ? r.place : 'מיקום לא מוגדר');
    if (r.returnedHeb) parts.push(<>הוחזר לאחרונה {r.returnedHeb}</>);
  }
  const line = parts.map((p, i) => <Fragment key={i}>{i ? ' · ' : null}{p}</Fragment>);
  if (compact) {
    const inner = <><span className="sp-rt"><b>{head}</b></span><span className="sp-ln">{line}</span></>;
    return url
      ? <a className="sn-link sp-link" href={url} data-sp-where={r.state} onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(url); } }}>{inner}</a>
      : <div className="sn-link sp-link" data-sp-where={r.state}>{inner}</div>;
  }
  const inner = <div className="t"><b>{head}</b><span className="ln">{line}</span></div>;
  return url
    ? <Link className="li rlink lrow" href={url} data-sp-where={r.state}>{inner}<Ic n="chev" cls="go" /></Link>
    : <div className="li lrow nolink" data-sp-where={r.state}>{inner}</div>;
}

function WhereView({ w, compact, onOpen }) {
  const lim = compact ? 6 : 12;
  const [more, setMore] = useState(false);
  const rows = more ? w.rows : w.rows.slice(0, lim);
  const chips = Object.entries(w.counts).filter(([, n]) => n > 0);
  return (
    <div className="sp-sec" data-sp-sec="where">
      <div className="sp-chips" aria-label="סיכום מיקומים">
        {chips.map(([k, n]) => <Chip key={k} cls={WHERE_CHIP[k]}>{WHERE_LABEL[k]} <bdi>{n}</bdi></Chip>)}
      </div>
      {w.rows.length === 0 ? <div className="sp-empty">לא נמצאו ברקודים</div> : (
        <div className={compact ? 'sp-rows' : 'list sp-rows'} aria-label="מיקום כל ברקוד">
          {rows.map((r) => <WhereRow key={r.key} r={r} compact={compact} onOpen={onOpen} />)}
        </div>
      )}
      {w.rows.length > lim ? <button type="button" className="sp-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? 'הצג פחות' : `עוד ${w.rows.length - lim}`}</button> : null}
      {w.truncated ? <div className="sp-empty">מוצגים {w.rows.length} מתוך {w.total}</div> : null}
    </div>
  );
}
const WHERE_LABEL = { out: 'מושכרים', repair: 'בתיקון', notInUse: 'לא בשימוש', reserve: 'רזרבה', warehouse: 'מחסן', place: 'במקום', unknown: 'לא מוגדר' };

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

/**
 * @param {{query: string, compact?: boolean, onOpen?: (url: string) => void}} props
 *   compact = החיפוש המהיר שבתפריט (שורות sn-link, פחות שורות); onOpen = ניווט במעטפת (סוגר את הפאנל)
 */
export default function SearchPanel({ query, compact = false, onOpen }) {
  const s = useSearchPanel(query);
  const [whereOpen, setWhereOpen] = useState(false);
  const sigNow = s.intent.signature + '|' + (s.sel.model ?? '') + '|' + (s.sel.size ?? '');
  useEffect(() => { setWhereOpen(false); }, [sigNow]);
  const wh = useSearchPanel(query, { view: 'where', enabled: whereOpen, sel: s.sel });
  if (s.state === 'idle' || s.state === 'empty') return null;
  if (s.state === 'loading' && !s.panel) return <Skeleton compact={compact} />;
  if (s.state === 'error') {
    return (
      <section className={`sp${compact ? ' sp-compact' : ''}`} role="status" data-sp-state="error">
        <div className="sp-empty">לא ניתן לטעון את נתוני התפוסה. <button type="button" className="sp-more" onClick={s.retry}>נסו שוב</button></div>
      </section>
    );
  }
  const p = s.panel;
  if (!p) return null;

  if (p.mode === 'choose') {
    return (
      <section className={`sp${compact ? ' sp-compact' : ''}`} data-sp-state="choose" aria-label="בחירת דגם">
        <div className="sp-head"><b>נמצאו {p.candidatesTotal} דגמים תואמים - בחרו דגם</b></div>
        <div className="sp-chips">
          {p.candidates.map((c) => (
            <button type="button" key={c.prefix} className="chip btnlike" onClick={() => s.pickModel(c.prefix)}>{c.name ? c.name + ' ' : 'דגם '}<bdi dir="ltr">{c.prefix}</bdi></button>
          ))}
        </div>
      </section>
    );
  }

  const isItem = p.mode === 'item';
  const sizeShown = isItem ? p.item.size : (p.sizes && p.sizes.length ? p.sizes.join(', ') : '');
  const T = isItem
    ? { out: 'המקומות בהם הוא מושכר', returned: 'המקומות בהם הוחזר', pending: 'הזמנות שצריכות את הדגם והמידה שלו', outEmpty: 'הפריט לא מושכר כרגע', retEmpty: 'הפריט עוד לא הוחזר מאף הזמנה', pendEmpty: 'אין הזמנות עתידיות שמחכות לדגם ולמידה' }
    : { out: 'בחוץ (מושכרים)', returned: 'הוחזרו (האחרונים)', pending: 'הזמנות שצריכות את הדגם והמידה ועדיין לא נלקחו', outEmpty: 'אין פריטים בחוץ', retEmpty: 'אין פריטים שהוחזרו', pendEmpty: 'אין הזמנות עתידיות שממתינות' };
  const whereLabel = isItem ? 'איפה המידה שלי?' : 'איפה אני?';
  const whereSub = isItem ? `המיקום של כל הברקודים בדגם ${p.model.name || p.model.prefix} מידה ${p.item.size}` : `המיקום של כל ברקוד בדגם ${p.model.name || p.model.prefix}${sizeShown ? ' מידה ' + sizeShown : ''}`;
  const whereBody = !whereOpen ? null : wh.state === 'error'
    ? <div className="sp-empty">לא ניתן לטעון את המיקומים. <button type="button" className="sp-more" onClick={wh.retry}>נסו שוב</button></div>
    : !wh.panel ? <div className="sp-skel sp-skel-line" aria-busy="true" /> : <WhereView w={wh.panel} compact={compact} onOpen={onOpen} />;
  return (
    <section className={`sp${compact ? ' sp-compact' : ''}${s.state === 'loading' ? ' sp-refresh' : ''}`} data-guide-id="srch.panel" data-sp-state="ok" data-sp-mode={p.mode} aria-label={isItem ? 'פרטי הפריט' : 'תפוסת הדגם'}>
      <button type="button" className={`sp-where ${compact ? 'sn-link' : 'li lrow'}${whereOpen ? ' on' : ''}`} data-guide-id="srch.panel-where" data-sp-act="where" aria-expanded={whereOpen} onClick={() => setWhereOpen((v) => !v)}>
        <span className={compact ? 'sp-rt' : 't'}>
          <b>{whereOpen ? 'חזרה לתפוסה' : whereLabel}</b>
          <span className={compact ? 'sp-ln' : 'ln'}>{whereOpen ? whereLabel : whereSub}</span>
        </span>
        <Ic n={whereOpen ? 'x' : 'chev'} cls="go" />
      </button>
      <div className="sp-head">
        <b>
          {isItem ? <>ברקוד <bdi dir="ltr">{p.item.barcode}</bdi> · </> : <>דגם <bdi dir="ltr">{p.model.prefix}</bdi>{p.model.name ? ' · ' : ''}</>}
          {p.model.name || (isItem ? `דגם ${p.model.prefix}` : '')}
        </b>
        <span className="sp-chips">
          {sizeShown ? <Chip cls="gold">מידה <bdi>{sizeShown}</bdi></Chip> : null}
          {!isItem ? <Chip>{p.date.isToday ? 'היום' : p.date.label}</Chip> : null}
          {isItem && p.itemMissing ? <Chip cls="amber">הברקוד לא נמצא במלאי</Chip> : null}
          {isItem && p.item.serial != null ? <Chip>מס׳ סידורי <bdi>{p.item.serial}</bdi></Chip> : null}
          {isItem && p.item.location ? <Chip>מיקום <bdi>{p.item.location}</bdi></Chip> : null}
          {isItem ? p.flags.map((f) => <Chip key={f} cls="amber">{f}</Chip>) : null}
          {!isItem && p.tiles.free != null ? <Chip cls="ok">פנויים <bdi>{p.tiles.free}</bdi></Chip> : null}
          {p.modelLink ? (compact
            ? <a className="chip btnlike" href={p.modelLink} onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(p.modelLink); } }}>כרטיס הדגם</a>
            : <Link className="chip btnlike" href={p.modelLink}>כרטיס הדגם</Link>) : null}
        </span>
      </div>
      {isItem ? <ItemTiles p={p} /> : <ModelTiles p={p} />}
      {!isItem && p.perSize && p.perSize.length > 1 ? (
        <div className="sp-sizes" aria-label="פירוט לפי מידה">
          {p.perSize.map((z) => (
            <button type="button" key={z.key} className={`chip btnlike${z.free === 0 ? ' rose' : ''}`} data-tip={`במלאי ${z.stock} · בתפוסה ${z.busy} · רזרבה ${z.reserve}`} onClick={() => s.pickSize(z.size)}>
              <b>{z.size}</b> <bdi>{z.free}/{z.stock}</bdi>
            </button>
          ))}
        </div>
      ) : null}
      {!isItem && s.sel.size ? <button type="button" className="sp-more" onClick={() => s.pickSize(null)}>חזרה לכל המידות</button> : null}
      {whereOpen ? whereBody : null}
      {whereOpen ? null : <Section id="out" title={T.out} sec={p.sections.out} compact={compact} onOpen={onOpen} emptyText={T.outEmpty} />}
      {whereOpen ? null : <Section id="returned" title={T.returned} sec={p.sections.returned} compact={compact} onOpen={onOpen} emptyText={T.retEmpty} />}
      {whereOpen ? null : <Section id="pending" title={T.pending} sec={p.sections.pending} compact={compact} onOpen={onOpen} emptyText={T.pendEmpty} />}
    </section>
  );
}
