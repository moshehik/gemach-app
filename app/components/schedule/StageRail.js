'use client';

import { useState } from 'react';
import ScheduleIcon from './ScheduleIcon';
import { STAGE_META, STAGE_ORDER } from './scheduleMeta';

// ציר שלבי היום (צד ימין) - כמו renderTL בעיצוב (לוז-יומי.html, שורות 1633, 1956-1971): כותרת "שלבי היום", שורת
// הברקוד (ניווט 48, S05/D2), ואז "הכל" + שורה לכל שלב: אייקון עם מונה "לביצוע" ורוד על הפינה, שם השלב, משולש
// התראות, חץ. לחיצה = סינון לשלב. שלב בלי פריטים מעומעם (fut) עם הטקסט "אין פעולות" (l1 בעיצוב, שורה 1963).
// אין בציר "מי במשמרת": המיקום שהבעלים אישר ל-B02 הוא טולטיפ על שבב המשמרת בסרגל העליון, לא רכיב בציר.
//
// חוזה לסוכן הברקוד/הסימון: onScan(code) נקרא ב-Enter בשדה הברקוד. בלי handler השדה מרונדר כבוי (disabled) באותו מראה.
export default function StageRail({ data, loading, filter, onFilter, onScan }) {
  const [code, setCode] = useState('');
  const byKey = {};
  if (data) data.stages.forEach((s) => { byKey[s.key] = s; });
  // שלבים כבויים (משלוחים כבויים בגמ״ח הראשי, תיקונים כבויים) לא מוצגים בכלל
  const keys = data ? STAGE_ORDER.filter((k) => byKey[k] && byKey[k].enabled) : STAGE_ORDER;
  const allTotal = data ? keys.reduce((a, k) => a + byKey[k].counts.total, 0) : 0;
  function scanKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = code.trim();
    if (!v) return;
    setCode('');
    if (onScan) onScan(v);
  }
  return (
    <aside className="rail lz-rail" aria-label="שלבי התהליך">
      <div className={'st-sidenav lz-snav' + (loading ? ' lz-loading' : '')}>
        <div className="lz-rh">שלבי היום</div>
        <div className="sbar" id="sbar">
          <div className="inpw">
            <ScheduleIcon name="scan" />
            <input
              className="inp"
              id="scanIn"
              name="barcode-nofill"
              placeholder=""
              aria-label="הקלדת ברקוד: סרקו או הקלידו קוד לסימון בוצע"
              data-tip="ברקוד"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore=""
              data-form-type="other"
              disabled={!onScan}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={scanKey}
            />
          </div>
        </div>
        <nav className="st-stabs" aria-label="סינון לפי שלב">
          <button
            type="button"
            className={'st-stab lz-stab' + (!filter ? ' on' : '')}
            aria-pressed={!filter}
            onClick={() => onFilter(null)}
            data-tip="הצגת כל השלבים"
          >
            <span className="st-sic"><ScheduleIcon name="rows" /></span>
            <span className="st-slb">
              <span className="lz-nm">הכל</span>
              {data ? <small>{allTotal} פריטים</small> : null}
            </span>
            <span className="st-sgo"><ScheduleIcon name="chev" className="sm" /></span>
          </button>
          {keys.map((k) => {
            const meta = STAGE_META[k];
            const s = byKey[k];
            const isInfo = meta.info;
            const total = s ? s.counts.total : 0;
            const done = s ? s.counts.done : 0;
            const alerts = s ? s.counts.alerts : 0;
            const cnt = isInfo ? total : total - done;
            let line = '';
            if (s) {
              if (!total) line = 'אין פעולות';
              else if (isInfo) line = total + ' ' + s.plural;
              else line = 'לביצוע ' + total + ' · בוצע ' + done;
            }
            const label = s ? s.label : meta.label;
            const tip = s ? label + ': ' + line + (alerts ? ' · ' + alerts + ' התראות' : '') + (s.shiftLabel ? ' · משמרת ' + s.shiftLabel : '') + ' · לחיצה לסינון' : label;
            const showBadge = !!(s && total);
            return (
              <button
                key={k}
                type="button"
                className={'st-stab lz-stab' + (s && !total ? ' fut' : '') + (filter === k ? ' on' : '')}
                style={{ '--pc': 'var(' + meta.color + ')' }}
                aria-pressed={filter === k}
                onClick={() => onFilter(k)}
                data-tip={tip}
              >
                <span className="st-sic">
                  <ScheduleIcon name={meta.icon} />
                  {showBadge ? (
                    <span
                      className={'sn-badge lz-rem' + (cnt ? '' : ' z')}
                      role="img"
                      aria-label={isInfo ? cnt + ' ' + s.plural : 'נותרו ' + cnt + ' לביצוע'}
                    >{cnt}</span>
                  ) : null}
                </span>
                <span className="st-slb">
                  <span className="lz-nm">{label}</span>
                  {s && !showBadge ? <small>{line}</small> : null}
                </span>
                {alerts ? <span className="sn-badge lz-al2" role="img" aria-label={alerts + ' התראות'}>{alerts}</span> : null}
                <span className="st-sgo"><ScheduleIcon name="chev" className="sm" /></span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
