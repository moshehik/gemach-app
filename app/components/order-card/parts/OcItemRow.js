'use client';

// OcItemRow — שורת פריט ברשימה (העיצוב: itemRow → article.hrow.irow > .li.rlink.lrow + .hdet > .hdet-in). לחיצה פותחת/סוגרת.
// בשורה הפתוחה (R26): פרטים (דגם, מידה, סטטוס, תיקון, אורך/פירוט כשתיקונים פעילים, מחיר, "פרטי הוספה" A11), שורת ברקוד
// (OcBarcodeRow: R25/R26/R27) ושורת "פרטים ועריכה": ⓘ פרטים והיסטוריה (R28) ו-📅 תפוסה (R29) — לחצני אייקון עגולים, "סמן תיקון
// בוצע", עריכה, הסרה. בלי קישור לכרטיס דגם (R30). שורת פריט מחוק: "שחזור" בלבד. פריט שטרם נשמר: "אישור" (POST) / הסרה.
import OcIcon from '../OcIcon';
import { fmtMoney, hebDateOf } from '../orderCardLogic';
import OcBarcodeRow from './OcBarcodeRow';
import { altText, addedAtOf, hasRepairOf, isLegacyItem, isPendingItem, israelTimeOf, itemName, itemPrice, statusText } from '../hooks/useItemActions';

export function addedText(item, order, creatorName) {
  const at = addedAtOf(item, order);
  const day = hebDateOf(at);
  const time = !isLegacyItem(item) && !isPendingItem(item) ? israelTimeOf(at) : '';
  return [day, time, creatorName].filter(Boolean).join(' · ') || '—';
}

export default function OcItemRow({ item, mode, oc, ui, actions, open, onToggle, locked, quotaFull, altEnabled, altShow, creatorName, onDetails, onCapacity, onEdit }) {
  const pending = isPendingItem(item);
  const key = item.id || item._localId;
  const status = statusText(item, oc.order, mode);
  const alt = altEnabled ? altText(item) : '';
  const hasAlt = hasRepairOf(item);
  const price = <bdi dir="ltr">{fmtMoney(itemPrice(item))}</bdi>;
  const detId = `det-${key}`;
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } };
  return (
    <article className={`hrow irow${pending || mode === 'del' ? ' pending' : ''}${open ? ' open' : ''}`} data-item={key}>
      <div className="li rlink lrow" role="button" tabIndex={0} data-act="opitem" aria-expanded={open} aria-controls={detId} onClick={onToggle} onKeyDown={onKey}>
        <div className="ic-b"><OcIcon name="dress" /><span className="rlbl">פריט</span></div>
        <div className="t">
          <b>דגם <bdi>{itemName(item)}</bdi> · מידה {item.sizeText || '—'}</b>
          <span className="ln">{status}{alt ? ` · ${alt}` : ''} · {price}</span>
        </div>
        <span className="go" aria-hidden="true"><OcIcon name="chev" size="sm" /></span>
      </div>
      <div className="hdet" id={detId}>
        <div className="hdet-in">
          <div className="hv-r"><small>דגם</small><b><bdi>{itemName(item)}</bdi></b></div>
          <div className="hv-r"><small>מידה</small><b>{item.sizeText || '—'}</b></div>
          <div className="hv-r"><small>סטטוס</small><b>{status}</b></div>
          {alt ? <div className="hv-r"><small>תיקון</small><b>{alt.replace('תיקון: ', '')}</b></div> : null}
          <div className="hv-r"><small>מחיר</small><b>{price}</b></div>
          <div className="hv-r"><small>פרטי הוספה</small><b>{addedText(item, oc.order, creatorName)}</b></div>
          {altEnabled && (hasAlt || altShow) ? (
            <>
              <div className="hv-r"><small>אורך</small><b>{item.lengthAlteration && String(item.lengthAlteration).trim() !== '' ? item.lengthAlteration : '—'}</b></div>
              <div className="hv-r"><small>פירוט</small><b>{item.alterationDetails || item.repairs || '—'}</b></div>
            </>
          ) : null}
          {mode === 'del' ? (
            <div className="hv-r hv-act">
              <small>פעולות</small>
              <b className="hv-btns">
                {!locked && !quotaFull ? (
                  <button type="button" className="btn sm" data-act="restore" onClick={() => actions.toggleDeleted(item)}><OcIcon name="undo" size="sm" />שחזור</button>
                ) : null}
              </b>
            </div>
          ) : (
            <>
              <OcBarcodeRow item={item} actions={actions} locked={locked} ui={ui} />
              <div className="hv-r hv-act">
                <small>פרטים ועריכה</small>
                <b className="hv-btns">
                  {pending ? (
                    <>
                      <button type="button" className="btn sm" data-act="confirmitem" onClick={() => actions.confirmItem(item)}><OcIcon name="check" size="sm" />אישור</button>
                      <button type="button" className="ibtn" data-act="rmitem" aria-label="הסרת פריט" data-tip="הסרת פריט" onClick={() => actions.toggleDeleted(item)}><OcIcon name="trash" size="sm" /></button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="ibtn" data-act="itemdet" aria-label="פרטים נוספים והיסטוריה" data-tip="פרטים נוספים והיסטוריה" onClick={onDetails}><OcIcon name="info" size="sm" /></button>
                      <button type="button" className="ibtn" data-act="cap" aria-label="בדוק תפוסה לתאריך אירוע" data-tip="בדוק תפוסה לתאריך אירוע" onClick={onCapacity}><OcIcon name="cal" size="sm" /></button>
                      {altEnabled && hasAlt && !locked ? (
                        <button type="button" className="btn sm" data-act="altdone" aria-pressed={!!item.alterationDone} onClick={() => actions.toggleAltDone(item)}>
                          <OcIcon name="check" size="sm" />{item.alterationDone ? 'בטל סימון תיקון' : 'סמן תיקון בוצע'}
                        </button>
                      ) : null}
                      {!item.isTaken && !locked ? (
                        <>
                          <button type="button" className="ibtn" data-act="edititem" aria-label="עריכת פריט" data-tip="עריכת פריט" onClick={onEdit}><OcIcon name="pencil" size="sm" /></button>
                          <button type="button" className="ibtn" data-act="rmitem" aria-label="הסרת פריט" data-tip="הסרת פריט" onClick={() => actions.toggleDeleted(item)}><OcIcon name="trash" size="sm" /></button>
                        </>
                      ) : null}
                    </>
                  )}
                </b>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
