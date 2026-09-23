'use client';

// חלקים משותפים לשני דפי הזיכויים: /admin/refund-planner (מתכנן כללים, בימים) ו-
// /admin/refund-simulator (סימולטור אמיתי, עם תאריכים). כל הסלקטורים ב-refund-planner.css (rp-*).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './refund-planner.css';
import { DEFAULT_POLICY, normalizePolicy, dayToYmd, dayToLocalDate } from '@/lib/refundSimulator';
import { getHebrewDateString, getHebrewWeekdayLabel } from '@/lib/hebrewDate';

// ---------- מיפוי להגדרות המערכת (אותם מפתחות ש-lib/pricingCalc.js קורא - מדיניות 2026-09-22, ---
// ---------- ר' docs/refund-swap-policy-2026-09-22.md ו-/admin/refund-policy) ----------
export const KEYS = {
  fullDays: 'REFUND_DAYS_FROM_ORDER',
  noRefundDays: 'NO_REFUND_DAYS_BEFORE_EVENT',
  percent: 'REFUND_PERCENTAGE',
  refundRepairs: 'REFUND_REPAIRS',
  creditMinutes: 'CANCELLATION_CREDIT_MINUTES',
  instantUndoMinutes: 'instant_undo_minutes',
  sameModelSwap: 'same_model_swap_no_fee',
  swapMinDays: 'swap_min_days_before_event',
  swapSameCategoryOnly: 'swap_same_category_only',
  swapPairingWindowMinutes: 'swap_pairing_window_minutes',
  refundTiersAtDeletion: 'refund_tiers_at_deletion_time',
};
// זהה לניסוח האמיתי ב-lib/settingsMetadata.js / admin/settings, כדי שלא יהיה בלבול בין הכלים.
export const LABELS = {
  fullDays: 'ימי החזר מלא מיום ביצוע ההזמנה',
  noRefundDays: 'ימים ללא החזר לפני האירוע',
  percent: 'אחוז החזר כספי בביטול',
  refundRepairs: 'החזר על עלויות תיקונים',
  creditMinutes: 'דקות לזיכוי דמי ביטול על פריט חלופי',
  instantUndoMinutes: 'ביטול מיידי - כמה דקות',
  sameModelSwap: 'החלפת מידה באותו דגם - ללא דמי ביטול',
  swapMinDays: 'החלפת מידה חינם - עד כמה ימים לפני האירוע',
  swapSameCategoryOnly: 'החלפת מידה חינם - רק באותה שורת מחיר',
  swapPairingWindowMinutes: 'החלפת מידה - הפרש זמן בין המחיקה להוספה (דקות)',
  refundTiersAtDeletion: 'מדרגות ההחזר לפי רגע הביטול',
};
const BOOL_KEYS = ['refundRepairs', 'sameModelSwap', 'swapSameCategoryOnly', 'refundTiersAtDeletion'];
// instant_undo_minutes הוא היחיד שערך ריק אצלו הוא מצב אמיתי ("כמו חלון הזיכוי"), לא ברירת מחדל.
const NULLABLE_KEYS = ['instantUndoMinutes'];
export const DAYS_CAP = 365; // תקרת השרת ל-REFUND_DAYS_FROM_ORDER / NO_REFUND_DAYS_BEFORE_EVENT

// ---------- עזרי עיצוב ----------
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const valueOrEmpty = (v) => (v === '' || v == null ? '' : v);
export const fmtMoney = (n) => `₪${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
export const fmtPct = (n) => `${Math.round((Number(n) || 0) * 10) / 10}%`;
export const fmtDM = (day) => { const [, m, d] = dayToYmd(day).split('-'); return `${d}.${m}`; };
export const fmtDMY = (day) => { const [y, m, d] = dayToYmd(day).split('-'); return `${d}.${m}.${y}`; };
export const hebFull = (day) => getHebrewDateString(dayToLocalDate(day));
export const hebShort = (day) => hebFull(day).split(' ').slice(0, -1).join(' ');
export const weekday = (day) => getHebrewWeekdayLabel(dayToLocalDate(day));
export const isSaturday = (day) => dayToLocalDate(day).getDay() === 6;

export const Icon = ({ id }) => <svg className="icon"><use href={`#${id}`} /></svg>;

// ---------- הגדרות חיות ----------
export function policyFromRows(rows) {
  const byKey = {};
  for (const r of rows || []) byKey[r.key] = r;
  // שורה חסרה או ריקה = ברירת המחדל (התנהגות legacy) - בדיוק כמו getSetting(key, def) במנוע.
  const pick = (k, fb) => (byKey[k] && byKey[k].value !== '' && byKey[k].value != null ? byKey[k].value : fb);
  // instant_undo_minutes בלבד: שורה חסרה/ריקה = null אמיתי ("נופל לחלון הזיכוי"), לא מספר -
  // בדיוק כמו getNonNegativeNumber() במנוע (lib/pricingCalc.js).
  const pickNullable = (k) => (byKey[k] && byKey[k].value !== '' && byKey[k].value != null ? byKey[k].value : null);
  return {
    policy: normalizePolicy({
      fullDays: pick(KEYS.fullDays, DEFAULT_POLICY.fullDays),
      noRefundDays: pick(KEYS.noRefundDays, DEFAULT_POLICY.noRefundDays),
      percent: pick(KEYS.percent, DEFAULT_POLICY.percent),
      refundRepairs: pick(KEYS.refundRepairs, 'false') === 'true',
      creditMinutes: pick(KEYS.creditMinutes, DEFAULT_POLICY.creditMinutes),
      instantUndoMinutes: pickNullable(KEYS.instantUndoMinutes),
      sameModelSwap: pick(KEYS.sameModelSwap, 'false') === 'true',
      swapMinDays: pick(KEYS.swapMinDays, DEFAULT_POLICY.swapMinDays),
      swapSameCategoryOnly: pick(KEYS.swapSameCategoryOnly, 'false') === 'true',
      swapPairingWindowMinutes: pick(KEYS.swapPairingWindowMinutes, DEFAULT_POLICY.swapPairingWindowMinutes),
      refundTiersAtDeletion: pick(KEYS.refundTiersAtDeletion, 'false') === 'true',
    }),
    names: Object.fromEntries(Object.values(KEYS).map((k) => [k, byKey[k]?.name || k])),
  };
}

// טוען את הכללים החיים מ-GET /api/settings (פתוח לקריאה). לא כותב דבר.
export function useLivePolicy() {
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [baseline, setBaseline] = useState(null);      // null = לא נטען
  const [names, setNames] = useState({});
  const [loadState, setLoadState] = useState('loading'); // loading | ok | failed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (!res.ok) throw new Error('bad status');
        const rows = await res.json();
        if (cancelled) return;
        const { policy: live, names: n } = policyFromRows(rows);
        setPolicy(live); setBaseline(live); setNames(n); setLoadState('ok');
      } catch {
        if (!cancelled) setLoadState('failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return { policy, setPolicy, baseline, setBaseline, names, loadState };
}

// ---------- ניווט בין דפי הזיכויים ----------
export function RefundNav({ current }) {
  const tabs = [
    { id: 'planner', href: '/admin/refund-planner', label: 'מתכנן כללים', sub: 'בימים, בלי תאריכים', icon: 'i-tag' },
    { id: 'simulator', href: '/admin/refund-simulator', label: 'סימולטור אמיתי', sub: 'הזמנה עם תאריכים', icon: 'i-play' },
    { id: 'policy', href: '/admin/refund-policy', label: 'תיעוד המדיניות', sub: 'הסבר כתוב', icon: 'i-receipt' },
  ];
  return (
    <nav className="rp-nav" aria-label="דפי זיכויים">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} className={`rp-nav-tab${t.id === current ? ' on' : ''}`} aria-current={t.id === current ? 'page' : undefined}>
          <Icon id={t.icon} /><span><b>{t.label}</b><small>{t.sub}</small></span>
        </Link>
      ))}
    </nav>
  );
}

// ---------- רכיבי טופס ----------
export function Stepper({ value, onChange, min = 0, max = DAYS_CAP, step = 1, unit, label }) {
  const n = Number(value);
  const set = (v) => onChange(clamp(Math.round(v), min, max));
  return (
    <div className="rp-rule-row">
      <div className="rp-step" role="group" aria-label={label}>
        <button type="button" onClick={() => set((Number.isFinite(n) ? n : 0) - step)} aria-label="הפחת">−</button>
        <input
          type="number" inputMode="numeric" min={min} max={max} value={valueOrEmpty(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : clamp(Math.round(Number(e.target.value)), min, max))}
          aria-label={label}
        />
        <button type="button" onClick={() => set((Number.isFinite(n) ? n : 0) + step)} aria-label="הוסף">+</button>
      </div>
      {unit && <span className="rp-unit">{unit}</span>}
    </div>
  );
}

export function Money({ value, onChange, label, placeholder }) {
  return (
    <div className="rp-money">
      <input
        className="input" type="number" inputMode="decimal" min="0" step="1" value={valueOrEmpty(value)} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} aria-label={label}
      />
    </div>
  );
}

// שדה דקות "ניתן לביטול" - כשה-Switch כבוי, הערך הוא null (ריק בהגדרה - "נופל לחלון הזיכוי"
// במנוע). כשמדליקים אותו נכנס למצב "ערך מפורש" עם ברירת מחדל nowValue (בד"כ הערך האפקטיבי הנוכחי).
export function NullableStepper({ value, onChange, fallback, unit, label, max = DAYS_CAP }) {
  const isSet = value !== null && value !== '' && value !== undefined;
  return (
    <div className="rp-nullable">
      <label className="rp-toggle rp-toggle-sm">
        <input type="checkbox" checked={isSet} onChange={(e) => onChange(e.target.checked ? fallback : null)} className="rp-sr" />
        <span className={`switch${isSet ? ' on' : ''}`} aria-hidden="true" />
        <span>ערך נפרד ({label})</span>
      </label>
      {isSet
        ? <Stepper value={value} onChange={onChange} max={max} unit={unit} label={label} />
        : <div className="rp-nullable-fallback">כבוי - נופל אוטומטית לערך של &quot;{LABELS.creditMinutes}&quot; ({fallback} {unit})</div>}
    </div>
  );
}

export function Switch({ checked, onChange, title, sub }) {
  return (
    <label className="rp-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rp-sr" />
      <span className={`switch${checked ? ' on' : ''}`} aria-hidden="true" />
      <span><b>{title}</b>{sub && <><br />{sub}</>}</span>
    </label>
  );
}

// ---------- שמירה בהגדרות המערכת (אחרי אישור מפורש בלבד) ----------
const MINUTE_KEYS = ['creditMinutes', 'instantUndoMinutes', 'swapPairingWindowMinutes'];
const DAY_KEYS = ['fullDays', 'noRefundDays', 'swapMinDays'];
const showVal = (k, p) => {
  if (BOOL_KEYS.includes(k)) return p[k] ? 'כן' : 'לא';
  if (k === 'percent') return `${p[k]}%`;
  if (NULLABLE_KEYS.includes(k)) return p[k] === null || p[k] === undefined ? 'כמו חלון הזיכוי' : `${p[k]} דק׳`;
  if (MINUTE_KEYS.includes(k)) return `${p[k]} דק׳`;
  if (DAY_KEYS.includes(k)) return `${p[k]} ימים`;
  return String(p[k]);
};
// ערך שנשלח לשרת עבור מפתח - ריק ('') ל-instant_undo_minutes null, אחרת ערך רגיל כמחרוזת.
const payloadValue = (k, p) => (NULLABLE_KEYS.includes(k) && (p[k] === null || p[k] === undefined) ? '' : String(p[k]));
// שוני בין הערך הנוכחי לזה שבמערכת - null נחשב שונה מכל מספר, ושווה רק ל-null אחר.
const differs = (k, a, b) => {
  if (NULLABLE_KEYS.includes(k)) return (a === null || a === undefined) !== (b === null || b === undefined)
    || (a !== null && a !== undefined && Number(a) !== Number(b));
  if (BOOL_KEYS.includes(k)) return a !== b;
  return Math.abs(Number(a) - Number(b)) > 1e-9;
};

export function ApplyPanel({ policy, pol, baseline, names, loadState, onApplied, onReset }) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);

  const changes = useMemo(() => {
    if (!baseline) return [];
    return Object.keys(KEYS).filter((k) => differs(k, pol[k], baseline[k]));
  }, [pol, baseline]);
  const hasEmpty = ['fullDays', 'noRefundDays', 'percent', 'creditMinutes', 'swapMinDays', 'swapPairingWindowMinutes']
    .some((k) => policy[k] === '');

  const apply = async () => {
    setSaving(true); setFlash(null);
    try {
      const items = changes.map((k) => ({ key: KEYS[k], value: payloadValue(k, pol), name: names[KEYS[k]] || KEYS[k] }));
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `שגיאה ${res.status}`);
      onApplied(pol); setConfirming(false);
      setFlash({ ok: true, text: 'הכללים נשמרו בהגדרות המערכת ויחולו על כל חישוב זיכוי מעכשיו.' });
    } catch (e) {
      setFlash({ ok: false, text: e.message === 'Unauthorized. Admin access required.' ? 'אין הרשאה לשמור הגדרות (נדרשת הנהלה ראשית).' : `השמירה נכשלה: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-pad rp-actions">
      <div className={`rp-dirty${changes.length ? ' on' : ''}`}>
        <span className="dot" />
        {loadState !== 'ok' ? 'ההגדרות החיות לא נטענו - אי אפשר לשמור.'
          : changes.length ? `${changes.length === 1 ? 'שינוי אחד לא נשמר' : `${changes.length} שינויים לא נשמרו`} בהגדרות המערכת` : 'זהה להגדרות המערכת'}
      </div>
      {confirming ? (
        <div className="rp-confirm">
          <b style={{ color: 'var(--text)' }}>להחיל בהגדרות המערכת?</b>
          <ul>{changes.map((k) => <li key={k}><span>{LABELS[k]}</span><b>{showVal(k, baseline)} ← {showVal(k, pol)}</b></li>)}</ul>
          זה משפיע על כל חישוב זיכוי מרגע השמירה, בכל ההזמנות (הגדרות כלליות, לא של הזמנה בודדת).
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={saving}>{saving ? 'שומר…' : 'אישור והחלה'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={saving}>ביטול</button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="btn btn-primary" disabled={!changes.length || loadState !== 'ok' || hasEmpty} onClick={() => { setFlash(null); setConfirming(true); }}>
            <Icon id="i-check-circle" />החל בהגדרות המערכת
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!changes.length} onClick={() => { setConfirming(false); setFlash(null); onReset(); }}>
            <Icon id="i-refresh" />החזר להגדרות הנוכחיות
          </button>
        </>
      )}
      {flash && <div className={`rp-flash ${flash.ok ? 'ok' : 'err'}`}>{flash.text}</div>}
    </div>
  );
}
