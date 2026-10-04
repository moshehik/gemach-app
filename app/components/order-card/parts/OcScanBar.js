'use client';

// OcScanBar — שורת הסריקה המהירה בשורת הכותרת (R42: גלויה, במרכז, מיושרת עם לחצני ההורדה; במסך צר שורה מלאה מתחת — המיקום
// ב-oc-base.css). התנהגות = הסריקה המהירה של הישן (ModernOrderCard.handleScanSubmit → LegacyOrderPage.handleQuickScan → MIM.scan):
// מעבר ללשונית פריטים, verify-item, rentals/scan לשמלה שבהשכרה אחרת, בחירת פריט כשיש כמה זהים, השכרה/החזרה (כולל 409 אי-התאמה /
// החזרה מוקדמת באישור מנהל). השדה מתאפס ונשאר בפוקוס אחרי כל סריקה — סריקה ברצף. #scanMsg (העיצוב) מציג את התוצאה לרגע.
// כש-enable_barcode_sequence_mode דלוק והוזרק SequencePanel (W2b) — הוא מוצג בתוך #sbar במקום השדה (REQUESTS-W3.md #4).
import { useEffect, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import useItemActions, { itemName } from '../hooks/useItemActions';
import { OcItemChooserDialog } from './OcBarcodeRow';

const MSG_MS = 2600;

export default function OcScanBar({ oc, ui, SequencePanel }) {
  const chooseItem = ({ candidates, barcode }) => ui.openDialog(OcItemChooserDialog, { candidates, barcode });
  const actions = useItemActions(oc, ui, { chooseItem });
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const inRef = useRef(null);
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), MSG_MS);
    return () => clearTimeout(t);
  }, [msg]);

  if (SequencePanel && oc.settings.enableBarcodeSequenceMode) {
    return <div className="sbar" id="sbar"><SequencePanel oc={oc} ui={ui} /></div>;
  }

  const submit = async () => {
    const code = val.trim();
    if (!code || busy) return;
    setVal('');
    setBusy(true);
    oc.setTab('items');
    try {
      const r = await actions.scan(code);
      if (r && r.ok) setMsg(`${r.kind === 'return' ? 'הוחזר' : 'הושכר'}: ${itemName(r.item)}`);
    } finally {
      setBusy(false);
      setTimeout(() => inRef.current && inRef.current.focus(), 0);
    }
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
