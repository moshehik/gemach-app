// components/SearchNotices.js - הודעות מתחת לשורת חיפוש ברשימות (הזמנות / לקוחות / דגמים): מה השרת עשה כדי למצוא תוצאות
// ("לא נמצא בהזמנות עתידיות - מוצגות תוצאות מכל התאריכים", "הוקלד במקלדת אנגלית?", "מוצגים שמות דומים") + אינדיקציית הטווח של הרשימה.
// קומפוננטה תצוגתית בלבד (בלי state), בסגנון ה-callout הקיים של design-system.css. ההודעות עצמן מגיעות מהשרת בתשובה (notices: [{kind,text}]).

const rowStyle = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' };

/** הודעות החיפוש מהשרת: notices = [{ kind, text }]. מציג כל הודעה בשורה נפרדת; לא מציג כלום כשהרשימה ריקה. */
export function SearchNotices({ notices }) {
  if (!Array.isArray(notices) || notices.length === 0) return null;
  return (
    <div role="status" aria-live="polite" data-search-notices="1">
      {notices.map((n, i) => (
        <div key={`${n.kind}-${i}`} className="callout callout-info" style={{ marginBottom: '8px' }} data-notice-kind={n.kind}>
          <svg className="icon"><use href="#i-info" /></svg>
          <span>{n.text}</span>
        </div>
      ))}
    </div>
  );
}

/** אינדיקציית טווח ליד שורת החיפוש: טקסט קבוע + (אופציונלי) כפתור "כל התאריכים" שמסיר את הסינון בלי לנקות את החיפוש. */
export function ScopeNote({ text, actionLabel, onAction }) {
  return (
    <div style={rowStyle} data-search-scope="1">
      <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <svg className="icon"><use href="#i-calendar" /></svg>
        {text}
      </span>
      {actionLabel && onAction ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}

/** מצב ריק עם רמזים: כותרת + שורת רמז (מה אפשר להקליד). */
export function SearchEmptyHint({ title, hint, action }) {
  return (
    <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--text-2)' }} data-search-empty="1">
      <div style={{ fontWeight: 600, marginBottom: '6px' }}>{title}</div>
      {hint ? <div style={{ fontSize: '12.5px', color: 'var(--text-3)' }}>{hint}</div> : null}
      {action ? <div style={{ marginTop: '10px' }}>{action}</div> : null}
    </div>
  );
}
