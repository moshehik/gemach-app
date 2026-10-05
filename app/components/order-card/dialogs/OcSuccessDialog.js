'use client';

// OcSuccessDialog — D6 "ההזמנה נשמרה" (A16/R10/R9/R44). נפתח ע"י הרייל אחרי שמירה שלא פתחה חלון גבייה, או אחרי שהחלון של W4 הסתיים בתשלום /
// השארת חוב. close('nav') = להמשיך ליעד (הזמנה חדשה או היעד שבהגדרה order_edit_redirect_screen), close('print') = הדפסה (R9), close('continue')
// / null = להישאר בכרטיס. בלי "לרשימה" (R10).
// מפת פורט: successDlg + act('new-order'|'print-done') בעיצוב (תצוגות-עיצוב/כרטיס-הזמנה.html); הכותרות לפי R10 (successHead ב-ocRailLogic).
// props: {head, orderId, customerName, targets} - targets מ-successTargets().

import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons } from '../OcUi';

export default function OcSuccessDialog({ head, orderId, customerName, targets, close }) {
  const primary = targets.primary;
  return (
    <div className="success">
      <div className="big-ck"><svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.500 4.500 4.500L19 7.500" /></svg></div>
      <h2 id="oc-dlg-t">{head}</h2>
      <div className="sub oc-success-sub">הזמנה <bdi>#{orderId}</bdi>{customerName ? ` · ${customerName}` : ''}</div>
      <div className="oc-success-gap" />
      <DlgButtons>
        <DlgBtn kind="primary" icon={primary.icon} act="new-order" autoFocus onClick={() => close(primary.key === 'continue' ? 'continue' : 'nav')}>{primary.label}</DlgBtn>
        <DlgBtn icon="print" act="print-done" onClick={() => close('print')}>הדפסה</DlgBtn>
        {targets.showContinue ? <DlgBtn kind="ghost" icon="file" onClick={() => close('continue')}>המשך לצפות בהזמנה</DlgBtn> : null}
      </DlgButtons>
    </div>
  );
}
