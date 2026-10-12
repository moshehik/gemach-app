'use client';

// DcScanBar - שורת הסריקה בכותרת כרטיס הדגם (העיצוב: #sbar > .inpw > svg.ic + input#scanIn + #scanMsg.chip). מאתרת פריט של הדגם הזה לפי ברקוד
// (ברקוד מלא, או הסיומת מידה+סידורי) - מעבירה ללשונית "פריטים", מנקה סינון, פותחת את פירוט השורה ומדגישה אותה. אין השכרה/החזרה כאן (זה כרטיס מלאי).
// שוויון עם הישן: ModernDressItemsTab highlightBarcode - איתור, הדגשה וגלילה; "לא נמצא" כשהברקוד לא בדגם.
import { useEffect, useRef, useState } from 'react';
import OcIcon from '../order-card/OcIcon';
import { bcFor, scanMatch } from '@/lib/dressCardLogic';

const MSG_MS = 2600;

export default function DcScanBar({ dc }) {
  const [val, setVal] = useState('');
  const [msg, setMsg] = useState(null); // {text, cls}
  const inRef = useRef(null);
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), MSG_MS);
    return () => clearTimeout(t);
  }, [msg]);
  const submit = () => {
    const code = val.trim();
    if (!code) return;
    const it = scanMatch(dc.cur.items, dc.prefix, code);
    if (it) {
      dc.locateItem(it.id);
      setMsg({ text: `${it.del ? 'מחוק · ' : ''}${bcFor(it, dc.prefix)} · מידה ${it.size}`, cls: it.del ? 'amber' : 'green' });
    } else setMsg({ text: 'לא נמצא בדגם', cls: 'red' });
    setVal('');
    if (inRef.current) inRef.current.focus();
  };
  return (
    <div className="sbar" id="sbar" data-guide-id="dc.scan">
      <div className="inpw">
        <OcIcon name="scan" />
        <input
          ref={inRef}
          className="inp"
          id="scanIn"
          name="barcode-nofill"
          inputMode="numeric"
          placeholder="ברקוד: סרקו או הקלידו..."
          aria-label="סריקת ברקוד של פריט בדגם"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submit(); } }}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
        />
        {msg ? <span id="scanMsg" className={`chip ${msg.cls}`} role="status" style={{ display: 'inline-flex' }}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
