'use client';

// OcPaymentDetails — R37 "פרטי תשלום מלאים" (WIN.paydet בעיצוב + MPM :1242-1301): אופן תשלום, סכום, תאריך עברי ושעה, ופירוט ההערות
// (נתוני נדרים מפוענחים לשורות, או טקסט). "מחק תשלום" מחזיר 'delete' - הקורא מאשר ומסמן isDeleted מקומית (נשמר ב-PUT, בלי PIN כמו
// היום - AMB-22).
// props: {payment, canDelete (רק לשורה ששמורה בשרת - !!p.id), close} ; close: 'delete' | null

import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons } from '../OcUi';
import { fmtMoney, hebDateOf } from '../orderCardLogic';
import { formatIsraelHHMM } from '@/lib/loginFlow';
import { amountOf, parsePaymentNotes } from '../hooks/usePaymentActions';

const Row = ({ label, children, ltr }) => (
  <div className="c">
    <div className="t">{label}</div>
    <div className="amt z">{ltr ? <bdi dir="ltr">{children}</bdi> : children}</div>
  </div>
);

export default function OcPaymentDetails({ payment: p, canDelete = false, close }) {
  const amount = amountOf(p.amount);
  const notes = parsePaymentNotes(p.notes);
  const when = [hebDateOf(p.paymentDate), formatIsraelHHMM(p.paymentDate)].filter(Boolean).join(' · ');
  return (
    <>
      <h2 id="oc-paydet-t">פרטי תשלום מלאים</h2>
      <div className="chg">
        <Row label="אופן תשלום">{p.paymentMethod || '-'}</Row>
        <Row label="סכום" ltr>{amount < 0 ? `−${fmtMoney(amount)}` : fmtMoney(amount)}</Row>
        <Row label="תאריך">{when || '-'}</Row>
      </div>
      <div className="mfld">
        <span className="lbl"><OcIcon name="note" size="sm" />הערות ופירוט (נדרים פלוס / אחר)</span>
        {notes.kind === 'kv' ? (
          <div className="chg oc-notes">{notes.rows.map(([k, v]) => <Row key={k} label={k} ltr>{v}</Row>)}</div>
        ) : notes.kind === 'text' ? (
          <div className="faint oc-notes-t">{notes.text}</div>
        ) : <div className="faint oc-notes-t">אין הערות</div>}
      </div>
      <DlgButtons>
        {canDelete ? <DlgBtn icon="trash" act="paydel" onClick={() => close('delete')}>מחק תשלום</DlgBtn> : null}
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>סגירה</DlgBtn>
      </DlgButtons>
    </>
  );
}
