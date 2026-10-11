'use client';

// DcSummaryDialog - חלון הסיכום לפני שמירה ("סיכום") וחלון היציאה עם שינויים ("שינויים שלא נשמרו") של כרטיס הדגם.
// summaryDlg(from) בעיצוב המאושר (model-card.js): רשימת השינויים (אייקון בריבוע 38px + טקסט + פירוט), ואז שלושה לחצנים:
// שמור / (צא בלי לשמור | בטל שינויים) / חזרה לעריכה. close('save' | 'discard' | null).
import { DlgBtn, DlgButtons, DlgHead } from '../../order-card/OcUi';
import OcIcon from '../../order-card/OcIcon';
import { Segs } from '../DcParts';

export default function DcSummaryDialog({ mode = 'save', changes = [], close }) {
  const exit = mode === 'exit';
  return (
    <>
      <DlgHead id="oc-dlg-t" title={exit ? 'שינויים שלא נשמרו' : 'סיכום'} />
      <div className="chg">
        {changes.map((c) => (
          <div className="c" key={c.k}>
            <div className="ico gray oc-cico"><OcIcon name={c.icon} size="sm" /></div>
            <div className="t"><Segs parts={c.text} />{c.note ? <div className="faint sm">{c.note}</div> : null}</div>
          </div>
        ))}
      </div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" act="do-save" autoFocus onClick={() => close('save')}>שמור</DlgBtn>
        {exit
          ? <DlgBtn icon="x" act="leave-nosave" onClick={() => close('discard')}>צא בלי לשמור</DlgBtn>
          : <DlgBtn icon="undo" act="discard-close" onClick={() => close('discard')}>בטל שינויים</DlgBtn>}
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(null)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}
