'use client';
// app/v3/strings/index.js — t()/useStrings (LIBRARY-MAP §3/§5, CONSTITUTION §ט.2).
// שכבות לפי עדיפות: override ארגוני (LabelsContext הקיים, /api/settings/labels)
// <- מילון v3 (he.js) <- מפתח חסר = מחרוזת שגיאה בולטת (לא נופל בשקט לאנגלית/undefined,
// כדי שמפתח שנשכח יתגלה מיד בגלריה/בפיתוח - C-9.2).
import { useLabels } from '@/app/components/LabelsContext';
import he from './he';

function format(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
}

/** t(key, params?, fallbackLabelsGetter?) - שימוש מחוץ ל-React (לא hook). */
export function t(key, params) {
  const base = he[key];
  if (base == null) {
    if (process.env.NODE_ENV !== 'production') return `[missing:${key}]`;
    return '';
  }
  return format(base, params);
}

/** useStrings() - hook: t(key, params) שמכבד גם override ארגוני מ-LabelsContext. */
export function useStrings() {
  const { getLabel } = useLabels(); // עובד גם בלי <LabelsProvider> (נופל ל-fallback, ראו LabelsContext.js)
  return {
    t: (key, params) => format(getLabel(key, he[key] ?? (process.env.NODE_ENV !== 'production' ? `[missing:${key}]` : '')), params),
  };
}

export { he as STRINGS_HE };
