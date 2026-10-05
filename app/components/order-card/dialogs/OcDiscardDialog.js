'use client';

// OcDiscardDialog — D7 "לבטל את כל השינויים?" (slot DiscardDialog, close(true|false)) ו-D2 "שינויים שלא נשמרו" (slot ExitDialog, AMB-01:
// יציאה עם שינויים → close('save'|'discard'|null)). מפת פורט: case 'discard' בעיצוב; חלון שלוש הבחירות של handleExit הישן
// (LegacyOrderPage.js:1055+, customThreeWayConfirm) - R43 הסיר את הלחצן "חזור" הנפרד, החץ ליד הכותרת יוצא דרך D2 כשיש שינויים.

import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { ChangeRow } from './ocDialogParts';
import { discardSub, EXIT_ROWS_MAX } from '../parts/ocRailLogic';


// D7: בעיצוב אין רשימת שינויים בחלון - רק הספירה
export default function OcDiscardDialog({ changes = [], close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="לבטל את כל השינויים?" sub={discardSub(changes.length)} />
      <DlgButtons>
        <DlgBtn kind="primary" icon="undo" act="discard-close" autoFocus onClick={() => close(true)}>כן, בטל שינויים</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(false)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}

// D2: שמור / צא בלי לשמור / חזרה לעריכה. רשימת השינויים (עד EXIT_ROWS_MAX) באותו מבנה כמו הסיכום.
export function OcExitDialog({ changes = [], close }) {
  const shown = changes.slice(0, EXIT_ROWS_MAX);
  const rest = changes.length - shown.length;
  const showAmt = changes.filter((c) => c.amt).length > 1;
  return (
    <>
      <DlgHead id="oc-dlg-t" title="שינויים שלא נשמרו" sub="ישנם שינויים שלא נשמרו בהזמנה. לשמור אותם לפני היציאה?" />
      <div className="chg">
        {shown.map((c) => <ChangeRow key={c.key} c={c} showAmt={showAmt} />)}
        {rest > 0 ? <div className="c"><div className="t"><span className="faint sm">ועוד {rest} שינויים</span></div></div> : null}
      </div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" act="do-save" autoFocus onClick={() => close('save')}>שמור וצא</DlgBtn>
        <DlgBtn icon="x" act="exit-discard" onClick={() => close('discard')}>צא בלי לשמור</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(null)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}
