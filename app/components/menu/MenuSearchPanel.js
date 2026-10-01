'use client';

// פאנל החיפוש של המעטפת החדשה (פלטה: ניווט 12/28/53 .sn-sbox, לחצן 54 .ibtn, לחצן 12 a.lnk "נקה", ניווט 24 .sn-link).
// שלושה חלקים: שורת אחורה/קדימה (R02), שדה חיפוש, ורשימה - "נצפו לאחרונה" כשהשדה ריק, אחרת תוצאות.
// הרשת מועתקת מ-TopbarSearch.js (// COPIED FROM): GET /api/global-search?q=, מינימום 2 תווים, דיבאונס 350, 15 תוצאות,
// "הצג את כל התוצאות" -> /?q=. החזרה מהירה בברקוד לא נכללת בגרסה הזאת (החלטה 12 בתוכנית השחרור).

import { useEffect, useMemo, useState } from 'react';
import useDebounce from '@/hooks/useDebounce';
import { flattenMenuTree } from '@/lib/menu/buildMenuTree';
import { Ic, SnLi } from './menuParts';

const TOPBAR_PANEL_RESULT_CAP = 15; // COPIED FROM TopbarSearch.js
const MIN_CHARS = 2;

/** מצב החיפוש - מוחזק במעטפת כדי שהפאנל בסרגל והמגירה בנייד יישארו מסונכרנים. */
export function useMenuSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounce(q, 350);

  // COPIED FROM TopbarSearch.js
  useEffect(() => {
    const term = debounced.trim();
    if (term.length < MIN_CHARS) {
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
          const combined = [...(data.orders || []), ...(data.customers || [])];
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
  }, [debounced]);

  return { q, setQ, results, total, searching, pending: q.trim() !== debounced.trim(), reset: () => setQ('') };
}

export default function SearchBody({ idPrefix, search, nav, tree, menu, drawer = false, onGo, onClearRecents, inputRef }) {
  const [note, setNote] = useState('');
  const q = search.q;
  const term = q.trim();
  const labels = nav.labels;

  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(''), 1800);
    return () => clearTimeout(t);
  }, [note]);

  const pages = useMemo(() => {
    if (!term) return [];
    return flattenMenuTree(tree).filter((x) => (
      x.kind === 'link' && x.href && x.group !== 'משתמש' && x.group !== 'התראות'
      && (String(x.label).includes(term) || String(x.group).includes(term))
    ));
  }, [tree, term]);

  const role = menu ? 'menuitem' : undefined;
  const step = (dir) => {
    if (dir < 0) { if (nav.canBack) nav.goBack(); else setNote(labels.noBackMessage); }
    else if (nav.canForward) nav.goForward(); else setNote(labels.noForwardMessage);
  };

  let list;
  if (!term) {
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
              <span className="sn-k">{isOrder ? name : (item.phone1 || item.city || '')}</span>
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
      <div className="sn-hist" role="group" aria-label="ניווט בהיסטוריית הצפייה">
        <button
          type="button"
          className="ibtn"
          data-hist="back"
          aria-label={labels.back}
          aria-disabled={labels.backDisabled ? 'true' : 'false'}
          data-tip={nav.canBack ? labels.back.replace('אחורה:', 'אחורה ·') : labels.noBackMessage}
          onClick={() => step(-1)}
        >
          <Ic n="arrr" cls="sm" />
        </button>
        <button
          type="button"
          className="ibtn"
          data-hist="fwd"
          aria-label={labels.forward}
          aria-disabled={labels.forwardDisabled ? 'true' : 'false'}
          data-tip={nav.canForward ? labels.forward.replace('קדימה:', 'קדימה ·') : labels.noForwardMessage}
          onClick={() => step(1)}
        >
          <Ic n="arrl" cls="sm" />
        </button>
        <span className="sn-hpos" role="status" aria-live="polite">{note || labels.positionText}</span>
      </div>
      <div className={`sn-sbox${drawer ? ' sn-dsearch' : ''}`}>
        <Ic n="search" cls="sm" />
        <input
          ref={inputRef}
          id={`${idPrefix}-q`}
          type="search"
          value={q}
          placeholder="חיפוש עמוד, הזמנה או לקוח…"
          autoComplete="nope"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
          aria-label="חיפוש עמוד, הזמנה או לקוח"
          onChange={(e) => search.setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && term.length >= MIN_CHARS) {
              e.preventDefault();
              onGo(() => nav.navigate(`/?q=${encodeURIComponent(term)}`), true);
            }
          }}
        />
      </div>
      <div className="sn-msg" role="status" aria-live="polite" />
      <div className="sn-res" role={menu ? 'menu' : undefined}>{list}</div>
    </>
  );
}
