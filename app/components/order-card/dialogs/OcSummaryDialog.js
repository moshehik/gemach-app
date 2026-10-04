'use client';

// OcSummaryDialog — D1 "סיכום" לפני שמירה (+R14: סה״כ לתשלום / שולם עד כה / יתרה). נפתח ע"י הבקר (slot SummaryDialog) כשההגדרה
// enable_order_edit_summary_confirm דולקת (נווה); בגמ"ח בלי ההגדרה אין חלון סיכום (כמו בישן). close(true) = להמשיך לשמירה, close(false) = חזרה לעריכה.
//
// מפת פורט: summaryDlg + בלוק r14 של שכבת הסקירה (תצוגות-עיצוב/כרטיס-הזמנה.html) ← חלון הסיכום של הישן (LegacyOrderPage.js:1605-1694).
// הלחצן הראשי נושא את התווית של הלחצן ברייל (תשלום / זיכוי / שמור; ביציאה "שמור וצא"). "בטל שינויים" של העיצוב לא כאן -
// הוא ברייל, והבקר מצפה ל-true|false בלבד (REQUESTS-W5 #2).

import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { Row, ChangeRow, NetBlock, Money } from './ocDialogParts';

const PRIMARY = {
  pay: { icon: 'card', text: 'תשלום' },
  credit: { icon: 'undo', text: 'זיכוי' },
  save: { icon: 'check', text: 'שמור' },
  exit: { icon: 'check', text: 'שמור וצא' },
};

/** נתוני החלון (טהור, נבדק ב-node): שורות הכסף של R14 ובלוק הסכום */
export function summaryModel({ changes = [], totalRequired = 0, totalPaid = 0, pendingNet }) {
  const required = Math.round((Number(totalRequired) || 0) * 100) / 100;
  const paid = Math.round((Number(totalPaid) || 0) * 100) / 100;
  const balance = Math.round((required - paid) * 100) / 100;
  // pendingNet (חיוב/זיכוי ממתין) אם הבקר מעביר; אחרת היתרה אחרי השמירה (שם הסכום לתשלום)
  const net = pendingNet !== undefined && pendingNet !== null ? Number(pendingNet) : balance;
  const showAmt = changes.filter((c) => c.amt).length > 1;
  const balanceLabel = balance > 0 ? 'יתרה לתשלום' : 'יתרת זכות / מאוזן';
  return { required, paid, balance, net, showAmt, balanceLabel };
}

export default function OcSummaryDialog({ intent = 'save', changes = [], totalRequired = 0, totalPaid = 0, pendingNet, close }) {
  const m = summaryModel({ changes, totalRequired, totalPaid, pendingNet });
  const p = PRIMARY[intent] || PRIMARY.save;
  return (
    <>
      <DlgHead id="oc-dlg-t" title="סיכום" />
      <div className="chg">{changes.map((c) => <ChangeRow key={c.key} c={c} showAmt={m.showAmt} />)}</div>
      <div className="chg" data-oc="r14">
        <Row amt={<Money n={m.required} />}>סה״כ לתשלום</Row>
        <Row amt={<Money n={m.paid} />}>שולם עד כה</Row>
        <Row amt={<Money n={Math.abs(m.balance)} />}>{m.balanceLabel}</Row>
      </div>
      <NetBlock net={m.net} />
      <DlgButtons>
        <DlgBtn kind="primary" icon={p.icon} act="do-save" autoFocus onClick={() => close(true)}>{p.text}</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(false)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}
