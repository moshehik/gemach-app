'use client';

// OcSummaryDialog — D1 "סיכום" לפני שמירה (+R14: סה״כ לתשלום / שולם עד כה / יתרה). נפתח ע"י הבקר (slot SummaryDialog) כשההגדרה
// enable_order_edit_summary_confirm דולקת (נווה); בגמ"ח בלי ההגדרה אין חלון סיכום (כמו בישן). close(true) = להמשיך לשמירה, close(false) = חזרה לעריכה.
//
// מפת פורט: summaryDlg + בלוק r14 של שכבת הסקירה (תצוגות-עיצוב/כרטיס-הזמנה.html) ← חלון הסיכום של הישן (LegacyOrderPage.js:1605-1694).
// הלחצן הראשי נושא את התווית של הלחצן ברייל (תשלום / זיכוי / שמור; ביציאה "שמור וצא"). "בטל שינויים" של העיצוב לא כאן -
// הוא ברייל, והבקר מצפה ל-true|false בלבד (REQUESTS-W5 #2).

import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { Row, ChangeRow, NetBlock, Money } from './ocDialogParts';
import { summaryModel } from '../parts/ocRailLogic';

const PRIMARY = {
  pay: { icon: 'card', text: 'תשלום' },
  credit: { icon: 'undo', text: 'זיכוי' },
  save: { icon: 'check', text: 'שמור' },
  exit: { icon: 'check', text: 'שמור וצא' },
};

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
