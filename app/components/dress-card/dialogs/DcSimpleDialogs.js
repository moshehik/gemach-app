'use client';

// חלונות קטנים של כרטיס הדגם (כולם כהים, דרך OcUi): ביטול כל השינויים, "כרטיס הדגם נשמר", מחיקת דגם.
// הטקסטים והלחצנים לפי model-card.js (act: discard / successDlg / delete).
import { DlgBtn, DlgButtons, DlgHead } from '../../order-card/OcUi';
import { Tip } from '../DcParts';

/** close(true) = בטל; close(false) = חזרה לעריכה */
export function DcDiscardDialog({ count = 0, close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="לבטל את כל השינויים?" sub={count === 1 ? 'שינוי אחד יימחק' : `${count} שינויים יימחקו`} />
      <DlgButtons>
        <DlgBtn kind="primary" icon="trash" act="discard-close" autoFocus onClick={() => close(true)}>בטל שינויים</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close(false)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}

/** close('continue' | 'print' | 'list' | null) */
export function DcSuccessDialog({ sub, close }) {
  return (
    <div className="success">
      <div className="big-ck"><svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.500 4.500 4.500L19 7.500" /></svg></div>
      <h2 id="oc-dlg-t">כרטיס הדגם נשמר</h2>
      <div className="sub oc-success-sub">{sub}</div>
      <div className="oc-success-gap" />
      <DlgButtons>
        <DlgBtn kind="primary" icon="dress" act="close" autoFocus onClick={() => close('continue')}>המשך לצפות בכרטיס</DlgBtn>
        <DlgBtn icon="print" act="print-done" onClick={() => close('print')}>הדפסת כרטיס דגם</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close('list')}>לרשימת הדגמים</DlgBtn>
      </DlgButtons>
    </div>
  );
}

/** close(true) = מחק; close(false) = חזרה. activeCount = פריטים פעילים במלאי (השרת לא מאפשר מחיקה כשיש) */
export function DcDeleteDialog({ activeCount = 0, close }) {
  return (
    <>
      <DlgHead
        id="oc-dlg-t"
        title="מחיקת דגם"
        sub={<>הדגם יימחק <Tip text={`מחיקה רכה — ניתן לשחזר. לא ניתן למחוק דגם שיש בו פריטים פעילים במלאי (כרגע ${activeCount})`} /></>}
      />
      <DlgButtons>
        <DlgBtn kind="primary" icon="trash" act="delete-go" autoFocus onClick={() => close(true)}>מחק דגם</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close(false)}>חזרה</DlgBtn>
      </DlgButtons>
    </>
  );
}

/** close(true) = שחזר; close(false) = חזרה */
export function DcRestoreDialog({ close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="שחזור דגם" sub="הדגם יחזור לרשימת הדגמים" />
      <DlgButtons>
        <DlgBtn kind="primary" icon="refresh" autoFocus onClick={() => close(true)}>שחזר דגם</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close(false)}>חזרה</DlgBtn>
      </DlgButtons>
    </>
  );
}
