'use client';

// StationCharts - רכיבי התצוגה של מסך "המרות בעמדה": עיצוב "זרימה" (כיוון B שנבחר ע"י הבעלים, 12.10.2026): לוחות נייבי עם הדגשות זהב,
// אריחי סטטיסטיקה עם פסי השוואה ומד חצי עיגול כפול, משפך כסרט מתחדד עם אחוזי המרה כתגיות על הצמתים, עמודות וקו עם זוהר.
// SVG / CSS בלבד (בלי ספריות). הצבעים כולם משתני CSS (station-analytics.css; שני צבעי סדרה בלבד, אומתו ב-validate_palette), הצירים מימין לשמאל
// (היום הראשון בטווח מימין), טולטיפ בריחוף ובמיקוד מקלדת, אנימציות מכבדות prefers-reduced-motion, ולכל גרף יש תצוגת טבלה (ב-StationAnalyticsPage).
// מקור העיצוב: scripts/station-analytics-tests/graphs-3/ (קובץ ההדגמה). הגיאומטריה הטהורה: chartLogic.js (נבדקת ב-chart.test.mjs).
import { useEffect, useId, useRef, useState } from 'react';
import { Ic } from '../settings-sim/SettingsDialogs';
import {
  STAGE_COLOR_VARS, bandAriaLabel, compareRows, dayBands, deltaInfo, fmtAvg, fmtInt, fmtPct, funnelGeometry, gaugeDash, labelStride, niceScale, splinePath, splitSegments,
} from './chartLogic';

/* ----------------------------------------------------------------- עזרים */

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

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** מספר שעולה מהערך הקודם אל הערך החדש (כבוי ב-prefers-reduced-motion). בצד השרת / לפני הטעינה מוצג הערך הסופי. as='text' לטקסט בתוך SVG. */
function CountUp({ value, format = fmtInt, as: Tag = 'span', ...rest }) {
  const ref = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof value !== 'number' || !isFinite(value)) return undefined;
    if (prefersReducedMotion()) { el.textContent = format(value); prev.current = value; return undefined; }
    const from = prev.current;
    const t0 = Date.now();
    el.textContent = format(from);
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / 900);
      const v = from + (value - from) * (1 - Math.pow(1 - k, 3));
      el.textContent = format(v);
      if (k >= 1) { clearInterval(id); el.textContent = format(value); prev.current = value; }
    }, 30);
    return () => clearInterval(id);
  }, [value, format]);
  return <Tag ref={ref} {...rest}>{format(value)}</Tag>;
}

function Arrow({ dir }) {
  const d = dir === 'up' ? 'M2 8l4-4 4 4' : dir === 'down' ? 'M2 4l4 4 4-4' : 'M2 6h8';
  return <svg className="sa-arr" viewBox="0 0 12 12" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** שבב שינוי מול ערך השוואה. לא בצבעי סטטוס: כיוון בצורה (חץ), בטקסט נסתר ובניגוד בין שני גוונים. */
function Delta({ cur, prev, kind }) {
  const info = deltaInfo(cur, prev, kind);
  if (!info) return null;
  const word = info.dir === 'up' ? 'עלייה של ' : info.dir === 'down' ? 'ירידה של ' : '';
  return <span className={`sa-chip sa-${info.dir}`}><Arrow dir={info.dir} /><span className="sr-only">{word}</span><bdi>{info.text}</bdi></span>;
}

/* ----------------------------------------------------------------- טולטיפ */

function Tooltip({ tip, wrapW }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 100), Math.max(100, wrapW - 100));
  return (
    <div className="sa-tt" role="tooltip" style={{ left, top: tip.y }}>
      <div className="sa-tt-d">{tip.title}</div>
      {tip.rows.map((r) => (
        <div className="sa-tt-r" key={r.label}>
          <i className="sa-tt-k" style={{ background: r.color }} aria-hidden="true" />
          <b dir="ltr"><bdi>{r.value}</bdi></b>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- מד חצי עיגול כפול */

function Gauge({ outer, inner, label }) {
  const uid = useId().replace(/:/g, '');
  const W = 220;
  const cx = W / 2;
  const cy = 112;
  const r1 = 88;
  const r2 = 68;
  const g1 = gaugeDash(r1, outer);
  const g2 = gaugeDash(r2, inner);
  const arc = (r) => `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
  const flip = `translate(${W},0) scale(-1,1)`; // המילוי מתחיל מהצד הימני (כיוון הקריאה בעברית)
  return (
    <svg className="sa-gauge" viewBox={`0 0 ${W} 128`} role="img" aria-label={label} style={{ direction: 'ltr' }}>
      <defs>
        <linearGradient id={`${uid}g`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" style={{ stopColor: 'var(--sa-c-appr-hi)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--sa-c-top)' }} />
        </linearGradient>
      </defs>
      <path d={arc(r1)} className="sa-g-track" strokeWidth="14" transform={flip} />
      <path d={arc(r1)} className="sa-g-fill sa-glow" stroke={`url(#${uid}g)`} strokeWidth="14" transform={flip} strokeDasharray={g1.length} style={{ '--len': g1.length, '--off': g1.offset }} />
      <path d={arc(r2)} className="sa-g-track sa-g-track-2" strokeWidth="6" transform={flip} />
      <path d={arc(r2)} className="sa-g-fill sa-g-inner" strokeWidth="6" transform={flip} strokeDasharray={g2.length} style={{ '--len': g2.length, '--off': g2.offset }} />
      <CountUp as="text" value={typeof outer === 'number' ? outer * 100 : null} format={(v) => (typeof v === 'number' ? `${fmtInt(v)}%` : '—')} x={cx} y={cy - 14} textAnchor="middle" className="sa-g-num" />
      <text x={cx} y={cy + 4} textAnchor="middle" className="sa-g-cap">נפתחה הזמנה</text>
    </svg>
  );
}

/* ----------------------------------------------------------------- אריח סטטיסטיקה */

/**
 * אריח סיכום: ערך ראשי (עולה בכניסה), שבב שינוי מול אתמול ושלוש שורות השוואה (היום / אתמול / ממוצע שבועי) כפסים.
 * kind 'count' | 'rate'. gauge = { strict, strictLabel } הופך את האריח לאריח עם מד חצי עיגול כפול (חיצוני: value, פנימי: strict).
 * unmeasured = השלב לא נמדד בערוץ הזה ("—" והסבר, לא אפס).
 */
export function StatTile({ icon, label, value, yesterday, weekAvg, kind = 'count', unmeasured = false, note = '', gauge = null, index = 0 }) {
  const fmt = kind === 'rate' ? fmtPct : fmtInt;
  const fmtA = kind === 'rate' ? fmtPct : fmtAvg;
  const rows = compareRows(value, yesterday, weekAvg);
  const gaugeMax = Math.max(1e-9, ...[value, yesterday, weekAvg, gauge && gauge.strict].filter((v) => typeof v === 'number'));
  return (
    <div className={`card sa-tile sa-panel${unmeasured ? ' sa-off' : ''}`} role="group" aria-label={label} style={{ '--i': index }}>
      <div className="sa-tile-h">
        <span className="sa-tile-ic"><Ic id={icon} /></span>
        <span className="sa-tile-l">{label}</span>
        {unmeasured ? null : <Delta cur={value} prev={yesterday} kind={kind} />}
      </div>
      {unmeasured ? (
        <>
          <div className="sa-tile-v sa-tile-v-off" dir="ltr"><bdi>—</bdi></div>
          <small className="sa-tile-n">{note || 'נמדד רק בקישור הכללי'}</small>
        </>
      ) : (
        <>
          {gauge ? (
            <Gauge outer={value} inner={gauge.strict} label={`${label}: ${fmtPct(value)}. ${gauge.strictLabel || 'בהגדרה המחמירה'}: ${fmtPct(gauge.strict)}`} />
          ) : (
            <div className="sa-tile-v" dir="ltr"><CountUp as="bdi" value={value} format={fmt} /></div>
          )}
          <div className="sa-cmp-rows">
            {gauge ? (
              <>
                {[['strict', gauge.strictLabel || 'בהגדרה המחמירה', gauge.strict], ['yest', 'אתמול', yesterday], ['avg', 'ממוצע שבועי', weekAvg]].map(([k, lab, v]) => (
                  <RowCmp key={k} row={{ key: k, label: lab, value: v, pct: typeof v === 'number' ? (v / gaugeMax) * 100 : 0 }} fmt={fmtPct} />
                ))}
              </>
            ) : rows.map((r) => (
              <RowCmp key={r.key} row={r} fmt={r.key === 'avg' ? fmtA : fmt} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RowCmp({ row, fmt }) {
  return (
    <>
      <span className="sa-cmp-l">{row.label}</span>
      <span className="sa-cmp-bar"><i className={`sa-b-${row.key}`} style={{ width: `${row.pct}%` }} /></span>
      <b className="num"><bdi>{row.value == null ? '—' : fmt(row.value)}</bdi></b>
    </>
  );
}

/* ----------------------------------------------------------------- משפך (סרט) */

/**
 * משפך "סרט" ממורכז: פס לכל שלב נמדד (צבע לפי קבוצה: כניסות / רישום / הזמנות), סרט מתחדד בין שלבים ותגית אחוז המרה על כל צומת.
 * stages = [{ key, label, count|null, parent, rateFromParent, rateFromVisits }]. שלב שלא נמדד בערוץ (count null) לא נצבע, ומופיע בהערה.
 */
export function FunnelBars({ stages, parentLabels, hasData }) {
  const wrapRef = useRef(null);
  const W = useWidth(wrapRef);
  const [tip, setTip] = useState(null);
  const uid = useId().replace(/:/g, '');
  const measured = stages.filter((s) => typeof s.count === 'number');
  const skipped = stages.filter((s) => typeof s.count !== 'number');
  const labelW = Math.min(150, Math.round(W * 0.34));
  const geo = funnelGeometry(measured, { width: W, labelWidth: labelW, parentLabels });
  const showTip = (s, b) => {
    const rows = [{ label: s.label, value: fmtInt(s.count), color: 'var(--sa-c-appr-hi)' }];
    if (typeof s.rateFromParent === 'number') rows.push({ label: `מתוך ${parentLabels[s.parent] || ''}`.trim(), value: fmtPct(s.rateFromParent), color: 'var(--sa-c-top)' });
    if (typeof s.rateFromVisits === 'number') rows.push({ label: 'מהנכנסים', value: fmtPct(s.rateFromVisits), color: 'var(--sa-text-dim)' });
    setTip({ x: geo.cx, y: Math.max(6, b.y - 8), title: s.label, rows });
  };
  return (
    <div className="sa-chart sa-funnel-wrap" ref={wrapRef} onMouseLeave={() => setTip(null)}>
      <svg width={W} height={geo.height} viewBox={`0 0 ${W} ${geo.height}`} role="group" aria-label="משפך ההמרה" className="sa-svg sa-funnel-svg" style={{ direction: 'ltr' }}>
        <defs>
          {geo.joints.map((j) => (
            <linearGradient key={j.to} id={`${uid}j${j.to}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: `var(${STAGE_COLOR_VARS[measured[j.from].key]})`, stopOpacity: 0.5 }} />
              <stop offset="100%" style={{ stopColor: `var(${STAGE_COLOR_VARS[measured[j.to].key]})`, stopOpacity: 0.32 }} />
            </linearGradient>
          ))}
        </defs>
        {geo.joints.map((j) => {
          const a = geo.bands[j.from].half;
          const b = geo.bands[j.to].half;
          const m = (j.y1 + j.y2) / 2;
          const cx = geo.cx;
          return <path key={j.to} className="sa-fade" fill={`url(#${uid}j${j.to})`} d={`M${cx - a},${j.y1} C${cx - a},${m} ${cx - b},${m} ${cx - b},${j.y2} L${cx + b},${j.y2} C${cx + b},${m} ${cx + a},${m} ${cx + a},${j.y1} Z`} />;
        })}
        {geo.bands.map((b, i) => {
          const s = measured[i];
          const joint = geo.joints.find((j) => j.to === i);
          const tag = joint && joint.tag;
          const tw = tag ? 22 + tag.length * 7.2 : 0;
          return (
            <g key={s.key} className="sa-rise" style={{ '--i': i }}>
              <rect x={b.x} y={b.y} width={b.w} height={46} rx="14" style={{ fill: `var(${STAGE_COLOR_VARS[s.key]})`, opacity: hasData ? 1 : 0.35 }} />
              <rect x={b.x} y={b.y} width={b.w} height={23} rx="14" fill="#fff" opacity="0.1" />
              <text x={geo.cx} y={b.y + 30} textAnchor="middle" className="sa-f-num num">{fmtInt(s.count)}</text>
              <text x={W - 4} y={b.y + 28} textAnchor="end" className="sa-f-lab">{s.label}</text>
              {tag ? (
                <g className="sa-fade">
                  <rect x={geo.cx - tw / 2} y={b.y - 14 - 11} width={tw} height="22" rx="11" className="sa-f-tag" />
                  <text x={geo.cx} y={b.y - 14 + 4} textAnchor="middle" className="sa-f-tag-t num">{tag}</text>
                </g>
              ) : null}
              <rect
                className="sa-hit" x="0" y={b.y - 6} width={W} height="58" tabIndex={0} role="img"
                aria-label={`${s.label} ${fmtInt(s.count)}${typeof s.rateFromParent === 'number' ? `, ${fmtPct(s.rateFromParent)} מתוך ${parentLabels[s.parent] || ''}` : ''}`}
                onMouseEnter={() => showTip(s, b)} onFocus={() => showTip(s, b)} onBlur={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} wrapW={W} />
      {skipped.length ? <p className="sa-fskip">לא נמדד בערוץ הזה: {skipped.map((s) => s.label).join(', ')}.</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- גרפים */

const H = 250;
const PAD = { top: 24, bottom: 32, left: 10, right: 38 }; // right = ציר ה-Y (ב-RTL הציר מימין)

function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <ul className="sa-legend" aria-label="מקרא">
      {series.map((s) => <li key={s.key}><i className={`sa-key sa-k${s.slot}`} aria-hidden="true" />{s.label}</li>)}
    </ul>
  );
}

/**
 * גרף עמודות יומי (מקובצות כשיש שתי סדרות; קפסולות עם זוהר). days = [{ day, label, title }]; series = [{ key, label, slot (1 כחול | 2 זהב), values }].
 * onPick(dayKey) - לחיצה על יום; picked = היום הנבחר. תווית ישירה רק לשיא של הסדרה הראשונה.
 */
export function DayColumns({ days, series, picked, onPick, ariaLabel, emptyText }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [tip, setTip] = useState(null);
  const uid = useId().replace(/:/g, '');
  const allZero = series.every((s) => s.values.every((v) => !v));
  const maxV = Math.max(0, ...series.flatMap((s) => s.values));
  const scale = niceScale(maxV);
  const plotLeft = PAD.left;
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const yOf = (v) => PAD.top + plotH - (v / scale.max) * plotH;
  const bands = dayBands(days.length, plotLeft, plotW);
  const stride = labelStride(days.length, plotW);
  const band0 = bands[0] ? bands[0].band : 10;
  const bw = Math.max(2, Math.min(series.length > 1 ? 10 : 14, band0 * (series.length > 1 ? 0.3 : 0.5)));
  const gap = 3;
  const groupW = bw * series.length + gap * (series.length - 1);
  const first = series[0];
  const peak = first ? first.values.indexOf(Math.max(...first.values)) : -1;

  const show = (i) => {
    const b = bands[i];
    if (!b) return;
    const top = Math.min(...series.map((s) => yOf(s.values[i] || 0)));
    setTip({ x: b.x + b.band / 2, y: Math.max(4, top - 8), title: days[i].title, rows: series.map((s) => ({ label: s.label, color: s.slot === 2 ? 'var(--sa-gold)' : 'var(--sa-blue)', value: fmtInt(s.values[i] || 0) })) });
  };

  return (
    <div className="sa-chart" ref={wrapRef}>
      <Legend series={series} />
      <div className="sa-plot" onMouseLeave={() => setTip(null)}>
        <svg width={width} height={H} role="group" aria-label={ariaLabel} className="sa-svg" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id={`${uid}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--sa-gold-hi)' }} /><stop offset="100%" style={{ stopColor: 'var(--sa-gold)' }} /></linearGradient>
            <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--sa-blue-hi)' }} /><stop offset="100%" style={{ stopColor: 'var(--sa-blue)' }} /></linearGradient>
          </defs>
          {scale.ticks.map((t) => (
            <g key={t}>
              <line className="sa-grid" x1={plotLeft} x2={plotLeft + plotW} y1={yOf(t)} y2={yOf(t)} />
              <text className="sa-ytick num" x={plotLeft + plotW + 8} y={yOf(t) + 4} textAnchor="start">{fmtInt(t)}</text>
            </g>
          ))}
          {bands.map((b, i) => {
            const startX = b.x + (b.band - groupW) / 2;
            const isPicked = picked && days[i].day === picked;
            const parts = series.map((s) => ({ label: s.label, value: s.values[i] || 0 }));
            return (
              <g key={days[i].day} className={`sa-band${isPicked ? ' sa-picked' : ''}`}>
                <rect className="sa-beam" x={b.x + 1} y={PAD.top} width={Math.max(0, b.band - 2)} height={plotH} rx="6" />
                {series.map((s, si) => {
                  const v = s.values[i] || 0;
                  if (!v) return null;
                  const top = yOf(v);
                  const r = bw / 2;
                  const x = startX + (series.length - 1 - si) * (bw + gap);
                  const base = PAD.top + plotH;
                  const d = `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z`;
                  return <path key={s.key} d={d} fill={`url(#${uid}${s.slot === 2 ? 'g' : 'b'})`} className={`sa-gcol ${s.slot === 2 ? 'sa-glow' : 'sa-glow-b'}`} style={{ '--i': i }} />;
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
          {peak >= 0 && first.values[peak] > 0 ? (
            <text className="sa-peak num" x={bands[peak].x + bands[peak].band / 2} y={yOf(first.values[peak]) - 8} textAnchor="middle">{`שיא ${fmtInt(first.values[peak])}`}</text>
          ) : null}
          <line className="sa-axis" x1={plotLeft} x2={plotLeft + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH} />
        </svg>
        <Tooltip tip={tip} wrapW={width} />
        {allZero ? <div className="sa-empty-over" role="status">{emptyText}</div> : null}
      </div>
    </div>
  );
}

/**
 * גרף קווי יומי של שיעור (0..1): עקומה חלקה עם מעבר צבע, זוהר, נקודה פועמת ביום האחרון וקו אנכי בריחוף. ימים בלי מכנה (null) = רווח בקו.
 */
export function RateLine({ days, label, values, ariaLabel, emptyText }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [tip, setTip] = useState(null);
  const [hover, setHover] = useState(-1);
  const uid = useId().replace(/:/g, '');
  const present = values.filter((v) => typeof v === 'number');
  const maxPct = Math.max(0, ...present.map((v) => v * 100));
  const scale = niceScale(maxPct <= 0 ? 10 : maxPct * 1.12, 4);
  const plotLeft = PAD.left;
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const n = days.length;
  const step = n > 1 ? plotW / (n - 1) : plotW;
  const X = (i) => plotLeft + plotW - i * step;
  const Y = (v) => PAD.top + plotH - ((v * 100) / scale.max) * plotH;
  const pts = values.map((v, i) => (typeof v === 'number' ? { x: X(i), y: Y(v), i, v } : null));
  const segs = splitSegments(pts);
  const stride = labelStride(n, plotW);
  const lastPt = pts[n - 1];
  const show = (i) => {
    setHover(i);
    const p = pts[i];
    setTip({ x: X(i), y: p ? Math.max(4, p.y - 10) : PAD.top + 10, title: days[i].title, rows: [{ label, color: 'var(--sa-gold)', value: typeof values[i] === 'number' ? fmtPct(values[i]) : 'אין כניסות' }] });
  };
  return (
    <div className="sa-chart" ref={wrapRef}>
      <div className="sa-plot" onMouseLeave={() => { setTip(null); setHover(-1); }}>
        <svg width={width} height={H} role="group" aria-label={ariaLabel} className="sa-svg" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id={`${uid}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--sa-blue-hi)', stopOpacity: 0.3 }} /><stop offset="100%" style={{ stopColor: 'var(--sa-blue-hi)', stopOpacity: 0 }} /></linearGradient>
            <linearGradient id={`${uid}s`} gradientUnits="userSpaceOnUse" x1={plotLeft + plotW} y1="0" x2={plotLeft} y2="0"><stop offset="0%" style={{ stopColor: 'var(--sa-c-top)' }} /><stop offset="100%" style={{ stopColor: 'var(--sa-c-appr-hi)' }} /></linearGradient>
          </defs>
          {scale.ticks.map((t) => {
            const yy = PAD.top + plotH - (t / scale.max) * plotH;
            return (
              <g key={t}>
                <line className="sa-grid" x1={plotLeft} x2={plotLeft + plotW} y1={yy} y2={yy} />
                <text className="sa-ytick num" x={plotLeft + plotW + 8} y={yy + 4} textAnchor="start">{`${fmtInt(t)}%`}</text>
              </g>
            );
          })}
          {segs.map((seg) => {
            if (seg.length < 2) return null;
            const asc = [...seg].reverse();
            const d = splinePath(asc);
            return (
              <g key={seg[0].i}>
                <path className="sa-fade" fill={`url(#${uid}a)`} d={`${d} L${asc[asc.length - 1].x},${PAD.top + plotH} L${asc[0].x},${PAD.top + plotH} Z`} />
                <path className="sa-draw sa-glow" d={d} fill="none" stroke={`url(#${uid}s)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
              </g>
            );
          })}
          {hover >= 0 ? <line className="sa-cross" x1={X(hover)} x2={X(hover)} y1={PAD.top} y2={PAD.top + plotH} /> : null}
          {hover >= 0 && pts[hover] ? <circle className="sa-halo" cx={pts[hover].x} cy={pts[hover].y} r="8" /> : null}
          {lastPt ? (
            <g>
              <circle className="sa-pulse" cx={lastPt.x} cy={lastPt.y} r="6" />
              <circle className="sa-enddot" cx={lastPt.x} cy={lastPt.y} r="5" />
              <text className="sa-endlab num" x={lastPt.x + 10} y={lastPt.y - 10}>{`היום ${fmtPct(lastPt.v)}`}</text>
            </g>
          ) : null}
          {days.map((d, i) => (
            <g key={d.day}>
              {i % stride === 0 ? <text className="sa-xtick" x={X(i)} y={H - 12} textAnchor="middle">{d.label}</text> : null}
              <rect
                className="sa-hit" x={X(i) - step / 2} y={PAD.top} width={step} height={plotH} tabIndex={0} role="img"
                aria-label={`${d.title}: ${typeof values[i] === 'number' ? `${label} ${fmtPct(values[i])}` : 'אין כניסות'}`}
                onMouseEnter={() => show(i)} onFocus={() => show(i)} onBlur={() => { setTip(null); setHover(-1); }}
              />
            </g>
          ))}
          <line className="sa-axis" x1={plotLeft} x2={plotLeft + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH} />
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
