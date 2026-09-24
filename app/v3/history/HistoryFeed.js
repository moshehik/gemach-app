'use client';
// HistoryFeed -- פיד ההיסטוריה v3 (hf-* מסקיצה B, R23). קורא שורות AuditLog גולמיות, מעביר במתאם (adapter.js)
// ומציג: קבוצות יום, חיפוש, סינון קטגוריות מרובה, רשומה מקופלת = תג + משפט + סכום + חץ, ופאנל מורחב לפני←אחרי.
// קריאה/תצוגה בלבד (R8). "ביטול מיידי" מוצג רק כש-ctx.liveUndo מתיר וקיים onUndo (הקריאה עצמה של המסך המארח).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getHebrewDateString, getHebrewWeekdayFullName } from '@/lib/hebrewDate';
import { Icon, IconSpriteV3 } from '../ui';
import Tip from '../ui/Tip';
import Btn from '../ui/Btn';
import { Switch } from '../ui/Tabs';
import '../tokens.css';
import '../components.css';
import './history.css';
import { CATEGORIES, buildFeed, dayKey, gregOf, money, searchHay, missingLabels } from './adapter';

/* שמות איקונים של המילון (סגנון הסקיצה) -> id בספרייט */
const ICON = { dress: 'shirt', cal: 'calendar', print: 'printer', sig: 'edit', undo: 'history', bank: 'wallet', cash: 'coin', pencil: 'edit', cart: 'receipt', alert: 'alert-circle' };
const ic = (n) => ICON[n] || n || 'clock';

/* תתי-סינון לפי אייקון (כמו HF_EXTRA בסקיצה) -- מופיעים רק אם קיימת רשומה כזו */
const HF_MAP = { sig: 'sig', print: 'print', mail: 'mail', fix: 'scissors' };
const HF_EXTRA = [['sig', 'חתימות', 'sig'], ['print', 'הדפסות', 'print'], ['mail', 'מיילים', 'mail'], ['fix', 'תיקונים', 'scissors']];
const CAT_ORDER = ['items', 'pay', 'del', 'dates', 'docs', 'rental', 'info', 'cust', 'dress', 'emp', 'sys'];
const inCat = (e, k) => (HF_MAP[k] ? e.icon === HF_MAP[k] : e.cat === k);

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function Hl({ text, words }) {
  const s = text == null ? '' : String(text);
  if (!words.length || !s) return s;
  const re = new RegExp('(' + words.map(esc).join('|') + ')', 'gi');
  return s.split(re).map((part, i) => (i % 2 ? <mark key={i} className="v3-mark">{part}</mark> : part));
}

function dayTitle(day) {
  const d = new Date(`${day}T12:00:00Z`);
  return `${getHebrewWeekdayFullName(d)} ${getHebrewDateString(d)}`;
}

function AmountChip({ e }) {
  const cls = e.kind === 'pay' ? 'v3-hamt--paid' : e.amt > 0 ? 'v3-hamt--charge' : 'v3-hamt--credit';
  const label = e.kind === 'pay' ? 'תשלום שהתקבל' : e.amt > 0 ? 'חיוב' : 'זיכוי';
  const sign = e.kind === 'pay' ? '' : e.amt > 0 ? '+' : '−';
  return (
    <Tip content={label}>
      <span className={`v3-hamt ${cls}`}><bdi>{sign}{money(e.amt)}</bdi></span>
    </Tip>
  );
}

function Entry({ e, i, words, open, onToggle, showEntity, canRaw, onUndo }) {
  const detId = `hd-${useId().replace(/:/g, '')}`;
  const init = (e.who || '?').trim()[0];
  const det = e.det || [];
  const bf = det.find((x) => x[0] === 'לפני');
  const af = det.find((x) => x[0] === 'אחרי');
  const canUndo = !!(onUndo && e.redo?.eligible);
  return (
    <article className={`v3-item v3-hentry${e.amt ? '' : ' is-noamt'}${open ? ' is-open' : ''}`} style={{ '--i': Math.min(i, 12) }}>
      <div className="v3-item__top" role="button" tabIndex={0} aria-expanded={open} aria-controls={detId}
        onClick={onToggle}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onToggle(); } }}>
        <div className="v3-item__thumb" data-tone={e.tone}><Icon name={ic(e.icon)} /></div>
        <div className="v3-item__info">
          <div className="v3-item__model">
            {showEntity && <span className="v3-item__size">{e.entLabel}</span>}{showEntity && ' '}
            <Hl text={e.text} words={words} />
          </div>
        </div>
        {e.amt ? <AmountChip e={e} /> : null}
        <span className="v3-item__chev" aria-hidden="true"><Icon name="chevron-down" size="sm" anim={false} /></span>
      </div>
      <div className="v3-item__wrap" id={detId}>
        <div className="v3-item__det"><div className="v3-item__det-in">
          <div className="v3-hrow"><small>מבצע/ת</small><b><span className="v3-avatar" aria-hidden="true">{init}</span><Hl text={e.who} words={words} /></b></div>
          <div className="v3-hrow"><small>שעה</small><b><bdi><Hl text={e.ts.slice(11)} words={words} /></bdi></b></div>
          {e.sub ? <div className="v3-hrow"><small>פרטים</small><b><Hl text={e.sub} words={words} /></b></div> : null}
          {bf && af ? <div className="v3-hrow"><small>שינוי</small><b><bdi><Hl text={bf[1]} words={words} /></bdi>{' ← '}<bdi><Hl text={af[1]} words={words} /></bdi></b></div> : null}
          {det.map(([a, b], k) => (bf && af && (a === 'לפני' || a === 'אחרי') ? null : (
            <div className="v3-hrow" key={k}><small>{a}</small><b><bdi><Hl text={b} words={words} /></bdi></b></div>
          )))}
          {canRaw && e.raw ? <div className="v3-hrow"><small>גולמי</small><pre className="v3-hraw">{typeof e.raw === 'string' ? e.raw : JSON.stringify(e.raw)}</pre></div> : null}
          {canUndo ? (
            <div className="v3-hrow v3-hrow--acts">
              <Btn variant="quiet" size="sm" icon="history" onClick={() => onUndo(e)}>ביטול מיידי</Btn>
              <Tip>זמין לזמן קצר אחרי הפעולה, לפי מדיניות הזיכויים.</Tip>
            </div>
          ) : null}
        </div></div>
      </div>
    </article>
  );
}

/**
 * rows        שורות AuditLog גולמיות (מ-/api/audit, כולל employeeName)
 * ctx         {itemsById, settingsById, liveUndo}  (ר' adapter.toFeedEntry)
 * showEntity  תג ישות בכל שורה (פיד גלובלי)
 * canShowAll  מתג "גם שמירות ללא שינוי + פירוט גולמי" (למנהלים -- HISTORY-DESIGN §6 פריט 1)
 * onUndo(entry)  קריאה קיימת של המסך המארח; לא נכתב כאן שום יומן
 * hasMore/onLoadMore, onServerSearch(q)  שכבת "יש עוד בשרת" (חיפוש שרת כמו במסך הישן)
 */
export default function HistoryFeed({ rows, ctx, showEntity = false, canShowAll = false, onUndo, hasMore = false, loadingMore = false, onLoadMore, onServerSearch, serverQuery = '', onClearServerSearch, total }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const [panel, setPanel] = useState(false);
  const [openMap, setOpenMap] = useState({});
  const [showNoise, setShowNoise] = useState(false);
  const selRef = useRef(null), triggerRef = useRef(null), inputRef = useRef(null);
  const listId = `hfl-${useId().replace(/:/g, '')}`;

  const feed = useMemo(() => buildFeed(rows || [], { ...(ctx || {}), showNoise }), [rows, ctx, showNoise]);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && missingLabels.size) console.info('[history] חסר במילון:', [...missingLabels]);
  }, [feed]);

  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const hay = useMemo(() => new Map(feed.entries.map((e) => [e.id, searchHay(e)])), [feed]);
  const hit = (e) => !words.length || words.every((w) => hay.get(e.id).includes(w));

  const cats = useMemo(() => {
    const base = CAT_ORDER.filter((k) => feed.entries.some((e) => e.cat === k)).map((k) => [k, CATEGORIES[k].label, CATEGORIES[k].icon]);
    const extra = HF_EXTRA.filter(([k]) => feed.entries.some((e) => inCat(e, k)));
    return [...base, ...extra];
  }, [feed]);
  const activeSel = sel.filter((k) => cats.some((c) => c[0] === k));

  const visible = useMemo(
    () => feed.entries.filter((e) => (!activeSel.length || activeSel.some((k) => inCat(e, k))) && hit(e)),
    [feed, sel, words],
  );
  const days = useMemo(() => {
    const out = [];
    for (const e of visible) {
      const d = dayKey(e.rawTs);
      if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, entries: [] });
      out[out.length - 1].entries.push(e);
    }
    return out;
  }, [visible]);
  const countOf = (k) => feed.entries.filter((e) => (k === 'all' || inCat(e, k)) && hit(e)).length;

  useEffect(() => {
    if (!panel) return undefined;
    const down = (ev) => { if (!selRef.current?.contains(ev.target)) setPanel(false); };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [panel]);

  const toggleCat = (k) => setSel((s) => (k === 'all' ? [] : s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const closePanel = (focus) => { setPanel(false); if (focus) triggerRef.current?.focus(); };
  const optKey = (ev, k) => {
    const all = [...selRef.current.querySelectorAll('[role="option"]')], i = all.indexOf(ev.currentTarget);
    const go = (n) => { ev.preventDefault(); all[(n + all.length) % all.length].focus(); };
    if (ev.key === 'ArrowDown') go(i + 1);
    else if (ev.key === 'ArrowUp') go(i - 1);
    else if (ev.key === 'Home') go(0);
    else if (ev.key === 'End') go(all.length - 1);
    else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggleCat(k); }
  };
  const nameOf = Object.fromEntries(cats.map((c) => [c[0], c[1]]));
  const optList = [['all', 'הכל', 'list'], ...cats];
  const isOpen = (e) => !!openMap[e.id] || (words.length > 0 && !words.every((w) => e.text.toLowerCase().includes(w)));

  if (!feed.entries.length && !q && !hasMore) {
    return (
      <div className="v3-hist" data-v3="" dir="rtl"><IconSpriteV3 />
        <div className="v3-hempty" role="status"><Icon name="history" size="2xl" /><b>אין עדיין היסטוריה</b><span>כשיתבצעו שינויים הם יופיעו כאן לפי יום.</span></div>
      </div>
    );
  }

  return (
    <div className="v3-hist" data-v3="" dir="rtl">
      <IconSpriteV3 />
      <div className="v3-filter-bar">
        <div className="v3-search">
          <Icon name="search" />
          <input ref={inputRef} type="search" autoComplete="off" value={q} placeholder="חיפוש בהיסטוריה" aria-label="חיפוש בהיסטוריה"
            onChange={(ev) => setQ(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Escape' && q) setQ(''); }} />
          <button type="button" className={`v3-search__clear${q ? ' is-on' : ''}`} aria-label="ניקוי חיפוש" tabIndex={q ? 0 : -1}
            onClick={() => { setQ(''); inputRef.current?.focus(); }}><Icon name="x" size="sm" /></button>
        </div>
        <div className={`v3-filter${panel ? ' is-open' : ''}`} ref={selRef}>
          <button type="button" ref={triggerRef} className="v3-filter__t" aria-haspopup="listbox" aria-expanded={panel} aria-controls={listId}
            onClick={() => setPanel((o) => !o)}
            onKeyDown={(ev) => { if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); setPanel(true); setTimeout(() => selRef.current?.querySelector('[role="option"]')?.focus(), 30); } }}>
            <Icon name="sort" />
            <span className="v3-filter__lbl">סינון</span>
            <span className={`v3-filter__count${activeSel.length ? ' has' : ''}`}>{activeSel.length || ''}</span>
            <Icon name="chevron-down" size="sm" className="v3-filter__chev" anim={false} />
          </button>
          <div className="v3-filter__scrim" onClick={() => closePanel(true)} />
          <div className="v3-filter__panel" onKeyDown={(ev) => { if (ev.key === 'Escape') { ev.preventDefault(); closePanel(true); } }}>
            <div className="v3-filter__hd"><b>סינון</b><span className="v3-filter__hc">{activeSel.length ? `${activeSel.length} פעילים` : 'הכל'}</span>
              <button type="button" className="v3-filter__rst" onClick={() => setSel([])}>איפוס</button></div>
            <div className="v3-filter__list" id={listId} role="listbox" aria-multiselectable="true" aria-label="סינון היסטוריה">
              {optList.map(([k, label, icon], n) => {
                const on = k === 'all' ? !activeSel.length : activeSel.includes(k);
                return (
                  <div key={k} className="v3-filter__opt" role="option" tabIndex={-1} aria-selected={on} style={{ '--k': n }}
                    onClick={() => toggleCat(k)} onKeyDown={(ev) => optKey(ev, k)}>
                    <span className="v3-check"><Icon name="check" anim={false} /></span>
                    <span className="v3-filter__oi"><Icon name={ic(icon)} size="sm" /></span>
                    <span className="v3-filter__ol">{label}</span>
                    <span className="v3-filter__oc"><bdi>{countOf(k)}</bdi></span>
                  </div>
                );
              })}
            </div>
            <div className="v3-filter__foot"><button type="button" className="v3-filter__done" onClick={() => closePanel(true)}><Icon name="check" /><span>החל</span></button></div>
          </div>
        </div>
        <div className="v3-pills">
          {activeSel.length > 0 && activeSel.length <= 3 && activeSel.map((k) => (
            <button key={k} type="button" className="v3-pill" aria-label={`הסרת סינון ${nameOf[k]}`} onClick={() => toggleCat(k)}>{nameOf[k]}<Icon name="x" size="xs" /></button>
          ))}
        </div>
        {canShowAll && (
          <div className="v3-hcnt">
            <Switch checked={showNoise} onChange={setShowNoise} label="הצג גם שמירות ללא שינוי ופירוט גולמי" />
            <Tip>למנהלים: שמירות שלא שינו כלום מוסתרות כברירת מחדל כדי שההיסטוריה תישאר קריאה.</Tip>
          </div>
        )}
        <span className="v3-sr" role="status" aria-live="polite">{visible.length} רשומות</span>
      </div>

      {serverQuery ? (
        <div className="v3-hmore">
          <span>מוצגות תוצאות שרת עבור <b><bdi>{serverQuery}</bdi></b></span>
          {onClearServerSearch && <Btn variant="quiet" size="sm" icon="x" onClick={onClearServerSearch}>נקה</Btn>}
        </div>
      ) : null}

      {!days.length ? (
        <div className="v3-hempty" role="status">
          <Icon name="search" size="2xl" />
          <b>לא נמצאו רשומות</b>
          {q && hasMore && onServerSearch ? <Btn variant="secondary" size="sm" icon="search" onClick={() => onServerSearch(q.trim())}>חיפוש בכל ההיסטוריה</Btn> : null}
          <Btn variant="secondary" size="sm" icon="x" onClick={() => { setQ(''); setSel([]); }}>נקה סינון</Btn>
        </div>
      ) : days.map((g) => {
        let idx = 0;
        return (
          <section className="v3-hgrp" key={g.day} aria-label={dayTitle(g.day)}>
            <div className="v3-hday"><b>{dayTitle(g.day)}</b><small><bdi>{gregOf(g.day)}</bdi></small></div>
            {g.entries.map((e) => (
              <Entry key={e.id} e={e} i={idx++} words={words} open={isOpen(e)} showEntity={showEntity} canRaw={canShowAll && showNoise} onUndo={onUndo}
                onToggle={() => setOpenMap((m) => ({ ...m, [e.id]: !isOpen(e) }))} />
            ))}
          </section>
        );
      })}

      {(hasMore || (total && rows && total > rows.length)) ? (
        <div className="v3-hmore">
          <span>מוצגות <bdi>{rows.length}</bdi>{total ? <> מתוך <bdi>{total}</bdi></> : null} רשומות</span>
          {q && onServerSearch ? <Btn variant="quiet" size="sm" icon="search" onClick={() => onServerSearch(q.trim())}>חיפוש בכל ההיסטוריה</Btn> : null}
          {onLoadMore ? <Btn variant="secondary" size="sm" icon="refresh" loading={loadingMore} onClick={onLoadMore}>טעינת עוד</Btn> : null}
        </div>
      ) : null}
    </div>
  );
}
