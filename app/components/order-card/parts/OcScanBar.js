'use client';

// OcScanBar — שורת הסריקה המהירה בשורת הכותרת (R42: גלויה, במרכז, מיושרת עם לחצני ההורדה; במסך צר שורה מלאה מתחת — המיקום
// ב-oc-base.css). התנהגות = הסריקה המהירה של הישן (ModernOrderCard.handleScanSubmit → LegacyOrderPage.handleQuickScan → MIM.scan):
// מעבר ללשונית פריטים, verify-item, rentals/scan לשמלה שבהשכרה אחרת, בחירת פריט כשיש כמה זהים, השכרה/החזרה (כולל 409 אי-התאמה /
// החזרה מוקדמת באישור מנהל). השדה מתאפס ונשאר בפוקוס אחרי כל סריקה — סריקה ברצף. #scanMsg (העיצוב) מציג את התוצאה לרגע.
// כש-enable_barcode_sequence_mode דלוק והוזרק SequencePanel (W2b) — הוא מוצג בתוך #sbar במקום השדה (REQUESTS-W3.md #4).
import { useEffect, useMemo, useRef, useState } from 'react';
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
  // תור הסריקות מחזיק מצב בין רינדורים (actions ו-setTab יציבים; setBusy/setMsg יציבים מטבעם)
  const setTab = oc.setTab;
  const queue = useMemo(() => createScanQueue(async (code) => {
    setTab('items');
    const r = await actions.scan(code);
    if (r && r.ok) setMsg(`${r.kind === 'return' ? 'הוחזר' : 'הושכר'}: ${itemName(r.item)}`);
  }, (b) => {
    setBusy(b);
    if (!b) setTimeout(() => { const el = document.getElementById('scanIn'); if (el) el.focus(); }, 0);
  }), [actions, setTab]);
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
