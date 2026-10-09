'use client';

// הערת שגיאת חישוב המחיר. שורת חיוב המשלוח בשלבי הפריטים / התשלום והלחצן "הוסף / עריכת משלוח" הוסרו (בקשת הבעלים 9.10.2026) -
// המשלוח נערך ומוצג רק בשלב המשלוח ובסיכום.
import { Ic } from './NoUi';

// סקירה 6.10.2026: חישוב המחיר נכשל (רשת / שרת) - הסכום לא ידוע, שמירה וחיוב חסומים עד "נסה שוב"
export function CalcErrorNote({ ctl }) {
  if (!ctl.calcError) return null;
  return (
    <div className="empty" role="alert" style={{ textAlign: 'start', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 12 }}>
      <span><Ic n="alert" c="sm" /> חישוב המחיר נכשל. לא ניתן לשמור הזמנה או לחייב עד שהחישוב יצליח.</span>
      <button type="button" className="btn sm" onClick={ctl.retryCalc}><Ic n="refresh" c="sm" />נסה שוב</button>
    </div>
  );
}
