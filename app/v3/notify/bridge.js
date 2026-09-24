// גשר תואם ל-PopupProvider.showAlert(message, type='info') - להפניית קריאות קיימות בהמשך בלי לגעת בעמודים.
import { enqueueNotice, SHORT_MS } from './store';

const KIND = { error: 'error', success: 'success', warn: 'warn', warning: 'warn', info: 'info' };

/** v3Toast(message, type?) או v3Toast({kind,title,text,href,persistToBell,durationMs}) */
export function v3Toast(message, type = 'info') {
  if (message && typeof message === 'object') return enqueueNotice({ durationMs: SHORT_MS, ...message });
  const kind = KIND[type] || 'info';
  const text = String(message ?? '');
  return enqueueNotice({ kind, title: text, durationMs: kind === 'error' ? 8000 : SHORT_MS, persistToBell: false });
}
export const v3Alert = v3Toast;   // חתימה זהה ל-showAlert

/** התראת שמירה + ניווט (R20): v3NoticeSaved({title,text,href}) ממש לפני router.push */
export function v3NoticeSaved(o) { return enqueueNotice({ kind: 'success', persistToBell: true, ...o }); }
