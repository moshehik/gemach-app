// העלאת הקלטת מסך (וידאו) ישר לדרייב (צד לקוח בלבד) — לא עובר דרך Vercel ולא נשמר ב-Neon.
// 1. prepareScreenRecordingUpload — נקרא כבר בתחילת ההקלטה: /api/ai/recording/init פותח בשרת
//    העלאה resumable לדרייב ומחזיר session URI. הפנייה לגשר לוקחת כמה שניות (Apps Script), ובדרך הזו
//    ההמתנה מתרחשת בזמן שהמשתמש מסריט ולא אחרי שהוא סיים.
// 2. uploadScreenRecording — בסיום ההקלטה הדפדפן שולח את הקובץ ב-PUT יחיד ישר ל-Google, ומקבל
//    את מזהה הקובץ בדרייב (fileId); /api/ai מוריד אותו משם ומעביר ל-Gemini.
// כשהדרייב לא מוגדר בשרת — השגיאה נושאת code='DRIVE_NOT_CONFIGURED' והקורא ממשיך בלי וידאו.
export function prepareScreenRecordingUpload(purpose) {
  return (async () => {
    const res = await fetch('/api/ai/recording/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // purpose='error-report': דיווחי שגיאות פתוחים לכל מי שמורשה לדווח, גם בלי הרשאת AI
      body: JSON.stringify({ purpose: purpose || 'ai' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err.error || `init failed (${res.status})`);
      e.code = err.code;
      throw e;
    }
    const { sessionUri } = await res.json();
    return sessionUri;
  })();
}

export async function uploadScreenRecording(blob, preparedPromise) {
  const sessionUri = await (preparedPromise || prepareScreenRecordingUpload());
  const put = await fetch(sessionUri, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/webm' },
    body: blob,
  });
  if (!put.ok) throw new Error(`העלאה לדרייב נכשלה (${put.status})`);
  const meta = await put.json();
  if (!meta.id) throw new Error('הדרייב לא החזיר מזהה קובץ');
  return meta.id;
}
