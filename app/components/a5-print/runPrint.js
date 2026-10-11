'use client';

// runPrint.js - עטיפה דקה שטוענת את התצוגה המקדימה רק בלחיצה (הקוד, ה-CSS ושורש ה-React של ההדפסה לא נכנסים ל-bundle הראשוני של המסך).
//   import { runPrint } from '../a5-print/runPrint';   ->   runPrint({ doc: 'models-list', kind, data: { rows, state, filters, statusText }, say })
// שגיאה בלתי צפויה = הודעת טוסט (say), לא חריגה לא מטופלת.
export async function runPrint(req) {
  try {
    const m = await import('./openPrintPreview');
    return await m.openPrintPreview(req);
  } catch (e) {
    if (req && req.say) req.say('פתיחת התצוגה המקדימה נכשלה', 'error', (e && e.message) || '');
    return { ok: false, reason: 'error' };
  }
}
