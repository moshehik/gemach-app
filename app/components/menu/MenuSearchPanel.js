'use client';

// פאנל החיפוש של המעטפת החדשה (פלטה: ניווט 12/28/53 .sn-sbox, לחצן 54 .ibtn, לחצן 12 a.lnk "נקה", ניווט 24 .sn-link).
// שני חלקים: שדה חיפוש, ורשימה - "נצפו לאחרונה" כשהשדה ריק, אחרת תוצאות.
// הרשת מועתקת מ-TopbarSearch.js (// COPIED FROM): GET /api/global-search?q=, מינימום 2 תווים, דיבאונס 350, 15 תוצאות,
// "הצג את כל התוצאות" -> /?q=. החזרה מהירה בברקוד: ברקוד בן 7 ספרות + Enter מחזיר את הפריט המושכר (כמו תיבת "החזרה מהירה"
// של העיצוב הישן, TopbarSearch.js); אם אין פריט מושכר בברקוד - נשארים בחיפוש ומוצגות התוצאות עם הסיבה (דיווח df035847).

import { useCallback, useEffect, useMemo, useState } from 'react';
import useDebounce from '@/hooks/useDebounce';
import { flattenMenuTree } from '@/lib/menu/buildMenuTree';
import { MINE_URL } from '@/lib/myRecentActivityView';
import { HOME_NAV_EVENT } from '@/lib/menu/homeNav';
import { MineRowBody, MineWho, SavedDelButton, SaveForm, ShortcutRowBody, useDraftCount, useMyActivity, useQuickPrefix } from '../search/QuickPrefix';
import { useSavedSearches } from '../search/savedSearches';
import { DeleteDialog, SaveIconButton } from '../search/ShortcutsUi';
import { actionTarget, keywordInsert, menuAllowedPaths, saveCandidate } from '@/lib/quickShortcuts';
import { combineQuickSearchResults } from '@/lib/quickSearchResults';
import { postReturnScan } from '@/components/orders/returnScanClient';
import { usePopup } from '@/app/components/PopupProvider';
import { Ic, SnLi } from './menuParts';

const TOPBAR_PANEL_RESULT_CAP = 15; // COPIED FROM TopbarSearch.js
const MIN_CHARS = 2;

/** מצב החיפוש - מוחזק במעטפת כדי שהפאנל בסרגל והמגירה בנייד יישארו מסונכרנים. */
export function useMenuSearch() {
  const [q, setQ] = useState('');
  // רשימת קידומת ('&' "השינויים שלי", '#' פעולות מהירות, '$' חיפושים שמורים) מוצגת במקום תוצאות החיפוש - ורק אז חיפוש השרת מושעה. ההחלטה היא
  // של הרשימה עצמה (SearchBody: prefixOn, אותו תנאי שמצייר אותה: הקידומת פעילה, שורה לא מקוצצת, כתו ראשון, הרשימה פתוחה) ומדווחת לכאן;
  // המגירה (נייד) גוברת על הפאנל כשהיא פתוחה.
  const [prefixSlots, setPrefixSlots] = useState({ panel: false, drawer: null });
  const setPrefixActive = useCallback((drawer, on) => setPrefixSlots((p) => { const k = drawer ? 'drawer' : 'panel'; return p[k] === on ? p : { ...p, [k]: on }; }), []);
  const prefixActive = prefixSlots.drawer !== null ? prefixSlots.drawer : prefixSlots.panel;
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounce(q, 350);

  // COPIED FROM TopbarSearch.js
  useEffect(() => {
    const term = debounced.trim();
    if (term.length < MIN_CHARS || prefixActive) {
      setResults([]);
      setTotal(0);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    fetch('/api/global-search?q=' + encodeURIComponent(term))
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data && (data.customers || data.orders)) {
          const combined = combineQuickSearchResults(data, term);
          setTotal(combined.length);
          setResults(combined.slice(0, TOPBAR_PANEL_RESULT_CAP));
        } else {
          setResults([]);
          setTotal(0);
        }
      })
      .catch(() => { if (!cancelled) { setResults([]); setTotal(0); } })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debounced, prefixActive]);

  return { q, setQ, setPrefixActive, results, total, searching, pending: q.trim() !== debounced.trim(), reset: () => setQ('') };
}

// קידומות בשורת החיפוש: '&' = "השינויים שלי" (ההזמנות שיצרתי והשינויים שעשיתי), '#' = פעולות מהירות (לפי הרשאות), '$' = חיפושים שמורים - אותן רשימות
// כמו בדף הבית (hook ומודלים משותפים: components/search/QuickPrefix.js, lib/myRecentActivityView.js, lib/quickShortcuts.js). '@' נשארת בדף הבית.
// מדריך הקיצורים (כפתור "קיצורים") רק בדף הבית (PFX-08) - בחיפוש התפריט אין אותו.
// '%' = מילות מפתח (רשימה סטטית מ-KEYWORD_GUIDE): הבחירה מכניסה את המילה לשדה, בלי ניווט.
const MENU_PREFIXES = ['&', '#', '$', '%'];

function MineMenuList({ qp }) {
  const m = qp.mineModel;
  if (!m) return null;
  let n = -1;
  const row = (r) => {
    n += 1;
    const i = n;
    return (
      <a
        key={r.key}
        id={`${qp.listId}-o${i}`}
        className={`sn-link mine-o${r.type === 'all' ? ' mine-more' : ''}${i === qp.act ? ' act' : ''}`}
        role="option"
        aria-selected={i === qp.act}
        href={r.url || '#'}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { e.preventDefault(); qp.pick(r); }}
      ><MineRowBody r={r} term={qp.term} /></a>
    );
  };
  const mine = qp.mine;
  const all = m.state === 'ok' ? m.more : null;
  const allIdx = m.items.length - 1;
  return (
    <div className="mine-menu" id={qp.listId} role="listbox" aria-label={qp.def.listLabel}>
      {(all || (mine && mine.chips.length > 0)) && (
        <div className="mine-head" role="presentation">
          <MineWho chips={mine ? mine.chips : []} setWho={mine ? mine.setWho : () => {}} />
          {all && (
            <button
              type="button"
              id={`${qp.listId}-o${allIdx}`}
              role="option"
              aria-selected={qp.act === allIdx}
              className={`btn sm mine-all${qp.act === allIdx ? ' act' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => qp.pick(all)}
            >{all.title}<Ic n="arrl" /></button>
          )}
        </div>
      )}
      {m.state === 'loading' && <div className="sn-empty" role="status">{m.none}</div>}
      {m.state === 'error' && <div className="sn-empty" role="alert">{m.none}<small>{m.sub}</small></div>}
      {m.state === 'error' && m.items.map(row)}
      {m.state !== 'loading' && m.state !== 'error' && m.sections.map((s) => (
        <div key={s.key}>
          <div className="sn-st" role="presentation">{s.head}<bdi className="sn-cnt">{s.count}</bdi></div>
          {s.rows.map(row)}
        </div>
      ))}
      {m.state === 'ok' && m.none && <div className="sn-empty" role="presentation">{m.none}{m.sub ? <small>{m.sub}</small> : null}</div>}
      <div className="mine-note" role="note"><Ic n="lock" /><span>{m.note}</span></div>
    </div>
  );
}

// רשימת '#' / '$' בתפריט (וגם במגירה): אותן שורות כמו בדף הבית (ShortcutRowBody), בעטיפה של sn-link
function ShortcutMenuList({ qp }) {
  const m = qp.model;
  if (!m) return null;
  const saved = qp.saved;
  const isSaved = qp.def.source === 'saved';
  return (
    <div className="mine-menu pfx-menu" id={qp.listId} role="listbox" aria-label={qp.def.listLabel}>
      <div className="sn-st" role="presentation">{m.head}{isSaved && m.state === 'ok' ? <bdi className="sn-cnt">{m.count}</bdi> : null}</div>
      {m.state === 'loading' && <div className="sn-empty" role="status">{m.none}</div>}
      {(m.state === 'error' || m.state === 'unavailable') && <div className="sn-empty" role="status">{m.none}<small>{m.sub}</small></div>}
      {m.items.map((r, i) => {
        if (r.type === 'save' && saved && saved.saving) return <div key="form"><SaveForm qp={qp} menu /></div>;
        const row = (
          <a
            key={r.key}
            id={`${qp.listId}-o${i}`}
            className={`sn-link mine-o pfx-o${i === qp.act ? ' act' : ''}${r.disabled ? ' dis' : ''}`}
            role="option"
            aria-selected={i === qp.act}
            aria-disabled={r.disabled ? true : undefined}
            href="#"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.preventDefault(); qp.pick(r); }}
          ><ShortcutRowBody r={r} term={qp.term} /></a>
        );
        return r.type === 'saved' ? <div className="pfx-row" key={r.key}>{row}<SavedDelButton r={r} saved={saved} /></div> : row;
      })}
      {m.state === 'ok' && m.none && <div className="sn-empty" role="presentation">{m.none}{m.sub ? <small>{m.sub}</small> : null}</div>}
      {m.state !== 'unavailable' && <div className="mine-note" role="note"><Ic n={m.noteIcon || 'lock'} /><span>{m.note}</span></div>}
    </div>
  );
}

export default function SearchBody({ idPrefix, search, nav, tree, menu, drawer = false, onGo, onClearRecents, inputRef }) {
  const q = search.q;
  const term = q.trim();
  const popup = usePopup();
  const mineData = useMyActivity();
  const showToast = popup && popup.showAlert;
  const saved = useSavedSearches({
    toast: (title, text, kind) => { if (showToast) showToast(text ? `${title}: ${text}` : title, kind === 'error' ? 'error' : kind === 'info' ? 'info' : 'success'); },
    focusInput: () => { if (inputRef && inputRef.current) inputRef.current.focus(); },
  });
  const draftCount = useDraftCount(q.startsWith('#'));
  const allowed = useMemo(() => menuAllowedPaths(flattenMenuTree(tree)), [tree]); // התפריט כבר מסונן לפי ההרשאות: שורה בו = מותר
  const actions = useMemo(() => ({ allowed, draftCount }), [allowed, draftCount]);
  const qp = useQuickPrefix({
    q,
    rows: [],
    mine: mineData,
    actions,
    saved,
    prefixes: MENU_PREFIXES,
    listId: `${idPrefix}-qp`,
    onPick: (row) => {
      if (row.type === 'keyword') { // '%': המילה נכנסת לשדה (הרשימה נסגרת, אין ניווט)
        const k = keywordInsert(row);
        search.setQ(k.text);
        setTimeout(() => { const el = inputRef && inputRef.current; if (el) { el.focus(); try { el.setSelectionRange(k.start, k.end); } catch { /* ignore */ } } }, 0);
        return;
      }
      if (row.type === 'action') {
        const tg = actionTarget(row.action);
        if (!tg) return;
        if (tg.kind === 'nav') onGo(() => nav.navigate(tg.url), true);
        else onGo(() => { nav.navigate(tg.url); window.dispatchEvent(new CustomEvent(HOME_NAV_EVENT, { detail: { href: tg.url } })); }, true); // /?run=debts|unsaved: תוצאות בדף הבית
      } else if (row.type === 'saved') {
        const href = `/?q=${encodeURIComponent(row.query)}`;
        onGo(() => nav.navigate(href), true);
      } else if (row.type === 'all') {
        const href = typeof row.url === 'string' && row.url.startsWith(MINE_URL) ? row.url : MINE_URL; // /?recent=mine[&emp=<id>]: הבחירה של הנהלה נשמרת
        onGo(() => { nav.navigate(href); window.dispatchEvent(new CustomEvent(HOME_NAV_EVENT, { detail: { href } })); }, true);
      } else if (row.url) {
        onGo(() => nav.navigate(row.url), true);
      }
    },
  });
  const prefixOn = qp.open && !!qp.def;
  const mineOn = prefixOn && qp.def.source === 'mine';
  const reportPrefix = search.setPrefixActive;
  useEffect(() => {
    if (!reportPrefix) return undefined;
    reportPrefix(drawer, prefixOn);
    return () => reportPrefix(drawer, drawer ? null : false); // המגירה נסגרת = מחזירה את ההחלטה לפאנל
  }, [reportPrefix, drawer, prefixOn]);
  const saveText = saveCandidate(q);
  const hasSaveText = !!saveText;
  const loadSaved = saved.load;
  useEffect(() => { if (hasSaveText) loadSaved(); }, [hasSaveText, loadSaved]); // נטען רק כשיש מה לשמור, לא בעליית הדף
  const isBarcode = /^\d{7}$/.test(term); // ברקוד תקין = בדיוק 7 ספרות (מס' הזמנה 5 ספרות, טלפון 9+)
  const [qr, setQr] = useState({ busy: false, text: '', err: false });

  // החזרה מהירה בברקוד - אותו מנגנון כמו TopbarSearch.js (postReturnScan מטפל גם באישור מנהל להחזרה מוקדמת)
  const quickReturn = async () => {
    if (qr.busy) return;
    setQr({ busy: true, text: '', err: false });
    try {
      const { res, data } = await postReturnScan({ barcode: term });
      if (res.ok) {
        setQr({ busy: false, text: '', err: false });
        onGo(() => {
          if (popup?.openRentalModal) popup.openRentalModal(data.orderId);
          else nav.navigate(`/orders/${data.orderId}`);
        }, true);
        return;
      }
      if (data?.cancelled) {
        setQr({ busy: false, text: '', err: false });
      } else if (res.status === 404) {
        // אין פריט מושכר בברקוד - נשארים בחיפוש (התוצאות לפי ברקוד מוצגות למטה) ומסבירים למה
        setQr({ busy: false, text: `${data?.error || 'לא נמצא פריט מושכר בברקוד הזה'} - מוצגות תוצאות חיפוש`, err: false });
      } else {
        setQr({ busy: false, text: data?.error || 'שגיאה בהחזרה', err: true });
      }
    } catch (e) {
      setQr({ busy: false, text: 'שגיאת תקשורת', err: true });
    }
  };

  const pages = useMemo(() => {
    if (!term || prefixOn) return [];
    return flattenMenuTree(tree).filter((x) => (
      x.kind === 'link' && x.href && x.group !== 'משתמש' && x.group !== 'התראות'
      && menuRowMatchesTerm(x, term)
    ));
  }, [tree, term, prefixOn]);

  const role = menu ? 'menuitem' : undefined;

  let list;
  if (prefixOn) {
    list = null; // רשימת הקידומת מצויירת במקום .sn-res (MineMenuList / ShortcutMenuList)
  } else if (!term) {
    list = (
      <>
        <div className="sn-st" style={{ display: 'flex', alignItems: 'center' }}>
          נצפו לאחרונה
          {nav.view.length > 1 && (
            <a className="lnk" href="#" style={{ marginInlineStart: 'auto' }} onClick={(e) => { e.preventDefault(); onClearRecents(); }}>נקה</a>
          )}
        </div>
        {nav.view.length === 0 && <div className="sn-empty">אין היסטוריה זמינה</div>}
        {nav.view.map((e) => (
          <a
            key={e.key}
            className="sn-link"
            role={role}
            href={e.path}
            aria-current={e.isCurrent ? 'page' : undefined}
            onClick={(ev) => { ev.preventDefault(); onGo(() => nav.goTo(e.index)); }}
          >
            <SnLi n={e.icon || 'file'} />
            {e.label}
            {(e.isCurrent || e.isForward) && <span className="sn-k">{e.isCurrent ? 'עכשיו' : 'קדימה'}</span>}
          </a>
        ))}
      </>
    );
  } else {
    const apiOn = term.length >= MIN_CHARS;
    list = (
      <>
        {pages.length > 0 && <div className="sn-st">עמודים</div>}
        {pages.map((p) => (
          <a
            key={p.id}
            className="sn-link"
            role={role}
            href={p.href}
            onClick={(ev) => { ev.preventDefault(); onGo(() => nav.navigate(p.href)); }}
          >
            <SnLi n={p.icon} />
            {p.label}
            {p.group ? <span className="sn-k">{p.group}</span> : null}
          </a>
        ))}
        {apiOn && (search.searching || search.pending) && <div className="sn-empty">מחפש…</div>}
        {apiOn && !search.searching && !search.pending && search.results.length > 0 && <div className="sn-st">הזמנות ולקוחות</div>}
        {apiOn && !search.searching && !search.pending && search.results.map((item, idx) => {
          const isOrder = !!item.orderId;
          const name = `${item.firstName || ''} ${item.lastName || ''}`.trim();
          return (
            <a
              key={`${isOrder ? 'o' : 'c'}-${item.id}-${idx}`}
              className="sn-link"
              role={role}
              href={isOrder ? `/orders/${item.id}` : `/customers/${item.id}`}
              onClick={(ev) => { ev.preventDefault(); onGo(() => nav.navigate(isOrder ? `/orders/${item.id}` : `/customers/${item.id}`), true); }}
            >
              <SnLi n={isOrder ? 'file' : 'user'} />
              {isOrder ? `הזמנה #${item.orderId}` : name}
              <span className="sn-k">{item.fromBarcode ? `ברקוד ${item.barcode}${item.stateLabel ? ` · ${item.stateLabel}` : ''}` : isOrder ? name : (item.phone1 || item.city || '')}</span>
            </a>
          );
        })}
        {apiOn && !search.searching && !search.pending && search.results.length === 0 && pages.length === 0 && (
          <div className="sn-empty">לא נמצאו תוצאות</div>
        )}
        {!apiOn && pages.length === 0 && <div className="sn-empty">לא נמצאו עמודים תואמים</div>}
        {apiOn && !search.searching && !search.pending && search.total > 0 && (
          <>
            <div className="sn-sep" />
            <a
              className="sn-link"
              role={role}
              href={`/?q=${encodeURIComponent(term)}`}
              onClick={(ev) => { ev.preventDefault(); onGo(() => nav.navigate(`/?q=${encodeURIComponent(term)}`), true); }}
            >
              <SnLi n="search" />
              {`הצג את כל התוצאות (${search.total}) במסך מלא`}
            </a>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className={`sn-sbox${drawer ? ' sn-dsearch' : ''}`}>
        <Ic n="search" cls="sm" />
        <input
          ref={inputRef}
          id={`${idPrefix}-q`}
          type="search"
          value={q}
          placeholder="חיפוש עמוד, הזמנה או לקוח…"
          name={`${idPrefix}-search`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
          aria-label="חיפוש עמוד, הזמנה או לקוח"
          onChange={(e) => { if (qr.text) setQr({ busy: false, text: '', err: false }); search.setQ(e.target.value); }}
          {...qp.inputProps}
          onFocus={qp.onFocus}
          onBlur={qp.onBlur}
          onKeyDown={(e) => {
            qp.onKeyDown(e); // '&': חצים / Enter / Esc של הרשימה (Enter עליה לא מריץ חיפוש)
            if (e.defaultPrevented) return;
            if (e.key !== 'Enter') return;
            if (isBarcode) {
              e.preventDefault();
              quickReturn();
            } else if (term.length >= MIN_CHARS) {
              e.preventDefault();
              onGo(() => nav.navigate(`/?q=${encodeURIComponent(term)}`), true);
            }
          }}
        />
        <SaveIconButton text={q} saved={saved} />
      </div>
      <div className={`sn-msg${qr.err ? ' err' : ''}`} role="status" aria-live="polite">
        {qr.busy ? 'מחזיר…' : (qr.text || (isBarcode ? `Enter - החזרה מהירה של ברקוד ${term}` : ''))}
      </div>
      {mineOn ? <MineMenuList qp={qp} /> : prefixOn ? <ShortcutMenuList qp={qp} /> : <div className="sn-res" role={menu ? 'menu' : undefined}>{list}</div>}
      {saved.confirm && <DeleteDialog key={saved.confirm.id} confirm={saved.confirm} onConfirm={saved.confirmDelete} onCancel={saved.cancelDelete} skin="menu" />}
    </>
  );
}
