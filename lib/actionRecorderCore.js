// לוגיקה טהורה (בלי DOM) של מקליט הפעולות ("מאקרו") של עוזר ה-AI — ר'
// app/components/useActionRecorder.js. המשתמש רואה את זה כ"הסרטת מסך"; בפועל נרשמת
// רשימת צעדים (לחיצות, הקלדות, ניווט) שנשלחת ל-Gemini כטקסט, לצד הוידאו.

export const MASKED_VALUE = '••• (מוסתר)';
const MAX_VALUE_CHARS = 80;
export const MAX_STEPS = 300;

// שדות שערכם אסור שיירשם: סיסמאות, כרטיס אשראי/CVV/קוד, תעודת זהות. הבדיקה גם לפי סוג
// השדה וגם לפי שם/מזהה/תווית/placeholder — כי בטופס הזה שדות כאלה לא תמיד type=password.
const SENSITIVE_RE = /password|passwd|pin\b|cvv|cvc|card|cc-|סיסמ|אשראי|כרטיס|תעודת|ת\.?ז\b|קוד אימות|זהות|zeout|idnumber|id_number|otp/i;

export function isSensitiveField(meta) {
  if (!meta) return false;
  if (String(meta.type || '').toLowerCase() === 'password') return true;
  const hay = [meta.name, meta.id, meta.autocomplete, meta.label, meta.placeholder, meta.elementName, meta.ariaLabel]
    .filter(Boolean)
    .join(' ');
  return SENSITIVE_RE.test(hay);
}

export function sanitizeValue(meta, value) {
  if (isSensitiveField(meta)) return MASKED_VALUE;
  const v = String(value ?? '').replace(/\s+/g, ' ').trim();
  return v.length > MAX_VALUE_CHARS ? `${v.slice(0, MAX_VALUE_CHARS)}…` : v;
}

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/**
 * steps: [{ t (שניות מתחילת ההקלטה), page, type, target?, value?, key? }]
 * מחזיר טקסט ממוספר בעברית שמוצמד לפרומפט של Gemini.
 */
export function formatActionSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return '';
  const lines = [];
  let lastPage = null;
  steps.slice(0, MAX_STEPS).forEach((s, i) => {
    const time = `[${mmss(s.t || 0)}]`;
    const where = s.page && s.page !== lastPage ? ` (בדף ${s.page})` : '';
    lastPage = s.page || lastPage;
    let what;
    switch (s.type) {
      case 'click': what = `לחץ על ${s.target || 'אלמנט'}`; break;
      case 'type': what = `הקליד ${JSON.stringify(s.value ?? '')} ב-${s.target || 'שדה לא ידוע'}`; break;
      case 'select': what = `בחר ${JSON.stringify(s.value ?? '')} ב-${s.target || 'רשימה'}`; break;
      case 'key': what = `לחץ על מקש ${s.key}${s.target ? ` בתוך ${s.target}` : ''}`; break;
      case 'navigate': what = `עבר לדף ${s.page}`; break;
      default: what = String(s.type || 'פעולה');
    }
    lines.push(`${i + 1}. ${time} ${what}${s.type === 'navigate' ? '' : where}`);
  });
  if (steps.length > MAX_STEPS) lines.push(`(נחתכו ${steps.length - MAX_STEPS} צעדים נוספים)`);
  return lines.join('\n');
}

// כותרת הבלוק שמצורף לטקסט של דיווח שגיאה (ErrorReportButton) כשהמשתמש הקליט את הפעולות שלו.
export const REPORT_STEPS_HEADER = 'הפעולות שבוצעו לפני התקלה:';

export function appendStepsToReport(text, stepsText) {
  return stepsText ? `${text}\n\n[${REPORT_STEPS_HEADER}\n${stepsText}]` : text;
}

/** מפריד דיווח ל-{ body, steps: string[] } — steps ריק אם אין בלוק פעולות. */
export function splitReportSteps(text) {
  const s = String(text || '');
  const marker = `[${REPORT_STEPS_HEADER}\n`;
  const at = s.lastIndexOf(marker);
  if (at === -1 || !/\]\s*$/.test(s)) return { body: s, steps: [] };
  const inner = s.slice(at + marker.length).replace(/\]\s*$/, '');
  const steps = inner.split('\n').map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
  return { body: s.slice(0, at).replace(/\s+$/, ''), steps };
}

/** "צעד אחד" / "5 צעדים" — כדי שלא יופיע "1 צעדים". */
export function stepsCountLabel(n) {
  return n === 1 ? 'צעד אחד' : `${n} צעדים`;
}
