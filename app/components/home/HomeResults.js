'use client';

// תוצאות החיפוש הכללי: רשימה מאוחדת אחת (הזמנות, שורות מלאי, לקוחות, פריטים) עם "עוד N", מתג שורות/טבלה,
// וייצוא/הדפסה/הורדה. בית 42 (card.res-one), 13 (vbar), 18/19/20 (hrow...), טבלה rtbl. החלטת הבעלים:
// ברירת המחדל = הרשימה המאוחדת (לא שלושה כרטיסים).
// 5.10.2026: הזמנות לפני לקוחות (מס' הזמנה מדויק תמיד ראשון), שורת פריט בשתי שורות בדיוק (כותרת = ברקוד + מצב; שורה קטנה = הזמנה, לקוחה, תאריך עברי),
// שורת "מלאי" לברקוד / מילות מפתח (פרטי הפריט + כל המידות של הדגם, בלי קישור למי שאין לה הרשאה), צ'יפים של הלו"ז ליום שהוקלד,
// הדגשת מה שהוקלד, וניווט חצים בין השורות (חץ למטה משורת החיפוש).

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { Ic, ViewSwitch, XlButtons, MoreButton, ResultsTable, Dash } from './HomeParts';
import { unifiedRows, tableRecords, TABLE_COLUMNS, highlightParts, highlightQuery } from './homeLogic';

const LIMIT = 8;

// טקסט עם הדגשת התאמה (<mark>); בלי שאילתה / בלי התאמה - הטקסט כמו שהוא
function Hl({ text, q }) {
  const parts = highlightParts(text, q);
  if (parts.length === 1 && !parts[0][1]) return parts[0][0];
  return parts.map(([t, m], i) => (m ? <mark key={i}>{t}</mark> : <Fragment key={i}>{t}</Fragment>));
}

function Stx({ s }) {
  return <span className={`stx ${s.cls}`}><Ic id={s.icon} />{s.label}</span>;
}

// שורה קטנה אחת מרכיבי טקסט (מפרידה ב"·"); רכיב ריק נשמט
function Parts({ items }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return <span className="ln">{shown.map((p, i) => <Fragment key={i}>{i ? ' · ' : null}{p}</Fragment>)}</span>;
}

function InvBody({ inv }) {
  const own = inv.size ? <>מידה <bdi>{inv.size}</bdi></> : null;
  const head = inv.type === 'barcode'
    ? [inv.barcode ? <>ברקוד <bdi dir="ltr">{inv.barcode}</bdi></> : null, inv.modelCode !== '' ? <>דגם <bdi dir="ltr">{inv.modelCode}</bdi></> : null, own,
      inv.serial !== '' ? <>מס׳ סידורי <bdi dir="ltr">{inv.serial}</bdi></> : null, inv.location ? <>מיקום <bdi>{inv.location}</bdi></> : null]
    : [inv.modelCode !== '' ? <>דגם <bdi dir="ltr">{inv.modelCode}</bdi></> : null];
  return (
    <>
      <b>{inv.modelName || 'דגם'}{inv.status ? <span className={`stx ${inv.status === 'מושכר' ? '' : inv.status === 'פנוי' ? 'ok' : 'warn'}`}>{inv.status}</span> : null}</b>
      <Parts items={head} />
      {inv.itemMissing ? <span className="ln">הברקוד לא נמצא במלאי; הדגם נקבע לפי קידומת הברקוד</span> : null}
      <span className="ln invs" aria-label={`זמינות ל${inv.dateLabel}`}>
        <span className="invd">זמינות ל{inv.dateLabel}:</span>
        {inv.sizes.length === 0 ? <span className="chip">אין מידות במלאי</span> : inv.sizes.map((s, i) => (
          <span key={i} className={`chip invz${s.own ? ' gold' : s.available === 0 ? ' rose' : ''}`} data-tip={`סה״כ ${s.total} · מוזמנות ${s.booked} · פנויות ${s.available}`}>
            <b>{s.size}</b> <bdi>{s.available}/{s.total}</bdi>
          </span>
        ))}
      </span>
    </>
  );
}

function RowBody({ r, hq }) {
  if (r.kind === 'לקוח') {
    return (
      <>
        <b><Hl text={r.title} q={hq} /></b>
        <span className="ln">{r.phone ? <bdi dir="ltr">{r.phone}</bdi> : 'אין טלפון'} · {r.city || 'אין עיר'}</span>
      </>
    );
  }
  if (r.kind === 'הזמנה') {
    return (
      <>
        <b><Hl text={r.title} q={hq} /></b>
        <span className="ln">
          הזמנה <bdi>#<Hl text={String(r.orderId)} q={hq} /></bdi> · {r.eventHeb || 'אין תאריך אירוע'} · <Stx s={r.status} />
        </span>
      </>
    );
  }
  if (r.kind === 'מלאי') return <InvBody inv={r.inv} />;
  // פריט: בדיוק שתי שורות (5.10.2026). כותרת = הברקוד + מצב הפריט; שורה קטנה = הזמנה, שם מלא של הלקוחה, תאריך אירוע עברי. חלק שחסר בנתונים ישנים פשוט לא מוצג.
  return (
    <>
      <b className="rt"><bdi dir="ltr"><Hl text={r.title} q={hq} /></bdi>{r.status ? <Stx s={r.status} /> : null}</b>
      <Parts items={[r.orderId ? <>הזמנה <bdi>#<Hl text={String(r.orderId)} q={hq} /></bdi></> : null, r.customer ? <bdi><Hl text={r.customer} q={hq} /></bdi> : null, r.eventHeb || null]} />
    </>
  );
}

// הלו"ז ליום שהוקלד: צ'יפ לכל שלב שיש בו פריטים באותו יום (הכנה, משלוח הלוך, איסוף, החזרה, תיקונים...). השרת שלח את זה רק למי שיש לה page:schedule,
// ולכן הצ'יפים תמיד קישורים ל-/schedule?date=... (בלי הרשאה לא מגיע כלום).
function DateChips({ d }) {
  return (
    <div className="dchips" aria-label="הלו״ז ליום שהוקלד">
      <div className="dchips-h">
        <Ic id="cal" size="sm" />
        <b>לו״ז ליום {d.dateHebrew}</b>
        {d.weekday ? <span className="muted">({d.weekday})</span> : null}
        {d.nonWorkingDay ? <span className="chip amber">{d.nonWorkingTitles.length ? 'לא יום עבודה · ' + d.nonWorkingTitles.join(', ') : 'לא יום עבודה'}</span> : null}
      </div>
      <div className="dchips-r">
        {d.chips.length === 0
          ? <span className="muted">אין פריטים בלו״ז ליום הזה</span>
          : d.chips.map((c) => {
            const body = <><b>{c.total}</b> {c.label}{c.alerts ? <span className="dchip-al" data-tip="יש התראות">!</span> : null}</>;
            return d.link
              ? <Link key={c.key} className={`chip btnlike${c.alerts ? ' amber' : ''}`} href={d.link} data-tip="פתיחה בלו״ז">{body}</Link>
              : <span key={c.key} className="chip">{body}</span>;
          })}
      </div>
    </div>
  );
}

export default function HomeResults({ res, none, table, onTable, onExport, note, query = '' }) {
  const [more, setMore] = useState(false);
  const rows = useMemo(() => (none ? [] : unifiedRows(res, query)), [res, none, query]);
  const records = useMemo(() => tableRecords(rows), [rows]);
  const hq = useMemo(() => highlightQuery(query), [query]);
  const chips = !none && res && res.dateChips ? res.dateChips : null;
  const notices = res && Array.isArray(res.notices) ? res.notices : []; // גם במצב "אין תוצאות" (למשל תאריך שלא קיים)
  const shown = more ? rows : rows.slice(0, LIMIT);
  const trio = rows.length
    ? (
      <div className="aixl">
        <XlButtons onExcel={() => onExport('excel')} onPrint={() => onExport('print')} onPdf={() => onExport('pdf')} />
      </div>
    )
    : null;

  // ניווט מקלדת: חצים בין השורות (כל אלמנט .lrow), Esc חוזר לשורת החיפוש. Enter על קישור פותח אותו כרגיל.
  const onListKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Escape') return;
    if (e.key === 'Escape') {
      const input = document.getElementById('sq');
      if (input) { e.preventDefault(); input.focus(); }
      return;
    }
    const items = Array.from(e.currentTarget.querySelectorAll('.lrow'));
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? items[i + 1] : items[i - 1];
    if (next) next.focus();
    else if (e.key === 'ArrowUp') { const input = document.getElementById('sq'); if (input) input.focus(); }
  };

  return (
    <div className="card res-one">
      <div className="card-h">
        <h2 id="rc-a">
          תוצאות <span className="faint">({rows.length})</span>
          <button type="button" className="tip" aria-label="עזרה" data-tip={'סטטוס ההזמנה מחושב כמו במסך ההזמנות: לפי מצב הפריטים (נלקחו / הוחזרו) ותאריך האירוע. הסכום הוא השדה הישן של ההזמנה.'}><Ic id="info" size="sm" /></button>
        </h2>
        {trio}
      </div>
      {notices.length > 0 && (
        <div role="status" aria-live="polite" data-search-notices="1">
          {notices.map((n) => (
            <div key={n.kind} className="muted" data-notice-kind={n.kind} style={{ padding: '6px 16px' }}><Ic id="info" size="sm" /> <span>{n.text}</span></div>
          ))}
        </div>
      )}
      {chips ? <DateChips d={chips} /> : null}
      {rows.length > 0 && (
        <div className="vbar"><ViewSwitch table={table} onChange={onTable} /></div>
      )}
      {rows.length === 0 ? (
        <div className="empty"><Ic id="search" size="lg" /><div>{chips ? 'אין הזמנות שהאירוע שלהן ביום הזה' : 'אין תוצאות לחיפוש הזה'}</div>{note ? <div className="muted">{note}</div> : null}</div>
      ) : (
        <>
          {table ? (
            <ResultsTable
              columns={TABLE_COLUMNS}
              records={records}
              linkCol={1}
              rowLimit={more ? 0 : LIMIT}
              renderCell={(c, j) => {
                if (j === 0) return <span className="chip rtype">{c}</span>;
                if (j === 2 || j === 4 || j === 5) return c ? <bdi dir="ltr">{c}</bdi> : <Dash />;
                return c ? c : <Dash />;
              }}
            />
          ) : (
            <div className="list" aria-label="תוצאות החיפוש" onKeyDown={onListKey}>
              {shown.map((r) => (r.url ? (
                <Link key={r.key} className="li rlink lrow" href={r.url}>
                  <div className="ic-b"><Ic id={r.icon} /><span className="rlbl">{r.kind}</span></div>
                  <div className="t"><RowBody r={r} hq={hq} /></div>
                  <Ic id="chev" size="sm" className="go" />
                </Link>
              ) : (
                // שורה בלי קישור (מלאי למי שאין לה הרשאה לכרטיס הדגם): אותה צורה, בלי חץ, ניתנת למיקוד כדי שמקלדת תעבור עליה
                <div key={r.key} className="li lrow nolink" tabIndex={0}>
                  <div className="ic-b"><Ic id={r.icon} /><span className="rlbl">{r.kind}</span></div>
                  <div className="t"><RowBody r={r} hq={hq} /></div>
                </div>
              )))}
            </div>
          )}
          {rows.length > LIMIT && <MoreButton open={more} extra={rows.length - LIMIT} onToggle={() => setMore((v) => !v)} />}
        </>
      )}
    </div>
  );
}
