'use client';

// OcMissingEmail — חלון "כתובת מייל חסרה" (R6): כשאין ללקוח מייל תקין בכרטיס, לפני שליחת מייל (שליחה במייל / מייל השכרה / מייל מהיר).
// מבנה החלון כמו WIN.missmail בעיצוב (כותרת, הסבר, שדה "כתובת מייל", "שמור ושלח" + "ביטול"). שמירה = PUT /api/customers/:id (כמו הישן) + סנכרון
// ההזמנה בכרטיס (oc.patchOrder), ואז החלון נסגר עם הכתובת כדי שהקורא ימשיך לשליחה. הכתובת לא נשלחת לשום מקום אחר.
import { useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, DlgHead, Field, Inp } from '../OcUi';
import { saveCustomerEmail } from './ocDocsActions';
import { isValidEmail } from './ocDocsLogic';

export function OcMissingEmailDialog({ oc, initial = '', close, fetchImpl }) {
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    if (!isValidEmail(value)) { setMsg('כתובת המייל שהוזנה אינה תקינה.'); return; }
    setBusy(true);
    const r = await saveCustomerEmail({ oc, email: value, fetchImpl });
    setBusy(false);
    if (!r.ok) { setMsg(r.error || 'שמירת הכתובת נכשלה'); return; }
    close(r.email);
  };
  return (
    <>
      <DlgHead id="oc-dlg-t" title="כתובת מייל חסרה" sub="ללקוח זה לא מעודכנת כתובת מייל במערכת. אנא הזן כתובת מייל עדכנית לשליחת הדוח (תישמר אוטומטית בכרטיס הלקוח)." />
      <Field label="כתובת מייל" icon="mail" htmlFor="oc-miss-mail">
        <Inp id="oc-miss-mail" type="email" dir="ltr" placeholder="example@gmail.com" value={value} data-autofocus="true"
          onChange={(e) => { setValue(e.target.value); setMsg(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submit(); } }} />
      </Field>
      {msg ? <div className="amsg" role="alert"><OcIcon name="alert" size="sm" />{msg}</div> : null}
      <DlgButtons>
        <DlgBtn kind="primary" icon="send" disabled={busy} onClick={submit}>שמור ושלח</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}

/** כתובת מייל תקינה של לקוח ההזמנה: הקיימת, או (אחרי "כתובת מייל חסרה") החדשה שנשמרה. null = בוטל. */
export async function ensureCustomerEmail({ oc, ui, current }) {
  if (isValidEmail(current)) return String(current).trim();
  const saved = await ui.openDialog(OcMissingEmailDialog, { oc, initial: String(current || '') }, { labelledBy: 'oc-dlg-t' });
  return saved || null;
}
