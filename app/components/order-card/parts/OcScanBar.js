'use client';

// OcScanBar — שורת הסריקה המהירה בשורת הכותרת (R42: גלויה, במרכז, מיושרת עם לחצני ההורדה; במסך צר שורה מלאה מתחת — המיקום
// ב-oc-base.css). התנהגות = הסריקה המהירה של הישן (ModernOrderCard.handleScanSubmit → LegacyOrderPage.handleQuickScan → MIM.scan):
// מעבר ללשונית פריטים, verify-item, rentals/scan לשמלה שבהשכרה אחרת, בחירת פריט כשיש כמה זהים, השכרה/החזרה (כולל 409 אי-התאמה /
// החזרה מוקדמת באישור מנהל). השדה מתאפס ונשאר בפוקוס אחרי כל סריקה — סריקה ברצף. #scanMsg (העיצוב) מציג את התוצאה לרגע.
// כש-enable_barcode_sequence_mode דלוק והוזרק SequencePanel (W2b) — הוא מוצג בתוך #sbar במקום השדה (REQUESTS-W3.md #4).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import useItemActions, { createScanQueue, itemName } from '../hooks/useItemActions';
import { OcItemChooserDialog } from './OcBarcodeRow';

const MSG_MS = 2600;

export default function OcScanBar({ oc, ui, SequencePanel }) {
  const chooseItem = ({ candidates, barcode }) => ui.openDialog(OcItemChooserDialog, { candidates, barcode });
  const actions = useItemActions(oc, ui, { chooseItem });
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const inRef = useRef(null);
  // תור הסריקות נוצר פעם אחת לאורך חיי הרכיב (דגל ה-busy והרשימה הממתינה חיים בתוכו) ופועל מול ה-actions העדכניים דרך ref - אובייקט
  // actions של ה-hook יכול להשתנות בין רינדורים, ויצירת תור חדש בכל רינדור איבדה את הדגל (סריקה שנייה רצה במקביל לראשונה; C3)
  const actionsRef = useRef(actions);
  const setTabRef = useRef(oc.setTab);
  useLayoutEffect(() => { actionsRef.current = actions; setTabRef.current = oc.setTab; });
  const queueRef = useRef(null);
  if (!queueRef.current) {
    queueRef.current = createScanQueue(async (code) => {
      setTabRef.current('items');
      const r = await actionsRef.current.scan(code);
      if (r && r.ok) setMsg(`${r.kind === 'return' ? 'הוחזר' : 'הושכר'}: ${itemName(r.item)}`);
    }, (b) => {
      setBusy(b);
      if (!b) setTimeout(() => { const el = document.getElementById('scanIn'); if (el) el.focus(); }, 0);
    });
  }
  const queue = queueRef.current;
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), MSG_MS);
    return () => clearTimeout(t);
  }, [msg]);

  if (SequencePanel && oc.settings.enableBarcodeSequenceMode) {
    return <div className="sbar" id="sbar"><SequencePanel oc={oc} ui={ui} /></div>;
  }

  // סריקה שנייה בזמן שהראשונה רצה: השדה מתנקה מיד (הסריקה הבאה לא מצטרפת לטקסט ישן) והקוד נכנס לתור (createScanQueue)
  const submit = () => {
    const code = val.trim();
    if (!code) return;
    setVal('');
    queue.push(code);
  };

  return (
    <div className="sbar" id="sbar">
      <div className="inpw">
        <OcIcon name="scan" />
        <input
          ref={inRef}
          className="inp"
          id="scanIn"
          name="barcode-nofill"
          inputMode="numeric"
          placeholder="ברקוד: סרקו או הקלידו..."
          aria-label="הקלדת ברקוד — השכרה / החזרה"
          aria-busy={busy}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submit(); } }}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
        />
        {msg ? <span id="scanMsg" className="chip green" role="status">{msg}</span> : null}
      </div>
    </div>
  );
}
