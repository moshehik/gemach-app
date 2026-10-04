'use client';

// OcConflictDialog — R12: 409 "ההזמנה עודכנה בשרת" בחלון פלטה עם שלוש בחירות במקום confirm() של הדפדפן:
// 'overwrite' (שמור בכל זאת ודרוס) / 'reload' (טען מחדש מהשרת - השינויים שלא נשמרו יאבדו) / null (חזרה לעריכה).
// מפת פורט: putOrder 409 (LegacyOrderPage.js:589-595: confirm → אישור = overwriteConflict, ביטול = reloadOrderFromServer) + WIN.conflict בשכבת
// הסקירה של העיצוב (ההחלטה: שלוש בחירות). חוסר מלאי (STOCK_SHORTAGE) לא מגיע לכאן - ר' OcStockDialog.

import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { Row } from './ocDialogParts';

export default function OcConflictDialog({ message, close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="ההזמנה עודכנה בשרת" sub={message || 'ההזמנה עודכנה בשרת מאז הטעינה האחרונה של הכרטיס.'} />
      <div className="chg">
        <Row icon="check">“שמור בכל זאת” דורס את הגרסה שבשרת</Row>
        <Row icon="refresh">“טען מחדש” מחזיר את נתוני השרת. השינויים שלא נשמרו יאבדו</Row>
      </div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" onClick={() => close('overwrite')}>שמור בכל זאת ולדרוס</DlgBtn>
        <DlgBtn icon="refresh" onClick={() => close('reload')}>לטעון מחדש מהשרת</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(null)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}
