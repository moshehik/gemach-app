'use client';

// StationCharts - רכיבי התצוגה של מסך "המרות בעמדה": אריח מספר, משפך (עמודות אופקיות), גרף עמודות יומי, גרף קווי יומי וטבלת נתונים.
// הפלטה (design-system/) אינה מכילה גרפים; הגרפים כאן SVG / HTML קטן עם טוקני הפלטה בלבד (--gm-*), לפי כללי dataviz: ציר אחד, קווים דקים, עמודות עם קצה מעוגל,
// מקרא תמיד כשיש שתי סדרות, ערכים בתוויות ישירות, טולטיפ גם במיקוד מקלדת, תצוגת טבלה לכל גרף, וצבעי הסדרות הם שני טוקנים שאומתו (navy-500 / gold-b).
// כיוון: הצירים מימין לשמאל (היום הראשון בטווח מימין) - כיוון הקריאה בעברית. אין תאריך לועזי בשום מקום.
import { useEffect, useRef, useState } from 'react';
import { Ic } from '../settings-sim/SettingsDialogs';
import { bandAriaLabel, dayBands, deltaInfo, fmtAvg, fmtInt, fmtPct, labelStride, niceScale } from './chartLogic';

/* ----------------------------------------------------------------- אריח מספר */

function Delta({ info, label }) {
  if (!info) return <span className="sa-cmp"><span className="sa-cmp-l">{label}</span><b>—</b></span>;
  const arrow = info.dir === 'up' ? 'M2 7l4-4 4 4' : info.dir === 'down' ? 'M2 5l4 4 4-4' : 'M2 6h8';
  const word = info.dir === 'up' ? 'עלייה של' : info.dir === 'down' ? 'ירידה של' : '';
  return (
    <span className={`sa-delta sa-${info.dir}`}>
      <svg className="sa-arr" viewBox="0 0 12 12" aria-hidden="true"><path d={arrow} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="sr-only">{word} </span>{info.text}
      <span className="sa-delta-l"> {label}</span>
    </span>
  );
}

/**
 * אריח סיכום: ערך ראשי + שתי שורות השוואה (אתמול / ממוצע שבועי). unmeasured = השלב לא נמדד בערוץ הזה (מוצג "—" והסבר, לא 0).
 * kind: 'count' | 'rate'.
 */
export function StatTile({ icon, label, value, yesterday, weekAvg, kind = 'count', unmeasured = false, note = '', extra = '' }) {
  const fmt = kind === 'rate' ? fmtPct : fmtInt;
  const fmtAvgFn = kind === 'rate' ? fmtPct : fmtAvg;
  return (
    <div className={`card sa-tile${unmeasured ? ' sa-off' : ''}`} role="group" aria-label={label}>
      <div className="sa-tile-h"><span className="sa-tile-ic"><Ic id={icon} /></span><span className="sa-tile-l">{label}</span></div>
      <div className="sa-tile-v" dir="ltr"><bdi>{unmeasured ? '—' : fmt(value)}</bdi></div>
      {extra && !unmeasured ? <small className="sa-tile-x">{extra}</small> : null}
      {unmeasured ? <small className="sa-tile-n">{note || 'נמדד רק בקישור הכללי'}</small> : (
        <div className="sa-tile-c">
          <span className="sa-cmp"><span className="sa-cmp-l">אתמול</span> <b><bdi>{fmt(yesterday)}</bdi></b> <Delta info={deltaInfo(value, yesterday, kind)} label="" /></span>
          <span className="sa-cmp"><span className="sa-cmp-l">ממוצע שבועי</span> <b><bdi>{fmtAvgFn(weekAvg)}</bdi></b> <Delta info={deltaInfo(value, weekAvg, kind)} label="" /></span>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- משפך */

/** שורות משפך: stages = [{ key, label, count|null, parent, rateFromParent, rateFromVisits }]. הרוחב ליניארי ביחס לשלב הגדול ביותר. */
export function FunnelBars({ stages, parentLabels, hasData }) {
  const max = Math.max(1, ...stages.map((s) => (typeof s.count === 'number' ? s.count : 0)));
  return (
    <ol className="sa-funnel" aria-label="משפך ההמרה">
      {stages.map((s, i) => {
        const measured = typeof s.count === 'number';
        const pct = measured ? Math.max(measured && s.count > 0 ? 1.5 : 0, (s.count / max) * 100) : 0;
        const parentName = s.parent ? parentLabels[s.parent] : '';
        return (
          <li key={s.key} className={`sa-frow${measured ? '' : ' sa-off'}`}>
            <div className="sa-frow-h">
              <span className="sa-fidx" aria-hidden="true">{i + 1}</span>
              <b className="sa-fl">{s.label}</b>
              <span className="sa-fv" dir="ltr"><bdi>{measured ? fmtInt(s.count) : '—'}</bdi></span>
            </div>
            <div className="sa-ftrack" aria-hidden="true">
              <span className="sa-fbar" style={{ width: `${hasData ? pct : 0}%` }} />
            </div>
            <div className="sa-frates">
              {!measured ? <span>לא נמדד בערוץ הזה</span> : (
                <>
                  {s.parent && s.rateFromParent !== null ? <span><b>{fmtPct(s.rateFromParent)}</b> מתוך {parentName}</span> : null}
                  {s.key !== 'visits' && s.parent !== 'visits' && s.rateFromVisits !== null ? <span><b>{fmtPct(s.rateFromVisits)}</b> מהנכנסים</span> : null}
                  {s.parent && s.rateFromParent === null ? <span>אין עדיין נתון להשוואה</span> : null}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------------------------------------------- גרפים */

function useWidth(ref, initial = 640) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => { const cw = Math.round(entries[0].contentRect.width); if (cw > 0) setW(cw); });
    ro.observe(el);
    setW(Math.max(200, Math.round(el.getBoundingClientRect().width) || initial));
    return () => ro.disconnect();
  }, [ref, initial]);
  return w;
}

const H = 230;
const PAD = { top: 14, bottom: 34, left: 10, right: 40 }; // right = ציר ה-Y (ב-RTL הציר מימין)

function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <ul className="sa-legend" aria-label="מקרא">
      {series.map((s) => <li key={s.key}><span className={`sa-key sa-s${s.slot}`} aria-hidden="true" />{s.label}</li>)}
    </ul>
  );
}

function Tooltip({ tip, wrapW }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 90), wrapW - 90);
  return (
    <div className="sa-tt" role="tooltip" style={{ left, top: tip.y }}>
      <div className="sa-tt-d">{tip.title}</div>
      {tip.rows.map((r) => (
        <div className="sa-tt-r" key={r.label}>
          <span className={`sa-key sa-s${r.slot}`} aria-hidden="true" />
          <b dir="ltr"><bdi>{r.value}</bdi></b>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * גרף עמודות יומי (מקובצות כשיש שתי סדרות). days = [{ day, label (תאריך עברי קצר), title (כותרת מלאה לטולטיפ) }]; series = [{ key, label, slot (1|2), values:number[] }].
 * onPick(dayKey) - לחיצה על יום (בורר היום של טבלת הרישומים). picked = היום הנבחר.
 */
export function DayColumns({ days, series, picked, onPick, ariaLabel, emptyText }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [tip, setTip] = useState(null);
  const allZero = series.every((s) => s.values.every((v) => !v));
  const maxV = Math.max(0, ...series.flatMap((s) => s.values));
  const scale = niceScale(maxV);
  const plotLeft = PAD.left;
  const plotRight = width - PAD.right;
  const plotW = Math.max(40, plotRight - plotLeft);
  const plotH = H - PAD.top - PAD.bottom;
  const yOf = (v) => PAD.top + plotH - (v / scale.max) * plotH;
  const bands = dayBands(days.length, plotLeft, plotW);
  const stride = labelStride(days.length, plotW);
  const gap = bands[0] && bands[0].band > 14 ? 2 : 1;
  const group = Math.min(bands[0] ? bands[0].band * 0.74 : 10, series.length * 26);
  const colW = Math.max(1.5, (group - gap * (series.length - 1)) / series.length);
  const r = Math.min(4, colW / 2);

  const show = (i) => {
    const b = bands[i];
    const wrap = wrapRef.current;
    if (!b || !wrap) return;
    const top = Math.min(...series.map((s) => yOf(s.values[i] || 0)));
    setTip({ x: b.x + b.band / 2, y: Math.max(4, top - 8), title: days[i].title, rows: series.map((s) => ({ label: s.label, slot: s.slot, value: fmtInt(s.values[i] || 0) })) });
  };

  return (
    <div className="sa-chart" ref={wrapRef}>
      <Legend series={series} />
      <div className="sa-plot" onMouseLeave={() => setTip(null)}>
        <svg width={width} height={H} role="group" aria-label={ariaLabel} className="sa-svg">
          {scale.ticks.map((t) => (
            <g key={t}>
              <line className="sa-grid" x1={plotLeft} x2={plotRight} y1={yOf(t)} y2={yOf(t)} />
              <text className="sa-ytick" x={plotRight + 8} y={yOf(t) + 4} textAnchor="start">{fmtInt(t)}</text>
            </g>
          ))}
          {bands.map((b, i) => {
            const startX = b.x + (b.band - (colW * series.length + gap * (series.length - 1))) / 2;
            const isPicked = picked && days[i].day === picked;
            const parts = series.map((s) => ({ label: s.label, value: s.values[i] || 0 }));
            return (
              <g key={days[i].day} className={`sa-band${isPicked ? ' sa-picked' : ''}`}>
                {isPicked ? <rect className="sa-pickbg" x={b.x} y={PAD.top} width={b.band} height={plotH} rx="4" /> : null}
                {series.map((s, si) => {
                  const v = s.values[i] || 0;
                  const h = v > 0 ? Math.max(2, plotH - (yOf(v) - PAD.top)) : 0;
                  // ב-RTL הסדרה הראשונה מימין לתוך הקבוצה
                  const x = startX + (series.length - 1 - si) * (colW + gap);
                  return h > 0 ? (
                    <path key={s.key} className={`sa-col sa-f${s.slot}`}
                      d={`M${x},${PAD.top + plotH} V${PAD.top + plotH - h + r} Q${x},${PAD.top + plotH - h} ${x + r},${PAD.top + plotH - h} H${x + colW - r} Q${x + colW},${PAD.top + plotH - h} ${x + colW},${PAD.top + plotH - h + r} V${PAD.top + plotH} Z`} />
                  ) : null;
                })}
                {i % stride === 0 ? <text className="sa-xtick" x={b.x + b.band / 2} y={H - 12} textAnchor="middle">{days[i].label}</text> : null}
                <rect
                  className="sa-hit" x={b.x} y={PAD.top} width={b.band} height={plotH} tabIndex={0} role="img"
                  aria-label={bandAriaLabel(days[i].title, parts)}
                  onMouseEnter={() => show(i)} onFocus={() => show(i)} onBlur={() => setTip(null)}
                  onClick={() => onPick && onPick(days[i].day)}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onPick) { e.preventDefault(); onPick(days[i].day); } }}
                />
              </g>
            );
          })}
          <line className="sa-axis" x1={plotLeft} x2={plotRight} y1={PAD.top + plotH} y2={PAD.top + plotH} />
        </svg>
        <Tooltip tip={tip} wrapW={width} />
        {allZero ? <div className="sa-empty-over" role="status">{emptyText}</div> : null}
      </div>
    </div>
  );
}

/**
 * גרף קווי יומי של שיעור (0..1), עם רווחים בימים בלי מכנה (null). days כמו ב-DayColumns; values: Array<number|null>.
 */
export function RateLine({ days, label, slot = 1, values, ariaLabel, emptyText }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [tip, setTip] = useState(null);
  const present = values.filter((v) => typeof v === 'number');
  const maxPct = Math.max(0, ...present.map((v) => v * 100));
  const scale = niceScale(maxPct <= 0 ? 10 : maxPct, 4);
  const plotLeft = PAD.left;
  const plotRight = width - PAD.right;
  const plotW = Math.max(40, plotRight - plotLeft);
  const plotH = H - PAD.top - PAD.bottom;
  const yOf = (pct) => PAD.top + plotH - (pct / scale.max) * plotH;
  const bands = dayBands(days.length, plotLeft, plotW);
  const stride = labelStride(days.length, plotW);
  const pts = bands.map((b, i) => (typeof values[i] === 'number' ? { x: b.x + b.band / 2, y: yOf(values[i] * 100), i } : null));
  // קטעים רצופים בלבד (ימים בלי נתון שוברים את הקו - לא משלימים בזיוף)
  const segments = [];
  let cur = [];
  pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segments.push(cur); cur = []; } });
  if (cur.length) segments.push(cur);
  const show = (i) => {
    const p = pts[i];
    const b = bands[i];
    setTip({ x: b.x + b.band / 2, y: p ? Math.max(4, p.y - 8) : PAD.top + 10, title: days[i].title, rows: [{ label, slot, value: typeof values[i] === 'number' ? fmtPct(values[i]) : 'אין נתון' }] });
  };
  return (
    <div className="sa-chart" ref={wrapRef}>
      <div className="sa-plot" onMouseLeave={() => setTip(null)}>
        <svg width={width} height={H} role="group" aria-label={ariaLabel} className="sa-svg">
          {scale.ticks.map((t) => (
            <g key={t}>
              <line className="sa-grid" x1={plotLeft} x2={plotRight} y1={yOf(t)} y2={yOf(t)} />
              <text className="sa-ytick" x={plotRight + 8} y={yOf(t) + 4} textAnchor="start">{`${fmtInt(t)}%`}</text>
            </g>
          ))}
          {segments.map((seg) => (seg.length > 1 ? <polyline key={seg[0].i} className={`sa-line sa-st${slot}`} fill="none" points={seg.map((p) => `${p.x},${p.y}`).join(' ')} /> : null))}
          {pts.map((p) => (p ? <circle key={p.i} className={`sa-dot sa-f${slot}`} cx={p.x} cy={p.y} r="4" /> : null))}
          {bands.map((b, i) => (
            <g key={days[i].day}>
              {i % stride === 0 ? <text className="sa-xtick" x={b.x + b.band / 2} y={H - 12} textAnchor="middle">{days[i].label}</text> : null}
              <rect className="sa-hit" x={b.x} y={PAD.top} width={b.band} height={plotH} tabIndex={0} role="img"
                aria-label={`${days[i].title}: ${label} ${typeof values[i] === 'number' ? fmtPct(values[i]) : 'אין נתון'}`}
                onMouseEnter={() => show(i)} onFocus={() => show(i)} onBlur={() => setTip(null)} />
            </g>
          ))}
          <line className="sa-axis" x1={plotLeft} x2={plotRight} y1={PAD.top + plotH} y2={PAD.top + plotH} />
        </svg>
        <Tooltip tip={tip} wrapW={width} />
        {present.length === 0 ? <div className="sa-empty-over" role="status">{emptyText}</div> : null}
      </div>
    </div>
  );
}

/** טבלת נתונים (התצוגה החלופית לכל גרף). columns = [{ key, label }]; rows = [{ id, cells: {key: text} }]. */
export function DataTable({ columns, rows, caption }) {
  return (
    <div className="tblw sa-tblw">
      <table className="rtbl sa-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key}>{r.cells[c.key]}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
