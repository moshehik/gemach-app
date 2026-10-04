'use client';

// "מסך ניהול ראשי" (/admin) — עיצוב מאושר: תצוגות-עיצוב/ניהול-ראשי-כרטיסים.html (4.10.2026), רכיבי פלטה בלבד
// (design-system/COMPONENTS.md) בתוך .gm-ds.gm-adm, כמו "הפרופיל שלי". החלטות הבעלים (answers-admin-cards.json):
// שורת חיפוש בלי מונה, מתג תצוגה שורות / טבלה / אריחים עם ברירת מחדל אריחים (הבחירה נזכרת לכל משתמש בנפרד),
// 9 קטגוריות עם תגית קטגוריה בכל שורה. הקטלוג והשערים: lib/adminHub.js; מה מוצג נקבע בשרת (app/admin/page.js).
// כל רכיב כאן קיים בעיצוב: סרגל .hf-bar + .hf-s + .vsw.v3, כרטיס .card.items-card עם שורות .hres > .hgrp > article.hrow.irow >
// a.li.rlink.lrow, טבלה .tblw > table.rtbl עם .trl, אריחים a.creditile.adm-tile, ומצב ריק .empty.

import '@/design-system/components.css';
import './admin-hub.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { HomeSprite } from '../home/HomeParts';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import usePageTooltip from '../profile/usePageTooltip';
import { VIEWS, VIEW_LABELS, VIEW_ICONS, DEFAULT_VIEW, normalizeView, viewStorageKey, groupTools } from '@/lib/adminHub';

// אייקון מה-sprite המוטמע. plain = בתוך רכיב עם data-ico (לחצני המתג / ניקוי), שם האנימציה היא של הלחצן ולא של האייקון — כמו בעיצוב.
function Ic({ id, size, plain }) {
  const cls = `ic${plain ? '' : ` ia-${id} ia-h`}${size ? ` ${size}` : ''}`;
  return (
    <svg className={cls} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>
  );
}

function readView(key) {
  try {
    const v = window.localStorage.getItem(key);
    return normalizeView(v);
  } catch {
    return DEFAULT_VIEW;
  }
}

function RowsCard({ category, tools }) {
  return (
    <div className="card items-card adm-rows">
      <div className="card-h">
        <span className="ico rose"><Ic id={category.icon} /></span>
        <h2>{category.title}</h2>
      </div>
      <div className="hres">
        <div className="hgrp">
          {tools.map((t) => (
            <article className="hrow irow" key={t.id}>
              <Link className="li rlink lrow" href={t.href} data-element-name={`כפתור_admin_${t.id}`}>
                <div className="ic-b"><Ic id={t.icon} /><span className="rlbl">{category.tag}</span></div>
                <div className="t"><b>{t.title}</b><span className="ln">{t.desc}</span></div>
                <span className="go" aria-hidden="true"><Ic id="arrl" size="sm" /></span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolsTable({ tools }) {
  return (
    <div className="tblw adm-table">
      <table className="rtbl">
        <thead><tr><th>כלי</th><th>תיאור</th><th className="tc" /></tr></thead>
        <tbody>
          {tools.map((t) => (
            <tr key={t.id}>
              <td><Link className="trl adm-trl" href={t.href} data-element-name={`כפתור_admin_${t.id}`}><Ic id={t.icon} size="sm" />{t.title}</Link></td>
              <td>{t.desc}</td>
              <td className="tc"><Ic id="arrl" size="sm go" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tiles({ tools }) {
  return (
    <div className="adm-tiles">
      {tools.map((t) => (
        <Link className="creditile adm-tile" href={t.href} key={t.id} data-element-name={`כפתור_admin_${t.id}`}>
          <span className="ico rose"><Ic id={t.icon} /></span>
          <div className="adm-tt"><b>{t.title}</b><small>{t.desc}</small></div>
        </Link>
      ))}
    </div>
  );
}

export default function AdminHubPage({ toolIds, userKey }) {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const inputRef = useRef(null);
  const storageKey = viewStorageKey(userKey);
  const [view, setView] = useState(() => readView(storageKey));
  const [query, setQuery] = useState('');

  // הטולטיפ של המעטפת האחידה (A5) מאזין רק לאזור הכותרת ולא לתוכן הדף - הדף מטפל בטולטיפים שלו תמיד (כמו הפרופיל)
  usePageTooltip(rootRef, ttRef, false);

  // משתמש אחר באותו דפדפן (החלפת משתמש בלי רענון): קוראים שוב את הבחירה שלו
  useEffect(() => { setView(readView(storageKey)); }, [storageKey]);

  const groups = useMemo(() => groupTools(toolIds, query), [toolIds, query]);

  const pickView = (v) => {
    setView(v);
    try { window.localStorage.setItem(storageKey, v); } catch { /* מצב פרטי / אחסון חסום: הבחירה נשארת רק לביקור הזה */ }
  };
  const clear = () => { setQuery(''); if (inputRef.current) inputRef.current.focus(); };

  return (
    <div className="gm-ds gm-adm home-bg" ref={rootRef} dir="rtl">
      <HomeSprite />
      <div className="app adm-app">
        <div className="topbar"><div className="ttl"><h1 className="pg-ttl"><small>הנהלה</small><bdi>מסך ניהול ראשי</bdi></h1></div></div>

        <div className="hf-bar adm-bar">
          <div className="hf-s">
            <Ic id="search" />
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder="חיפוש כלי ניהול"
              aria-label="חיפוש כלי ניהול"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              data-element-name="שדה_admin_search"
              data-lpignore="true"
              data-1p-ignore
              data-form-type="other"
            />
            <button type="button" className={`hf-cl${query ? ' on' : ''}`} onClick={clear} aria-label="ניקוי חיפוש" data-ico="x" data-tip="ניקוי חיפוש">
              <Ic id="x" plain />
            </button>
          </div>
          <div className={`vsw v3${view === 'table' ? ' t' : ''}${view === 'tiles' ? ' c' : ''}`} role="group" aria-label="מצב תצוגה">
            <span className="vknob" aria-hidden="true" />
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                className={`vopt${view === v ? ' on' : ''}`}
                aria-pressed={view === v}
                aria-label={`תצוגת ${VIEW_LABELS[v]}`}
                data-tip={VIEW_LABELS[v]}
                data-ico={VIEW_ICONS[v]}
                data-view={v}
                onClick={() => pickView(v)}
              >
                <Ic id={VIEW_ICONS[v]} plain />
              </button>
            ))}
          </div>
        </div>

        <div id="admSecs" className={`v-${view}`}>
          {groups.map(({ category, tools }) => (
            <section className="adm-sec" aria-label={category.title} key={category.id} data-cat={category.id}>
              <h2 className="adm-h"><span className="adm-hi"><Ic id={category.icon} /></span>{category.title}</h2>
              {view === 'rows' ? <RowsCard category={category} tools={tools} /> : null}
              {view === 'table' ? <ToolsTable tools={tools} /> : null}
              {view === 'tiles' ? <Tiles tools={tools} /> : null}
            </section>
          ))}
        </div>
        {groups.length === 0 ? (
          <div className="empty"><Ic id="search" size="lg" /><div>לא נמצאו כלים התואמים לחיפוש</div></div>
        ) : null}
      </div>
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}
