'use client';

import ScheduleIcon from './ScheduleIcon';
import StaffOnShift from './StaffOnShift';
import { STAGE_META, STAGE_ORDER } from './scheduleMeta';

// ציר שלבי היום (צד): "הכל" + שלב לכל שורה עם מונה "לביצוע" על האייקון, משולש התראות וחץ.
// לחיצה = סינון לשלב. אין שורת ברקוד ואין שלב 3 (V1 קריאה בלבד).
export default function StageRail({ data, loading, filter, onFilter }) {
  const byKey = {};
  if (data) data.stages.forEach((s) => { byKey[s.key] = s; });
  // שלבים כבויים (משלוחים כבויים בגמ״ח הראשי, תיקונים כבויים) לא מוצגים בכלל
  const keys = data ? STAGE_ORDER.filter((k) => byKey[k] && byKey[k].enabled) : STAGE_ORDER;
  const allTotal = data ? keys.reduce((a, k) => a + byKey[k].counts.total, 0) : 0;
  return (
    <aside className="rail lz-rail" aria-label="שלבי התהליך">
      <div className={'st-sidenav lz-snav' + (loading ? ' lz-loading' : '')}>
        <div className="lz-rh">שלבי היום</div>
        {data ? <StaffOnShift staff={data.staff} /> : null}
        <nav className="st-stabs" aria-label="סינון לפי שלב">
          <button
            type="button"
            className={'st-stab lz-stab' + (!filter ? ' on' : '')}
            aria-pressed={!filter}
            onClick={() => onFilter(null)}
            title="הצגת כל השלבים"
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
            const known = !!(s && !s.infoOnly && s.doneSource);
            const cnt = isInfo ? total : total - done;
            let line = '';
            if (s) {
              if (!total) line = 'אין פעולות';
              else if (isInfo) line = total + ' ' + s.plural;
              else line = known ? 'לביצוע ' + total + ' · בוצע ' + done : 'לביצוע ' + total + ' · בוצע —';
            }
            const label = s ? s.label : meta.label;
            const tip = s ? label + ': ' + line + (alerts ? ' · ' + alerts + ' התראות' : '') + ' · לחיצה לסינון' : label;
            const showBadge = !!(s && total);
            return (
              <button
                key={k}
                type="button"
                className={'st-stab lz-stab' + (s && !total ? ' fut' : '') + (filter === k ? ' on' : '')}
                style={{ '--pc': 'var(' + meta.color + ')' }}
                aria-pressed={filter === k}
                onClick={() => onFilter(k)}
                title={tip}
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
