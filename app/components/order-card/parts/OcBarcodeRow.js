'use client';

// OcBarcodeRow — שורת הברקוד בשורת פריט פתוחה (R25/R26/R27, העיצוב: hv-r.hv-act "ברקוד" + שכבת הסקירה pv-bcin): שדה הזנת ברקוד
// (כמו בחלון "השכרה והחזרה") שמבצע השכרה לפריט ממתין / החזרה לפריט מושכר, "בטל השכרה", "בטל החזרה", ומצב החזרה תקין / לא תקין.
// פריט שהוחזר (הערת הבעלים 2026-10-05): בלי שדה ברקוד - צ׳יפ "הוחזרה · תאריך" + בורר תקין/לא תקין + "בטל החזרה" כפעולה משנית אחת.
// בלי "סמן כנלקחה/כנמסרה/כהוחזרה" ובלי קישור לכרטיס דגם (הערת הבעלים ל-R25). בהזמנה נעולה (R3): השכרה וביטול השכרה חסומים;
// החזרה, ביטול החזרה ומצב החזרה זמינים (כמו בישן :1023-1040).
// OcItemChooserDialog — "לאיזה פריט לשייך את הברקוד?" (MIM :1200-1255) כחלון כהה של הכרטיס.
import { useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { hasRepairOf, isPendingItem, itemBarcode, itemName, barcodePlaceholder, isItemReturned, dayTimeOf } from '../hooks/useItemActions';

const NO_FILL = { autoComplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };


export default function OcBarcodeRow({ item, actions, locked, ui }) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = isPendingItem(item);
  const ph = barcodePlaceholder(item, locked);
  const inputOff = busy || pending || isItemReturned(item) || (!item.isTaken && locked);
  const own = itemBarcode(item);
  const okCond = item.returnedOk !== false;
  const go = async (fn) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const submit = () => go(async () => {
    const v = val;
    const r = await actions.barcodeForItem(item, v);
    if (r && r.ok) setVal('');
  });
  const returned = isItemReturned(item);
  const when = returned && item.returnDate ? dayTimeOf(item.returnDate) : null;
  const badCond = () => go(async () => {
    if (!ui || item.returnedOk === false) return actions.setReturnCondition(item, false);
    const note = await ui.openDialog(OcCondBadDialog, { item });
    if (note === null || note === undefined) return null;
    return actions.setReturnCondition(item, false, { note });
  });
  // הערת הבעלים 2026-10-05: בפריט שהוחזר לא ברור אם ההחזרה הצליחה (שני לחצנים פעילים + שדה ברקוד). עכשיו: מצב אחד ברור - צ׳יפ "הוחזרה" עם התאריך,
  // בורר תקין / לא תקין (קבוצת רדיו אחת), ופעולה משנית אחת "בטל החזרה" (ghost). שדה הברקוד לא מוצג כלל לפריט שהוחזר. (המקור המאושר, R26/R27, הציג
  // שדה מנוטרל + שני לחצני tgl + "בטל החזרה" btn sm - הוחלף לבקשת הבעלים.)
  if (returned) {
    return (
      <div className="hv-r hv-act oc-bcrow oc-bcret" data-state="returned">
        <small>ברקוד</small>
        <b className="hv-btns">
          <span className={`chip ${okCond ? 'green' : 'amber'} oc-retchip`} role="status" data-act="returned-chip">
            <OcIcon name={okCond ? 'check' : 'alert'} size="sm" />{`הוחזרה${okCond ? '' : ' · לא תקין'}${when ? ` · ${when}` : ''}`}
          </span>
          <div className="seg pill oc-cond" role="radiogroup" aria-label="מצב ההחזרה" style={{ '--n': 2, '--i': okCond ? 0 : 1 }}>
            <span className="pth" aria-hidden="true" />
            <button type="button" role="radio" aria-checked={okCond} className={okCond ? 'on' : ''} data-act="cond-ok" disabled={busy} onClick={() => go(() => actions.setReturnCondition(item, true))}>
              <OcIcon name="check" size="sm" />תקין
            </button>
            <button type="button" role="radio" aria-checked={!okCond} className={okCond ? '' : 'on'} data-act="cond-bad" disabled={busy} onClick={badCond}>
              <OcIcon name="alert" size="sm" />לא תקין
            </button>
          </div>
          <button type="button" className="btn sm ghost" data-act="undoret" disabled={busy} onClick={() => go(() => actions.cancelReturn(item))}>
            <OcIcon name="undo" size="sm" />בטל החזרה
          </button>
          {own ? <span className="faint oc-bch">ברקוד <bdi dir="ltr">{own}</bdi></span> : null}
        </b>
      </div>
    );
  }
  return (
    <div className="hv-r hv-act oc-bcrow">
      <small>ברקוד</small>
      <b className="hv-btns">
        <div className="inpw oc-bcin">
          <OcIcon name="scan" size="sm" />
          <input
            className="inp"
            name="bc-nofill"
            inputMode="numeric"
            dir="ltr"
            value={val}
            placeholder={ph}
            aria-label={`ברקוד לפריט ${itemName(item)}: ${ph}`}
            disabled={inputOff}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submit(); } }}
            {...NO_FILL}
          />
        </div>
        {item.isTaken && !locked ? (
          <button type="button" className="btn sm" data-act="undorent" disabled={busy} onClick={() => go(() => actions.cancelRent(item))}>
            <OcIcon name="undo" size="sm" />בטל השכרה
          </button>
        ) : null}
        {own && !pending ? <span className="faint oc-bch">ברקוד <bdi dir="ltr">{own}</bdi></span> : null}
      </b>
    </div>
  );
}

// R27 "לא תקין": הערה שתתווסף לכרטיס הלקוח (העיצוב: WIN.condbad; הישן: customPrompt). ביטול = null (בלי שינוי).
export function OcCondBadDialog({ item, close }) {
  const [note, setNote] = useState('');
  return (
    <>
      <DlgHead id="oc-dlg-t" title="החזרה לא תקינה" sub={`דגם ${itemName(item)}${item.sizeText ? ` · מידה ${item.sizeText}` : ''}`} />
      <div className="mfld">
        <label className="lbl" htmlFor="oc-cond-note"><OcIcon name="note" size="sm" />הערה על הפריט (תתווסף לכרטיס הלקוח)</label>
        <textarea className="inp" id="oc-cond-note" rows={3} placeholder="מה לא תקין?" value={note} data-autofocus="true" onChange={(e) => setNote(e.target.value)} {...NO_FILL} />
      </div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" onClick={() => close(note)}>שמור הערה</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}

export function OcItemChooserDialog({ candidates = [], barcode, close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="לאיזה פריט לשייך את הברקוד?" sub="נמצאו מספר פריטים זהים בהזמנה שמתאימים לברקוד שנסרק — יש לבחור לאיזה פריט לשייך אותו:" />
      <div className="oc-bcval"><bdi dir="ltr">{barcode}</bdi></div>
      <div className="dbtns oc-choose" role="listbox" aria-label="פריטים מתאימים">
        {candidates.map((it, i) => (
          <button key={it.id || i} type="button" className="opt" role="option" aria-selected={false} onClick={() => close(it)}>
            <OcIcon name="dress" size="lg" />
            <div><b>דגם <bdi>{itemName(it)}</bdi> · מידה {it.sizeText || '-'}</b><small>{hasRepairOf(it) ? 'עם תיקון' : 'ללא תיקון'}</small></div>
          </button>
        ))}
      </div>
      <DlgButtons>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}
