'use client';

import { useState } from 'react';

// אימייל או טלפון ישראלי (נייד/קווי/07x, עם או בלי מקפים/רווחים) בתוך טקסט חופשי.
// הסינון (?<![\d-]) / (?!\d) מונע התאמה לחלק ממספר ארוך יותר (מספר הזמנה, ברקוד, תאריך).
const COPYABLE_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+|(?<![\d-])0(?:5\d|7\d|[2-489])[-\s]?\d{3}[-\s]?\d{4}(?!\d))/g;

// מפצל טקסט לרצף קטעים: { text, token: true } לאימייל/טלפון, { text, token: false } לשאר.
export function splitCopyable(text) {
  if (typeof text !== 'string' || !text) return [];
  return text
    .split(COPYABLE_RE)
    .map((part, i) => ({ text: part, token: i % 2 === 1 }))
    .filter((seg) => seg.text !== '');
}

async function writeClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // דפדפן/הקשר בלי הרשאת clipboard (למשל http): נפילה ל-execCommand.
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// תגית לחיצה שמעתיקה את הערך (אימייל/טלפון) ללוח.
export function CopyChip({ value }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (await writeClipboard(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <button
      type="button"
      className="chip"
      title={copied ? 'הועתק' : 'לחץ להעתקה'}
      onClick={onCopy}
      style={{ cursor: 'pointer', direction: 'ltr', unicodeBidi: 'isolate', margin: '0 4px', gap: 4 }}
    >
      <span>{value}</span>
      <svg className="icon" style={{ width: 14, height: 14 }}><use href={`#${copied ? 'i-check' : 'i-copy'}`} /></svg>
    </button>
  );
}

// מציג טקסט (או ערך תא בטבלה) כשאימייל/טלפון בתוכו מוחלפים בתגיות העתקה.
export function renderCopyable(value) {
  if (value === null || value === undefined) return value;
  const text = typeof value === 'string' ? value : null;
  if (text === null) return value;
  const segments = splitCopyable(text);
  if (!segments.some((s) => s.token)) return text;
  return segments.map((seg, i) => (seg.token ? <CopyChip key={i} value={seg.text.trim()} /> : <span key={i}>{seg.text}</span>));
}
