'use client';

// OcBarcodeRow — שורת הברקוד בשורת פריט פתוחה (R25/R26/R27, העיצוב: hv-r.hv-act "ברקוד" + שכבת הסקירה pv-bcin): שדה הזנת ברקוד
// (כמו בחלון "השכרה והחזרה") שמבצע השכרה לפריט ממתין / החזרה לפריט מושכר, "בטל השכרה", "בטל החזרה", ומצב החזרה תקין / לא תקין.
// בלי "סמן כנלקחה/כנמסרה/כהוחזרה" ובלי קישור לכרטיס דגם (הערת הבעלים ל-R25). בהזמנה נעולה (R3): השכרה וביטול השכרה חסומים;
// החזרה, ביטול החזרה ומצב החזרה זמינים (כמו בישן :1023-1040).
// OcItemChooserDialog — "לאיזה פריט לשייך את הברקוד?" (MIM :1200-1255) כחלון כהה של הכרטיס.
import { useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { hasRepairOf, isPendingItem, itemBarcode, itemName } from '../hooks/useItemActions';

const NO_FILL = { autoComplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };

export function barcodePlaceholder(item, locked) {
  if (isPendingItem(item)) return 'יש לשמור קודם';
  if (item.isReturned) return 'הפריט הוחזר';
  if (item.isTaken) return 'סרקו ברקוד להחזרה';
  return locked ? 'ההזמנה נעולה' : 'סרקו ברקוד להשכרה';
}

export default function OcBarcodeRow({ item, actions, locked }) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = isPendingItem(item);
  const ph = barcodePlaceholder(item, locked);
  const inputOff = busy || pending || item.isReturned || (!item.isTaken && locked);
  const own = itemBarcode(item);
  const okCond = item.returnedOk !== false;
  const go = async (fn) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const submit = () => go(async () => {
    const v = val;
    const r = await actions.barcodeForItem(item, v);
    if (r && r.ok) setVal('');
  });
  return (
    <div className="hv-r hv-act oc-bcrow">
      <small>ברקוד</small>
      <b className="hv-btns">
        <div className="inpw bcin">
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
        {item.isReturned ? (
          <>
            <button type="button" className={`btn sm tgl${okCond ? ' on' : ''}`} data-act="cond-ok" aria-pressed={okCond} disabled={busy} onClick={() => go(() => actions.setReturnCondition(item, true))}>
              <OcIcon name="check" size="sm" />תקין
            </button>
            <button type="button" className={`btn sm tgl${okCond ? '' : ' on'}`} data-act="cond-bad" aria-pressed={!okCond} disabled={busy} onClick={() => go(() => actions.setReturnCondition(item, false))}>
              <OcIcon name="alert" size="sm" />לא תקין
            </button>
          </>
        ) : null}
        {item.isTaken && !item.isReturned && !locked ? (
          <button type="button" className="btn sm" data-act="undorent" disabled={busy} onClick={() => go(() => actions.cancelRent(item))}>
            <OcIcon name="undo" size="sm" />בטל השכרה
          </button>
        ) : null}
        {item.isReturned ? (
          <button type="button" className="btn sm" data-act="undoret" disabled={busy} onClick={() => go(() => actions.cancelReturn(item))}>
            <OcIcon name="undo" size="sm" />בטל החזרה
          </button>
        ) : null}
        {own && !pending ? <span className="faint bch">ברקוד <bdi dir="ltr">{own}</bdi></span> : null}
      </b>
    </div>
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
