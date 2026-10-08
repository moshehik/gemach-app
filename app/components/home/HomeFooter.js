'use client';

// תחתית האתר (ניווט 5/46 footer.site-foot, 110/123 nav.sf-col, 40/111 sf-meta) + חלון מדיניות הפרטיות
// (חלון 18/20 div.dlg + חלון 9/10 scrim). קישורי התחתית לפי מה שמותר למשתמשת (footerGroups ב-homeLogic).
// החלון נפתח מהקישור "מדיניות פרטיות" בעמודה "החשבון שלי" ונסגר ב-Escape / לחיצה על הרקע / "הבנתי".

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Ic } from './HomeParts';
import { PRIVACY_TITLE, PRIVACY_SUB, buildPrivacySections } from './privacyPolicyText';
import { hebrewVersionStamp } from '@/lib/hebrewStamp';

const LINK_ICON = { landing: 'home', orders: 'file', customers: 'users', dresses: 'dress', dashboard: 'wallet', guide: 'info', report: 'alert', profile: 'user', display: 'sun' };

// כפתור "דיווח על תקלה" של הסרגל החדש (MenuA5Shell: button#snErr[data-sn-err]). בדף הבית עם סרגל ישן אין לו כפתור כזה -
// אז הפריט מוצג "בקרוב" (לא קישור) במקום כפתור שלא עושה כלום.
const REPORT_SELECTOR = '[data-sn-err]';

function SoonItem({ link }) {
  // שורה כבויה: span (לא <a> ולא <button>), בלי tabindex, בלי href - לעולם לא מובילה לשום מקום.
  return (
    <span className="sf-soon" aria-disabled="true">
      <Ic id={LINK_ICON[link.key] || 'file'} size="sm" />{link.label}<span className="sf-badge">בקרוב</span>
    </span>
  );
}

export function HomeFooter({ groups, name, version, date, onPrivacy }) {
  const [canReport, setCanReport] = useState(false);
  useEffect(() => { setCanReport(!!document.querySelector(REPORT_SELECTOR)); }, []);
  const openReport = () => { const b = document.querySelector(REPORT_SELECTOR); if (b) b.click(); };
  const stamp = hebrewVersionStamp(date);
  return (
    <footer className="site-foot" role="contentinfo">
      <div className="sf-in">
        {groups.filter((g) => g.links.length > 0 || g.privacy).map((g) => (
          <nav key={g.h} className="sf-col" aria-label={g.h}>
            <h3>{g.h}</h3>
            {g.links.map((l) => {
              if (l.action === 'report') {
                return canReport
                  ? <button key={l.key} type="button" className="lnk" onClick={openReport}><Ic id={LINK_ICON[l.key]} size="sm" />{l.label}</button>
                  : <SoonItem key={l.key} link={l} />;
              }
              if (l.soon || !l.href) return <SoonItem key={l.key} link={l} />;
              if (l.newTab) return <a key={l.key} href={l.href} target="_blank" rel="noopener"><Ic id={LINK_ICON[l.key] || 'file'} size="sm" />{l.label}</a>;
              return <Link key={l.key} href={l.href}><Ic id={LINK_ICON[l.key] || 'file'} size="sm" />{l.label}</Link>;
            })}
            {g.privacy && (
              <button type="button" className="lnk" onClick={onPrivacy}><Ic id="shield" size="sm" />מדיניות פרטיות</button>
            )}
          </nav>
        ))}
      </div>
      <div className="sf-meta">
        <b><Ic id="dress" size="sm" />{name || 'גמ״ח שמלות'}</b>
        {version ? <span>{`גרסה ${version}`}</span> : null}
        {stamp ? <span>{stamp}</span> : null}
      </div>
    </footer>
  );
}

// settings = הגדרות הארגון מ-/api/a5/boot: gmach_name (שם הגוף המשפטי) ו-gmach_phone (שורת הפנייה) - נבנה בזמן ההצגה, לא קשיח לכל גמ"ח.
// תאריך העדכון בנוסח הוא קבוע (POLICY_UPDATED ב-privacyPolicyText.js), לא תאריך הפריסה.
export function PrivacyDialog({ onClose, settings }) {
  const sections = useMemo(() => buildPrivacySections({
    legalName: settings && settings.gmach_name,
    phone: settings && settings.gmach_phone,
  }), [settings]);
  const boxRef = useRef(null);
  const closeRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    lastFocus.current = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !boxRef.current) return;
      // מלכודת מיקוד בתוך החלון
      const f = [...boxRef.current.querySelectorAll('button:not([disabled]),a[href]')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!boxRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const prev = lastFocus.current;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [onClose]);

  return (
    <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} className="dlg priv-dlg" role="dialog" aria-modal="true" aria-labelledby="pv-t">
        <h2 id="pv-t">{PRIVACY_TITLE}</h2>
        <div className="sub">{PRIVACY_SUB}</div>
        <div className="priv-body">
          {sections.map((sec) => (
            <section key={sec.h}>
              <h3>{sec.h}</h3>
              {sec.ul && <ul>{sec.ul.map((li) => <li key={li}>{li}</li>)}</ul>}
              {sec.p && <p>{sec.p}</p>}
            </section>
          ))}
        </div>
        <div className="dbtns">
          <button ref={closeRef} type="button" className="btn primary lg block" onClick={onClose}><Ic id="check" />הבנתי</button>
        </div>
      </div>
    </div>
  );
}
