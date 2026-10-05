'use client';

// חלקי תצוגה קטנים של חלון "דיווח על שגיאות" (עיצוב B, 4.10.2026). אותם שמות מחלקות כמו בסקיצה המאושרת
// (תצוגות-עיצוב/דיווח-שגיאות-סקיצות-2.html), כדי שבדיקת הנאמנות (scripts/error-report-audit) תשווה רכיב מול רכיב.
import { useState } from 'react';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';

// אייקונים שהריחוף שלהם מטופל ע"י כללי [data-ico] של הפלטה כשהכפתור נושא data-ico (כמו בסקיצה: ia-ov)
export const COVERED_ICONS = new Set('check card print plus x trash undo bk back chev truck pencil scissors lock swap ext mail bag cart'.split(' '));
/** אייקון מספריית הפלטה (sprite מוטמע, #gmi-<שם>) + מחלקות הנפשת הריחוף של הפלטה (ia-<שם> ia-h), כמו בסקיצה ובתפריט.
 *  inBtn: האייקון בתוך כפתור שנושא data-ico (מוסיף ia-ov לאייקונים שהפלטה כבר מנפישה דרך [data-ico]). */
export function Ic({ n, cls, inBtn }) {
  return (
    <svg className={`ic ia-${n} ia-h${inBtn && COVERED_ICONS.has(n) ? ' ia-ov' : ''}${cls ? ` ${cls}` : ''}`} aria-hidden="true" focusable="false">
      <use href={`#${SPRITE_ID_PREFIX}${n}`} />
    </svg>
  );
}

export const Spin = ({ lt }) => <span className={`er-spin${lt ? ' lt' : ''}`} />;

/** קישור הורדה קטן (צ׳יפ בבועה / פינת תמונה ממוזערת). */
export function DlLink({ info, onThumb }) {
  return (
    <a className={`er3-dl${onThumb ? ' on-th' : ''}`} data-ico="download" href={info.src} download={info.name} target="_blank" rel="noopener noreferrer" data-tip="הורדה" aria-label={`הורדת ${info.name}`}>
      <Ic n="download" cls="sm" />
    </a>
  );
}

/** תמונה ממוזערת של צרופה ממתינה (בטופס / בתגובה): לחיצה פותחת בתצוגה גדולה, X מסיר, וכפתור הורדה בפינה. */
export function Thumb({ info, uploading, onOpen, onRemove }) {
  const [broken, setBroken] = useState(false);
  let inner;
  if (uploading) inner = <div className="er-vid"><Spin lt />הסרטת מסך</div>;
  else if (info.kind === 'video') inner = <div className="er-vid"><Ic n="video" />הסרטת מסך</div>;
  else if (info.kind === 'image' && !broken) inner = <img className="er-elt er-img" src={info.src} alt="צילום מצורף" onError={() => setBroken(true)} />;
  else inner = <div className="er-fileb" data-tip={info.name}><Ic n={broken ? 'alert' : 'clip'} /><span>{broken ? 'הקובץ אינו זמין' : info.name}</span></div>;
  return (
    <div className="er-pt">
      {uploading ? inner : (
        <div className="er-pop" role="button" tabIndex={0} aria-label={`פתיחה: ${info.label}`} data-tip="פתיחה"
          onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}>
          {inner}
        </div>
      )}
      {onRemove ? <button type="button" className="er-x" data-ico="x" aria-label="הסר" data-tip="הסר" onClick={onRemove}><Ic n="x" inBtn /></button> : null}
      {uploading ? null : <DlLink info={info} onThumb />}
    </div>
  );
}

/** צ׳יפ צרופה בתוך בועה: פתיחה (תצוגה גדולה) + הורדה. */
export function AttChip({ info, onOpen }) {
  return (
    <span className="er3-chip">
      <button type="button" className="er3-co" data-ico={info.icon} aria-label={`פתיחה: ${info.label}`} data-tip="פתיחה" onClick={onOpen}>
        <Ic n={info.icon} cls="sm" inBtn /><span>{info.label}</span>
      </button>
      <DlLink info={info} />
    </span>
  );
}

/**
 * תיבת הכתיבה: textarea + שורת האייקונים בתוכה (נחשפת בריחוף / מיקוד מקלדת / נגיעה) + כפתור שליחה שתמיד גלוי.
 * acts: [{ k, icon, t, h, count, disabled, spin, on, onClick }]
 */
export function Composer({ id, rows, label, placeholder, value, onChange, onKeyDown, bad, reply, reveal, onTouch, acts, send, textareaRef, required }) {
  return (
    <div className={`er-composer${bad ? ' bad' : ''}${reveal ? ' reveal' : ''}${reply ? ' rp' : ''}`}
      onPointerDown={(e) => { if (e.pointerType === 'touch' && onTouch) onTouch(); }}>
      <textarea
        ref={textareaRef}
        className={`inp${bad ? ' bad' : ''}`}
        id={id}
        rows={rows}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        required={required}
        aria-invalid={bad ? 'true' : undefined}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <div className="er-cbar">
        {acts.map((a) => (
          <button key={a.k} type="button" className={`er-cb${a.on ? ' on' : ''}`} data-act={a.k} data-ico={a.spin ? undefined : a.icon} data-tip={`${a.t} · ${a.h}`} aria-label={a.t} disabled={a.disabled} onClick={a.onClick}>
            {a.spin ? <Spin /> : <Ic n={a.icon} inBtn />}
            {a.count ? <span className="er-cc">{a.count}</span> : null}
          </button>
        ))}
        {send}
      </div>
    </div>
  );
}

/** כפתור עגול כחול של הפלטה (לחצן 20/9: .tools .xlbtn.xlp) עם טולטיפ המערכת. */
export function RoundBtn({ icon, tip, onClick, pressed, disabled, act }) {
  return (
    <button type="button" className={`xlbtn xlp${pressed ? ' on' : ''}`} data-act={act} data-ico={icon} data-tip={tip} aria-label={tip}
      aria-pressed={pressed === undefined ? undefined : !!pressed} disabled={disabled} onClick={onClick}>
      <Ic n={icon} inBtn />
    </button>
  );
}
