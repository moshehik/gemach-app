'use client';

// OcStockDialog — R48: חוסר במלאי (validate-inventory לפני שמירה, או 409 STOCK_SHORTAGE מהשרת - G12) עם רשימת החוסרים ורמז הציפוף.
// close(any) = חזרה לעריכה. מפת פורט: alert של validate-inventory (LegacyOrderPage.js:729-738) + WIN.stock בעיצוב.
// props: {message, lines:[{text, spacing}], spacingHint} (formatStockErrors ב-orderCardLogic).

import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { Row } from './ocDialogParts';

export const STOCK_LINE_NOTE = (spacing) => (spacing ? 'היחידה תפוסה בגלל ציפוף הימים' : 'אין יחידה פנויה בתאריך האירוע');
export const STOCK_HINT = 'רמז: ציפוף הימים בין הזמנות יכול לתפוס יחידה. בדקו “ציפוף ימים מיוחד” בפרטים מתקדמים.';

export default function OcStockDialog({ message, lines = [], spacingHint, close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="חוסר במלאי" sub={message || 'לא ניתן לשמור את ההזמנה עקב חוסר במלאי.'} />
      <div className="chg">
        {lines.map((l, i) => <Row key={i} icon="dress">{l.text}<div className="faint oc-sub">{STOCK_LINE_NOTE(l.spacing)}</div></Row>)}
      </div>
      {spacingHint ? <div className="faint oc-hint">{STOCK_HINT}</div> : null}
      <DlgButtons>
        <DlgBtn kind="primary" icon="pencil" autoFocus onClick={() => close(true)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}
