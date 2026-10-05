'use client';

// החיפוש החכם בתוך כרטיס (בית 1/4/16/17/18/43/44/45/53): שיחה, העתקה, פתיחת הגדרה, "פתיחת עמוד",
// טבלת תוצאות (רשימה/טבלה), הורד/הדפס הכל, ושאלת המשך בתוך הכרטיס. הלוגיקה של הקריאה ל-/api/ai
// נמצאת ב-HomeA5 (כמו הדף הישן); כאן רק תצוגה.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Ic, ViewSwitch, XlButtons, MoreButton, ResultsTable, Dash, PrintGlyph, DownloadGlyph } from './HomeParts';
import { rowColumns, aiRowView, aiRowKind, aiRowHref, richSegments, cellText, chatCopyText } from './homeLogic';

const AI_LIMIT = 15;

function RichText({ text, onCopy }) {
  return richSegments(text).map((s, i) => {
    if (s.type === 'copy') {
      return (
        <button key={i} type="button" className="cpy" aria-label={`העתקת ${s.value}`} data-tip="לחיצה מעתיקה" onClick={() => onCopy(s.value)}>
          {s.value}<Ic id="file" />
        </button>
      );
    }
    if (s.type === 'link') return <Link key={i} className="lnk" href={s.href}>{s.value}</Link>;
    return <span key={i}>{s.value}</span>;
  });
}

function AiTable({ m, table, onTable, onExport }) {
  const [more, setMore] = useState(false);
  const rows = m.rows;
  const cols = rowColumns(rows);
  const shown = more ? rows : rows.slice(0, AI_LIMIT);
  const head = (
    <div className="xlrow xlrow2">
      <ViewSwitch table={table} onChange={onTable} />
      <div className="bub-acts aixl">
        <XlButtons onExcel={() => onExport('excel', m)} onPrint={() => onExport('print', m)} onPdf={() => onExport('pdf', m)} />
      </div>
    </div>
  );
  const moreBtn = rows.length > AI_LIMIT ? <MoreButton open={more} extra={rows.length - AI_LIMIT} onToggle={() => setMore((v) => !v)} /> : null;
  if (table) {
    const records = shown.map((r) => ({ url: aiRowHref(r), cells: [aiRowKind(r)[0], ...cols.map((k) => cellText(r[k]))] }));
    return (
      <>
        {head}
        <ResultsTable
          columns={['סוג', ...cols]}
          records={records}
          linkCol={1}
          renderCell={(c, j) => (j === 0 ? <span className="chip rtype">{c}</span> : c ? <bdi>{c}</bdi> : <Dash />)}
        />
        {moreBtn}
      </>
    );
  }
  return (
    <>
      {head}
      <div className="list mt" aria-label="תוצאות">
        {shown.map((r, i) => {
          const v = aiRowView(r);
          const k = aiRowKind(r);
          const href = aiRowHref(r);
          const inner = (
            <>
              <div className="ic-b"><Ic id={k[1]} /><span className="rlbl">{k[0]}</span></div>
              <div className="t"><b>{v.title}</b><span className="ln">{v.parts.map((p, pi) => <span key={pi}>{pi ? ' · ' : ''}{p.k} <bdi>{p.v}</bdi></span>)}</span></div>
              <Ic id="chev" size="sm" className="go" />
            </>
          );
          return href
            ? <Link key={i} className="li rlink lrow" href={href}>{inner}</Link>
            : <div key={i} className="li rlink lrow">{inner}</div>;
        })}
      </div>
      {moreBtn}
    </>
  );
}

function CopyMessageButton({ message }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className="ibtn cpm"
      aria-label={done ? 'הועתק' : 'העתקת ההודעה'}
      data-tip="העתקה"
      onClick={async () => {
        try { await navigator.clipboard.writeText(chatCopyText(message)); } catch { /* אין הרשאת לוח */ }
        setDone(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1500);
      }}
    >
      <Ic id={done ? 'check' : 'copy'} size="sm" />
    </button>
  );
}

// הכותרת הצפה של חיפוש חכם (כמו בדף הדמו, "חלון החיפוש החכם: כשהכותרת צפה בגלילה, 'חיפוש חכם' עולה לשורת הכפתורים"):
// כשכותרת כרטיס השיחה יוצאת מתחת לסרגל העליון מופיע עותק מכווץ שלה (position:fixed) 8px מתחת לסרגל, צר ב-34px מכל צד, והוא נעלם בסוף הכרטיס.
// העותק יושב ישירות ב-body (דרך portal): אבות עם transform/backdrop-filter (הכרטיס עצמו) הופכים position:fixed ליחסי להם.
// שני עוטפים עם display:contents (בלי קופסה, לא משנים את פריסת הדף ולא מוסיפים את ה-min-height/רקע של .gm-ds): החיצוני gm-ds gm-home והפנימי advp aiw,
// כי כלל הפלטה הוא .gm-ds.gm-home .advp.aiw>.card-h.aibar (צאצא, לא אותו אלמנט).
const FLOAT_WRAP_STYLE = { display: 'contents' };

function FloatingTitle({ headRef, cardRef, watch, onClose, onThread }) {
  const [mounted, setMounted] = useState(false);
  const barRef = useRef(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return undefined;
    let raf = 0;
    const upd = () => {
      raf = 0;
      const bar = barRef.current, ch = headRef.current, card = cardRef.current;
      if (!bar || !ch || !card) return;
      const cr = card.getBoundingClientRect(), hr = ch.getBoundingClientRect();
      const nav = document.querySelector('.snav');
      const nb = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
      const inset = 14, side = 34, bh = bar.offsetHeight || 52;
      bar.style.width = Math.max(0, hr.width - side * 2) + 'px'; // צרה מהכותרת הרגילה, עם שוליים סימטריים
      // בדפי RTL פס הגלילה משמאל, ולכן left של fixed נמדד מקצה אחר מזה של getBoundingClientRect: מודדים את ההפרש בפועל ומקזזים
      bar.style.left = '0px';
      bar.style.left = (hr.left + side - bar.getBoundingClientRect().left) + 'px';
      bar.style.top = Math.min(nb + 8, cr.bottom - bh - inset) + 'px';
      bar.classList.toggle('on', hr.bottom < nb + 4 && cr.bottom > nb + bh + inset + 8);
    };
    const sched = () => { if (!raf) raf = requestAnimationFrame(upd); };
    upd();
    window.addEventListener('scroll', sched, { passive: true });
    window.addEventListener('resize', sched);
    const ro = typeof ResizeObserver !== 'undefined' && cardRef.current ? new ResizeObserver(sched) : null;
    if (ro) ro.observe(cardRef.current);
    return () => { window.removeEventListener('scroll', sched); window.removeEventListener('resize', sched); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [mounted, headRef, cardRef, watch]);
  if (!mounted) return null;
  return createPortal(
    <div className="gm-ds gm-home" style={FLOAT_WRAP_STYLE} data-ai-float="">
      <div className="advp aiw" style={FLOAT_WRAP_STYLE}>
        <div className="card-h aibar" ref={barRef}>
          <button type="button" className="ibtn" aria-label="סגירת השיחה" data-tip="סגירה" onClick={onClose}><Ic id="x" size="sm" /></button>
          <h2>חיפוש חכם</h2>
          <button type="button" className="ibtn hdx hdd" aria-label="הורד הכל" data-tip="הורד הכל" onClick={() => onThread('download')}><DownloadGlyph /></button>
          <button type="button" className="ibtn hdx hdp" aria-label="הדפס הכל" data-tip="הדפס הכל" onClick={() => onThread('print')}><PrintGlyph /></button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function HomeChat({ chat, loading, table, onTable, onClose, onFollowUp, onExport, onThread, onCopyValue, onOpenSetting, onOpenRoute }) {
  const [fu, setFu] = useState('');
  const endRef = useRef(null);
  const cardRef = useRef(null);
  const headRef = useRef(null);
  const fuRef = useRef(null);
  useEffect(() => {
    if (endRef.current && chat.length > 1) endRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat.length]);

  return (
    <div className="card res-one advp aiw" ref={cardRef}>
      <div className="card-h" ref={headRef}>
        <button type="button" className="ibtn" aria-label="סגירת השיחה" data-tip="סגירה" onClick={onClose}><Ic id="x" size="sm" /></button>
        <h2 id="ai-h">חיפוש חכם</h2>
        <button type="button" className="ibtn hdx hdd" aria-label="הורד הכל" data-tip="הורד הכל" onClick={() => onThread('download')}><DownloadGlyph /></button>
        <button type="button" className="ibtn hdx hdp" aria-label="הדפס הכל" data-tip="הדפס הכל" onClick={() => onThread('print')}><PrintGlyph /></button>
      </div>
      <div className="chat" aria-live="polite">
        {chat.map((m, i) => (
          <div key={i} className={`bub ${m.me ? 'me' : 'bot'}${m.err ? ' err' : ''}`}>
            <span className="who"><Ic id={m.me ? 'user' : m.err ? 'alert' : 'sparkle'} size="sm" />{m.me ? 'אני' : 'תשובה'}<CopyMessageButton message={m} /></span>
            <p>{m.me ? m.t : <RichText text={m.t} onCopy={onCopyValue} />}</p>
            {m.link && m.linkRoute && (
              <div className="bub-acts"><button type="button" className="lrow" data-open="עמוד" onClick={() => onOpenRoute(m.linkRoute)}><Ic id="ext" size="sm" />פתיחת {m.link}</button></div>
            )}
            {m.setting && (
              <div className="bub-acts"><button type="button" className="lrow" onClick={() => onOpenSetting(m.setting)}><Ic id="gear" size="sm" />פתיחת ההגדרה</button></div>
            )}
            {m.rows && m.rows.length > 0 && <AiTable m={m} table={table} onTable={onTable} onExport={onExport} />}
          </div>
        ))}
        {loading && <div className="typing" role="status" aria-label="החיפוש החכם כותב תשובה"><span /><span /><span /></div>}
        <div ref={endRef} />
      </div>
      <form
        className="fu fu-in"
        aria-label="שאלת המשך"
        onSubmit={(e) => {
          e.preventDefault();
          const q = fu.trim();
          if (!q || loading) return;
          setFu('');
          onFollowUp(q);
        }}
      >
        <div className="scan">
          <button type="button" className="ibtn" aria-label="ניקוי הטקסט" data-tip="ניקוי הטקסט" hidden={!fu} onClick={() => { setFu(''); if (fuRef.current) fuRef.current.focus(); }}><Ic id="x" /></button>
          <label className="sr-only" htmlFor="fuQ">שאלת המשך</label>
          <input id="fuQ" ref={fuRef} value={fu} onChange={(e) => setFu(e.target.value)} placeholder="שאלת המשך…" disabled={loading} autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" />
          <button type="submit" className="btn primary" aria-label="שליחה" data-tip="שליחה" disabled={loading}><Ic id="send" /></button>
        </div>
      </form>
      <FloatingTitle headRef={headRef} cardRef={cardRef} watch={chat.length + (loading ? 1 : 0)} onClose={onClose} onThread={onThread} />
    </div>
  );
}
